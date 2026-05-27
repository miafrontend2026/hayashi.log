// HTTP function:綠界 chargeback 通知 → 自動同意 + email 黑名單
//
// 副業策略:不爭執,直接認賠 + ban 該 email 永久。
// 跟銀行打官司不值得時間。

import * as functions from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { verifyCheckMacValue } from "./utils/ecpay";
import {
  writeTransaction, getSubscription, patchSubscription, recordChargeback,
} from "./utils/firestore";

if (admin.apps.length === 0) admin.initializeApp();

export const chargeback = functions.onRequest(
  { region: "asia-east1" },
  async (req, res) => {
    try {
      const body = req.body as Record<string, string>;
      console.log("Chargeback notification:", JSON.stringify(body));

      if (!verifyCheckMacValue(body)) {
        res.status(400).send("0|CheckMacValue Fail");
        return;
      }

      const uid = body.CustomField1 || "";
      const tradeNo = body.TradeNo;

      // 找對應用戶,取 email
      let email = "";
      if (uid) {
        try {
          const userRecord = await admin.auth().getUser(uid);
          email = userRecord.email || "";
        } catch (e) {
          console.warn("Failed to lookup user email for chargeback:", uid, e);
        }
      }

      // 寫帳本
      await writeTransaction({
        uid,
        type: "chargeback",
        source: "web",
        plan: "n/a",
        amount_twd: -Number(body.TradeAmt || 0),
        payment_method: "ecpay",
        external_id: tradeNo || "",
        status: "refunded",
        note: `Chargeback - ${body.RtnMsg || "no reason"}`,
      });

      // 黑名單
      if (email) await recordChargeback(email);

      // subscription 立刻降級
      const sub = await getSubscription(uid);
      if (sub) {
        await patchSubscription(uid, {
          status: "refunded",
          willRenew: false,
        });
      }

      res.status(200).send("1|OK");
    } catch (err) {
      console.error("chargeback error:", err);
      res.status(500).send("0|Internal Error");
    }
  },
);
