// HTTP function:訂閱前 precheck(前端 paywall 顯示 plan card 時呼叫)
//
// 回傳:
//   { ok: true, allowed_plans: [...] }   ← 用戶可以訂,告訴前端能顯示哪些 plan
//   { ok: false, reason: "..." }         ← 不能訂,顯示原因

import * as functions from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { precheckSubscribe } from "./utils/firestore";

if (admin.apps.length === 0) admin.initializeApp();

export const precheck = functions.onRequest(
  {
    cors: true,
    region: "asia-east1",
    maxInstances: 10,
    timeoutSeconds: 15,
    memory: "256MiB",
    concurrency: 80,
  },
  async (req, res) => {
    try {
      const idToken = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
      if (!idToken) { res.status(401).json({ error: "missing_auth" }); return; }
      const decoded = await admin.auth().verifyIdToken(idToken);
      const uid = decoded.uid;
      const email = decoded.email || "";

      const result = await precheckSubscribe(uid, email);
      res.json(result);
    } catch (err) {
      console.error("precheck error:", err);
      res.status(500).json({ error: "internal" });
    }
  },
);
