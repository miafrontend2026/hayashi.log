// HTTP function:RevenueCat webhook(App IAP 訂閱事件)
//
// RevenueCat doc: https://www.revenuecat.com/docs/webhooks
//
// 事件類型:INITIAL_PURCHASE / RENEWAL / CANCELLATION / EXPIRATION / BILLING_ISSUE
// 跨平台共存:這裡寫入的 subscription.source = "app",網頁端讀同一份 Firestore doc。
//
// 部署完才接通,Apple Dev / Play Console 核准 + RevenueCat 連好後設 webhook URL。

import * as functions from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { PLANS, PlanKey } from "./utils/constants";
import {
  writeSubscription, writeTransaction, getSubscription,
  patchSubscription, nowMs, plusDays, tryReserveEarlyBird, SubscriptionDoc,
} from "./utils/firestore";

if (admin.apps.length === 0) admin.initializeApp();

const REVENUECAT_AUTH_HEADER = process.env.REVENUECAT_WEBHOOK_SECRET || "";

export const revenuecatWebhook = functions.onRequest(
  { region: "asia-east1" },
  async (req, res) => {
    try {
      // 驗 RevenueCat shared secret(設定在 RevenueCat dashboard webhook config)
      const auth = req.headers.authorization || "";
      if (REVENUECAT_AUTH_HEADER && auth !== `Bearer ${REVENUECAT_AUTH_HEADER}`) {
        res.status(401).send("unauthorized");
        return;
      }

      const event = req.body?.event;
      if (!event) { res.status(400).send("missing event"); return; }

      const uid = event.app_user_id;   // RevenueCat SDK logIn(uid) 設的
      const productId = event.product_id as string;
      const type = event.type as string;

      console.log("RevenueCat event:", { type, uid, productId });

      if (!uid) { res.status(400).send("missing app_user_id"); return; }

      // product_id 映射到 plan
      const plan = mapProductIdToPlan(productId);
      if (!plan) {
        console.warn("Unknown product_id:", productId);
        res.status(200).send("ok (unknown product)");
        return;
      }

      const planInfo = PLANS[plan];
      const existingSub = await getSubscription(uid);

      switch (type) {
        case "INITIAL_PURCHASE":
        case "RENEWAL": {
          let isEarlyBird = false;
          if (plan === "yearly_early_bird" && type === "INITIAL_PURCHASE") {
            isEarlyBird = await tryReserveEarlyBird();
          } else if (plan === "yearly_early_bird") {
            isEarlyBird = existingSub?.is_early_bird === true;
          }
          const newSub: SubscriptionDoc = {
            source: "app",
            plan,
            status: "active",
            expiresAt: plusDays(nowMs(), planInfo.period_days),
            willRenew: true,
            startedAt: existingSub?.startedAt || nowMs(),
            apple_txn: event.transaction_id,
            is_early_bird: isEarlyBird || existingSub?.is_early_bird === true,
            failed_retries: 0,
          };
          await writeSubscription(uid, newSub);

          await writeTransaction({
            uid,
            type: type === "INITIAL_PURCHASE" ? "subscribe" : "renew",
            source: "app",
            plan,
            amount_twd: planInfo.price_twd,
            payment_method: event.store === "PLAY_STORE" ? "google_billing" : "apple_iap",
            external_id: event.transaction_id || event.original_transaction_id,
            status: "success",
            note: `RevenueCat ${type}`,
          });
          break;
        }

        case "CANCELLATION": {
          if (existingSub) {
            await patchSubscription(uid, { willRenew: false });
          }
          await writeTransaction({
            uid,
            type: "cancel",
            source: "app",
            plan,
            amount_twd: 0,
            payment_method: event.store === "PLAY_STORE" ? "google_billing" : "apple_iap",
            external_id: event.transaction_id || "",
            status: "success",
            note: "User cancelled (will run until expiresAt)",
          });
          break;
        }

        case "EXPIRATION": {
          await patchSubscription(uid, { status: "expired", willRenew: false });
          await writeTransaction({
            uid,
            type: "fail",
            source: "app",
            plan,
            amount_twd: 0,
            payment_method: event.store === "PLAY_STORE" ? "google_billing" : "apple_iap",
            external_id: event.transaction_id || "",
            status: "failed",
            note: "Subscription expired",
          });
          break;
        }

        case "BILLING_ISSUE": {
          await patchSubscription(uid, {
            failed_retries: (existingSub?.failed_retries || 0) + 1,
            last_retry_at: nowMs(),
          });
          await writeTransaction({
            uid,
            type: "fail",
            source: "app",
            plan,
            amount_twd: 0,
            payment_method: event.store === "PLAY_STORE" ? "google_billing" : "apple_iap",
            external_id: event.transaction_id || "",
            status: "failed",
            note: "Billing issue (card expired / insufficient funds)",
          });
          break;
        }

        default:
          console.log("Unhandled RevenueCat event type:", type);
      }

      res.status(200).send("ok");
    } catch (err) {
      console.error("revenuecatWebhook error:", err);
      res.status(500).send("internal");
    }
  },
);

function mapProductIdToPlan(productId: string): PlanKey | null {
  // Product IDs 定義在 stayjp-app/src/lib/subscription.ts:PLANS
  // App Store Connect / Play Console 上要建這些 product
  const map: Record<string, PlanKey> = {
    "com.stayjp.app.monthly": "monthly",
    "stayjp_monthly": "monthly",
    "com.stayjp.app.yearly": "yearly",
    "stayjp_yearly": "yearly",
    "com.stayjp.app.yearly_early_bird": "yearly_early_bird",
    "stayjp_yearly_early_bird": "yearly_early_bird",
  };
  return map[productId] ?? null;
}
