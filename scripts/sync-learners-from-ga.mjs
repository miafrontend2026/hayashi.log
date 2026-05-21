#!/usr/bin/env node
// 從 GA4 抓 newUsers 同步到 Firestore stats/global.learners。
// 改用 user OAuth refresh token（不用 service account，避免 GA UI 拒接 SA 的 bug）。
// 你本人 Gmail 既是 GCP project owner、又是 GA admin，OAuth scope 一把鑰匙打開兩道門。
//
// 必填環境變數：
//   OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, OAUTH_REFRESH_TOKEN
//   GA4_PROPERTY_ID   （純數字 property ID）
// 可選：
//   GA_START_DATE     起算日（預設 2025-01-01）
//   GCP_PROJECT_ID    Firestore project（預設 jpnote-1bdd6）

const need = ['OAUTH_CLIENT_ID', 'OAUTH_CLIENT_SECRET', 'OAUTH_REFRESH_TOKEN', 'GA4_PROPERTY_ID'];
for (const k of need) if (!process.env[k]) { console.error(`Missing ${k}`); process.exit(1); }

const projectId = process.env.GCP_PROJECT_ID || 'jpnote-1bdd6';
const propertyId = process.env.GA4_PROPERTY_ID;
const startDate = process.env.GA_START_DATE || '2025-01-01';

// 1) refresh_token → access_token
async function getAccessToken() {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.OAUTH_CLIENT_ID,
      client_secret: process.env.OAUTH_CLIENT_SECRET,
      refresh_token: process.env.OAUTH_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  if (!r.ok) throw new Error(`OAuth token exchange ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return j.access_token;
}

// 2) GA Data API runReport(newUsers, 全年)
async function getGaNewUsers(token) {
  const r = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dateRanges: [{ startDate, endDate: 'today' }],
      metrics: [{ name: 'newUsers' }],
    }),
  });
  if (!r.ok) throw new Error(`GA runReport ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return parseInt(j.rows?.[0]?.metricValues?.[0]?.value || '0', 10);
}

// 3) Firestore REST PATCH stats/global.learners
// 用 user OAuth + datastore scope → 走 Cloud IAM 不受 client rules 限制
async function writeFirestore(token, learners) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/stats/global?updateMask.fieldPaths=learners&updateMask.fieldPaths=lastSyncedAt`;
  const r = await fetch(url, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        learners: { integerValue: String(learners) },
        lastSyncedAt: { timestampValue: new Date().toISOString() },
      },
    }),
  });
  if (!r.ok) throw new Error(`Firestore PATCH ${r.status}: ${await r.text()}`);
  return r.json();
}

// run
const token = await getAccessToken();
console.log('Got OAuth access token');

const newUsers = await getGaNewUsers(token);
console.log(`GA newUsers (${startDate}~today): ${newUsers}`);
if (!Number.isFinite(newUsers) || newUsers <= 0) {
  console.error('Invalid newUsers, aborting');
  process.exit(1);
}

await writeFirestore(token, newUsers);
console.log(`Firestore stats/global.learners ← ${newUsers}`);
