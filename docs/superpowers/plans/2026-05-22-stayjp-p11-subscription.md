# StayJP P11 — 訂閱系統(NT$149/月 + 跨平台識別)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** 上架前接好訂閱 — NT$149/月 個人方案(Apple 標 family-shareable,自動讓 Apple 家庭 6 人共用)+ 7 天試用 + 跨平台識別(網頁買的 App 也吃到,App 買的網頁也吃到)。

**Architecture:**
- **真相源**:Firestore `users/{uid}.subscription`
- **App 端**:RevenueCat SDK → StoreKit/Play Billing → webhook → Firestore
- **網頁端**:歐付寶 → 你後端 webhook → Firestore
- **兩端讀**:同一份 Firestore field,登入同帳號 = 看得到同一筆訂閱

**Firestore schema(P2.5 已預留):**
```ts
users/{uid}.subscription = {
  source: 'web' | 'app',          // 用哪個管道買的
  plan: 'monthly' | 'yearly',     // v1 只有 monthly
  status: 'trialing' | 'active' | 'cancelled' | 'expired',
  expiresAt: number,              // ms epoch
  willRenew: boolean,
  trialEndsAt?: number,           // 試用結束時間
  product_id?: string,            // RevenueCat product ID(App)
  ecpay_order?: string,           // 歐付寶訂單號(網頁)
}
```

---

## File Structure

```
stayjp-app/                                 # App 端
├── src/lib/
│   ├── subscription.ts                     # NEW — 讀 Firestore subscription, 判 active
│   └── revenuecat.ts                       # NEW — RevenueCat SDK wrapper
├── src/components/
│   └── Paywall.tsx                         # NEW — 試用結束後付費牆
└── app/
    ├── paywall.tsx                         # NEW — push route
    └── web.tsx                             # MODIFY — webview 載入時 inject subscription state

stay-jp-notes/                              # 網頁端
├── ecpay-callback.js (or Cloud Function)   # NEW — 歐付寶回呼寫 Firestore
└── content-loader.js                       # MODIFY — 讀 subscription field

functions/                                  # Cloud Functions(共用)
├── revenuecat-webhook.ts                   # NEW — 接 RevenueCat webhook,寫 Firestore
└── ecpay-callback.ts                       # NEW — 接歐付寶 callback,寫 Firestore
```

---

## Pricing config

```ts
// src/lib/subscription.ts
export const PLANS = {
  monthly: {
    apple_product_id: "com.stayjp.app.monthly",   // App Store Connect 建這個
    google_product_id: "stayjp_monthly",          // Play Console 建這個
    price_twd: 149,
    trial_days: 7,
    family_shareable: true,                       // Apple 自動家庭共享
  },
} as const;
```

---

## Tasks(分三批,看你帳號 ready 度推進)

### Phase 1:**現在可以做,不用等帳號**

#### Task 1.1 — Firestore subscription reader

**Files:**
- Create: `src/lib/subscription.ts`

```ts
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db, auth } from "./firebase";

export interface Subscription {
  source: "web" | "app";
  plan: "monthly" | "yearly";
  status: "trialing" | "active" | "cancelled" | "expired";
  expiresAt: number;
  willRenew: boolean;
  trialEndsAt?: number;
}

export function isPremium(sub: Subscription | null): boolean {
  if (!sub) return false;
  if (sub.status !== "active" && sub.status !== "trialing") return false;
  return sub.expiresAt > Date.now();
}

export async function fetchSubscription(): Promise<Subscription | null> {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  const snap = await getDoc(doc(db, `users/${uid}`));
  return (snap.data()?.subscription as Subscription) ?? null;
}

export function subscribeToSubscription(cb: (sub: Subscription | null) => void): () => void {
  const uid = auth.currentUser?.uid;
  if (!uid) return () => {};
  return onSnapshot(doc(db, `users/${uid}`), (snap) => {
    cb((snap.data()?.subscription as Subscription) ?? null);
  });
}
```

Commit: `feat(subscription): Firestore subscription reader + isPremium check`

#### Task 1.2 — Paywall UI shell

**Files:**
- Create: `src/components/Paywall.tsx`
- Create: `app/paywall.tsx`

Paywall layout:
- Hero:「升級為 Premium」+ 狸貓
- Pricing card: **NT$149 / 月,前 7 天免費**,可隨時取消
- Bullet points:N1~N5 全解鎖 / 跟讀全部 / 模考 / 跨裝置同步
- Big CTA:「開始免費試用」
- 「我已訂閱」恢復購買連結
- 隱私政策 / 條款連結

不接 RevenueCat 實際購買(Phase 2 才接),先做 UI。

Commit: `feat(paywall): UI shell (購買流程 wait Apple Dev)`

#### Task 1.3 — webview 注入訂閱狀態

**Files:**
- Modify: `app/web.tsx`

`injectedJS` 增加 subscription 資料:

```ts
function injectedJS(theme: "light" | "dark", sub: Subscription | null): string {
  return `
    window.STAYJP_NATIVE = {
      ...,
      subscription: ${JSON.stringify(sub)},
      isPremium: ${isPremium(sub)},
    };
    ...
  `;
}
```

`web.tsx` 改成:

```tsx
const [sub, setSub] = useState<Subscription | null>(null);
useEffect(() => {
  const unsub = subscribeToSubscription(setSub);
  return unsub;
}, []);
```

網頁端可以讀 `window.STAYJP_NATIVE.isPremium` 來決定 UI(雖然 web 自己也讀 Firestore,但 native 注入更快、首屏對齊)。

Commit: `feat(web): inject subscription state into WebView`

---

### Phase 2:**Apple Dev / Google Play 帳號審完後**(估 1-2 週)

#### Task 2.1 — App Store Connect / Play Console 建 IAP product

**你做(non-code):**
- App Store Connect:
  - Subscription group:「StayJP Premium」
  - Product ID:`com.stayjp.app.monthly`
  - 價格:NT$149/月
  - 免費試用:7 天
  - 標 **Family Sharing 可共用**
- Play Console:
  - Subscription: `stayjp_monthly`
  - 同樣價格 + 試用設定

#### Task 2.2 — RevenueCat 設定

**你做(non-code):**
1. https://revenuecat.com/ 註冊帳號(免費 < $2.5k MTR)
2. 創建 project「StayJP」
3. 連 App Store Connect(用 API key)
4. 連 Play Console(用 service account JSON)
5. 拿到 RevenueCat public API key,丟給我

#### Task 2.3 — RevenueCat SDK 接線

**Files:**
- Create: `src/lib/revenuecat.ts`
- Modify: `src/components/Paywall.tsx`(實際購買)
- Modify: `app/paywall.tsx`

```bash
cd ~/Documents/GitHub/stayjp-app
npx expo install react-native-purchases react-native-purchases-ui
```

RevenueCat 初始化、購買、恢復、查詢狀態。

Commit: `feat(paywall): RevenueCat SDK 接 StoreKit/Play Billing`

#### Task 2.4 — RevenueCat webhook → Firestore

**Files:**
- Create: `functions/revenuecat-webhook.ts`(Cloud Function)

Cloud Function 接 RevenueCat webhook events(`INITIAL_PURCHASE`, `RENEWAL`, `CANCELLATION`, `EXPIRATION`, `BILLING_ISSUE`),寫進 `users/{uid}.subscription`。

User 對應:RevenueCat 在 SDK 端用 `Purchases.logIn(firebaseUid)`,webhook 帶 uid。

Commit: `feat(functions): RevenueCat webhook → Firestore subscription`

---

### Phase 3:**網頁端歐付寶(你網頁那邊做)**

#### Task 3.1 — 歐付寶 callback → Firestore

**Files(stay-jp-notes):**
- 你已經在做網頁訂閱了
- 確保歐付寶回呼寫:`users/{uid}.subscription = { source: 'web', status: 'active', ... }`

跟我 App 端讀同一個 field,自動跨平台識別。

#### Task 3.2 — 網頁讀 subscription 顯示 premium UI

**Files(stay-jp-notes):**
- `content-loader.js` 或對應位置加:檢查 `users/{uid}.subscription`,過期就鎖某些功能

---

## Done Criteria

- [ ] Phase 1:訂閱讀取 + paywall UI shell(我先做)
- [ ] Phase 2:RevenueCat 真實購買(等你帳號)
- [ ] Phase 3:網頁歐付寶(你網頁那邊做)
- [ ] 端到端測:Apple 沙盒帳號買 → 開網頁同帳號 → 看得到 premium

## 試用 + 自動續訂 邏輯

- App 端:Apple/Google 內建 7 天試用 → 自動轉訂閱
- RevenueCat 自動標 `status: 'trialing' → 'active'`
- 用戶 24h 前可取消(Apple 規則)

## 重要的 Apple 規則(我做時會 follow)

- App 內**不准**出現「請去網頁訂閱」字眼(anti-steering)
- 試用條款要明確披露(NT$149/月、7 天免費、自動續訂)
- 「恢復購買」按鈕必須有
- 「管理訂閱」深鏈到系統頁
- 隱私政策 + 服務條款 必須連到網頁版

## Out of Scope(v1.1+)

- 年付方案(NT$1490 之類)
- 第二層付費(模考 NT$299 一次買斷)
- 推薦人優惠
- italki 推薦佣金重啟

## Open Questions

(都沒了)
