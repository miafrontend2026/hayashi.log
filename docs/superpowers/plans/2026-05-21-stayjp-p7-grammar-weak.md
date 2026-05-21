# StayJP P7 — Grammar Weak Marker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Mirror web's WeakGrammar ("不熟" mark) feature. User can flag any grammar point as "不熟"; flagged points show a red badge in the list and can be filtered/shadowed as a focused review set. Sync the `grammar_weak` field through existing `webSync` pipeline.

**Scope cap:** Only the **weak flag** + filter + shadow. The full `grammar_srs` (interval-based flashcard mode for grammar) is **out of scope** for P7. Web has it (GrammarDrill module); App can add it later as P7.1 or P8.

**Web reference:**
- `index.html` lines 2053-2106 — WeakGrammar module (toggleWeak, isWeak, count, markKnown)
- Schema: `{ [grammarId]: timestamp }` — flat map keyed by grammar `id` (e.g., `"n3-1"`); value is ms epoch
- Field in `SYNC_KEYS`: `grammar_weak`

**Architecture:**
- New `src/grammar/weakStore.ts` — MMKV store + push field
- `WebUserDoc.grammar_weak: Record<string, number>` + `mergeGrammarWeak(local, cloud)` — union (any side flagged = stays flagged)
- New filter state in Grammar tab: `all | weak`
- New range option in Shadow grammar source: `all | weak`
- Red flag icon on GrammarCard when weak

---

## File Structure

```
stayjp-app/
├── src/
│   ├── grammar/
│   │   ├── weakStore.ts             # NEW
│   │   ├── GrammarList.tsx          # MODIFY — filter pills + weak indicator
│   │   └── GrammarCard.tsx          # MODIFY — red flag when weak
│   ├── shadow/
│   │   └── SourcePicker.tsx         # MODIFY — grammar range pills (all/weak)
│   └── lib/
│       └── webSync.ts               # MODIFY — grammar_weak field + merger
├── app/
│   ├── grammar/[level]/[id].tsx     # MODIFY — toggle button on detail
│   └── _layout.tsx                  # MODIFY — bootSync merges grammar_weak
└── __tests__/
    ├── grammar-weak-store.test.ts   # NEW
    └── grammar-weak-merge.test.ts   # NEW
```

---

### Task 1: Types + store + tests

**Files:**
- Create: `src/grammar/weakStore.ts`
- Create: `__tests__/grammar-weak-store.test.ts`

- [ ] **Step 1: Implement store**

```ts
// src/grammar/weakStore.ts
import { getJSON, setJSON } from "../lib/storage";
import { schedulePushField } from "../lib/webSync";

export type GrammarWeak = Record<string, number>;  // key = grammar id, value = ms epoch flagged at

const KEY = "grammar_weak";

export function getGrammarWeak(): GrammarWeak {
  return getJSON<GrammarWeak>(KEY) ?? {};
}

export function setGrammarWeak(d: GrammarWeak): void {
  setJSON(KEY, d);
  schedulePushField("grammar_weak", d);
}

export function isWeak(id: string): boolean {
  return !!getGrammarWeak()[id];
}

export function toggleWeak(id: string, now: number = Date.now()): boolean {
  const d = getGrammarWeak();
  const wasWeak = !!d[id];
  if (wasWeak) delete d[id];
  else d[id] = now;
  setGrammarWeak(d);
  return !wasWeak;  // returns new state
}

export function weakCount(): number {
  return Object.keys(getGrammarWeak()).length;
}
```

- [ ] **Step 2: Write tests**

```ts
// __tests__/grammar-weak-store.test.ts
jest.mock("../src/lib/webSync", () => ({
  schedulePushField: jest.fn(),
}));

import { storage } from "../src/lib/storage";
import { isWeak, toggleWeak, weakCount, getGrammarWeak } from "../src/grammar/weakStore";

beforeEach(() => storage.clearAll());

test("toggleWeak adds and removes", () => {
  expect(isWeak("n3-1")).toBe(false);
  expect(toggleWeak("n3-1")).toBe(true);
  expect(isWeak("n3-1")).toBe(true);
  expect(toggleWeak("n3-1")).toBe(false);
  expect(isWeak("n3-1")).toBe(false);
});

test("weakCount reflects current size", () => {
  toggleWeak("n3-1");
  toggleWeak("n3-2");
  toggleWeak("n4-7");
  expect(weakCount()).toBe(3);
  toggleWeak("n3-1");
  expect(weakCount()).toBe(2);
});

test("getGrammarWeak returns flat map", () => {
  toggleWeak("n3-1", 1000);
  toggleWeak("n3-2", 2000);
  expect(getGrammarWeak()).toEqual({ "n3-1": 1000, "n3-2": 2000 });
});
```

- [ ] **Step 3: Run, expect PASS**

```bash
pnpm test grammar-weak-store
```

- [ ] **Step 4: Commit**

```bash
git add src/grammar/weakStore.ts __tests__/grammar-weak-store.test.ts
git commit -m "feat(grammar): grammar_weak MMKV store with toggle/isWeak/count"
```

---

### Task 2: webSync schema + merger

**Files:**
- Modify: `src/lib/webSync.ts`
- Create: `__tests__/grammar-weak-merge.test.ts`

- [ ] **Step 1: Extend WebUserDoc + merger**

In `src/lib/webSync.ts`:

```ts
export interface WebUserDoc {
  // existing...
  grammar_weak?: Record<string, number>;
}

/**
 * Union merge: any side flagged = stays flagged. Take the *earlier* timestamp on overlap
 * (matches web's "first flagged at" intent — though web doesn't really preserve this,
 * earlier-wins is safer than later-wins for an additive set).
 */
export function mergeGrammarWeak(
  local: Record<string, number>,
  cloud: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = { ...cloud };
  for (const [id, lts] of Object.entries(local)) {
    const cts = out[id];
    if (cts === undefined) { out[id] = lts; continue; }
    out[id] = Math.min(lts, cts);
  }
  return out;
}
```

- [ ] **Step 2: Tests**

```ts
// __tests__/grammar-weak-merge.test.ts
jest.mock("../src/lib/firebase", () => ({ auth: { currentUser: null }, db: {} }));
jest.mock("firebase/firestore", () => ({
  doc: jest.fn(), setDoc: jest.fn(), getDoc: jest.fn(),
}));

import { mergeGrammarWeak } from "../src/lib/webSync";

test("union — local-only kept", () => {
  expect(mergeGrammarWeak({ "n3-1": 5 }, {})).toEqual({ "n3-1": 5 });
});

test("union — cloud-only kept", () => {
  expect(mergeGrammarWeak({}, { "n3-2": 10 })).toEqual({ "n3-2": 10 });
});

test("overlap — earlier timestamp wins", () => {
  expect(mergeGrammarWeak({ "n3-1": 100 }, { "n3-1": 50 })).toEqual({ "n3-1": 50 });
  expect(mergeGrammarWeak({ "n3-1": 50 }, { "n3-1": 100 })).toEqual({ "n3-1": 50 });
});
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/webSync.ts __tests__/grammar-weak-merge.test.ts
git commit -m "feat(sync): grammar_weak field + merger (union, earlier ts wins)"
```

---

### Task 3: Red flag on GrammarCard

**Files:**
- Modify: `src/grammar/GrammarCard.tsx`

- [ ] **Step 1: Read weak state, render flag**

```tsx
import { isWeak } from "./weakStore";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";

// inside component, before return:
const weak = isWeak(item.id);

// add to right cluster (above the chevron-down or replacing it conditionally):
{weak ? (
  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginRight: 8 }}>
    <Ionicons name="flag" size={14} color="#EF4444" />
  </View>
) : null}
```

(Place the flag indicator visibly next to the chevron. Keep chevron for navigation affordance.)

**Note:** `isWeak()` reads MMKV on each render. Since GrammarCard is memo'd and `item.id` is stable, this re-evaluates only when item changes (which is rare). Acceptable. If perf becomes an issue, hoist weak set into parent via useMemo + tick.

- [ ] **Step 2: Commit**

```bash
git add src/grammar/GrammarCard.tsx
git commit -m "feat(grammar): red flag indicator on GrammarCard when weak"
```

---

### Task 4: Detail page toggle button

**Files:**
- Modify: `app/grammar/[level]/[id].tsx`

- [ ] **Step 1: Add toggle button next to 跟讀**

In the header bar (currently has back-arrow on left, 跟讀 button on right):

```tsx
import { isWeak as isGrammarWeak, toggleWeak as toggleGrammarWeak } from "../../../src/grammar/weakStore";

// in component:
const [weak, setWeak] = useState(() => isGrammarWeak(id as string));

function toggle() {
  const next = toggleGrammarWeak(id as string);
  setWeak(next);
}

// in JSX header row, between back and 跟讀:
<Pressable onPress={toggle} hitSlop={10}
  style={{
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    backgroundColor: weak ? "#FEE2E2" : colors.chip,
  }}>
  <Ionicons name={weak ? "flag" : "flag-outline"} size={14} color={weak ? "#DC2626" : colors.textMuted} />
  <Text style={{ color: weak ? "#DC2626" : colors.textMuted, fontSize: 13, fontWeight: "600" }}>
    {weak ? "已標不熟" : "標記不熟"}
  </Text>
</Pressable>
```

(Wrap the existing button row to fit three items: ◀ back / 不熟 toggle / 跟讀.)

- [ ] **Step 2: Commit**

```bash
git add app/grammar
git commit -m "feat(grammar): detail page can toggle 不熟 flag"
```

---

### Task 5: Filter pill on Grammar tab (顯示全部 / 只看不熟)

**Files:**
- Modify: `app/(tabs)/grammar.tsx`
- Modify: `src/grammar/GrammarList.tsx` (add weakOnly prop)

- [ ] **Step 1: Tab adds toggle**

In `app/(tabs)/grammar.tsx`:

```tsx
const [weakOnly, setWeakOnly] = useState(false);
const weakN = weakCount();

// next to the 跟讀本級 button, add a pill:
<Pressable onPress={() => setWeakOnly(b => !b)}
  className="flex-row items-center gap-1 px-3 py-1.5 rounded-full"
  style={{ backgroundColor: weakOnly ? "#FEE2E2" : colors.chip }}>
  <Ionicons name="flag" size={12} color={weakOnly ? "#DC2626" : colors.textMuted} />
  <Text style={{ color: weakOnly ? "#DC2626" : colors.textMuted, fontSize: 12, fontWeight: "600" }}>
    {weakOnly ? `只看不熟 (${weakN})` : `不熟 ${weakN}`}
  </Text>
</Pressable>
```

Pass `weakOnly` to GrammarList.

- [ ] **Step 2: GrammarList filters when weakOnly**

In `GrammarList.tsx`, accept `weakOnly?: boolean` prop. When true, filter `grammar(level)` by `isWeak(item.id)` before grouping/rendering.

- [ ] **Step 3: Commit**

```bash
git add app/\(tabs\)/grammar.tsx src/grammar/GrammarList.tsx
git commit -m "feat(grammar): tab filter — show all / 只看不熟"
```

---

### Task 6: Shadow grammar range — add 不熟

**Files:**
- Modify: `src/shadow/SourcePicker.tsx`
- Modify: `src/shadow/sources.ts`

- [ ] **Step 1: collectGrammarItems takes optional weak filter**

In `sources.ts`:

```ts
export function collectGrammarItems(level: Level, weakOnly: boolean = false): ShadowItem[] {
  // existing logic, but if weakOnly, filter grammar(level) by isWeak first
  // then flatten eg arrays
}
```

(Import `isWeak` from `../grammar/weakStore`.)

- [ ] **Step 2: SourcePicker shows grammar range pill**

When `kind === "grammar"`, show:
- 全部 / 不熟

`build()` passes `weakOnly` to `collectGrammarItems`.

- [ ] **Step 3: Commit**

```bash
git add src/shadow/SourcePicker.tsx src/shadow/sources.ts
git commit -m "feat(shadow): grammar source supports weak-only filter"
```

---

### Task 7: bootSync merges grammar_weak

**Files:**
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Add merge block**

```ts
import { mergeGrammarWeak } from "../src/lib/webSync";
import { getGrammarWeak, setGrammarWeak } from "../src/grammar/weakStore";

// inside bootSync after existing merges:
if (remote.grammar_weak) {
  const merged = mergeGrammarWeak(getGrammarWeak(), remote.grammar_weak);
  setGrammarWeak(merged);
}
```

- [ ] **Step 2: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat(auth): bootSync merges grammar_weak"
```

---

### Task 8: Verify

- [ ] **Step 1: tsc + tests**

```bash
pnpm test
npx tsc --noEmit
```

Expected: ~104 tests pass (97 + 4 store + 3 merge).

- [ ] **Step 2: Manual smoke**

1. 文法 tab → tap into a grammar point → tap 「標記不熟」 → button flips to red 「已標不熟」
2. Back to 文法 tab → that grammar's card shows a red flag icon
3. Top header pill shows `不熟 1` (or `只看不熟 (1)` when active)
4. Tap the pill → list filtered to just that one
5. 跟讀 tab → grammar source → 「不熟」 range pill appears → only weak grammar examples queue
6. Sign out + in → flag persists via Firestore

## Done Criteria

- All 7 tasks committed
- `pnpm test` passes
- `npx tsc --noEmit` 0 errors
- Web ↔ App round-trip of `grammar_weak` works

## Out of Scope (P7.1)

- Full grammar SRS (`grammar_srs`) like web's GrammarDrill (interval-based review of grammar examples)
- 「不熟複習」quiz mini-game from web's WeakGrammar.startQuiz
- Toast notifications on toggle (we just flip the button color)
- Haptic feedback

## Open Questions

(none)
