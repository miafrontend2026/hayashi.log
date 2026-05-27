// HTTP function:前端 [訂閱] 按鈕呼叫 → 回傳 ECPay 結帳 URL + 表單參數
//
// 流程:
//   1. 驗證 Firebase Auth token(從前端 idToken)
//   2. precheck:不能重複訂、不能黑名單、確認允許的 plan
//   3. 寫 transaction(status: pending)當預單號
//   4. 組綠界 AioCheckOut 表單 + CheckMacValue
//   5. 回傳 { endpoint, params } 給前端 → 前端 auto-submit POST 到綠界

import * as functions from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { PLANS, PlanKey, ecpayConfig, ecpayEndpoint } from "./utils/constants";
import { checkMacValue, ecpayDateTimeTW, generateMerchantTradeNo } from "./utils/ecpay";
import {
  precheckSubscribe, writeTransaction, emailHash,
} from "./utils/firestore";

if (admin.apps.length === 0) admin.initializeApp();

export const createPayment = functions.onRequest(
  { cors: true, region: "asia-east1" },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ error: "method_not_allowed" });
        return;
      }

      // ── 1. 驗證 Firebase Auth ──
      const idToken = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
      if (!idToken) { res.status(401).json({ error: "missing_auth" }); return; }
      const decoded = await admin.auth().verifyIdToken(idToken);
      const uid = decoded.uid;
      const email = decoded.email || "";
      if (!email) { res.status(400).json({ error: "missing_email" }); return; }

      // ── 2. precheck ──
      const plan = (req.body?.plan || "") as PlanKey;
      if (!PLANS[plan]) { res.status(400).json({ error: "invalid_plan", plan }); return; }

      const check = await precheckSubscribe(uid, email);
      if (!check.ok) { res.status(403).json({ error: "precheck_failed", reason: check.reason }); return; }
      if (!check.allowed_plans?.includes(plan)) {
        res.status(403).json({
          error: "plan_not_allowed",
          reason: plan === "yearly_early_bird"
            ? "早期鳥名額已滿或您不符合資格,請改選一般年費 / 月費。"
            : "此方案目前不開放。",
          allowed_plans: check.allowed_plans,
        });
        return;
      }

      // ── 3. 寫 pending transaction ──
      const merchantTradeNo = generateMerchantTradeNo();
      const planInfo = PLANS[plan];
      await writeTransaction({
        uid,
        type: "subscribe",
        source: "web",
        plan,
        amount_twd: planInfo.price_twd,
        payment_method: "ecpay",
        external_id: merchantTradeNo,
        status: "pending",
        email_hash: emailHash(email),
        note: "等待 ECPay 扣款 callback",
      });

      // ── 4. 組綠界表單 ──
      const cfg = ecpayConfig();
      const params: Record<string, string | number> = {
        MerchantID: cfg.merchantId,
        MerchantTradeNo: merchantTradeNo,
        MerchantTradeDate: ecpayDateTimeTW(),
        PaymentType: "aio",
        TotalAmount: planInfo.price_twd,
        TradeDesc: encodeURIComponent("StayJP Premium 訂閱"),
        ItemName: `StayJP Premium ${planInfo.display_name}`,
        ChoosePayment: "ALL",
        EncryptType: 1,
        // ── 通知 URL ──
        ReturnURL: `${cfg.siteOrigin.replace(/^https?:\/\//, "https://")}/api/ecpay-callback`,
        // ↑ ReturnURL 必須是 server-to-server callback,不是 user 看的頁
        OrderResultURL: `${cfg.siteOrigin}/account.html?from=ecpay`,
        ClientBackURL: `${cfg.siteOrigin}/pricing.html`,
        // ── 自訂帶回(callback 用來識別)──
        CustomField1: uid,
        CustomField2: plan,
      };

      // 定期定額(訂閱制)— lifetime 不設,單次付款
      if (plan === "monthly") {
        params.PeriodAmount = planInfo.price_twd;
        params.PeriodType = "M";
        params.Frequency = 1;
        params.ExecTimes = 99;     // 上限 99 期月費(綠界限制)
        params.PeriodReturnURL = `${cfg.siteOrigin}/api/ecpay-callback`;
      } else if (plan === "yearly" || plan === "yearly_early_bird") {
        params.PeriodAmount = planInfo.price_twd;
        params.PeriodType = "Y";
        params.Frequency = 1;
        params.ExecTimes = 99;
        params.PeriodReturnURL = `${cfg.siteOrigin}/api/ecpay-callback`;
      }
      // lifetime:不設 Period* 欄位,綠界當一次性付款處理

      // ── 5. 算 CheckMacValue ──
      params.CheckMacValue = checkMacValue(params);

      res.json({
        endpoint: ecpayEndpoint(),
        params,
        merchantTradeNo,
      });
    } catch (err) {
      console.error("createPayment error:", err);
      res.status(500).json({ error: "internal", message: String(err) });
    }
  },
);
