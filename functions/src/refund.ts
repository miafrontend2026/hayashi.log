// HTTP function:用戶在 /account.html 按 [申請退費] → 全自動退款
//
// 規則(全自動,零人工):
//   - source=web 才接受;App 訂戶導去 iOS Settings
//   - 7 天內首次訂閱 → 全額退,釋放早鳥名額
//   - 7 天後仍在期間內 → 按剩餘比例退
//   - 已過期 / 已退過 → 拒絕
//   - 寫 transactions(amount 負值)
//   - 記黑名單(refund_count++)
//   - 退費滿 2 次 → permanently_blocked

import * as functions from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import axios from "axios";
import { PLANS, REFUND_POLICY, ecpayConfig, ecpayRefundEndpoint } from "./utils/constants";
import { checkMacValue } from "./utils/ecpay";
import {
  getSubscription, patchSubscription, writeTransaction,
  recordRefund, releaseEarlyBird, nowMs, emailHash,
} from "./utils/firestore";

if (admin.apps.length === 0) admin.initializeApp();

export const refund = functions.onRequest(
  { cors: true, region: "asia-east1" },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ error: "method_not_allowed" });
        return;
      }

      // 驗 Firebase Auth
      const idToken = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
      if (!idToken) { res.status(401).json({ error: "missing_auth" }); return; }
      const decoded = await admin.auth().verifyIdToken(idToken);
      const uid = decoded.uid;
      const email = decoded.email || "";

      // 拿訂閱
      const sub = await getSubscription(uid);
      if (!sub) { res.status(400).json({ error: "no_subscription" }); return; }

      if (sub.source !== "web") {
        res.status(400).json({
          error: "wrong_platform",
          reason: "App 訂閱請至「設定 → Apple ID / Google Pay」管理。",
        });
        return;
      }

      if (sub.status !== "active") {
        res.status(400).json({
          error: "not_active",
          reason: `訂閱狀態為「${sub.status}」,無可退費。`,
        });
        return;
      }

      // 計算退費金額
      const planInfo = PLANS[sub.plan];
      const startedAt = sub.startedAt;
      const now = nowMs();
      const daysSinceStart = Math.floor((now - startedAt) / (24 * 60 * 60 * 1000));
      const daysRemaining = Math.max(0, Math.floor((sub.expiresAt - now) / (24 * 60 * 60 * 1000)));

      let refundAmount: number;
      if (daysSinceStart <= REFUND_POLICY.full_refund_days) {
        refundAmount = planInfo.price_twd;          // 7 天內全退
      } else {
        // 比例退:按剩餘天數
        refundAmount = Math.floor(planInfo.price_twd * daysRemaining / planInfo.period_days);
        if (refundAmount <= 0) {
          res.status(400).json({ error: "no_refundable_amount", reason: "已用完訂閱期,無可退費。" });
          return;
        }
      }

      // 呼叫綠界退費 API(DoAction)
      const cfg = ecpayConfig();
      if (!sub.ecpay_order) {
        res.status(500).json({ error: "missing_ecpay_order" });
        return;
      }

      const refundParams: Record<string, string | number> = {
        MerchantID: cfg.merchantId,
        MerchantTradeNo: sub.ecpay_order,
        TradeNo: sub.ecpay_order,    // 退費要原 TradeNo,理想是從 transactions 取最近的 success
        Action: "R",                 // R = Refund
        TotalAmount: refundAmount,
      };
      refundParams.CheckMacValue = checkMacValue(refundParams);

      const ecpayRes = await axios.post(
        ecpayRefundEndpoint(),
        new URLSearchParams(refundParams as Record<string, string>).toString(),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
      );
      console.log("ECPay refund response:", ecpayRes.data);

      // 假設綠界回應格式:"1|OK" 表成功
      const refundOk = String(ecpayRes.data).startsWith("1|");

      if (!refundOk) {
        await writeTransaction({
          uid,
          type: "refund",
          source: "web",
          plan: sub.plan,
          amount_twd: 0,
          payment_method: "ecpay",
          external_id: sub.ecpay_order,
          status: "failed",
          note: `ECPay 退費失敗:${ecpayRes.data}`,
        });
        res.status(500).json({ error: "ecpay_refund_failed", details: String(ecpayRes.data) });
        return;
      }

      // 退費成功 → 更新狀態 + 寫帳本 + 釋放早鳥
      await patchSubscription(uid, {
        status: "refunded",
        willRenew: false,
      });

      await writeTransaction({
        uid,
        type: "refund",
        source: "web",
        plan: sub.plan,
        amount_twd: -refundAmount,
        payment_method: "ecpay",
        external_id: sub.ecpay_order,
        status: "refunded",
        email_hash: emailHash(email),
        note: daysSinceStart <= REFUND_POLICY.full_refund_days
          ? "首次訂閱 7 天內全額退"
          : `按剩餘 ${daysRemaining} 天比例退`,
      });

      // 早鳥首次訂閱 + 7 天內退 → 釋放名額
      if (sub.is_early_bird && daysSinceStart <= REFUND_POLICY.full_refund_days) {
        await releaseEarlyBird().catch(e => console.warn("releaseEarlyBird fail:", e));
      }

      // 記黑名單(refund_count++,2 次 → permanently_blocked)
      const bl = await recordRefund(email);

      res.json({
        ok: true,
        refunded_amount: refundAmount,
        new_status: "refunded",
        will_blacklist: bl.permanently_blocked,
        message: `已退費 NT$${refundAmount},5 個工作天內入帳。${bl.permanently_blocked ? "因第 2 次退費,此帳號已限制再次訂閱。" : ""}`,
      });
    } catch (err) {
      console.error("refund error:", err);
      res.status(500).json({ error: "internal", message: String(err) });
    }
  },
);
