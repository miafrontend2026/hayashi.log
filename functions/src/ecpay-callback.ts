// HTTP function:綠界 ECPay server-to-server callback
//
// 觸發時機:
//   - 首次訂閱扣款成功
//   - 每期續扣成功(綠界定期定額)
//   - 扣款失敗
//
// 流程:
//   1. 驗 CheckMacValue
//   2. 從 CustomField1/2 拿回 uid + plan
//   3. 根據 RtnCode 判斷成功 / 失敗
//   4. 成功 → 更新 subscription.status=active + expiresAt + 寫 transaction(success)
//      + 早鳥名額 +1(如果是 yearly_early_bird 且首次)
//   5. 失敗 → 寫 transaction(failed)+ 觸發 retry 計數(由 daily-retry-cron 接手)
//   6. 回應綠界 "1|OK"(成功)或 "0|Error"

import * as functions from "firebase-functions/v2/https";
import { PLANS, PlanKey } from "./utils/constants";
import { verifyCheckMacValue } from "./utils/ecpay";
import {
  writeTransaction, getSubscription, writeSubscription, patchSubscription,
  tryReserveEarlyBird, nowMs, plusDays, SubscriptionDoc,
} from "./utils/firestore";

export const ecpayCallback = functions.onRequest(
  { region: "asia-east1" },
  async (req, res) => {
    try {
      // ECPay 是 x-www-form-urlencoded POST
      const body = req.body as Record<string, string>;
      console.log("ECPay callback received:", JSON.stringify(body));

      // 1. 驗 CheckMacValue
      if (!verifyCheckMacValue(body)) {
        console.error("CheckMacValue mismatch");
        res.status(400).send("0|CheckMacValue Fail");
        return;
      }

      // 2. 拿 uid + plan
      const uid  = body.CustomField1 || "";
      const plan = (body.CustomField2 || "") as PlanKey;
      if (!uid || !PLANS[plan]) {
        console.error("Missing CustomField:", { uid, plan });
        res.status(400).send("0|Missing CustomField");
        return;
      }

      const merchantTradeNo = body.MerchantTradeNo;
      const tradeNo         = body.TradeNo;
      const amount          = Number(body.TradeAmt || PLANS[plan].price_twd);
      const rtnCode         = String(body.RtnCode || "0");
      const rtnMsg          = body.RtnMsg || "";
      const isSuccess       = rtnCode === "1";

      // 3. 寫帳本
      const existingSub = await getSubscription(uid);
      const isFirstPayment = !existingSub || existingSub.status !== "active";

      if (isSuccess) {
        const planInfo = PLANS[plan];

        // 早鳥首次訂閱 → 占名額
        let isEarlyBird = false;
        if (plan === "yearly_early_bird" && isFirstPayment) {
          const reserved = await tryReserveEarlyBird();
          if (!reserved) {
            // 已滿,改一般年費價格 — 不應發生因為 precheck 已擋,但防禦性處理
            console.warn("Early bird full but ECPay charged, falling back to yearly", { uid });
          }
          isEarlyBird = reserved;
        } else if (plan === "yearly_early_bird") {
          // 續扣早鳥(原本就有 is_early_bird flag)
          isEarlyBird = existingSub?.is_early_bird === true;
        }

        // 寫 / 更新 subscription
        const newExpiresAt = plusDays(nowMs(), planInfo.period_days);
        const newSub: SubscriptionDoc = {
          source: "web",
          plan,
          status: "active",
          expiresAt: existingSub?.status === "active"
            ? plusDays(existingSub.expiresAt, planInfo.period_days)   // 續扣:加一期
            : newExpiresAt,
          willRenew: true,
          startedAt: existingSub?.startedAt || nowMs(),
          ecpay_order: merchantTradeNo,
          is_early_bird: isEarlyBird || existingSub?.is_early_bird === true,
          failed_retries: 0,   // 成功歸零
        };
        await writeSubscription(uid, newSub);

        // 寫 transaction
        await writeTransaction({
          uid,
          type: isFirstPayment ? "subscribe" : "renew",
          source: "web",
          plan,
          amount_twd: amount,
          payment_method: "ecpay",
          external_id: tradeNo || merchantTradeNo,
          status: "success",
          invoice_no: body.InvoiceNo || undefined,
          note: rtnMsg,
        });

        console.log("✓ ECPay payment success", { uid, plan, amount, isFirstPayment });
      } else {
        // 扣款失敗
        await writeTransaction({
          uid,
          type: "fail",
          source: "web",
          plan,
          amount_twd: amount,
          payment_method: "ecpay",
          external_id: tradeNo || merchantTradeNo,
          status: "failed",
          note: `RtnCode=${rtnCode} ${rtnMsg}`,
        });

        // retry 計數 +1(daily-retry-cron 會根據這個值決定何時 retry)
        if (existingSub) {
          await patchSubscription(uid, {
            failed_retries: (existingSub.failed_retries || 0) + 1,
            last_retry_at: nowMs(),
          });
        }

        console.warn("✗ ECPay payment failed", { uid, plan, rtnCode, rtnMsg });
      }

      // 4. 回應綠界(這個格式很重要,綠界看到 "1|OK" 才不會 retry)
      res.status(200).send("1|OK");
    } catch (err) {
      console.error("ecpayCallback error:", err);
      res.status(500).send("0|Internal Error");
    }
  },
);
