# 同步 GA4 → Firestore learners 計數 — 安裝步驟（OAuth refresh token 版）

之前試 service account 路線被 GA4 UI 拒接 SA email。改用個人 OAuth 一把鑰匙打開 GA 跟 Firestore 兩道門（你本人是 GCP project owner + GA admin，scope 涵蓋兩邊）。

每天 cron 跑一次：抓 GA4 累計 newUsers → 覆寫 Firestore `stats/global.learners`。

## 1. 確認 GA4 Data API 已啟用

[Google Cloud Console → APIs Library](https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com?project=jpnote-1bdd6) → Enable（之前可能已開）

## 2. 設定 OAuth consent screen

如果之前沒設過：

1. [APIs & Services → OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent?project=jpnote-1bdd6)
2. User Type：**External**（個人 Google 帳號用）
3. App name 隨便（`stayjp-learners-sync`）
4. User support email + Developer email 填你的 Gmail
5. Scopes 步驟先跳過（後面 Playground 會帶）
6. Test users：加 `abc83327@gmail.com`（你本人）
7. Save

> Publishing status 留 `Testing` 就好。test user list 裡的帳號可以無限期用，不會 7 天過期。

## 3. 建立 OAuth Client ID

1. [APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials?project=jpnote-1bdd6) → + Create Credentials → **OAuth client ID**
2. Application type：**Web application**
3. Name：`learners-sync-oauth`
4. **Authorized redirect URIs** 加一條：
   ```
   https://developers.google.com/oauthplayground
   ```
5. Create → 跳出視窗顯示 **Client ID** 跟 **Client Secret** → 複製下來（之後也可以從 Credentials 列表再看）

## 4. 拿 refresh token（OAuth Playground）

1. 打開 [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
2. 右上齒輪 ⚙ → 勾「**Use your own OAuth credentials**」→ 貼步驟 3 的 Client ID + Secret
3. 左邊 Step 1「Select & authorize APIs」最下面的 **Input your own scopes** 框，貼這兩條（用空白或逗號隔開）：
   ```
   https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/datastore
   ```
4. **Authorize APIs** → 用你的 Gmail 登入 → 同意授權
5. Step 2「Exchange authorization code for tokens」→ 點 **Exchange authorization code for tokens**
6. 右側出現 **Refresh token**（一長串 `1//...`）→ 複製下來

> 這 refresh token 只要不主動撤銷就**永久有效**。

## 5. 找 GA4 Property ID

[GA4 Admin → Property details](https://analytics.google.com/) → 9 位數純數字 ID（不是 `G-XXXXX`）

## 6. 設 GitHub Secrets

[repo Settings → Secrets and variables → Actions](https://github.com/miabuilds/stayjp.study/settings/secrets/actions) → 加四條：

| Name | Value |
|---|---|
| `OAUTH_CLIENT_ID` | 步驟 3 的 Client ID |
| `OAUTH_CLIENT_SECRET` | 步驟 3 的 Client Secret |
| `OAUTH_REFRESH_TOKEN` | 步驟 4 的 refresh token |
| `GA4_PROPERTY_ID` | 步驟 5 的 9 位數 ID |

## 7. 手動觸發測

[Actions → Sync learners from GA4 → Run workflow](https://github.com/miabuilds/stayjp.study/actions/workflows/sync-learners.yml)

跑完 log 看到：
```
Got OAuth access token
GA newUsers (2025-01-01~today): 15234
Firestore stats/global.learners ← 15234
```

回 Firebase Console 看 `stats/global` 就是 GA 數字。

## 8. 取消註解排程

[.github/workflows/sync-learners.yml](.github/workflows/sync-learners.yml) 把 schedule 區塊取消註解 → commit → 每天 UTC 03:00 自動同步。

## 維運提示

- refresh token 不過期，但若 OAuth consent screen 改設定 / Client 被刪除會失效
- 起算日預設 2025-01-01，要改去 workflow 加 env `GA_START_DATE`
- 客戶端 +1 increment 還在跑當即時感，下次 cron 來覆寫
