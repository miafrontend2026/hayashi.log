# StayJP App — Design Spec

- **Date**: 2026-05-19
- **App name (primary, en)**: StayJP
- **Subtitle (App Store)**: JLPT Shadowing & Flashcards
- **Display name (zh-TW/zh-Hant)**: 日本再留計劃
- **Display name (ja)**: 日本再留計画
- **Web counterpart**: hayashi.log / stay-jp-notes（https://miafrontend2026.github.io/hayashi.log/）
- **Repo (to be created)**: separate repo, not part of stay-jp-notes

## 1. Positioning

「為了留在日本而學日文的人專用 App。JLPT N5~N1 全覆蓋，主打絲滑跟讀 + 26 秒快速背單字，跟網頁版雲端同步。」

- Web (`日本再留計劃`) = SEO 入口 + 免费试用层
- App = 付费主战场（订阅转化）
- 同账号同进度（Firebase Auth 共享）
- 内容全级覆盖，营销重心放 N3→N2 留日路线
- 网页先公开上线，App 之后跟进（顺序锁定）

## 2. Tech Stack

```
App: Expo (React Native) + TypeScript
  UI:        Tamagui or NativeWind（决策放到 plan 阶段实测后定）
  Animation: react-native-reanimated v3 + react-native-gesture-handler
  Audio:     expo-av（播放 + 录音对比；不做 AI 评分）
  Storage:   react-native-mmkv（本地）+ Firestore（云）
  State:     Zustand
  Auth:      Firebase Auth（Email + Google + Apple，与网页共账号）
  Subscription: RevenueCat → StoreKit / Play Billing
  Push:      Expo Notifications

Backend: Firebase (复用网页 project)
  Auth, Firestore, Storage (optional, if audio 迁出 GitHub Pages)
```

**关键决策：**
- 内容打 bundle（不走 CDN）→ 即用、离线、零延迟翻卡；包大小用按等级下载控制
- SRS 算法 port 自 `srs.js`（interval/ease/nextReviewTs/nextReview 兼容字段）
- 订阅校验走 RevenueCat（跨平台 + 服务端校验 + 网页可读订阅状态）
- 所有写操作 optimistic（先 MMKV 后 Firestore）→ 絲滑核心

## 3. Asset Reuse from Web

| 资产 | 来源（stay-jp-notes） | 处理 |
|---|---|---|
| 单字 N1~N5 | `vocab-n{1..5}.js` | build script → JSON 打 bundle |
| 语法 N1~N3 | `grammar-n{1..3}.js` | build script → JSON 打 bundle |
| 听力题库 | `listening.js` | build script → JSON 打 bundle |
| 音檔 | `audio/tts/*.mp3`（VoiceVox 生成） | CDN 托管 + 按等级预下载 |
| SRS 算法 | `srs.js` | TS rewrite，逻辑照搬 |
| Flashcard 交互 | `flashcard.js`（20s 倒数翻面 + 滑动 + 自动播音） | RN 重写，逻辑照搬 |
| Exam date / base level / goal level | localStorage keys | 迁到 MMKV + Firestore |

**单一内容源原则**：内容只在网页 repo 维护，App build script 抽取并转换，避免双份维护。

## 4. TTS / Audio

- **路线**：纯 VoiceVox（免费 + 商用允许 + 必须标注）
- **合规要求**：
  - App 内建 Credits 页，列出用到的所有角色 + 标注「VOICEVOX:角色名」
  - 生成新内容前查询每个角色官方授权页，禁止用条款不允许商用的角色
  - 已生成音檔在分发前再次复核授权（如有失效需替换）

## 5. Features (v1 MVP)

### Tab Bar
- 跟讀 Shadowing
- 單字 Flashcard
- 測驗 Quiz
- 我的 Profile

### A. Onboarding
- 选 base level（none/N5~N2）+ goal level（N5~N1）+ exam date（可空）
- 自动算每日任务量（剩余天数 × 单字密度）
- 首屏 hero：「距 N{x} 还有 {days} 天｜今日 {n} 字 + {m} 句」
- Onboarding 完毕直接进 Flashcard 26 秒模式（让用户在 1 分钟内感受核心价值）

### B. Shadowing
- 列表：按等级 / 主题 / 收藏
- 单句页：日文（假名可切）+ 中译 + 波形播放 + 跟读录音 + 对比回放
- 速度档位：0.5 / 0.75 / 1.0 / 1.25
- 滑动切下一句（reanimated 卡片动画）
- v1 不做 AI 发音评分

### C. Flashcard（26 秒模式）
- 倒数自动翻面 + 左右滑（左=不会、右=会、下=半生熟）+ 自动播音
- SRS 队列从 Firestore 拉，本地 MMKV 镜像
- 等级 / 词性 / 收藏夹筛选

### D. Quiz
- 单字测验：四选一（读音 / 义 / 汉字 三种题型）
- 跟读测验：听完整段选大意 / 关键信息（复用 listening.js 题库）
- 模考入口推 v1.1

### E. Profile
- 考试日期 + 倒数
- 每日打卡日历（streakDays）
- 学过的字 / 跟读过的句数
- 订阅管理（深链系统订阅页）
- 帐号同步状态

### v1 明确不做
模考、读解、汉字系统、语法独立模块、AI 发音评分、社区、推荐佣金、广告

## 6. Subscription Model

- **试用**：注册即起 7 天全功能
- **试用结束**：自动续订 $6.99/月 或 $59/年（年付前 7 天 / 月付前 24h 推送提醒）
- **未订阅状态**：仅 N5 单字 + 每天 5 张卡（保留卸载挽回钩子）
- **跨端**：App 订阅 / 网页订阅互通（Firestore `subscription.source` 标记，RevenueCat 永远是订阅 SoT）
- **合规**：
  - Onboarding paywall 全文披露价格、试用、自动续订
  - 「恢复购买」按钮
  - 「管理订阅」深链
  - 隐私政策 / 服务条款（复用网页 privacy.html / terms.html）

## 7. Data Schema

**Firestore（沿用网页结构 + 扩展）：**

```
users/{uid}
  profile: { displayName, baseLevel, goalLevel, examDate, locale, createdAt }
  subscription: { source: 'app'|'web', plan, status, expiresAt, willRenew, trialEndsAt }
  stats: { streakDays, lastActiveAt, totalCardsLearned, totalShadowingSec }

users/{uid}/srs/{level}:{word}
  { interval, ease, reviews, correct, nextReviewTs, nextReview, updatedAt }

users/{uid}/shadowing/{sentenceId}
  { playCount, recordCount, lastPlayedAt, favorited }

users/{uid}/quiz_runs/{runId}
  { type: 'vocab'|'listening', level, score, total, items[], at }
```

**MMKV 本地镜像**：所有上述集合镜像一份；UI 先读 MMKV，背景拉 Firestore diff（按 `updatedAt`）合并。

**冲突规则**：last-write-wins（按 `updatedAt`）；订阅状态以 RevenueCat 为准。

## 8. Bundle / Download Strategy

- 首装 bundle 目标：< 80MB（代码 + 当前选定等级单字/语法 JSON + N5 音频）
- 用户选定 goal level 后，后台静默下载该等级音频
- 弱网 fallback：跟读模式可临时切 expo-speech 本地 TTS（但不算"正式跟读"，UI 标灰）
- 全等级音频总量估 200MB+，绝不一次性下载

## 9. Risks

| 等级 | 风险 | 对策 |
|---|---|---|
| 🔴 | Apple 4.2/4.3 拒绝（视为网页包壳） | Expo 原生重写、绝不在 App 内出现网页 URL、强调原生 SRS + 录音 + 推送 |
| 🔴 | 自动续订订阅审核严 | 完整价格披露、续订提醒、恢复购买、深链管理订阅、隐私/条款齐 |
| 🔴 | 冷启动获客 = 0 | ASO 长尾「JLPT 跟讀」「26 秒背單字」；网页每个内容页加 App CTA；社群 case study；年付首年 $39 限定 |
| 🟡 | VoiceVox 角色授权 | 生成前查每角色条款；Credits 页标注；不商用的角色不用 |
| 🟡 | 包体积超 200MB 蜂窝下载警告 | 分级下载，首装 < 80MB |
| 🟡 | Firebase 成本（>1k DAU） | MMKV 激进缓存 + 写入 debounce 5s |
| 🟢 | RN 性能 | reanimated v3 worklet 60fps |
| 🟢 | 跨端帐号冲突 | Firebase Auth 成熟 |

## 10. Timeline (副业单人节奏)

| 周 | 里程碑 |
|---|---|
| W1-2 | Expo 骨架 + Firebase Auth + Firestore 接通 |
| W3-4 | 内容打 bundle 流程 + Flashcard 26 秒 MVP |
| W5-6 | Shadowing 列表 + 单句页 + 录音对比 |
| W7 | Quiz + Onboarding + 考试倒数 |
| W8 | RevenueCat + paywall + 7 天试用 + 推送 |
| W9 | 离线下载 + SRS 本地持久化 + 状态机收尾 |
| W10 | TestFlight + 内测 + ASO 资料 |
| W11 | Apple/Google 提审 + bug fix |
| W12 | 上架 + 软启动 |

**关键路径（开工前必做）：**
- [ ] **今天注册** Apple Developer（$99/年，1~14 天审）
- [ ] **今天注册** Google Play Console（$25 一次性，2025 起新账号需 12 人 14 天封测）
- [ ] hayashi.log 网页版正式公开（歐付寶审核状态推进）
- [ ] 商标 / App 名「StayJP」可用性查（USPTO + 日本/台湾商标局；.com / App Store 名查重）

## 11. Out of Scope (v1)

- 模考、读解、汉字、独立语法模块
- AI 发音评分
- 社区、用户内容
- italki 推荐 / 广告
- Web 端任何改动（除 SEO 加 App CTA 外不动）

## 12. Open Questions

(none — all key parameters confirmed during brainstorm)
