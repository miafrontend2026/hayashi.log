// HTTP function:owner 開發測試用 — 一鍵清空自己的 billing 資料
//
// 嚴格 owner only(stayjpplan@gmail.com / abc83327@gmail.com),
// 用 Firebase Auth idToken 驗 email。
//
// 清以下:
//   - users/{uid}.subscription field 刪掉
//   - 該 uid 的所有 transactions 文件刪掉
//   - blacklist/{emailHash} 刪掉(如果有)
//   - counters/early_bird 不動(避免影響其他用戶測試)
//
// 部署完用:
//   curl -X POST https://adminresetbilling-lsd7okt5qa-de.a.run.app \
//        -H "Authorization: Bearer <idToken>"

import * as functions from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { db, FieldValue, emailHash } from "./utils/firestore";

if (admin.apps.length === 0) admin.initializeApp();

const OWNER_EMAILS = new Set(["stayjpplan@gmail.com", "abc83327@gmail.com"]);

export const adminResetBilling = functions.onRequest(
  {
    cors: true,
    region: "asia-east1",
    invoker: "public",
    maxInstances: 2,
    timeoutSeconds: 60,
    memory: "256MiB",
    concurrency: 10,
  },
  async (req, res) => {
    try {
      const idToken = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
      if (!idToken) { res.status(401).json({ error: "missing_auth" }); return; }
      const decoded = await admin.auth().verifyIdToken(idToken);
      const email = decoded.email || "";
      const uid = decoded.uid;

      if (!OWNER_EMAILS.has(email)) {
        res.status(403).json({ error: "not_owner" });
        return;
      }

      const log: string[] = [];

      // 1. 刪 subscription field
      await db.doc(`users/${uid}`).update({ subscription: FieldValue.delete() })
        .catch(() => { log.push("subscription field not present"); });
      log.push(`✓ deleted users/${uid}.subscription`);

      // 2. 刪 transactions
      const txnSnap = await db.collection("transactions").where("uid", "==", uid).get();
      const batch = db.batch();
      txnSnap.docs.forEach(d => batch.delete(d.ref));
      if (!txnSnap.empty) await batch.commit();
      log.push(`✓ deleted ${txnSnap.size} transactions`);

      // 3. 刪 blacklist
      const hash = emailHash(email);
      await db.doc(`blacklist/${hash}`).delete()
        .catch(() => { log.push("blacklist entry not present"); });
      log.push(`✓ deleted blacklist/${hash}`);

      // 4. counters/early_bird 不動,owner 重訂閱會占用 1 個名額是預期的
      log.push("ℹ counters/early_bird not touched");

      res.json({ ok: true, uid, email, log });
    } catch (err) {
      console.error("adminResetBilling error:", err);
      res.status(500).json({ error: "internal", message: String(err) });
    }
  },
);
