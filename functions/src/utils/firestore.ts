// Firestore 寫入 helpers — 訂閱 / 交易 / 早鳥計數 / blacklist
//
// 跨平台共存原則:
//   - subscription.source ∈ {"web","app"} 區分平台
//   - 同 uid 只能有一筆 active subscription (precheck 擋重複)
//   - 退費 / 取消 / chargeback 都會把 status 改掉,讓另一邊重新可以訂

import * as admin from "firebase-admin";
import crypto from "crypto";
import {
  EARLY_BIRD_LIMIT,
  PlanKey,
  Source,
  SubStatus,
  REFUND_POLICY,
} from "./constants";

if (admin.apps.length === 0) admin.initializeApp();
export const db = admin.firestore();
export const FieldValue = admin.firestore.FieldValue;

// ───── helpers ─────────────────────────────────────────────────────────

export function emailHash(email: string): string {
  return crypto.createHash("sha256").update(email.toLowerCase().trim()).digest("hex").slice(0, 16);
}

export function nowMs(): number {
  return Date.now();
}

export function plusDays(ms: number, days: number): number {
  return ms + days * 24 * 60 * 60 * 1000;
}

// ───── subscription r/w ────────────────────────────────────────────────

export interface SubscriptionDoc {
  source: Source;
  plan: PlanKey;
  status: SubStatus;
  expiresAt: number;
  willRenew: boolean;
  startedAt: number;
  ecpay_order?: string;
  apple_txn?: string;
  google_txn?: string;
  is_early_bird?: boolean;
  refund_requested_at?: admin.firestore.Timestamp;
  failed_retries?: number;
  last_retry_at?: number;
}

export async function getSubscription(uid: string): Promise<SubscriptionDoc | null> {
  const snap = await db.doc(`users/${uid}`).get();
  return (snap.data()?.subscription as SubscriptionDoc) || null;
}

export async function writeSubscription(uid: string, sub: SubscriptionDoc): Promise<void> {
  await db.doc(`users/${uid}`).set({ subscription: sub }, { merge: true });
}

export async function patchSubscription(
  uid: string,
  patch: Partial<SubscriptionDoc>,
): Promise<void> {
  const updates: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    updates[`subscription.${k}`] = v;
  }
  await db.doc(`users/${uid}`).update(updates);
}

/**
 * 取最近一筆成功 charge transaction(subscribe / renew),回傳 ECPay TradeNo。
 * 退費 / cancel 用這個,不能用 subscription.ecpay_order(那是 MerchantTradeNo)。
 */
export async function getLatestSuccessTradeNo(uid: string): Promise<string | null> {
  const snap = await db.collection("transactions")
    .where("uid", "==", uid)
    .where("status", "==", "success")
    .where("type", "in", ["subscribe", "renew"])
    .orderBy("occurred_at", "desc")
    .limit(1)
    .get();
  if (snap.empty) return null;
  return (snap.docs[0].data().external_id as string) || null;
}

// ───── transactions (append-only 帳本) ──────────────────────────────────

export type TxnType =
  | "subscribe" | "renew" | "cancel" | "refund"
  | "fail" | "chargeback" | "gift";

export interface TransactionDoc {
  uid: string;
  type: TxnType;
  source: Source;
  plan: PlanKey | "n/a";
  amount_twd: number;          // 正數 = 收入,負數 = 退費
  occurred_at: admin.firestore.Timestamp;
  payment_method: "ecpay" | "apple_iap" | "google_billing" | "manual";
  external_id: string;
  status: "success" | "pending" | "failed" | "refunded";
  invoice_no?: string;
  note?: string;
  email_hash?: string;         // 防薅羊毛追蹤
}

export async function writeTransaction(txn: Omit<TransactionDoc, "occurred_at">): Promise<string> {
  const ref = db.collection("transactions").doc();
  await ref.set({
    ...txn,
    occurred_at: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

// ───── 早鳥計數器(atomic transaction)─────────────────────────────────

export async function tryReserveEarlyBird(): Promise<boolean> {
  return db.runTransaction(async tx => {
    const ref = db.doc("counters/early_bird");
    const snap = await tx.get(ref);
    const count = (snap.data()?.count as number) || 0;
    if (count >= EARLY_BIRD_LIMIT) return false;
    tx.set(ref, {
      count: count + 1,
      limit: EARLY_BIRD_LIMIT,
      updated_at: FieldValue.serverTimestamp(),
    }, { merge: true });
    return true;
  });
}

export async function releaseEarlyBird(): Promise<void> {
  await db.doc("counters/early_bird").update({
    count: FieldValue.increment(-1),
    updated_at: FieldValue.serverTimestamp(),
  });
}

export async function getEarlyBirdCount(): Promise<{ count: number; limit: number }> {
  const snap = await db.doc("counters/early_bird").get();
  return {
    count: (snap.data()?.count as number) || 0,
    limit: EARLY_BIRD_LIMIT,
  };
}

// ───── 黑名單(email + cardHash 退費紀錄)──────────────────────────────

export interface BlacklistDoc {
  email_hash: string;
  refund_count: number;
  chargeback_count: number;
  permanently_blocked: boolean;
  first_refund_at?: admin.firestore.Timestamp;
  last_event_at: admin.firestore.Timestamp;
  reason?: string;
}

export async function getBlacklist(email: string): Promise<BlacklistDoc | null> {
  const hash = emailHash(email);
  const snap = await db.doc(`blacklist/${hash}`).get();
  return snap.exists ? (snap.data() as BlacklistDoc) : null;
}

export async function recordRefund(email: string, reason = "user_refund"): Promise<BlacklistDoc> {
  const hash = emailHash(email);
  const ref = db.doc(`blacklist/${hash}`);
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const cur = (snap.data() as BlacklistDoc | undefined) ?? {
      email_hash: hash,
      refund_count: 0,
      chargeback_count: 0,
      permanently_blocked: false,
      last_event_at: admin.firestore.Timestamp.now(),
    };
    const newCount = cur.refund_count + 1;
    const next: BlacklistDoc = {
      ...cur,
      email_hash: hash,
      refund_count: newCount,
      permanently_blocked: cur.permanently_blocked
        || newCount >= REFUND_POLICY.blacklist_after_refunds,
      first_refund_at: cur.first_refund_at || admin.firestore.Timestamp.now(),
      last_event_at: admin.firestore.Timestamp.now(),
      reason,
    };
    tx.set(ref, next);
    return next;
  });
}

export async function recordChargeback(email: string): Promise<void> {
  const hash = emailHash(email);
  const ref = db.doc(`blacklist/${hash}`);
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const cur = (snap.data() as BlacklistDoc | undefined) ?? {
      email_hash: hash,
      refund_count: 0,
      chargeback_count: 0,
      permanently_blocked: false,
      last_event_at: admin.firestore.Timestamp.now(),
    };
    tx.set(ref, {
      ...cur,
      email_hash: hash,
      chargeback_count: cur.chargeback_count + 1,
      permanently_blocked: true,  // chargeback 一次就永久 ban
      last_event_at: admin.firestore.Timestamp.now(),
      reason: "chargeback",
    });
  });
}

// ───── 訂閱前檢查 ─────────────────────────────────────────────────────

export interface PrecheckResult {
  ok: boolean;
  reason?: string;
  allowed_plans?: PlanKey[];   // 不能享早鳥就只列 monthly/yearly
}

/**
 * 訂閱前 precheck:
 * - 同 uid 已有 active 訂閱 → 拒絕(防雙平台重複訂)
 * - email 在黑名單 permanently_blocked → 拒絕
 * - email 退費 1+ 次 → 排除 early_bird plan
 * - 早鳥名額用完 → 排除 early_bird
 */
export async function precheckSubscribe(uid: string, email: string): Promise<PrecheckResult> {
  // 1. 已有 active 訂閱?
  const sub = await getSubscription(uid);
  if (sub && (sub.status === "active") && sub.expiresAt > nowMs()) {
    return {
      ok: false,
      reason: `您在${sub.source === "app" ? " App" : "網頁"}已有訂閱(到期日:${new Date(sub.expiresAt).toLocaleDateString("zh-TW")}),不需重複訂閱。`,
    };
  }

  // 2. 黑名單?
  const bl = await getBlacklist(email);
  if (bl?.permanently_blocked) {
    return { ok: false, reason: "此帳號已被限制訂閱,如有疑問請寄信客服。" };
  }

  // 3. 退過費 → 排除早鳥
  const noEarlyBird = (bl?.refund_count ?? 0) >= REFUND_POLICY.no_early_bird_after_refunds;

  // 4. 早鳥名額還夠嗎?
  const { count, limit } = await getEarlyBirdCount();
  const earlyBirdOpen = count < limit;

  const allowed: PlanKey[] = ["monthly", "yearly"];
  if (earlyBirdOpen && !noEarlyBird) allowed.unshift("yearly_early_bird");

  return { ok: true, allowed_plans: allowed };
}
