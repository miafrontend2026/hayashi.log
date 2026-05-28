// HTTP function:用戶按 [申請退費] → 全自動退款
//
// 修正版(2026-05-28):
//   - 用 TradeNo 而非 MerchantTradeNo(從最近一筆 success transaction 取)
//   - 退費對「最近一筆 charge」做,不是 plan 總金額
//   - lifetime 7 天後完全不退(memory 規則)
//   - 綠界退費失敗 → Firestore 不更新狀態,避免錢沒退但用戶降級
//
// 規則:
//   - source=web 才接受;App 訂戶導去 iOS Settings
//   - 7 天內首次訂閱 → 全額退,釋放早鳥名額
//   - 7 天後仍在期間內(非 lifetime)→ 按剩餘比例退最近一筆 charge
//   - lifetime 7 天後 → 拒絕
//   - 已過期 / 已退過 → 拒絕

import * as functions from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import axios from "axios";
import { PLANS, REFUND_POLICY, ecpayConfig, ecpayRefundEndpoint } from "./utils/constants";
import { checkMacValue } from "./utils/ecpay";
import {
  getSubscription, patchSubscription, writeTransaction,
  recordRefund, releaseEarlyBird, getLatestSuccessTradeNo, nowMs, emailHash,
} from "./utils/firestore";

if (admin.apps.length === 0) admin.initializeApp();

export const refund = functions.onRequest(
  {
    cors: true,
    region: "asia-east1",
    invoker: "public",
    maxInstances: 5,
    timeoutSeconds: 120,
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
      const email = decoded.email || "";

      const sub = await getSubscription(uid);
      if (!sub) { res.status(400).json({ error: "no_subscription" }); return; }

      if (sub.source !== "web") {
        res.status(400).json({
          error: "wrong_platform",
          reason: "App 訂閱請至「設定 → Apple ID / Google Pay」管理。",
        });
        return;
      }

      if (sub.status !== "active" && sub.status !== "cancelled") {
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
      let refundReason: string;

      if (sub.plan === "lifetime") {
        // Lifetime 7 天內全退,7 天後拒絕(memory 規則)
        if (daysSinceStart <= REFUND_POLICY.full_refund_days) {
          refundAmount = planInfo.price_twd;
          refundReason = "終身方案 7 天內全額退";
        } else {
          res.status(400).json({
            error: "lifetime_no_refund",
            reason: "終身方案超過 7 天視為已使用,無可退費。",
          });
          return;
        }
      } else if (daysSinceStart <= REFUND_POLICY.full_refund_days) {
        // 一般訂閱 7 天內 全退
        refundAmount = planInfo.price_twd;
        refundReason = "首次訂閱 7 天內全額退";
      } else {
        // 一般訂閱 7 天後 按剩餘比例退
        refundAmount = Math.floor(planInfo.price_twd * daysRemaining / planInfo.period_days);
        refundReason = `按剩餘 ${daysRemaining} 天比例退`;
        if (refundAmount <= 0) {
          res.status(400).json({ error: "no_refundable_amount", reason: "已用完訂閱期,無可退費。" });
          return;
        }
      }

      // 拿最近一筆 success transaction 的 TradeNo(綠界產的交易編號)
      const tradeNo = await getLatestSuccessTradeNo(uid);
      if (!tradeNo) {
        res.status(500).json({ error: "missing_trade_no", reason: "找不到對應的扣款交易,請聯絡客服。" });
        return;
      }
      if (!sub.ecpay_order) {
        res.status(500).json({ error: "missing_ecpay_order" });
        return;
      }

      // 呼叫綠界退費 API(DoAction Action=R)
      const cfg = ecpayConfig();
      const refundParams: Record<string, string | number> = {
        MerchantID: cfg.merchantId,
        MerchantTradeNo: sub.ecpay_order,
        TradeNo: tradeNo,                  // ← 必須是 ECPay TradeNo 不是 MerchantTradeNo
        Action: "R",                       // R = Refund
        TotalAmount: refundAmount,
      };
      refundParams.CheckMacValue = checkMacValue(refundParams);

      let ecpayMsg = "";
      let refundOk = false;
      try {
        const ecpayRes = await axios.post(
          ecpayRefundEndpoint(),
          new URLSearchParams(refundParams as Record<string, string>).toString(),
          { headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: 30000 },
        );
        ecpayMsg = String(ecpayRes.data);
        console.log("ECPay refund response:", ecpayMsg);
        // 綠界 DoAction 回應格式:RtnCode=1 為成功
        refundOk = /RtnCode=1\b/.test(ecpayMsg);
      } catch (e) {
        ecpayMsg = String(e);
        console.error("ECPay refund call failed:", e);
      }

      if (!refundOk) {
        // 綠界退費失敗 → 不要更新 Firestore,避免錢沒退用戶降級
        await writeTransaction({
          uid,
          type: "refund",
          source: "web",
          plan: sub.plan,
          amount_twd: 0,
          payment_method: "ecpay",
          external_id: tradeNo,
          status: "failed",
          note: `ECPay refund failed: ${ecpayMsg}`,
        });
        res.status(500).json({
          error: "ecpay_refund_failed",
          reason: "綠界退費失敗,請聯絡客服處理。",
          ecpay_response: ecpayMsg,
        });
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
        external_id: tradeNo,
        status: "refunded",
        email_hash: emailHash(email),
        note: refundReason,
      });

      // 早鳥首次訂閱 + 7 天內全退 → 釋放名額(讓下一個 user 可以買早鳥)
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
