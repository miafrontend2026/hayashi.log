# StayJP P3 — Flashcard (26-second Mode) + SRS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Port the web's `flashcard.js` (26-second countdown auto-flip + swipe gestures + 3-tier rating + cross-level due review) and `srs.js` (interval/ease-based SRS) to React Native. Replace the P2 placeholder in the 單字 tab with the real Flashcard experience.

**Architecture:** Pure-TS SRS module (no React). Zustand store for in-flight session state (queue, current index, score). Settings persistence via MMKV mirror + Firestore sync (P1 sync layer reused). Card flip uses `react-native-reanimated` v3 worklets for 60fps. Swipe uses `react-native-gesture-handler` `PanGestureHandler`. No audio in P3 (audio bundle deferred to P8).

**Tech Stack:** existing — `react-native-reanimated`, `react-native-gesture-handler`, `expo-router`, Zustand, MMKV.

**Reference spec:** `stay-jp-notes/docs/superpowers/specs/2026-05-19-stayjp-app-design.md` § 5.C (Flashcard 26秒模式).
**Reference web code:**
- `stay-jp-notes/srs.js` (208 lines) — SRS algorithm to port (translate `recordGrade` / `getDue` / `getNew` / `getStats` / `isDue` verbatim)
- `stay-jp-notes/flashcard.js` (488 lines) — UI and queue building

---

## File Structure

```
stayjp-app/
├── src/
│   ├── srs/
│   │   ├── algo.ts            # pure SRS: recordGrade, isDue, computeNext
│   │   ├── store.ts           # MMKV-backed SRS data + Firestore sync
│   │   ├── queue.ts           # buildQueue(level, count, range, srsData, vocab)
│   │   └── stats.ts           # getStats, getDueCount, countLearned, scopeLevels
│   ├── flashcard/
│   │   ├── session.ts         # Zustand: queue, cur, score, status
│   │   ├── Card.tsx           # rotating card with front/back, reanimated worklet
│   │   ├── Countdown.tsx      # 26s ring/bar timer
│   │   ├── RatingButtons.tsx  # 不會 / 半生熟 / 記得
│   │   ├── SettingsPanel.tsx  # level / count / range / base / goal / exam
│   │   ├── DoneScreen.tsx     # stats summary after queue empty
│   │   └── exam-dates.ts      # firstSundayOf, getUpcomingJlptDates
│   └── stores/
│       └── prefsStore.ts      # base/goal/examDate (Zustand + MMKV)
└── app/
    └── (tabs)/
        └── flashcard.tsx      # orchestrates Settings → Session → Done
```

---

### Task 1: Define SRS types

**Files:**
- Create: `stayjp-app/src/srs/types.ts`

- [ ] **Step 1: Write types**

```ts
// src/srs/types.ts
import type { Level } from "../types/content";

export type Grade = "known" | "soso" | "unknown";

export interface SrsEntry {
  interval: number;       // days; 0 means hasn't graduated yet
  ease: number;           // multiplier
  reviews: number;
  correct: number;
  lastReviewTs?: number;
  nextReviewTs: number;   // ms epoch
  nextReview: string;     // ISO date (yyyy-mm-dd) — kept for web compat
}

export type SrsData = Record<string, SrsEntry>;  // key = `${level}:${word}`

export const GRADES = {
  known:   { ms: 7 * 86400 * 1000, label: "一週後" },
  soso:    { ms: 60 * 60 * 1000,   label: "1 小時後" },
  unknown: { ms: 10 * 60 * 1000,   label: "10 分鐘後" },
} as const satisfies Record<Grade, { ms: number; label: string }>;
```

- [ ] **Step 2: Commit**

```bash
git add src/srs/types.ts
git commit -m "feat(srs): types (Grade, SrsEntry, SrsData, GRADES)"
```

---

### Task 2: SRS algorithm (pure functions, TDD)

**Files:**
- Create: `stayjp-app/src/srs/algo.ts`
- Create: `stayjp-app/__tests__/srs-algo.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// __tests__/srs-algo.test.ts
import { applyGrade, isDue, srsKey } from "../src/srs/algo";
import type { SrsEntry } from "../src/srs/types";

const FIXED_NOW = 1_700_000_000_000;

test("srsKey produces stable string", () => {
  expect(srsKey("n5", "水")).toBe("n5:水");
});

test("isDue returns true when nextReviewTs <= now", () => {
  const e: SrsEntry = { interval: 1, ease: 2.5, reviews: 1, correct: 1, nextReviewTs: FIXED_NOW - 1, nextReview: "2024-01-01" };
  expect(isDue(e, FIXED_NOW)).toBe(true);
});

test("isDue returns false when nextReviewTs > now", () => {
  const e: SrsEntry = { interval: 1, ease: 2.5, reviews: 1, correct: 1, nextReviewTs: FIXED_NOW + 1000, nextReview: "2099-01-01" };
  expect(isDue(e, FIXED_NOW)).toBe(false);
});

test("applyGrade(known) -> interval 7 days, ease +0.1 (cap 3)", () => {
  const out = applyGrade(undefined, "known", FIXED_NOW);
  expect(out.interval).toBe(7);
  expect(out.ease).toBe(2.6);
  expect(out.correct).toBe(1);
  expect(out.nextReviewTs).toBe(FIXED_NOW + 7 * 86400 * 1000);
});

test("applyGrade(soso) -> interval 0, ease -0.1, next +1h", () => {
  const out = applyGrade(undefined, "soso", FIXED_NOW);
  expect(out.interval).toBe(0);
  expect(out.ease).toBeCloseTo(2.4);
  expect(out.nextReviewTs).toBe(FIXED_NOW + 60 * 60 * 1000);
});

test("applyGrade(unknown) -> ease floor 1.3", () => {
  const e: SrsEntry = { interval: 1, ease: 1.4, reviews: 5, correct: 3, nextReviewTs: 0, nextReview: "" };
  const out = applyGrade(e, "unknown", FIXED_NOW);
  expect(out.ease).toBe(1.3);
  expect(out.nextReviewTs).toBe(FIXED_NOW + 10 * 60 * 1000);
});
```

- [ ] **Step 2: Run, expect FAIL**

```bash
pnpm test srs-algo
```

- [ ] **Step 3: Implement algo.ts**

```ts
// src/srs/algo.ts
import type { Level } from "../types/content";
import type { Grade, SrsEntry } from "./types";
import { GRADES } from "./types";

export function srsKey(level: Level, word: string): string {
  return `${level}:${word}`;
}

export function isDue(e: SrsEntry | undefined, now: number): boolean {
  if (!e) return false;
  return e.nextReviewTs <= now;
}

function dayIsoOf(ts: number): string {
  return new Date(ts).toISOString().split("T")[0];
}

export function applyGrade(prev: SrsEntry | undefined, grade: Grade, now: number): SrsEntry {
  const spec = GRADES[grade];
  const base: SrsEntry = prev ?? {
    interval: 0, ease: 2.5, reviews: 0, correct: 0,
    nextReviewTs: now, nextReview: dayIsoOf(now),
  };
  const next: SrsEntry = {
    ...base,
    reviews: base.reviews + 1,
    lastReviewTs: now,
  };
  if (grade === "known") {
    next.correct = base.correct + 1;
    next.interval = 7;
    next.ease = Math.min(3, base.ease + 0.1);
  } else {
    next.interval = 0;
    next.ease = Math.max(1.3, base.ease - (grade === "unknown" ? 0.2 : 0.1));
  }
  next.nextReviewTs = now + spec.ms;
  next.nextReview = dayIsoOf(next.nextReviewTs);
  return next;
}
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/srs/algo.ts __tests__/srs-algo.test.ts
git commit -m "feat(srs): pure algo (applyGrade, isDue, srsKey) — port from web srs.js"
```

---

### Task 3: SRS store (MMKV + Firestore sync, TDD)

**Files:**
- Create: `stayjp-app/src/srs/store.ts`
- Create: `stayjp-app/__tests__/srs-store.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// __tests__/srs-store.test.ts
import { storage } from "../src/lib/storage";
import { recordGrade, getSrsData, getEntry } from "../src/srs/store";

beforeEach(() => storage.clearAll());

test("recordGrade writes new entry and getEntry reads it back", () => {
  recordGrade("n5", "水", "known", 1_700_000_000_000);
  const e = getEntry("n5", "水");
  expect(e?.interval).toBe(7);
  expect(e?.correct).toBe(1);
});

test("recordGrade twice on same word updates the entry", () => {
  recordGrade("n5", "火", "soso", 1_700_000_000_000);
  recordGrade("n5", "火", "known", 1_700_000_000_000 + 1000);
  const e = getEntry("n5", "火")!;
  expect(e.reviews).toBe(2);
  expect(e.interval).toBe(7);
});

test("getSrsData returns the entire map", () => {
  recordGrade("n5", "犬", "known", 1_700_000_000_000);
  recordGrade("n4", "犬", "soso", 1_700_000_000_000);
  const all = getSrsData();
  expect(Object.keys(all)).toHaveLength(2);
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement store.ts**

```ts
// src/srs/store.ts
import { getJSON, setJSON } from "../lib/storage";
import { schedulePush } from "../lib/sync";
import { applyGrade, srsKey } from "./algo";
import type { Grade, SrsData, SrsEntry } from "./types";
import type { Level } from "../types/content";

const KEY = "srs/data";

export function getSrsData(): SrsData {
  return getJSON<SrsData>(KEY) ?? {};
}

export function setSrsData(d: SrsData): void {
  setJSON<SrsData>(KEY, d);
  schedulePush(KEY);
}

export function getEntry(level: Level, word: string): SrsEntry | undefined {
  return getSrsData()[srsKey(level, word)];
}

export function recordGrade(level: Level, word: string, grade: Grade, now: number = Date.now()): void {
  const d = getSrsData();
  const k = srsKey(level, word);
  d[k] = applyGrade(d[k], grade, now);
  setSrsData(d);
}
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/srs/store.ts __tests__/srs-store.test.ts
git commit -m "feat(srs): MMKV-backed store with sync-on-write"
```

---

### Task 4: Stats helpers

**Files:**
- Create: `stayjp-app/src/srs/stats.ts`
- Create: `stayjp-app/__tests__/srs-stats.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// __tests__/srs-stats.test.ts
import { storage } from "../src/lib/storage";
import { recordGrade } from "../src/srs/store";
import { getStats, getDueCount, countLearned, scopeLevels } from "../src/srs/stats";

beforeEach(() => storage.clearAll());

test("countLearned counts entries with correct > 0", () => {
  recordGrade("n5", "水", "known", Date.now());
  recordGrade("n5", "火", "soso", Date.now());
  expect(countLearned("n5")).toBe(1);
});

test("getStats returns total/due/mastered/learning", () => {
  const now = Date.now();
  recordGrade("n5", "水", "known", now);
  recordGrade("n5", "火", "soso", now);
  const s = getStats("n5", now);
  expect(s.total).toBe(2);
  expect(s.due).toBeGreaterThan(0);
});

test("scopeLevels excludes base and includes goal", () => {
  expect(scopeLevels("n5", "n3")).toEqual(["n4", "n3"]);
  expect(scopeLevels("none", "n2")).toEqual(["n5", "n4", "n3", "n2"]);
  expect(scopeLevels("n2", "n2")).toEqual([]);
});

test("getDueCount totals across all levels", () => {
  recordGrade("n5", "水", "soso", Date.now() - 99 * 60 * 60 * 1000);
  recordGrade("n4", "火", "soso", Date.now() - 99 * 60 * 60 * 1000);
  expect(getDueCount(Date.now())).toBeGreaterThanOrEqual(2);
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement stats.ts**

```ts
// src/srs/stats.ts
import { LEVELS, type Level } from "../types/content";
import { getSrsData } from "./store";
import { isDue } from "./algo";

export interface Stats {
  total: number;
  due: number;
  mastered: number;   // interval >= 21 days
  learning: number;
}

export function getStats(level: Level, now: number = Date.now()): Stats {
  const d = getSrsData();
  const pf = level + ":";
  const entries = Object.entries(d).filter(([k]) => k.startsWith(pf));
  return {
    total: entries.length,
    due: entries.filter(([, e]) => isDue(e, now)).length,
    mastered: entries.filter(([, e]) => e.interval >= 21).length,
    learning: entries.filter(([, e]) => e.interval > 0 && e.interval < 21).length,
  };
}

export function countLearned(level: Level): number {
  const d = getSrsData();
  const pf = level + ":";
  let n = 0;
  for (const k in d) if (k.startsWith(pf) && (d[k].correct ?? 0) > 0) n++;
  return n;
}

export function getDueCount(now: number = Date.now()): number {
  const d = getSrsData();
  let c = 0;
  for (const k in d) if (isDue(d[k], now)) c++;
  return c;
}

export type BaseLevel = "none" | "n5" | "n4" | "n3" | "n2";

export function scopeLevels(base: BaseLevel, goal: Level | ""): Level[] {
  if (!goal) return [];
  const gi = LEVELS.indexOf(goal);
  if (gi < 0) return [];
  const bi = base === "none" ? -1 : LEVELS.indexOf(base);
  return LEVELS.slice(bi + 1, gi + 1);
}
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/srs/stats.ts __tests__/srs-stats.test.ts
git commit -m "feat(srs): stats — getStats, countLearned, getDueCount, scopeLevels"
```

---

### Task 5: Prefs store (base / goal / exam date)

**Files:**
- Create: `stayjp-app/src/stores/prefsStore.ts`
- Create: `stayjp-app/__tests__/prefs-store.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// __tests__/prefs-store.test.ts
import { storage } from "../src/lib/storage";
import { setPref, getPref } from "../src/stores/prefsStore";

beforeEach(() => storage.clearAll());

test("setPref / getPref roundtrip for base level", () => {
  setPref("baseLevel", "n4");
  expect(getPref("baseLevel")).toBe("n4");
});

test("getPref returns default when unset", () => {
  expect(getPref("baseLevel")).toBe("none");
  expect(getPref("goalLevel")).toBe("");
  expect(getPref("examDate")).toBe("");
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement prefsStore.ts**

```ts
// src/stores/prefsStore.ts
import { getJSON, setJSON } from "../lib/storage";
import { schedulePush } from "../lib/sync";
import type { Level } from "../types/content";
import type { BaseLevel } from "../srs/stats";

export interface Prefs {
  baseLevel: BaseLevel;
  goalLevel: Level | "";
  examDate: string;   // ISO yyyy-mm-dd; "" = unset
}

const KEY = "prefs/learning";
const DEFAULT: Prefs = { baseLevel: "none", goalLevel: "", examDate: "" };

function getAll(): Prefs {
  return getJSON<Prefs>(KEY) ?? DEFAULT;
}

export function getPref<K extends keyof Prefs>(k: K): Prefs[K] {
  return getAll()[k];
}

export function setPref<K extends keyof Prefs>(k: K, v: Prefs[K]): void {
  const cur = getAll();
  setJSON<Prefs>(KEY, { ...cur, [k]: v });
  schedulePush(KEY);
}
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/stores/prefsStore.ts __tests__/prefs-store.test.ts
git commit -m "feat(prefs): MMKV store for base/goal/examDate"
```

---

### Task 6: Queue builder

**Files:**
- Create: `stayjp-app/src/srs/queue.ts`
- Create: `stayjp-app/__tests__/srs-queue.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// __tests__/srs-queue.test.ts
import { storage } from "../src/lib/storage";
import { recordGrade } from "../src/srs/store";
import { buildQueue } from "../src/srs/queue";

beforeEach(() => storage.clearAll());

test("buildQueue range='new' returns unlearned words", () => {
  const q = buildQueue("n5", 5, "new");
  expect(q.length).toBeLessThanOrEqual(5);
  q.forEach(c => { expect(c.isNew).toBe(true); });
});

test("buildQueue range='due' includes due reviews (cross-level)", () => {
  recordGrade("n5", "水", "unknown", Date.now() - 99 * 60 * 60 * 1000); // due
  recordGrade("n4", "火", "unknown", Date.now() - 99 * 60 * 60 * 1000); // due
  const q = buildQueue("n5", 10, "due");
  // queue may contain entries from both levels
  expect(q.length).toBeGreaterThanOrEqual(2);
});

test("buildQueue range='random' returns up to count items", () => {
  const q = buildQueue("n5", 10, "random");
  expect(q.length).toBeLessThanOrEqual(10);
  expect(q.length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement queue.ts**

```ts
// src/srs/queue.ts
import { vocab } from "../lib/content";
import { LEVELS, type Level } from "../types/content";
import type { Word } from "../types/content";
import { getSrsData } from "./store";
import { isDue } from "./algo";
import { srsKey } from "./algo";

export type Range = "new" | "due" | "random";

export interface QueueItem extends Word {
  level: Level;
  isNew: boolean;
}

export function buildQueue(level: Level, count: number, range: Range, now: number = Date.now()): QueueItem[] {
  const srs = getSrsData();
  if (range === "new") {
    const learnedSet = new Set(
      Object.keys(srs).filter(k => k.startsWith(level + ":"))
        .map(k => k.slice(level.length + 1))
    );
    return vocab(level)
      .filter(v => !learnedSet.has(v.w))
      .slice(0, count)
      .map(v => ({ ...v, level, isNew: true }));
  }
  if (range === "due") {
    // cross-level due (matches web behavior)
    const dueKeys = Object.entries(srs)
      .filter(([, e]) => isDue(e, now))
      .map(([k]) => k);
    const out: QueueItem[] = [];
    for (const k of dueKeys) {
      const ci = k.indexOf(":");
      const lv = k.slice(0, ci) as Level;
      const word = k.slice(ci + 1);
      const v = vocab(lv).find(w => w.w === word);
      if (v) out.push({ ...v, level: lv, isNew: false });
      if (out.length >= count) break;
    }
    return out;
  }
  // random — sample from current level (or scope; keep simple = current level)
  const all = vocab(level);
  const shuf = [...all].sort(() => Math.random() - 0.5);
  return shuf.slice(0, count).map(v => {
    const has = srs[srsKey(level, v.w)] !== undefined;
    return { ...v, level, isNew: !has };
  });
}
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/srs/queue.ts __tests__/srs-queue.test.ts
git commit -m "feat(srs): queue builder (new/due cross-level/random)"
```

---

### Task 7: JLPT exam date helpers

**Files:**
- Create: `stayjp-app/src/flashcard/exam-dates.ts`
- Create: `stayjp-app/__tests__/exam-dates.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// __tests__/exam-dates.test.ts
import { firstSundayOf, getUpcomingJlptDates, daysUntilExam } from "../src/flashcard/exam-dates";

test("firstSundayOf 2027 July is 2027-07-04 (Sunday)", () => {
  const d = firstSundayOf(2027, 7);
  expect(d.getFullYear()).toBe(2027);
  expect(d.getMonth()).toBe(6);
  expect(d.getDay()).toBe(0);
});

test("getUpcomingJlptDates returns N future dates", () => {
  const out = getUpcomingJlptDates(4, new Date("2027-01-01"));
  expect(out).toHaveLength(4);
  out.forEach(x => expect(new Date(x.iso) >= new Date("2027-01-01")).toBe(true));
});

test("daysUntilExam returns positive int when future", () => {
  const futureIso = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  expect(daysUntilExam(futureIso)).toBeGreaterThan(25);
});

test("daysUntilExam returns null for empty string", () => {
  expect(daysUntilExam("")).toBeNull();
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement exam-dates.ts**

```ts
// src/flashcard/exam-dates.ts
export function firstSundayOf(year: number, month: number): Date {
  for (let day = 1; day <= 7; day++) {
    const d = new Date(year, month - 1, day);
    if (d.getDay() === 0) return d;
  }
  throw new Error("unreachable");
}

export interface UpcomingExam {
  date: Date;
  label: string;
  iso: string;
}

export function getUpcomingJlptDates(count: number, fromDate: Date = new Date()): UpcomingExam[] {
  const today = new Date(fromDate);
  today.setHours(0, 0, 0, 0);
  const out: UpcomingExam[] = [];
  let y = today.getFullYear();
  while (out.length < count) {
    for (const [m, label] of [[7, "第 1 回 (7月)"], [12, "第 2 回 (12月)"]] as const) {
      if (out.length >= count) break;
      const d = firstSundayOf(y, m);
      if (d >= today) {
        const iso = `${d.getFullYear()}-${String(m).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        out.push({ date: d, iso, label: `${iso} JLPT ${label}` });
      }
    }
    y++;
  }
  return out;
}

export function daysUntilExam(iso: string): number | null {
  if (!iso) return null;
  const exam = new Date(iso); exam.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.ceil((exam.getTime() - today.getTime()) / 86400000);
}
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/flashcard/exam-dates.ts __tests__/exam-dates.test.ts
git commit -m "feat(flashcard): JLPT exam date helpers"
```

---

### Task 8: Session store (Zustand)

**Files:**
- Create: `stayjp-app/src/flashcard/session.ts`

- [ ] **Step 1: Implement session.ts**

```ts
// src/flashcard/session.ts
import { create } from "zustand";
import type { QueueItem, Range } from "../srs/queue";
import { buildQueue } from "../srs/queue";
import { recordGrade } from "../srs/store";
import type { Grade, Level } from "../types/content";

export type SessionStatus = "idle" | "running" | "done";

interface SessionState {
  status: SessionStatus;
  queue: QueueItem[];
  cur: number;
  score: { known: number; soso: number; unknown: number };
  flipped: boolean;
  start: (level: Level, count: number, range: Range) => void;
  flip: () => void;
  rate: (grade: Grade) => void;
  reset: () => void;
}

const INITIAL = {
  status: "idle" as SessionStatus,
  queue: [] as QueueItem[],
  cur: 0,
  score: { known: 0, soso: 0, unknown: 0 },
  flipped: false,
};

export const useSession = create<SessionState>((set, get) => ({
  ...INITIAL,
  start: (level, count, range) => {
    const queue = buildQueue(level, count, range);
    set({ ...INITIAL, queue, status: queue.length ? "running" : "done" });
  },
  flip: () => set({ flipped: true }),
  rate: (grade) => {
    const { queue, cur, score } = get();
    const item = queue[cur];
    if (!item) return;
    recordGrade(item.level, item.w, grade);
    const nextScore = { ...score, [grade]: score[grade] + 1 };
    const nextCur = cur + 1;
    if (nextCur >= queue.length) {
      set({ status: "done", score: nextScore, cur: nextCur, flipped: false });
    } else {
      set({ cur: nextCur, score: nextScore, flipped: false });
    }
  },
  reset: () => set(INITIAL),
}));
```

- [ ] **Step 2: Commit**

```bash
git add src/flashcard/session.ts
git commit -m "feat(flashcard): Zustand session store"
```

---

### Task 9: Countdown timer component

**Files:**
- Create: `stayjp-app/src/flashcard/Countdown.tsx`

- [ ] **Step 1: Implement Countdown.tsx**

```tsx
// src/flashcard/Countdown.tsx
import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  cancelAnimation,
  runOnJS,
} from "react-native-reanimated";

export interface CountdownProps {
  seconds: number;       // total countdown duration
  resetKey: string;      // change this prop to restart the countdown
  onComplete: () => void;
}

export function Countdown({ seconds, resetKey, onComplete }: CountdownProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: seconds * 1000 }, (finished) => {
      if (finished) runOnJS(onComplete)();
    });
    return () => cancelAnimation(progress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, seconds]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <View className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
      <Animated.View style={[barStyle]} className="h-full bg-rose-500" />
    </View>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/flashcard/Countdown.tsx
git commit -m "feat(flashcard): Countdown bar (reanimated worklet)"
```

---

### Task 10: Card with flip animation + swipe gestures

**Files:**
- Create: `stayjp-app/src/flashcard/Card.tsx`

- [ ] **Step 1: Implement Card.tsx**

```tsx
// src/flashcard/Card.tsx
import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import type { QueueItem } from "../srs/queue";
import type { Grade } from "../types/content";

interface Props {
  item: QueueItem;
  index: number;          // change index → reset gesture state
  flipped: boolean;
  onFlip: () => void;
  onRate: (g: Grade) => void;
}

const SWIPE_THRESHOLD = 120;

export function Card({ item, index, flipped, onFlip, onRate }: Props) {
  const flipAnim = useSharedValue(0); // 0 front, 1 back
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);

  useEffect(() => {
    flipAnim.value = withTiming(flipped ? 1 : 0, { duration: 320 });
  }, [flipped]);

  useEffect(() => {
    tx.value = 0; ty.value = 0;
    flipAnim.value = 0;
  }, [index]);

  const front = useAnimatedStyle(() => {
    const rot = interpolate(flipAnim.value, [0, 1], [0, 180]);
    return {
      transform: [{ translateX: tx.value }, { translateY: ty.value }, { perspective: 1000 }, { rotateY: `${rot}deg` }],
      opacity: flipAnim.value < 0.5 ? 1 : 0,
      position: "absolute", inset: 0,
    };
  });
  const back = useAnimatedStyle(() => {
    const rot = interpolate(flipAnim.value, [0, 1], [180, 360]);
    return {
      transform: [{ translateX: tx.value }, { translateY: ty.value }, { perspective: 1000 }, { rotateY: `${rot}deg` }],
      opacity: flipAnim.value >= 0.5 ? 1 : 0,
      position: "absolute", inset: 0,
    };
  });

  const pan = Gesture.Pan()
    .onUpdate(e => {
      tx.value = e.translationX;
      ty.value = e.translationY * 0.3;
    })
    .onEnd(e => {
      if (e.translationX > SWIPE_THRESHOLD) {
        tx.value = withTiming(500, { duration: 200 });
        runOnJS(onRate)("known");
      } else if (e.translationX < -SWIPE_THRESHOLD) {
        tx.value = withTiming(-500, { duration: 200 });
        runOnJS(onRate)("unknown");
      } else {
        tx.value = withSpring(0);
        ty.value = withSpring(0);
      }
    });

  return (
    <GestureDetector gesture={pan}>
      <View style={{ width: "100%", height: 320, position: "relative" }}>
        <Animated.View style={front}>
          <Pressable onPress={onFlip} className="bg-white rounded-3xl border border-gray-200 p-8 flex-1 items-center justify-center">
            <Text className="text-xs text-gray-400 mb-2">{item.level.toUpperCase()}</Text>
            <Text className="text-5xl font-bold text-gray-900">{item.w}</Text>
            {item.w !== item.r && <Text className="text-xl text-gray-600 mt-3">{item.r}</Text>}
            <Text className="text-xs text-gray-400 mt-6">點擊翻面</Text>
          </Pressable>
        </Animated.View>
        <Animated.View style={back}>
          <View className="bg-white rounded-3xl border border-gray-200 p-8 flex-1 items-center justify-center">
            <Text className="text-xs text-gray-400 mb-2">{item.level.toUpperCase()}</Text>
            <Text className="text-3xl font-bold text-gray-900">{item.w}</Text>
            {item.w !== item.r && <Text className="text-lg text-gray-600 mt-2">{item.r}</Text>}
            {item.m && item.m !== item.w && <Text className="text-base text-gray-700 mt-6 text-center">{item.m}</Text>}
            <Text className="text-xs text-gray-400 mt-6">←不會　半生熟　會→</Text>
          </View>
        </Animated.View>
      </View>
    </GestureDetector>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/flashcard/Card.tsx
git commit -m "feat(flashcard): Card with flip + pan-to-swipe"
```

---

### Task 11: Rating buttons (3-tier)

**Files:**
- Create: `stayjp-app/src/flashcard/RatingButtons.tsx`

- [ ] **Step 1: Implement RatingButtons.tsx**

```tsx
// src/flashcard/RatingButtons.tsx
import { Pressable, Text, View } from "react-native";
import type { Grade } from "../types/content";

interface Props {
  onRate: (g: Grade) => void;
  disabled?: boolean;
}

const buttons: { grade: Grade; label: string; cls: string }[] = [
  { grade: "unknown", label: "不會",  cls: "bg-rose-100 active:bg-rose-200" },
  { grade: "soso",    label: "半生熟", cls: "bg-amber-100 active:bg-amber-200" },
  { grade: "known",   label: "記得",  cls: "bg-emerald-100 active:bg-emerald-200" },
];

const textCls: Record<Grade, string> = {
  unknown: "text-rose-700",
  soso: "text-amber-700",
  known: "text-emerald-700",
};

export function RatingButtons({ onRate, disabled }: Props) {
  return (
    <View className="flex-row gap-3 mt-6">
      {buttons.map(b => (
        <Pressable
          key={b.grade}
          disabled={disabled}
          onPress={() => onRate(b.grade)}
          className={`flex-1 ${b.cls} rounded-2xl py-4 items-center justify-center`}
        >
          <Text className={`font-semibold ${textCls[b.grade]}`}>{b.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/flashcard/RatingButtons.tsx
git commit -m "feat(flashcard): 3-tier rating buttons"
```

---

### Task 12: Settings panel

**Files:**
- Create: `stayjp-app/src/flashcard/SettingsPanel.tsx`

- [ ] **Step 1: Implement SettingsPanel.tsx**

```tsx
// src/flashcard/SettingsPanel.tsx
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Button } from "../components/Button";
import { allLevels } from "../lib/content";
import { vocab } from "../lib/content";
import { countLearned, scopeLevels } from "../srs/stats";
import { getPref, setPref } from "../stores/prefsStore";
import { getUpcomingJlptDates, daysUntilExam } from "./exam-dates";
import type { Level } from "../types/content";
import type { BaseLevel } from "../srs/stats";
import type { Range } from "../srs/queue";

interface Props {
  onStart: (level: Level, count: number, range: Range) => void;
}

const COUNTS = [10, 20, 50] as const;
const RANGES: { v: Range; label: string }[] = [
  { v: "new", label: "新詞為主" },
  { v: "due", label: "待複習" },
  { v: "random", label: "全部隨機" },
];

export function SettingsPanel({ onStart }: Props) {
  const [level, setLevel] = useState<Level>("n5");
  const [count, setCount] = useState<number>(20);
  const [range, setRange] = useState<Range>("new");
  const [base, setBase] = useState<BaseLevel>(getPref("baseLevel"));
  const [goal, setGoal] = useState<Level | "">(getPref("goalLevel"));
  const [exam, setExam] = useState<string>(getPref("examDate"));

  const upcoming = useMemo(() => getUpcomingJlptDates(6), []);

  const scope = scopeLevels(base, goal);
  const totals = scope.map(l => ({
    lv: l,
    total: vocab(l).length,
    learned: countLearned(l),
  }));
  const totalRemaining = totals.reduce((sum, t) => sum + (t.total - t.learned), 0);
  const days = daysUntilExam(exam);
  const perDay = days && days > 0 && totalRemaining > 0 ? Math.ceil(totalRemaining / days) : null;

  function commitPrefs(next: { base?: BaseLevel; goal?: Level | ""; exam?: string }) {
    if (next.base !== undefined) { setBase(next.base); setPref("baseLevel", next.base); }
    if (next.goal !== undefined) { setGoal(next.goal); setPref("goalLevel", next.goal); }
    if (next.exam !== undefined) { setExam(next.exam); setPref("examDate", next.exam); }
  }

  return (
    <ScrollView contentContainerClassName="px-5 pb-32">
      <Text className="text-2xl font-bold mt-4 mb-1">快速背單字</Text>
      <Text className="text-sm text-gray-500 mb-4">每張 20 秒自動翻面 · 左右滑或按按鈕評分</Text>

      <PillRow label="級別" value={level} options={allLevels.map(l => ({ v: l, label: l.toUpperCase() }))} onChange={v => setLevel(v as Level)} />
      <PillRow label="張數" value={String(count)} options={COUNTS.map(c => ({ v: String(c), label: String(c) }))} onChange={v => setCount(Number(v))} />
      <PillRow label="範圍" value={range} options={RANGES.map(r => ({ v: r.v, label: r.label }))} onChange={v => setRange(v as Range)} />
      <PillRow label="目前程度" value={base} options={[{ v: "none", label: "零基礎" }, ...["n5","n4","n3","n2"].map(l => ({ v: l, label: `${l.toUpperCase()} 已學完` }))]} onChange={v => commitPrefs({ base: v as BaseLevel })} />
      <PillRow label="目標級別" value={goal} options={[{ v: "", label: "未設定" }, ...allLevels.map(l => ({ v: l, label: l.toUpperCase() }))]} onChange={v => commitPrefs({ goal: v as Level | "" })} />

      <Text className="text-sm font-semibold text-gray-700 mt-4 mb-2">考試日期</Text>
      <View className="gap-2">
        <Pressable onPress={() => commitPrefs({ exam: "" })} className={`px-3 py-2 rounded-xl ${exam === "" ? "bg-rose-100" : "bg-gray-100"}`}>
          <Text className={exam === "" ? "text-rose-700 font-semibold" : "text-gray-700"}>不設定</Text>
        </Pressable>
        {upcoming.map(u => (
          <Pressable key={u.iso} onPress={() => commitPrefs({ exam: u.iso })} className={`px-3 py-2 rounded-xl ${exam === u.iso ? "bg-rose-100" : "bg-gray-100"}`}>
            <Text className={exam === u.iso ? "text-rose-700 font-semibold" : "text-gray-700"}>{u.label}</Text>
          </Pressable>
        ))}
      </View>

      {(totalRemaining > 0 || days !== null) && (
        <View className="mt-5 bg-rose-50 rounded-2xl p-4">
          {totalRemaining > 0 && <Text className="text-gray-800">{(!base || base === "none") ? "零基礎" : base.toUpperCase()} → {goal && (goal as string).toUpperCase()}：還要背 {totalRemaining} 個</Text>}
          {days !== null && <Text className="text-gray-800">考試倒數：{days >= 0 ? `${days} 天` : `已過 ${-days} 天`}</Text>}
          {perDay !== null && <Text className="mt-1 text-rose-700 font-semibold">建議每天背 {perDay} 個才背得完</Text>}
        </View>
      )}

      <View className="mt-6">
        <Button label="開始" onPress={() => onStart(level, count, range)} />
      </View>
    </ScrollView>
  );
}

function PillRow({ label, value, options, onChange }: { label: string; value: string; options: { v: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <View className="mb-3">
      <Text className="text-sm font-semibold text-gray-700 mb-2">{label}</Text>
      <View className="flex-row flex-wrap gap-2">
        {options.map(o => {
          const on = o.v === value;
          return (
            <Pressable key={o.v} onPress={() => onChange(o.v)} className={`px-4 py-2 rounded-full ${on ? "bg-rose-600" : "bg-gray-100"}`}>
              <Text className={on ? "text-white font-semibold" : "text-gray-700"}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/flashcard/SettingsPanel.tsx
git commit -m "feat(flashcard): settings panel (level/count/range/base/goal/exam)"
```

---

### Task 13: Done screen

**Files:**
- Create: `stayjp-app/src/flashcard/DoneScreen.tsx`

- [ ] **Step 1: Implement DoneScreen.tsx**

```tsx
// src/flashcard/DoneScreen.tsx
import { Text, View } from "react-native";
import { Button } from "../components/Button";
import { getStats } from "../srs/stats";
import type { Level } from "../types/content";

interface Props {
  level: Level;
  score: { known: number; soso: number; unknown: number };
  totalCards: number;
  onAgain: () => void;
  onExit: () => void;
}

export function DoneScreen({ level, score, totalCards, onAgain, onExit }: Props) {
  const stats = getStats(level);
  return (
    <View className="flex-1 px-6 pt-12 bg-white">
      <Text className="text-3xl font-bold mb-2">完成！</Text>
      <Text className="text-gray-500 mb-6">這一輪 {totalCards} 張</Text>

      <View className="flex-row gap-3 mb-6">
        <ScoreCard label="記得" value={score.known} color="emerald" />
        <ScoreCard label="半生熟" value={score.soso} color="amber" />
        <ScoreCard label="不會" value={score.unknown} color="rose" />
      </View>

      <View className="bg-gray-50 rounded-2xl p-4 mb-8">
        <Text className="font-semibold mb-2">{level.toUpperCase()} 累計</Text>
        <Text className="text-gray-700">學過：{stats.total}</Text>
        <Text className="text-gray-700">已掌握：{stats.mastered}</Text>
        <Text className="text-gray-700">學習中：{stats.learning}</Text>
        <Text className="text-gray-700">今日待複習：{stats.due}</Text>
      </View>

      <Button label="再來一輪" onPress={onAgain} />
      <Button label="回到設定" variant="secondary" onPress={onExit} />
    </View>
  );
}

function ScoreCard({ label, value, color }: { label: string; value: number; color: "emerald" | "amber" | "rose" }) {
  const bg = { emerald: "bg-emerald-100", amber: "bg-amber-100", rose: "bg-rose-100" }[color];
  const tx = { emerald: "text-emerald-700", amber: "text-amber-700", rose: "text-rose-700" }[color];
  return (
    <View className={`flex-1 ${bg} rounded-2xl p-4 items-center`}>
      <Text className={`text-3xl font-bold ${tx}`}>{value}</Text>
      <Text className={`text-xs mt-1 ${tx}`}>{label}</Text>
    </View>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/flashcard/DoneScreen.tsx
git commit -m "feat(flashcard): done screen with score + level stats"
```

---

### Task 14: Wire up the Flashcard tab

**Files:**
- Modify: `stayjp-app/app/(tabs)/flashcard.tsx`

- [ ] **Step 1: Replace placeholder with real flow**

```tsx
// app/(tabs)/flashcard.tsx
import { useCallback } from "react";
import { View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSession } from "../../src/flashcard/session";
import { SettingsPanel } from "../../src/flashcard/SettingsPanel";
import { Card } from "../../src/flashcard/Card";
import { RatingButtons } from "../../src/flashcard/RatingButtons";
import { Countdown } from "../../src/flashcard/Countdown";
import { DoneScreen } from "../../src/flashcard/DoneScreen";

const COUNTDOWN_SEC = 20;

export default function FlashcardTab() {
  const insets = useSafeAreaInsets();
  const { status, queue, cur, flipped, score, start, flip, rate, reset } = useSession();

  const onAutoFlip = useCallback(() => { if (!flipped) flip(); }, [flipped, flip]);

  if (status === "idle") {
    return (
      <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: "white" }}>
        <SettingsPanel onStart={start} />
      </View>
    );
  }
  if (status === "done") {
    const lv = queue[0]?.level ?? "n5";
    return (
      <DoneScreen
        level={lv}
        score={score}
        totalCards={queue.length}
        onAgain={() => start(lv, queue.length, "new")}
        onExit={reset}
      />
    );
  }

  // running
  const item = queue[cur];
  if (!item) return null;
  return (
    <View style={{ flex: 1, paddingTop: insets.top + 16, paddingBottom: 24, paddingHorizontal: 20, backgroundColor: "white" }}>
      <View className="flex-row justify-between items-center mb-3">
        <Text className="text-gray-700">{cur + 1} / {queue.length}</Text>
        <Text className="text-xs text-gray-400">{item.isNew ? "新詞" : "複習"}</Text>
      </View>
      <Countdown seconds={COUNTDOWN_SEC} resetKey={String(cur)} onComplete={onAutoFlip} />
      <View className="mt-4">
        <Card item={item} index={cur} flipped={flipped} onFlip={flip} onRate={rate} />
      </View>
      {flipped && <RatingButtons onRate={rate} />}
    </View>
  );
}
```

- [ ] **Step 2: Verify**

```bash
pnpm test       # all tests pass
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/\(tabs\)/flashcard.tsx
git commit -m "feat(flashcard): wire settings → session → done in tab"
```

---

### Task 15: GestureHandlerRootView wrapper

The card uses gesture-handler; on web/iOS Android it requires the root be wrapped.

**Files:**
- Modify: `stayjp-app/app/_layout.tsx`

- [ ] **Step 1: Wrap with GestureHandlerRootView**

In `app/_layout.tsx`, change the SafeAreaProvider child to wrap `Stack` inside `<GestureHandlerRootView style={{ flex: 1 }}>`:

```tsx
import "../global.css";
import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useUserStore } from "../src/stores/userStore";
import { subscribeAuth } from "../src/lib/auth";

export default function RootLayout() {
  // ... existing auth gate logic unchanged
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

If `react-native-gesture-handler` isn't installed, install it:
```bash
npx expo install react-native-gesture-handler
```

- [ ] **Step 2: Verify final state**

```bash
pnpm test
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/_layout.tsx package.json pnpm-lock.yaml
git commit -m "chore: GestureHandlerRootView wrapper for flashcard gestures"
```

---

## Done Criteria for P3

- [ ] All 15 tasks committed
- [ ] `pnpm test` passes (existing 27 + new ~20 = 47±)
- [ ] `npx tsc --noEmit` 0 errors
- [ ] User can:
  1. Open 單字 tab → see settings panel
  2. Pick level + count + range + start
  3. See cards with 20-second auto-flip countdown
  4. Tap to flip manually
  5. Swipe right = known, swipe left = unknown
  6. Or tap one of 3 rating buttons after flip
  7. Reach done screen with stats
  8. Settings (base/goal/exam) persist across app restarts and sync to Firestore

## Out of Scope for P3

- Audio playback (speaker icon) — needs P8 (audio CDN + offline strategy)
- Streak/calendar logging — P6 (Profile + streak)
- 範圍 = "due" cross-level UI annotation
- Background notification when due reviews stack up
- Confusables ("比較") — separate module, deferred
- Search vocab — deferred

## Open Questions

(none — all design decisions traced to web behavior and spec § 5.C)
