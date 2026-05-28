// HTTP function:用戶按 [關閉自動續訂] → 通知綠界停止定期定額
//
// 修正版(2026-05-28):
//   - 用對 API:PeriodAction Action=CancelRevoke(不是 DoAction Action=N)
//   - 用 MerchantTradeNo(不是 TradeNo)— PeriodAction 用 MerchantTradeNo
//   - lifetime 跳過 ECPay 呼叫(沒定期定額,只是一次性付款)

import * as functions from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import axios from "axios";
import { ecpayConfig, ecpayPeriodActionEndpoint } from "./utils/constants";
import { checkMacValue } from "./utils/ecpay";
import { getSubscription, patchSubscription, writeTransaction } from "./utils/firestore";

if (admin.apps.length === 0) admin.initializeApp();

export const cancelSubscription = functions.onRequest(
  {
    cors: true,
    region: "asia-east1",
    invoker: "public",
    maxInstances: 5,
    timeoutSeconds: 60,
    memory: "256MiB",
    concurrency: 40,
  },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ error: "method_not_allowed" });
        return;
      }

      const idToken = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
      if (!idToken) { res.status(401).json({ error: "missing_auth" }); return; }
      const decoded = await admin.auth().verifyIdToken(idToken);
      const uid = decoded.uid;

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
          error: "already_cancelled",
          reason: `訂閱狀態為「${sub.status}」,無需取消。`,
        });
        return;
      }

      // lifetime:沒定期定額,跳過綠界,只更新 Firestore
      const isRecurring = sub.plan !== "lifetime";

      let ecpayOk = true;
      let ecpayMsg = "";

      if (isRecurring && sub.ecpay_order) {
        // 停止定期定額:CreditCardPeriodAction Action=CancelRevoke
        // 用 MerchantTradeNo(原訂單號,不是 TradeNo)
        const cfg = ecpayConfig();
        const params: Record<string, string | number> = {
          MerchantID: cfg.merchantId,
          MerchantTradeNo: sub.ecpay_order,
          Action: "CancelRevoke",
          TimeStamp: Math.floor(Date.now() / 1000),
        };
        params.CheckMacValue = checkMacValue(params);

        try {
          const ecpayRes = await axios.post(
            ecpayPeriodActionEndpoint(),
            new URLSearchParams(params as Record<string, string>).toString(),
            { headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: 15000 },
          );
          ecpayMsg = String(ecpayRes.data);
          console.log("ECPay PeriodAction CancelRevoke response:", ecpayMsg);
          // 綠界回應格式:RtnCode=1 為成功
          ecpayOk = /RtnCode=1\b/.test(ecpayMsg);
        } catch (e) {
          ecpayOk = false;
          ecpayMsg = String(e);
          console.error("ECPay PeriodAction call failed:", e);
        }
      }

      if (isRecurring && !ecpayOk) {
        // 綠界 cancel API 失敗 → 不要更新 Firestore,避免兩邊狀態不一致
        await writeTransaction({
          uid,
          type: "cancel",
          source: "web",
          plan: sub.plan,
          amount_twd: 0,
          payment_method: "ecpay",
          external_id: sub.ecpay_order || "",
          status: "failed",
          note: `ECPay PeriodAction CancelRevoke failed: ${ecpayMsg}`,
        });
        res.status(500).json({
          error: "ecpay_cancel_failed",
          reason: "綠界端取消失敗,請稍後再試或聯絡客服。",
          ecpay_response: ecpayMsg,
        });
        return;
      }

      // 更新 Firestore — willRenew=false,status="cancelled"
      // expiresAt 不變,讓 user 用到當期到期日
      await patchSubscription(uid, {
        willRenew: false,
        status: "cancelled",
      });

      await writeTransaction({
        uid,
        type: "cancel",
        source: "web",
        plan: sub.plan,
        amount_twd: 0,
        payment_method: "ecpay",
        external_id: sub.ecpay_order || "",
        status: "success",
        note: `ECPay: ${ecpayMsg || "lifetime - no recurring to cancel"}`,
      });

      const expiresDate = new Date(sub.expiresAt).toLocaleDateString("zh-TW");
      res.json({
        ok: true,
        message: `已關閉自動續訂,可繼續使用至 ${expiresDate}。`,
        new_status: "cancelled",
        expires_at: sub.expiresAt,
      });
    } catch (err) {
      console.error("cancelSubscription error:", err);
      res.status(500).json({ error: "internal", message: String(err) });
    }
  },
);
