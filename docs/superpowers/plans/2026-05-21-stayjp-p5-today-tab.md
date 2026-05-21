# StayJP P5 — Today Tab + 5-Tab Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Restructure App from 4 tabs (跟讀/單字/測驗/我的) to 5 tabs (今日/單字/文法/跟讀/我的). Implement the new **今日** tab as a daily-learning dashboard: exam countdown hero, due-review summary, streak calendar, and quick-launch buttons that deep-link into Flashcard/Shadow tabs. The 測驗 tab is removed (P5 quiz was a placeholder); the existing **單字** tab (currently Flashcard SRS settings) keeps that role for now — a future P6 will turn it into a true browse list. **文法 browse tab is also out of P5 scope** — only the today tab and tab restructure happen here. This lets us validate the new shell before stacking more screens.

**Architecture:**
- New `app/(tabs)/today.tsx` as the new first tab.
- Tab layout updated in `app/(tabs)/_layout.tsx` to declare 5 tabs in order: today / flashcard / grammar (placeholder) / shadowing / profile.
- Today screen reads from existing stores: `getSrsData()`, `getDueCount()`, `vocab()`, `getPref("exam_date")`, `getSentenceFavs()`, `getVocabFavs()`. **No new sync work needed.**
- Quick-launch buttons use expo-router `router.push` and pass an intent via a new lightweight Zustand store `useLaunchIntent` (one field `pendingRange: ShadowRange | null` and `pendingFlashcardRange: Range | null`). Target tab mounts → reads intent → auto-starts session → clears.
- **Streak**: real daily activity tracking deferred to P5.1. P5 shows a placeholder "今日打卡" simple state (today's date row only, no historical heatmap).
- 測驗 tab file (`app/(tabs)/quiz.tsx`) is deleted.

**Tech stack:** existing (NativeWind, AeroCard, expo-router, Zustand).

**Reference spec:** `stay-jp-notes/docs/superpowers/specs/2026-05-19-stayjp-app-design.md`.
**Web reference:** `index.html` has no "today" view per se — daily prompts are embedded in Flashcard settings ("還要背 X 個 / 建議每天 Y 個"). We pull those same numbers into the today tab for parity.

---

## File Structure

```
stayjp-app/
├── app/(tabs)/
│   ├── _layout.tsx           # MODIFY — 5 tabs, new order
│   ├── today.tsx             # NEW — daily dashboard
│   ├── flashcard.tsx         # MODIFY — read launch intent on mount, auto-start if set
│   ├── grammar.tsx           # NEW (placeholder only — full browse in P6)
│   ├── shadowing.tsx         # MODIFY — read launch intent
│   ├── quiz.tsx              # DELETE
│   └── profile.tsx           # unchanged
└── src/
    └── stores/
        └── launchIntent.ts    # NEW — tiny intent bus for cross-tab quick-launch
```

---

### Task 1: Launch intent store

**Files:**
- Create: `src/stores/launchIntent.ts`

- [ ] **Step 1: Implement the store**

```ts
// src/stores/launchIntent.ts
import { create } from "zustand";
import type { Range } from "../srs/queue";
import type { ShadowKind, ShadowRange } from "../shadow/types";

interface LaunchIntentState {
  /** Set by 今日 tab buttons; consumed by target tab on mount. */
  pendingFlashcard: { range: Range; level?: "n5"|"n4"|"n3"|"n2"|"n1" } | null;
  pendingShadow: { kind: ShadowKind; range?: ShadowRange; level?: "n5"|"n4"|"n3"|"n2"|"n1" } | null;
  setFlashcardIntent: (v: { range: Range; level?: "n5"|"n4"|"n3"|"n2"|"n1" } | null) => void;
  setShadowIntent: (v: { kind: ShadowKind; range?: ShadowRange; level?: "n5"|"n4"|"n3"|"n2"|"n1" } | null) => void;
}

export const useLaunchIntent = create<LaunchIntentState>((set) => ({
  pendingFlashcard: null,
  pendingShadow: null,
  setFlashcardIntent: (v) => set({ pendingFlashcard: v }),
  setShadowIntent: (v) => set({ pendingShadow: v }),
}));
```

- [ ] **Step 2: Commit**

```bash
cd ~/Documents/GitHub/stayjp-app
git add src/stores/launchIntent.ts
git commit -m "feat(stores): launchIntent — cross-tab quick-start signaling"
```

---

### Task 2: Tab layout — 5 tabs, new order, drop quiz

**Files:**
- Modify: `app/(tabs)/_layout.tsx`
- Delete: `app/(tabs)/quiz.tsx`

- [ ] **Step 1: Update _layout.tsx**

Order: today → flashcard → grammar → shadowing → profile. Icons:
- today: `sunny-outline` (or `today-outline`)
- flashcard: `albums-outline`
- grammar: `book-outline`
- shadowing: `mic-outline`
- profile: `person-circle-outline`

Tab labels (zh-TW): 今日 / 單字 / 文法 / 跟讀 / 我的.

```tsx
<Tabs.Screen name="today" options={{ title: "今日", tabBarIcon: ({ color, size }) => <Ionicons name="sunny-outline" size={size} color={color} /> }}/>
<Tabs.Screen name="flashcard" options={{ title: "單字", tabBarIcon: ({ color, size }) => <Ionicons name="albums-outline" size={size} color={color} /> }}/>
<Tabs.Screen name="grammar" options={{ title: "文法", tabBarIcon: ({ color, size }) => <Ionicons name="book-outline" size={size} color={color} /> }}/>
<Tabs.Screen name="shadowing" options={{ title: "跟讀", tabBarIcon: ({ color, size }) => <Ionicons name="mic-outline" size={size} color={color} /> }}/>
<Tabs.Screen name="profile" options={{ title: "我的", tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" size={size} color={color} /> }}/>
```

- [ ] **Step 2: Delete quiz.tsx**

```bash
rm app/\(tabs\)/quiz.tsx
```

- [ ] **Step 3: Update default landing**

`app/_layout.tsx` currently redirects to `/(tabs)/flashcard` after sign-in. Change to `/(tabs)/today`.

- [ ] **Step 4: Commit**

```bash
git add app/\(tabs\)/_layout.tsx app/_layout.tsx
git rm app/\(tabs\)/quiz.tsx
git commit -m "feat(nav): 5-tab structure — today first, drop quiz placeholder"
```

---

### Task 3: Grammar tab placeholder

**Files:**
- Create: `app/(tabs)/grammar.tsx`

- [ ] **Step 1: Implement placeholder matching shadowing/quiz styling**

```tsx
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function GrammarTab() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: "#f8fafc" }} className="items-center justify-center px-6">
      <Ionicons name="book-outline" size={56} color="#94a3b8" />
      <Text className="text-2xl font-bold text-slate-700 mt-4">文法</Text>
      <Text className="text-sm text-slate-500 mt-2">即將上線</Text>
      <View className="mt-3 bg-slate-100 px-2.5 py-0.5 rounded-full">
        <Text className="text-[10px] text-slate-500 font-semibold tracking-widest">P6</Text>
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(tabs\)/grammar.tsx
git commit -m "feat(grammar): placeholder tab (full browse in P6)"
```

---

### Task 4: Today tab — content

**Files:**
- Create: `app/(tabs)/today.tsx`

The today tab is a scrollable column with these AeroCard blocks, top to bottom:

```
┌─────────────────────────────────────────────────┐
│ Hero: 距離 N2 還有 87 天                          │
│ (large countdown + level + small "改設定 →" link) │
├─────────────────────────────────────────────────┤
│ 今日複習                                          │
│ 8 字待複習 · 0 句語法待複習                       │
│ [複習今日單字 →] [跟讀今日語法 →]                 │
├─────────────────────────────────────────────────┤
│ 學習進度                                          │
│ N3 → N2:142 / 2,400 個                          │
│ (thin progress bar)                              │
│ [前往背單字 →]                                    │
├─────────────────────────────────────────────────┤
│ 連續打卡(P5.1 細做)                              │
│ 暫時:今天有打卡 ✓ / 今天還沒                      │
└─────────────────────────────────────────────────┘
```

Implementation:

```tsx
// app/(tabs)/today.tsx
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { AeroCard } from "../../src/components/AeroCard";
import { getDueCount } from "../../src/srs/stats";
import { countLearned, scopeLevels } from "../../src/srs/stats";
import { getPref } from "../../src/stores/prefsStore";
import { daysUntilExam } from "../../src/flashcard/exam-dates";
import { useLaunchIntent } from "../../src/stores/launchIntent";
import { vocab } from "../../src/lib/content";
import { Button } from "../../src/components/Button";
import type { Level } from "../../src/types/content";

export default function TodayTab() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { setFlashcardIntent, setShadowIntent } = useLaunchIntent();

  const base = getPref("base_level");
  const goal = getPref("goal_level");
  const exam = getPref("exam_date");
  const days = daysUntilExam(exam);
  const due = getDueCount();

  // learning progress: base → goal scope
  const scope = scopeLevels(base, goal);
  let totalTarget = 0, totalLearned = 0;
  scope.forEach((l) => {
    totalTarget += vocab(l).length;
    totalLearned += countLearned(l);
  });
  const remaining = totalTarget - totalLearned;
  const pct = totalTarget > 0 ? Math.round((totalLearned / totalTarget) * 100) : 0;

  function launchFlashcardDue() {
    setFlashcardIntent({ range: "due", level: (goal || "n5") as Level });
    router.push("/(tabs)/flashcard");
  }
  function launchShadowGrammar() {
    setShadowIntent({ kind: "grammar", level: (goal || "n5") as Level });
    router.push("/(tabs)/shadowing");
  }
  function launchFlashcardLearn() {
    setFlashcardIntent({ range: "new", level: (goal || "n5") as Level });
    router.push("/(tabs)/flashcard");
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#f8fafc" }}
      contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: 32, paddingHorizontal: 20 }}
    >
      {/* Hero — exam countdown */}
      <AeroCard accent="#2563eb" className="mb-3">
        <View className="p-5">
          <Text className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-1">距離考試</Text>
          {days !== null ? (
            <>
              <Text style={{ fontFamily: "NotoSansJP_700Bold" }} className="text-5xl font-extrabold text-slate-900 tracking-tight">
                {days >= 0 ? days : -days}
                <Text className="text-2xl font-bold text-slate-700"> 天</Text>
              </Text>
              <Text className="text-sm text-slate-500 mt-1">{goal ? `目標 ${(goal as string).toUpperCase()}` : "尚未設定目標"}{days < 0 ? " · 已過" : ""}</Text>
            </>
          ) : (
            <Text className="text-base text-slate-600 mt-2">尚未設定考試日期</Text>
          )}
        </View>
      </AeroCard>

      {/* Today review */}
      <AeroCard accent="#2563eb" className="mb-3">
        <View className="p-5">
          <Text className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-1">今日複習</Text>
          <View className="flex-row items-baseline gap-3 mt-1">
            <Text style={{ fontFamily: "NotoSansJP_700Bold" }} className="text-4xl font-extrabold text-slate-900">{due}</Text>
            <Text className="text-base text-slate-600">字待複習</Text>
          </View>
          {due > 0 ? (
            <View className="mt-4 gap-2">
              <Button label="複習今日單字" onPress={launchFlashcardDue} />
              <Button variant="secondary" label="跟讀今日語法" onPress={launchShadowGrammar} />
            </View>
          ) : (
            <Text className="text-sm text-slate-500 mt-2">今天沒有待複習,可以背新詞 ↓</Text>
          )}
        </View>
      </AeroCard>

      {/* Learning progress */}
      <AeroCard accent="#2563eb" className="mb-3">
        <View className="p-5">
          <Text className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-1">學習進度</Text>
          <Text className="text-base text-slate-700 mt-1">
            {base === "none" ? "零基礎" : (base as string).toUpperCase()} → {goal ? (goal as string).toUpperCase() : "(未設目標)"}
          </Text>
          {totalTarget > 0 && (
            <>
              <View className="flex-row items-baseline gap-2 mt-2">
                <Text style={{ fontFamily: "NotoSansJP_700Bold" }} className="text-3xl font-extrabold text-slate-900">{totalLearned}</Text>
                <Text className="text-base text-slate-500">/ {totalTarget} 個</Text>
                <Text className="ml-auto text-sm text-slate-500">{pct}%</Text>
              </View>
              <View className="h-1.5 bg-slate-200 rounded-full mt-2 overflow-hidden">
                <View className="h-full bg-indigo-500" style={{ width: `${pct}%` }} />
              </View>
              <Text className="text-sm text-slate-500 mt-2">還要背 {remaining} 個</Text>
            </>
          )}
          <View className="mt-4">
            <Button variant="secondary" label="繼續背單字" onPress={launchFlashcardLearn} />
          </View>
        </View>
      </AeroCard>

      {/* Streak placeholder */}
      <AeroCard className="mb-3">
        <View className="p-5">
          <Text className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-1">連續打卡</Text>
          <Text className="text-sm text-slate-500 mt-2">每日打卡日曆即將上線</Text>
        </View>
      </AeroCard>
    </ScrollView>
  );
}
```

- [ ] **Step 1: Implement file per above**

- [ ] **Step 2: Verify tsc + tests**

```bash
pnpm test
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/\(tabs\)/today.tsx
git commit -m "feat(today): daily dashboard — exam countdown, due review, progress, launch buttons"
```

---

### Task 5: Flashcard tab consumes launch intent

**Files:**
- Modify: `app/(tabs)/flashcard.tsx`

- [ ] **Step 1: On mount, read pendingFlashcard and auto-start if set**

Add at top of the component:

```tsx
import { useEffect } from "react";
import { useLaunchIntent } from "../../src/stores/launchIntent";
// inside FlashcardTab():
const { pendingFlashcard, setFlashcardIntent } = useLaunchIntent();
const startSession = useSession((s) => s.start);

useEffect(() => {
  if (!pendingFlashcard) return;
  const { range, level } = pendingFlashcard;
  // default count
  startSession((level || "n5") as Level, 20, range);
  setFlashcardIntent(null);
}, [pendingFlashcard]);
```

This means when 今日 tab pushes intent + navigates here, on mount the session auto-starts.

- [ ] **Step 2: Commit**

```bash
git add app/\(tabs\)/flashcard.tsx
git commit -m "feat(flashcard): consume launch intent for auto-start from 今日 tab"
```

---

### Task 6: Shadow tab consumes launch intent

**Files:**
- Modify: `app/(tabs)/shadowing.tsx`

- [ ] **Step 1: Auto-start with intent**

Similar pattern: on mount, if `pendingShadow` set, build queue per kind/level/range and call `useShadow.start(queue)`.

```tsx
import { useEffect } from "react";
import { useLaunchIntent } from "../../src/stores/launchIntent";
import { collectGrammarItems, collectVocabItems } from "../../src/shadow/sources";
import { useShadow } from "../../src/shadow/session";
// inside ShadowingTab:
const { pendingShadow, setShadowIntent } = useLaunchIntent();
const startShadow = useShadow((s) => s.start);

useEffect(() => {
  if (!pendingShadow) return;
  const { kind, level, range } = pendingShadow;
  let queue: ShadowItem[] = [];
  if (kind === "grammar") queue = collectGrammarItems(level || "n5");
  else if (kind === "vocab") queue = collectVocabItems(level || "n5", range || "all");
  // favorites kind unsupported via intent for now; ignore silently
  setShadowIntent(null);
  if (queue.length) startShadow(queue);
}, [pendingShadow]);
```

- [ ] **Step 2: Commit**

```bash
git add app/\(tabs\)/shadowing.tsx
git commit -m "feat(shadow): consume launch intent for auto-start from 今日 tab"
```

---

### Task 7: Verify navigation flow end-to-end

**Files:** none

- [ ] **Step 1: Manual smoke (user-side)**

Manual checklist for user:
1. Sign in → lands on **今日 tab** (not flashcard)
2. 今日 hero shows exam countdown if set, else "尚未設定考試日期"
3. 今日複習 card shows due count; tap "複習今日單字" → navigates to 單字 tab AND session auto-starts in due mode
4. 今日 progress card shows learned/total; tap "繼續背單字" → 單字 tab auto-start in new mode
5. 跟讀今日語法 → 跟讀 tab auto-start with grammar at goal level
6. After auto-start, user can normally exit the session and use the tab manually (intent cleared, no loop)
7. Removed 測驗 tab is no longer in bottom nav

- [ ] **Step 2: If issues found, file as P5.0.1 fixes**

---

## Done Criteria for P5

- [ ] All 6 implementation tasks committed
- [ ] `pnpm test` passes (no new tests required — UI orchestration; if you have time, add a launchIntent state test)
- [ ] `npx tsc --noEmit` 0 errors
- [ ] Manual flow per Task 7 walks cleanly

## Out of Scope for P5 (deferred)

- **P5.1:** Real daily-activity logging + streak calendar heatmap
- **P6:** Vocab browse list inside 單字 tab (currently only Flashcard SRS panel lives there)
- **P6.5:** Grammar browse list inside 文法 tab (currently placeholder)
- **P7:** grammar_srs sync (so grammar shadowing/quiz can filter by SRS state)
- **P8:** quiz tab proper, offline audio download
- 今日待複習計算「文法」部分目前都是 0 — 因為 grammar_srs 尚未 sync
- Intent-driven deep links from external (push notifications, share sheets)

## Open Questions

(none — every store, prop, and screen referenced exists today)
