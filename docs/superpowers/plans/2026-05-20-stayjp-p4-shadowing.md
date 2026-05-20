# StayJP P4 — Shadowing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Port the web's Shadow auto-cycle mode (`index.html` lines 1655-1968) to the App's `跟讀` tab. Users pick a source (vocab N5~N1 / grammar examples N5~N1 / 收藏) and the app auto-plays each sentence twice with a shadowing pause in between, advancing through the queue. Same speed control, same favorites, same Firestore schema as web. **No microphone recording in v1** — spec's record-and-compare deferred to P4.1.

**Architecture:** Three layers.
- **Pure logic** (`src/shadow/`): state machine (stage 0→1→2→3→advance), source builders, favorites store. All testable without React Native.
- **UI** (`src/shadow/` components + `app/(tabs)/shadowing.tsx`): Source picker → Playback view → end-of-queue summary.
- **Side effects**: audio via `expo-audio` (reuse `playWord` infrastructure, but with onEnd callback support), favorites via MMKV + `webSync` (extending P2.5 schema by adding `shadow_favs` and `word_notebook` fields).

**Tech Stack:** existing — `expo-audio`, MMKV, Zustand, NativeWind, reanimated for transitions.

**Reference web code:**
- `stay-jp-notes/index.html` lines 1655-1968 — Shadow module to mirror
- Shadow uses two favorites systems:
  - `shadow_favs` localStorage key: `{ [j]: { j, z, ts } }` for grammar example sentences
  - `word_notebook` localStorage key: `[{ w, r, m, lv, added }]` for vocab words
- Web also has CSS animations (`.shadow-mask` fade-in, `.shadow-box` slide) — we'll use NativeWind transitions for parity feel.

**Spec reference:** `stay-jp-notes/docs/superpowers/specs/2026-05-19-stayjp-app-design.md` § 5.B.

---

## Web Schema Extensions (P2.5 follow-on)

P2.5 only synced `srs_data`, `base_level`, `goal_level`, `exam_date`. P4 adds:

| Field | Type | Notes |
|---|---|---|
| `shadow_favs` | `Record<string, { j: string; z: string; ts: number }>` | Grammar example sentence favorites. Key = `j` text. |
| `word_notebook` | `Array<{ w: string; r: string; m: string; lv: string; added: string }>` | Vocab favorites (writes from Shadow when user favs a vocab item). `added` is ISO timestamp. |

Both should be added to `WebUserDoc` interface in `src/lib/webSync.ts`. Merge rules (per web's `loadCloudData`):
- `shadow_favs`: object merge — cloud values fill missing local keys; existing local wins (web does this with the "if(!merged[key])" guard).
- `word_notebook`: array dedupe by `(w, lv)` keeping the entry with the *earlier* `added` timestamp (web lines 1402-1410).

---

## Source picker — three sources

The web has implicit context ("collect from current list view"). App is more deliberate. UI offers:

1. **語法例句** (grammar examples): for level ∈ {N5, N4, N3, N2, N1}, flatten all `grammar(level)[].eg[]` into `{ j, z }` items.
2. **單字** (vocab): for level ∈ {N5..N1}, map `vocab(level)` to `{ j: r || w, z: w + ' · ' + m, w, r, m, lv }`. Same shape web uses (lines 1915-1932).
3. **我的收藏** (favorites): merge `shadow_favs` (sentences) + `word_notebook` (words), shuffle (web line 1957).

---

## File Structure

```
stayjp-app/
├── src/
│   └── shadow/
│       ├── types.ts             # ShadowItem, ShadowSource, ShadowStage
│       ├── sources.ts           # collectGrammarItems(level), collectVocabItems(level), collectFavorites()
│       ├── favs.ts              # MMKV-backed favorites (shadow_favs + word_notebook) + webSync push
│       ├── engine.ts            # pure stage machine: nextStage(stage, repeatWindow) → { nextStage, delayMs? }
│       ├── session.ts           # Zustand: queue, idx, stage, paused, speed, repeatWindow + side effects
│       ├── SourcePicker.tsx     # source + level + start
│       ├── PlaybackView.tsx     # J/Z text, controls, status, speed
│       └── DoneScreen.tsx       # "完成了 N 句" + restart/back
└── app/(tabs)/
    └── shadowing.tsx            # orchestrate picker → playback → done
```

---

### Task 1: Types

**Files:**
- Create: `src/shadow/types.ts`

- [ ] **Step 1: Write types**

```ts
// src/shadow/types.ts
import type { Level } from "../types/content";

/** A single playable item — either grammar example or vocab word. */
export interface ShadowItem {
  j: string;              // Japanese to speak
  z: string;              // Chinese gloss to display below
  // Optional metadata (present for vocab items, absent for grammar sentences):
  w?: string;             // 漢字 (only for vocab)
  r?: string;             // 振り仮名 (only for vocab)
  m?: string;             // 中文釋義 (only for vocab)
  lv?: Level;             // level (only for vocab)
}

export type ShadowKind = "grammar" | "vocab" | "favorites";

export interface ShadowSource {
  kind: ShadowKind;
  level?: Level;          // required for grammar / vocab; ignored for favorites
}

/**
 * Stage machine (mirrors web index.html lines 1837-1873):
 *   0 = first play
 *   1 = pause for user to shadow
 *   2 = second play
 *   3 = pause for user to shadow again
 *   4 = inter-sentence gap, then advance idx + reset stage to 0
 */
export type ShadowStage = 0 | 1 | 2 | 3 | 4;

export type Speed = 0.75 | 1 | 1.25;
```

- [ ] **Step 2: Commit**

```bash
cd ~/Documents/GitHub/stayjp-app
git add src/shadow/types.ts
git commit -m "feat(shadow): types (ShadowItem, ShadowSource, Stage, Speed)"
```

---

### Task 2: Source builders (TDD)

**Files:**
- Create: `src/shadow/sources.ts`
- Create: `__tests__/shadow-sources.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// __tests__/shadow-sources.test.ts
import { collectGrammarItems, collectVocabItems } from "../src/shadow/sources";

test("collectGrammarItems(n3) flattens all eg sentences", () => {
  const items = collectGrammarItems("n3");
  expect(items.length).toBeGreaterThan(50);  // N3 has ~79 grammar points × ~3 eg each
  items.forEach(it => {
    expect(typeof it.j).toBe("string");
    expect(typeof it.z).toBe("string");
  });
});

test("collectGrammarItems(n5) returns non-empty", () => {
  const items = collectGrammarItems("n5");
  expect(items.length).toBeGreaterThan(50);  // N5 has 68 points
});

test("collectVocabItems(n5) maps each word with j=r and z combining w+m", () => {
  const items = collectVocabItems("n5");
  expect(items.length).toBeGreaterThan(100);
  // pick one with kanji
  const withKanji = items.find(x => x.w && x.w !== x.j);
  if (withKanji) {
    expect(withKanji.z).toContain(withKanji.w!);  // z starts with kanji
    expect(withKanji.z).toContain(" · ");          // separator
    expect(withKanji.lv).toBe("n5");
  }
});

test("collectVocabItems item shape matches web schema (j is reading)", () => {
  const items = collectVocabItems("n3");
  // Web uses `j = r || w` — verify
  items.forEach(it => {
    expect([it.r, it.w]).toContain(it.j);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

```bash
pnpm test shadow-sources
```

- [ ] **Step 3: Implement sources.ts**

```ts
// src/shadow/sources.ts
import { vocab, grammar } from "../lib/content";
import type { Level } from "../types/content";
import type { ShadowItem } from "./types";

/** Flatten grammar[lv].eg[] into shadow items. Strips <em>...</em> markup. */
export function collectGrammarItems(level: Level): ShadowItem[] {
  const out: ShadowItem[] = [];
  for (const g of grammar(level)) {
    for (const eg of g.eg) {
      // Web's grammar j contains <em>...</em> — strip it for TTS
      const jClean = eg.j.replace(/<\/?em>/g, "");
      out.push({ j: jClean, z: eg.z });
    }
  }
  return out;
}

/** Map vocab[lv] to shadow items. Mirrors web index.html lines 1915-1932. */
export function collectVocabItems(level: Level): ShadowItem[] {
  return vocab(level).map(v => {
    const j = v.r || v.w;
    let z = "";
    if (v.w && v.w !== j && v.m) z = `${v.w} · ${v.m}`;
    else if (v.w && v.w !== j) z = v.w;
    else if (v.m) z = v.m;
    return { j, z, w: v.w, r: v.r, m: v.m, lv: level };
  });
}
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/shadow/sources.ts __tests__/shadow-sources.test.ts
git commit -m "feat(shadow): source builders for grammar & vocab (web parity)"
```

---

### Task 3: Stage engine (pure function, TDD)

**Files:**
- Create: `src/shadow/engine.ts`
- Create: `__tests__/shadow-engine.test.ts`

The web's stage transitions are intermixed with side effects (`pendingTimer`, `setTimeout`). We extract just the **state transition logic** into a pure function for testability. Side effects (timers, audio calls) stay in the session store.

- [ ] **Step 1: Write failing tests**

```ts
// __tests__/shadow-engine.test.ts
import { nextStage } from "../src/shadow/engine";

test("stage 0 → 1 (shadow pause) when repeatWindow ON", () => {
  expect(nextStage(0, true, "abcde")).toEqual({ stage: 1, delayMs: 1200 });
});

test("stage 0 → 4 (immediate advance) when repeatWindow OFF", () => {
  expect(nextStage(0, false, "abcde")).toEqual({ stage: 4, delayMs: 0 });
});

test("stage 1 → 2 (auto, after delay)", () => {
  expect(nextStage(1, true, "abc")).toEqual({ stage: 2, delayMs: 0 });
});

test("stage 2 → 3 with repeatWindow", () => {
  expect(nextStage(2, true, "abcdef")).toEqual({ stage: 3, delayMs: expect.any(Number) });
});

test("stage 2 → 4 without repeatWindow", () => {
  expect(nextStage(2, false, "abc")).toEqual({ stage: 4, delayMs: 0 });
});

test("stage 3 → 4 after delay", () => {
  expect(nextStage(3, true, "abc")).toEqual({ stage: 4, delayMs: expect.any(Number) });
});

test("stage 4 → 0 advances (gap)", () => {
  expect(nextStage(4, true, "abc")).toEqual({ stage: 0, delayMs: 400, advance: true });
});

test("delay scales with text length at speed 1", () => {
  const short = nextStage(0, true, "xxx");
  const long = nextStage(0, true, "x".repeat(40));
  expect(long.delayMs).toBeGreaterThan(short.delayMs);
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement engine.ts**

```ts
// src/shadow/engine.ts
import type { ShadowStage } from "./types";

export interface StageTransition {
  stage: ShadowStage;
  delayMs: number;
  advance?: boolean;
}

/**
 * Pure transition function. Given current stage, repeatWindow setting, and text length,
 * return the next stage + delay before triggering it.
 *
 * Mirror of web index.html lines 1837-1873.
 * Stage 1 and 3 are "shadow pauses" with delay = max(1200, text.length * 200 / 1).
 * Stage 4 is inter-sentence gap = 400ms, and signals advance to next item.
 */
export function nextStage(stage: ShadowStage, repeatWindow: boolean, text: string): StageTransition {
  const repeatMs = Math.max(1200, text.length * 200);
  if (stage === 0) {
    // After audio finishes; either pause for shadowing or advance immediately
    if (repeatWindow) return { stage: 1, delayMs: repeatMs };
    return { stage: 4, delayMs: 0 };
  }
  if (stage === 1) return { stage: 2, delayMs: 0 };
  if (stage === 2) {
    if (repeatWindow) return { stage: 3, delayMs: repeatMs };
    return { stage: 4, delayMs: 0 };
  }
  if (stage === 3) return { stage: 4, delayMs: 400 };
  // stage 4: inter-sentence gap, then advance
  return { stage: 0, delayMs: 400, advance: true };
}
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/shadow/engine.ts __tests__/shadow-engine.test.ts
git commit -m "feat(shadow): pure stage transition function"
```

---

### Task 4: Audio helper extension — onEnd callback

The current `src/lib/audio.ts` `playWord(text)` plays but provides no way to know when playback finished. Shadow needs that to trigger the next stage.

**Files:**
- Modify: `src/lib/audio.ts`

- [ ] **Step 1: Add `playWordWithCallback`**

Read current `src/lib/audio.ts`. Add a new function (don't break existing `playWord`):

```ts
export interface PlayOptions {
  volume?: number;
  speed?: number;         // playback rate
  onEnd?: () => void;     // fires when audio finishes (or errors)
}

/** Play TTS and fire onEnd when done. Returns immediately. */
export function playWordWithCallback(text: string, opts: PlayOptions = {}): void {
  const hash = audioFor(text);
  if (!hash) { opts.onEnd?.(); return; }
  try {
    if (currentPlayer) {
      currentPlayer.remove();
      currentPlayer = null;
    }
    const player = createAudioPlayer({ uri: `${CDN_BASE}${hash}.mp3` });
    player.volume = opts.volume ?? 1;
    if (opts.speed !== undefined) player.setPlaybackRate(opts.speed);
    let finished = false;
    const safeEnd = () => {
      if (finished) return;
      finished = true;
      opts.onEnd?.();
    };
    player.addListener("playbackStatusUpdate", (s) => {
      if (s.didJustFinish) safeEnd();
    });
    player.play();
    currentPlayer = player;
    // Safety: fallback timeout in case status update doesn't fire (matches web behavior)
    setTimeout(safeEnd, Math.max(3000, text.length * 250));
  } catch (e) {
    console.warn("playWordWithCallback failed:", e);
    opts.onEnd?.();
  }
}
```

If `expo-audio`'s actual API doesn't match (`setPlaybackRate` may be a setter on the object, `addListener` signature may differ), read the typings and adapt. Keep `safeEnd` once-only and call `opts.onEnd()` even on failure (so the stage machine doesn't get stuck).

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/audio.ts
git commit -m "feat(audio): playWordWithCallback for shadow auto-cycle"
```

---

### Task 5: Favorites store (TDD)

**Files:**
- Modify: `src/lib/webSync.ts` (extend `WebUserDoc` + add mergers)
- Create: `src/shadow/favs.ts`
- Create: `__tests__/shadow-favs.test.ts`

- [ ] **Step 1: Extend webSync schema**

In `src/lib/webSync.ts`, extend `WebUserDoc`:
```ts
export interface ShadowFav { j: string; z: string; ts: number; }
export interface NotebookEntry { w: string; r?: string; m?: string; lv?: string; added?: string; }

export interface WebUserDoc {
  srs_data?: SrsData;
  exam_date?: string;
  base_level?: string;
  goal_level?: string;
  shadow_favs?: Record<string, ShadowFav>;
  word_notebook?: NotebookEntry[];
}
```

Add merger helpers (mirror web's `loadCloudData`):
```ts
/** Merge: cloud fills missing local keys; existing local always wins. */
export function mergeShadowFavs(
  local: Record<string, ShadowFav>,
  cloud: Record<string, ShadowFav>
): Record<string, ShadowFav> {
  return { ...cloud, ...local };
}

/** Merge: dedupe by (w, lv), keep entry with EARLIER `added` (web line 1408). */
export function mergeWordNotebook(
  local: NotebookEntry[],
  cloud: NotebookEntry[]
): NotebookEntry[] {
  const byKey = new Map<string, NotebookEntry>();
  [...local, ...cloud].forEach(x => {
    if (!x || !x.w) return;
    const key = x.w + " " + (x.lv || "");
    const prev = byKey.get(key);
    if (!prev || (x.added && prev.added && x.added < prev.added)) byKey.set(key, x);
  });
  return [...byKey.values()];
}
```

- [ ] **Step 2: Write failing tests**

```ts
// __tests__/shadow-favs.test.ts
jest.mock("../src/lib/webSync", () => ({
  schedulePushField: jest.fn(),
}));

import { storage } from "../src/lib/storage";
import { isFav, toggleSentenceFav, toggleVocabFav, getSentenceFavs, getVocabFavs } from "../src/shadow/favs";
import type { ShadowItem } from "../src/shadow/types";

beforeEach(() => storage.clearAll());

test("toggleSentenceFav adds / removes", () => {
  const item: ShadowItem = { j: "おはよう", z: "早安" };
  expect(isFav(item)).toBe(false);
  toggleSentenceFav(item);
  expect(isFav(item)).toBe(true);
  toggleSentenceFav(item);
  expect(isFav(item)).toBe(false);
});

test("toggleVocabFav writes to word_notebook keyed by (w, lv)", () => {
  const item: ShadowItem = { j: "みず", z: "水 · water", w: "水", r: "みず", m: "water", lv: "n5" };
  toggleVocabFav(item);
  const nb = getVocabFavs();
  expect(nb).toHaveLength(1);
  expect(nb[0].w).toBe("水");
  expect(nb[0].lv).toBe("n5");
});

test("isFav recognises vocab via word_notebook (not just shadow_favs)", () => {
  const item: ShadowItem = { j: "みず", z: "水", w: "水", lv: "n5" };
  toggleVocabFav(item);
  expect(isFav(item)).toBe(true);
});

test("getSentenceFavs returns map keyed by j", () => {
  const a: ShadowItem = { j: "A", z: "" };
  const b: ShadowItem = { j: "B", z: "" };
  toggleSentenceFav(a); toggleSentenceFav(b);
  const map = getSentenceFavs();
  expect(Object.keys(map).sort()).toEqual(["A", "B"]);
});
```

- [ ] **Step 3: Run, expect FAIL**

- [ ] **Step 4: Implement favs.ts**

```ts
// src/shadow/favs.ts
import { getJSON, setJSON } from "../lib/storage";
import { schedulePushField, type ShadowFav, type NotebookEntry } from "../lib/webSync";
import type { ShadowItem } from "./types";

const FAVS_KEY = "shadow_favs";
const NOTEBOOK_KEY = "word_notebook";

export function getSentenceFavs(): Record<string, ShadowFav> {
  return getJSON<Record<string, ShadowFav>>(FAVS_KEY) ?? {};
}
export function setSentenceFavs(d: Record<string, ShadowFav>): void {
  setJSON(FAVS_KEY, d);
  schedulePushField("shadow_favs", d);
}
export function getVocabFavs(): NotebookEntry[] {
  return getJSON<NotebookEntry[]>(NOTEBOOK_KEY) ?? [];
}
export function setVocabFavs(arr: NotebookEntry[]): void {
  setJSON(NOTEBOOK_KEY, arr);
  schedulePushField("word_notebook", arr);
}

export function isFav(item: ShadowItem): boolean {
  if (item.w && item.lv) {
    return getVocabFavs().some(x => x.w === item.w && x.lv === item.lv);
  }
  return !!getSentenceFavs()[item.j];
}

export function toggleSentenceFav(item: ShadowItem): boolean {
  const d = getSentenceFavs();
  const has = !!d[item.j];
  if (has) delete d[item.j];
  else d[item.j] = { j: item.j, z: item.z || "", ts: Date.now() };
  setSentenceFavs(d);
  return !has;
}

export function toggleVocabFav(item: ShadowItem): boolean {
  if (!item.w || !item.lv) return false;
  const arr = getVocabFavs();
  const i = arr.findIndex(x => x.w === item.w && x.lv === item.lv);
  const added = i === -1;
  if (added) arr.push({
    w: item.w, r: item.r || item.j, m: item.m || "",
    lv: item.lv, added: new Date().toISOString(),
  });
  else arr.splice(i, 1);
  setVocabFavs(arr);
  return added;
}

/** Returns true if the item is favorited (sentence OR vocab) and toggles it. */
export function toggleFav(item: ShadowItem): boolean {
  if (item.w && item.lv) return toggleVocabFav(item);
  return toggleSentenceFav(item);
}
```

- [ ] **Step 5: Run, expect PASS**

- [ ] **Step 6: Commit**

```bash
git add src/lib/webSync.ts src/shadow/favs.ts __tests__/shadow-favs.test.ts
git commit -m "feat(shadow): favorites store (shadow_favs + word_notebook) with web schema"
```

---

### Task 6: Pull web favorites on sign-in

Extend `bootSync` in `app/_layout.tsx` to also pull/merge `shadow_favs` and `word_notebook` after sign-in.

**Files:**
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Update `bootSync`**

Inside the `bootSync` function (added in P2.5 Task 6), after the existing `remote.goal_level` block, add:

```ts
import { getSentenceFavs, setSentenceFavs, getVocabFavs, setVocabFavs } from "../src/shadow/favs";
import { mergeShadowFavs, mergeWordNotebook } from "../src/lib/webSync";

// ...after existing prefs merging...
if (remote.shadow_favs) {
  const merged = mergeShadowFavs(getSentenceFavs(), remote.shadow_favs);
  setSentenceFavs(merged);
}
if (remote.word_notebook) {
  const merged = mergeWordNotebook(getVocabFavs(), remote.word_notebook);
  setVocabFavs(merged);
}
```

- [ ] **Step 2: Verify**

```bash
pnpm test
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat(auth): bootSync also merges shadow_favs and word_notebook from cloud"
```

---

### Task 7: Session store (Zustand, side effects allowed)

**Files:**
- Create: `src/shadow/session.ts`

Stage transitions in this layer call `playWordWithCallback` and `setTimeout` directly. The pure logic is delegated to `engine.ts`. This is the only file in `src/shadow/` that touches audio / timers.

- [ ] **Step 1: Implement session.ts**

```ts
// src/shadow/session.ts
import { create } from "zustand";
import { playWordWithCallback, stopAudio } from "../lib/audio";
import { nextStage } from "./engine";
import type { ShadowItem, ShadowStage, Speed } from "./types";

export type ShadowStatus = "idle" | "running" | "done";

interface SessionState {
  status: ShadowStatus;
  queue: ShadowItem[];
  idx: number;
  stage: ShadowStage;
  paused: boolean;
  speed: Speed;
  repeatWindow: boolean;
  start: (queue: ShadowItem[]) => void;
  pause: () => void;
  resume: () => void;
  togglePause: () => void;
  next: () => void;
  prev: () => void;
  replay: () => void;
  setSpeed: (s: Speed) => void;
  setRepeatWindow: (b: boolean) => void;
  exit: () => void;
}

const INITIAL = {
  status: "idle" as ShadowStatus,
  queue: [] as ShadowItem[],
  idx: 0,
  stage: 0 as ShadowStage,
  paused: false,
  speed: 1 as Speed,
  repeatWindow: true,
};

let pendingTimer: ReturnType<typeof setTimeout> | null = null;
function clearPending() {
  if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null; }
}

export const useShadow = create<SessionState>((set, get) => {

  function step(): void {
    const { paused, queue, idx, stage, speed, repeatWindow } = get();
    if (paused) return;
    if (idx >= queue.length) { set({ status: "done" }); return; }
    const item = queue[idx];

    if (stage === 0 || stage === 2) {
      // Play audio; on end, transition to next stage
      playWordWithCallback(item.j, {
        speed,
        onEnd: () => {
          if (get().paused) return;
          const trans = nextStage(stage, repeatWindow, item.j);
          set({ stage: trans.stage });
          if (trans.delayMs > 0) {
            pendingTimer = setTimeout(() => { clearPending(); step(); }, trans.delayMs);
          } else {
            step();
          }
        },
      });
      return;
    }
    if (stage === 1 || stage === 3) {
      // Pause stages — just wait for the timer that was scheduled when we entered
      // (handled by the playback's onEnd path above; this branch shouldn't normally execute)
      return;
    }
    if (stage === 4) {
      // Inter-sentence gap, then advance
      pendingTimer = setTimeout(() => {
        clearPending();
        set({ idx: get().idx + 1, stage: 0 });
        step();
      }, 400);
    }
  }

  return {
    ...INITIAL,
    start: (queue) => {
      clearPending();
      stopAudio();
      set({ ...INITIAL, queue, status: queue.length ? "running" : "done" });
      if (queue.length) step();
    },
    pause: () => { clearPending(); stopAudio(); set({ paused: true }); },
    resume: () => {
      if (!get().paused) return;
      clearPending();
      set({ paused: false, stage: 0 });
      step();
    },
    togglePause: () => { get().paused ? get().resume() : get().pause(); },
    next: () => {
      clearPending();
      stopAudio();
      const nextIdx = Math.min(get().idx + 1, get().queue.length - 1);
      set({ idx: nextIdx, stage: 0 });
      if (!get().paused) step();
    },
    prev: () => {
      clearPending();
      stopAudio();
      const prevIdx = Math.max(get().idx - 1, 0);
      set({ idx: prevIdx, stage: 0 });
      if (!get().paused) step();
    },
    replay: () => {
      clearPending();
      stopAudio();
      set({ stage: 0 });
      if (!get().paused) step();
    },
    setSpeed: (s) => set({ speed: s }),
    setRepeatWindow: (b) => set({ repeatWindow: b }),
    exit: () => { clearPending(); stopAudio(); set({ ...INITIAL }); },
  };
});
```

- [ ] **Step 2: Commit**

```bash
git add src/shadow/session.ts
git commit -m "feat(shadow): Zustand session driving the stage machine + audio"
```

---

### Task 8: Source picker UI

**Files:**
- Create: `src/shadow/SourcePicker.tsx`

- [ ] **Step 1: Implement SourcePicker.tsx**

```tsx
// src/shadow/SourcePicker.tsx
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Button } from "../components/Button";
import { allLevels } from "../lib/content";
import { collectGrammarItems, collectVocabItems } from "./sources";
import { getSentenceFavs, getVocabFavs } from "./favs";
import type { ShadowItem, ShadowKind } from "./types";
import type { Level } from "../types/content";

interface Props {
  onStart: (queue: ShadowItem[]) => void;
}

const KINDS: { v: ShadowKind; label: string }[] = [
  { v: "grammar", label: "語法例句" },
  { v: "vocab", label: "單字" },
  { v: "favorites", label: "我的收藏" },
];

export function SourcePicker({ onStart }: Props) {
  const [kind, setKind] = useState<ShadowKind>("grammar");
  const [level, setLevel] = useState<Level>("n5");

  function build(): ShadowItem[] {
    if (kind === "favorites") {
      const senFavs = Object.values(getSentenceFavs()).map(f => ({ j: f.j, z: f.z || "" }));
      const nb = getVocabFavs().map(x => {
        const j = x.r || x.w;
        let z = "";
        if (x.w !== j && x.m) z = `${x.w} · ${x.m}`;
        else if (x.w !== j) z = x.w;
        else if (x.m) z = x.m || "";
        return { j, z, w: x.w, r: x.r, m: x.m, lv: x.lv as Level };
      });
      const all = [...senFavs, ...nb];
      return all.sort(() => Math.random() - 0.5);
    }
    if (kind === "vocab") return collectVocabItems(level);
    return collectGrammarItems(level);
  }

  return (
    <ScrollView contentContainerClassName="px-5 pb-32">
      <Text className="text-2xl font-bold mt-4 mb-1">跟讀</Text>
      <Text className="text-sm text-gray-500 mb-4">自動播放 → 跟讀停頓 → 再播一次 → 下一句</Text>

      <Pills label="內容" value={kind} options={KINDS.map(k => ({ v: k.v, label: k.label }))}
        onChange={v => setKind(v as ShadowKind)} />

      {kind !== "favorites" && (
        <Pills label="級別" value={level}
          options={allLevels.map(l => ({ v: l, label: l.toUpperCase() }))}
          onChange={v => setLevel(v as Level)} />
      )}

      <View className="mt-8">
        <Button label="開始" onPress={() => onStart(build())} />
      </View>
    </ScrollView>
  );
}

function Pills({ label, value, options, onChange }:
  { label: string; value: string; options: { v: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <View className="mb-3">
      <Text className="text-sm font-semibold text-gray-700 mb-2">{label}</Text>
      <View className="flex-row flex-wrap gap-2">
        {options.map(o => {
          const on = o.v === value;
          return (
            <Pressable key={o.v} onPress={() => onChange(o.v)}
              className={`px-4 py-2 rounded-full ${on ? "bg-rose-600" : "bg-gray-100"}`}>
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
git add src/shadow/SourcePicker.tsx
git commit -m "feat(shadow): source picker UI"
```

---

### Task 9: Playback view UI

**Files:**
- Create: `src/shadow/PlaybackView.tsx`

- [ ] **Step 1: Implement PlaybackView.tsx**

```tsx
// src/shadow/PlaybackView.tsx
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useShadow } from "./session";
import { isFav, toggleFav } from "./favs";
import type { Speed } from "./types";

const SPEEDS: Speed[] = [0.75, 1, 1.25];

export function PlaybackView() {
  const { queue, idx, stage, paused, speed, repeatWindow, togglePause, next, prev, replay, setSpeed, setRepeatWindow, exit } = useShadow();
  const item = queue[idx];
  if (!item) return null;
  const status = paused ? "暫停" : (stage === 0 || stage === 2) ? "🔊 播放中" : (stage === 1 || stage === 3) ? "🎤 跟著念…" : "";
  const fav = isFav(item);

  return (
    <View className="flex-1 bg-white px-5">
      {/* Header */}
      <View className="flex-row justify-between items-center pt-2 pb-3">
        <Pressable onPress={() => toggleFav(item)} hitSlop={10}>
          <Ionicons name={fav ? "star" : "star-outline"} size={24} color={fav ? "#F5B400" : "#9ca3af"} />
        </Pressable>
        <Text className="text-sm text-gray-500">{idx + 1} / {queue.length}</Text>
        <Pressable onPress={exit} hitSlop={10}>
          <Ionicons name="close" size={26} color="#9ca3af" />
        </Pressable>
      </View>

      {/* Status */}
      <Text className="text-center text-rose-600 font-semibold mb-2">{status}</Text>

      {/* Main text */}
      <View className="flex-1 justify-center">
        <Text className="text-3xl font-bold text-gray-900 leading-relaxed text-center">{item.j}</Text>
        {item.z ? <Text className="text-base text-gray-500 text-center mt-4">{item.z}</Text> : null}
      </View>

      {/* Controls */}
      <View className="flex-row justify-center gap-4 mb-4">
        <CtrlBtn icon="play-skip-back" onPress={prev} />
        <CtrlBtn icon="refresh" onPress={replay} />
        <CtrlBtn icon={paused ? "play" : "pause"} onPress={togglePause} big />
        <CtrlBtn icon="play-skip-forward" onPress={next} />
      </View>

      {/* Options */}
      <View className="flex-row justify-center gap-4 mb-6 items-center">
        <View className="flex-row gap-1">
          {SPEEDS.map(s => (
            <Pressable key={s} onPress={() => setSpeed(s)}
              className={`px-3 py-1 rounded-full ${speed === s ? "bg-rose-600" : "bg-gray-100"}`}>
              <Text className={speed === s ? "text-white text-xs" : "text-gray-700 text-xs"}>{s}x</Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={() => setRepeatWindow(!repeatWindow)}
          className={`px-3 py-1 rounded-full ${repeatWindow ? "bg-rose-100" : "bg-gray-100"}`}>
          <Text className={repeatWindow ? "text-rose-700 text-xs" : "text-gray-500 text-xs"}>跟讀停頓</Text>
        </Pressable>
      </View>
    </View>
  );
}

function CtrlBtn({ icon, onPress, big }: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void; big?: boolean }) {
  const size = big ? 56 : 44;
  return (
    <Pressable onPress={onPress}
      style={{ width: size, height: size }}
      className={`items-center justify-center rounded-full ${big ? "bg-rose-600" : "bg-gray-100 border border-gray-200"}`}>
      <Ionicons name={icon} size={big ? 24 : 18} color={big ? "white" : "#374151"} />
    </Pressable>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shadow/PlaybackView.tsx
git commit -m "feat(shadow): playback view (text, status, controls, speed, fav)"
```

---

### Task 10: Done screen

**Files:**
- Create: `src/shadow/DoneScreen.tsx`

- [ ] **Step 1: Implement DoneScreen.tsx**

```tsx
// src/shadow/DoneScreen.tsx
import { Text, View } from "react-native";
import { Button } from "../components/Button";

export function DoneScreen({ count, onAgain, onExit }: { count: number; onAgain: () => void; onExit: () => void }) {
  return (
    <View className="flex-1 px-6 pt-12 bg-white items-center justify-center">
      <Text className="text-3xl font-bold mb-2">辛苦了</Text>
      <Text className="text-gray-500 mb-8">這一輪跟讀了 {count} 句</Text>
      <View className="w-full max-w-xs">
        <Button label="再來一輪" onPress={onAgain} />
        <Button label="回到設定" variant="secondary" onPress={onExit} />
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shadow/DoneScreen.tsx
git commit -m "feat(shadow): done screen"
```

---

### Task 11: Wire shadowing tab

**Files:**
- Modify: `app/(tabs)/shadowing.tsx`

- [ ] **Step 1: Implement tab orchestration**

```tsx
// app/(tabs)/shadowing.tsx
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useShadow } from "../../src/shadow/session";
import { SourcePicker } from "../../src/shadow/SourcePicker";
import { PlaybackView } from "../../src/shadow/PlaybackView";
import { DoneScreen } from "../../src/shadow/DoneScreen";

export default function ShadowingTab() {
  const insets = useSafeAreaInsets();
  const { status, queue, start, exit } = useShadow();

  if (status === "idle") {
    return (
      <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: "white" }}>
        <SourcePicker onStart={start} />
      </View>
    );
  }
  if (status === "done") {
    return (
      <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: "white" }}>
        <DoneScreen count={queue.length} onAgain={() => start(queue)} onExit={exit} />
      </View>
    );
  }
  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: "white" }}>
      <PlaybackView />
    </View>
  );
}
```

- [ ] **Step 2: Verify**

```bash
pnpm test
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/\(tabs\)/shadowing.tsx
git commit -m "feat(shadow): wire picker → playback → done in tab"
```

---

## Done Criteria for P4

- [ ] All 11 commits landed on `main`
- [ ] `pnpm test` shows ~70+ tests, 0 failures
- [ ] `npx tsc --noEmit` 0 errors
- [ ] User can:
  1. Open 跟讀 tab
  2. Pick 語法例句 / 單字 / 我的收藏 + 級別
  3. 按開始 → 播放 → 跟讀停頓 → 再播 → 停頓 → 下一句
  4. 速度按鈕切 0.75 / 1 / 1.25
  5. 跟讀停頓 toggle 取消停頓直接過下一句
  6. 收藏 star button → 寫進 word_notebook（單字）或 shadow_favs（語法）
  7. 退出 → 重新進來 source picker 仍是上次設定
  8. 在網頁加收藏 → App 登入後同步看到 ⭐

## Out of Scope for P4 (deferred)

- **Recording + comparison**（spec 原本提到的「跟读录音 + 对比回放」）→ P4.1
  - 用 `expo-audio` v2 的 recording API
  - UI 加錄音按鈕 + 回放按鈕 + 波形顯示
  - 估 3-5 task
- **AI 發音評分** → spec 標明不在 v1 範圍
- **波形顯示**（spec 提到）→ P4.1（純視覺，不影響功能）
- **左右滑動切句**（spec 提到的「滑動切下一句」）→ P4.1（控制鈕已可用）
- **假名切換**（spec 提到日文可切假名）→ P4.1（grammar j 有 `<em>` 標記但無假名標註，需要額外處理）
- **鍵盤快捷鍵**（web 有 Space/←→/R/F/Esc）→ 等實體鍵盤支援需求出現再做
- **跟讀本頁**（從 SRS 卡片清單觸發）→ 等 SRS 整合需求

## Open Questions

(none — web's Shadow module fully understood from index.html lines 1655-1968)
