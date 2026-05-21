#!/usr/bin/env node
// 從 GA4 抓 newUsers 同步到 Firestore stats/global.learners。
// 混搭：
//   - GA Data API：user OAuth refresh token（SA 加不進 GA UI 的繞法）
//   - Firestore write：service account JWT（user OAuth 直寫 Firestore REST 配額為 0）
//
// 必填環境變數：
//   OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, OAUTH_REFRESH_TOKEN
//   GA4_PROPERTY_ID   （純數字 property ID）
//   GCP_SA_KEY        service account JSON 整段（jpnote-1bdd6 內 Cloud Datastore User）
// 可選：
//   GA_START_DATE     起算日（預設 2025-01-01）

import crypto from 'node:crypto';

const need = ['OAUTH_CLIENT_ID', 'OAUTH_CLIENT_SECRET', 'OAUTH_REFRESH_TOKEN', 'GA4_PROPERTY_ID', 'GCP_SA_KEY'];
for (const k of need) if (!process.env[k]) { console.error(`Missing ${k}`); process.exit(1); }

const sa = JSON.parse(process.env.GCP_SA_KEY);
const projectId = sa.project_id;
const propertyId = process.env.GA4_PROPERTY_ID;
const startDate = process.env.GA_START_DATE || '2025-01-01';

// 1a) user OAuth refresh_token → access_token（給 GA 用）
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

// 1b) Service account JWT → access_token（給 Firestore 用）
// user OAuth 寫 Firestore REST 預設 quota 0；改用 SA JWT 避開
function base64UrlEncode(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function getSaAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64UrlEncode(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claim}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  const signature = base64UrlEncode(signer.sign(sa.private_key));
  const jwt = `${unsigned}.${signature}`;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!r.ok) throw new Error(`SA JWT exchange ${r.status}: ${await r.text()}`);
  return (await r.json()).access_token;
}

// 3) Firestore REST PATCH stats/global.learners — 用 SA access token
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
const userToken = await getAccessToken();
console.log('Got user OAuth access token (for GA)');

const newUsers = await getGaNewUsers(userToken);
console.log(`GA newUsers (${startDate}~today): ${newUsers}`);
if (!Number.isFinite(newUsers) || newUsers <= 0) {
  console.error('Invalid newUsers, aborting');
  process.exit(1);
}

const saToken = await getSaAccessToken();
console.log('Got SA access token (for Firestore)');
await writeFirestore(saToken, newUsers);
console.log(`Firestore stats/global.learners ← ${newUsers}`);
