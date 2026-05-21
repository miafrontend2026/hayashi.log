# StayJP P6 — Vocab & Grammar Browse Lists Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Mirror the web's browse experience — let users **see all vocab and grammar at a glance per level**, not one card at a time. Today's 單字 tab is a Flashcard SRS settings panel; rewrite it as a scrollable list. 文法 tab is a placeholder; build it as a scrollable list. Flashcard SRS session becomes a modal launched from a "速習" button in the 單字 tab.

**Architecture changes:**
- `app/(tabs)/flashcard.tsx` → renamed concept: still the 單字 tab, but content is now a browse list.
- Flashcard session moves to a new modal route `app/flashcard-session.tsx` (pushed as a modal via expo-router's `presentation: 'modal'`).
- `app/(tabs)/grammar.tsx` placeholder → real browse list.
- Word detail and Grammar detail use bottom-sheet-style modals or push routes. **Decision:** use push routes (`app/word/[id].tsx`, `app/grammar/[id].tsx`) for simplicity and deep-link support.
- Lists use `FlatList` with `windowSize`, `removeClippedSubviews`, `getItemLayout` for vocab (fixed row height) — N5 has ~800 words, N1 ~1000+, need virtualization.
- 跟讀 + Today launch-intent flow keeps working: launching Flashcard from Today still opens the session, now as the modal route (not the tab body). Need to update intent-consumer logic to push to `/flashcard-session` instead of relying on tab body.

**Reference web code:** `stay-jp-notes/index.html` lines ~1100-1300 render vocab list; grammar uses `.gc` cards with `.ex` examples. Same data, different shell.

---

## Decisions to lock in

1. **Modal vs tab body for Flashcard session**: modal. Reason: user said "讓單字 tab 看到所有單字" — incompatible with also being session. Modal keeps session ephemeral and reachable from anywhere.
2. **Word/Grammar detail = push route, not modal**: deep-linkable, simpler back behavior, reuses Stack.
3. **Sort order**: by appearance in the source JSON (which matches web's display order). No alphabetical / popularity sort in P6.
4. **Empty state**: each list always has data (N5~N1 all populated); skip empty UI.
5. **Search bar**: defer to P6.1. P6 is "see everything, scrollable list" only.
6. **SRS state indicator on row**: small colored dot.
   - gray (no entry) = 新詞
   - amber (interval > 0 and < 21) = 學習中
   - emerald (interval ≥ 21) = 掌握
   - red (due) = 待複習 (overrides amber/emerald if isDue)
   Decision: due > mastered > learning > new (priority for color).

---

## File Structure

```
stayjp-app/
├── app/
│   ├── (tabs)/
│   │   ├── flashcard.tsx          # MODIFY — becomes 單字 browse list
│   │   └── grammar.tsx            # MODIFY — becomes 文法 browse list
│   ├── flashcard-session.tsx      # NEW — modal route hosting the SRS session
│   ├── word/[level]/[w].tsx       # NEW — vocab detail push route
│   └── grammar/[level]/[id].tsx   # NEW — grammar detail push route
└── src/
    ├── vocab/
    │   ├── VocabList.tsx          # NEW — virtualized FlatList
    │   ├── VocabRow.tsx           # NEW — single row (kanji/kana/meaning/star/SRS dot)
    │   └── srsDotColor.ts         # NEW — pure helper: srs entry → color
    └── grammar/
        ├── GrammarList.tsx        # NEW — FlatList
        └── GrammarRow.tsx         # NEW — single row (t/p/ex preview)
```

---

### Task 1: SRS dot color helper (pure, TDD)

**Files:**
- Create: `src/vocab/srsDotColor.ts`
- Create: `__tests__/srs-dot-color.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// __tests__/srs-dot-color.test.ts
import { srsDotColor } from "../src/vocab/srsDotColor";
import type { SrsEntry } from "../src/srs/types";

const NOW = 1_700_000_000_000;

test("undefined entry → new (gray)", () => {
  expect(srsDotColor(undefined, NOW)).toBe("#cbd5e1");  // slate-300
});

test("entry with future nextReview + interval 1 → learning (amber)", () => {
  const e: SrsEntry = { interval: 5, ease: 2.5, reviews: 2, correct: 1, nextReviewTs: NOW + 86400_000, nextReview: "" };
  expect(srsDotColor(e, NOW)).toBe("#f59e0b");
});

test("entry with interval >= 21 and not due → mastered (emerald)", () => {
  const e: SrsEntry = { interval: 30, ease: 2.7, reviews: 5, correct: 5, nextReviewTs: NOW + 86400_000, nextReview: "" };
  expect(srsDotColor(e, NOW)).toBe("#10b981");
});

test("due entry → red (regardless of interval)", () => {
  const e: SrsEntry = { interval: 30, ease: 2.7, reviews: 5, correct: 5, nextReviewTs: NOW - 1000, nextReview: "" };
  expect(srsDotColor(e, NOW)).toBe("#ef4444");
});
```

- [ ] **Step 2: Implement srsDotColor.ts**

```ts
// src/vocab/srsDotColor.ts
import type { SrsEntry } from "../srs/types";

export function srsDotColor(entry: SrsEntry | undefined, now: number = Date.now()): string {
  if (!entry) return "#cbd5e1";              // slate-300 — new
  if (entry.nextReviewTs <= now) return "#ef4444";  // red-500 — due (highest priority)
  if (entry.interval >= 21) return "#10b981";       // emerald-500 — mastered
  return "#f59e0b";                                  // amber-500 — learning
}
```

- [ ] **Step 3: Run, expect PASS**

```bash
pnpm test srs-dot-color
```

- [ ] **Step 4: Commit**

```bash
cd ~/Documents/GitHub/stayjp-app
git add src/vocab/srsDotColor.ts __tests__/srs-dot-color.test.ts
git commit -m "feat(vocab): srsDotColor pure helper for browse-row state indicator"
```

---

### Task 2: VocabRow component

**Files:**
- Create: `src/vocab/VocabRow.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/vocab/VocabRow.tsx
import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Word, Level } from "../types/content";
import { srsDotColor } from "./srsDotColor";
import { srsKey } from "../srs/algo";
import type { SrsData } from "../srs/types";

interface Props {
  word: Word;
  level: Level;
  srs: SrsData;
  isFav: boolean;
  onPress: () => void;
  onToggleFav: () => void;
}

export const VocabRow = memo(function VocabRow({ word, level, srs, isFav, onPress, onToggleFav }: Props) {
  const entry = srs[srsKey(level, word.w)];
  const dot = srsDotColor(entry);

  return (
    <Pressable onPress={onPress} className="flex-row items-center px-5 py-3 bg-white border-b border-slate-100 active:bg-slate-50">
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot, marginRight: 12 }} />
      <View className="flex-1 min-w-0">
        <View className="flex-row items-baseline gap-2">
          <Text style={{ fontFamily: "NotoSansJP_500Medium" }} className="text-lg font-semibold text-slate-900">{word.w}</Text>
          {word.r && word.r !== word.w ? (
            <Text style={{ fontFamily: "NotoSansJP_400Regular" }} className="text-sm text-slate-500">{word.r}</Text>
          ) : null}
        </View>
        <Text className="text-sm text-slate-600 mt-0.5" numberOfLines={1}>{word.m}</Text>
      </View>
      <Text className="text-xs text-slate-400 mr-3">{word.c}</Text>
      <Pressable onPress={onToggleFav} hitSlop={10}>
        <Ionicons name={isFav ? "star" : "star-outline"} size={20} color={isFav ? "#f59e0b" : "#cbd5e1"} />
      </Pressable>
    </Pressable>
  );
});
```

- [ ] **Step 2: Commit**

```bash
git add src/vocab/VocabRow.tsx
git commit -m "feat(vocab): VocabRow — kanji/kana/meaning/SRS dot/star"
```

---

### Task 3: VocabList — virtualized FlatList

**Files:**
- Create: `src/vocab/VocabList.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/vocab/VocabList.tsx
import { useCallback, useMemo, useState } from "react";
import { FlatList, View, Pressable, Text } from "react-native";
import { useRouter } from "expo-router";
import { allLevels, vocab } from "../lib/content";
import { getSrsData } from "../srs/store";
import { getVocabFavs, toggleVocabFav } from "../shadow/favs";
import { VocabRow } from "./VocabRow";
import type { Level, Word } from "../types/content";

const ROW_HEIGHT = 64;

interface Props {
  level: Level;
  onLevelChange: (l: Level) => void;
}

export function VocabList({ level, onLevelChange }: Props) {
  const router = useRouter();
  // Trigger re-render after favorite toggle. Cheap approach: bump a counter.
  const [favTick, setFavTick] = useState(0);

  const data: Word[] = useMemo(() => vocab(level), [level]);
  const srs = useMemo(() => getSrsData(), [favTick, level]);
  const favSet = useMemo(() => {
    const arr = getVocabFavs();
    const s = new Set<string>();
    arr.forEach((x) => s.add(`${x.lv ?? ""}::${x.w}`));
    return s;
  }, [favTick, level]);

  const onPressWord = useCallback((w: Word) => {
    router.push(`/word/${level}/${encodeURIComponent(w.w)}`);
  }, [router, level]);

  const onToggleFav = useCallback((w: Word) => {
    toggleVocabFav({ j: w.r || w.w, z: "", w: w.w, r: w.r, m: w.m, lv: level });
    setFavTick((n) => n + 1);
  }, [level]);

  return (
    <View style={{ flex: 1 }}>
      {/* Level pills (sticky header could be added; for v1 just place above list) */}
      <View className="flex-row gap-2 px-5 py-3 bg-white border-b border-slate-100">
        {allLevels.map((lv) => {
          const on = lv === level;
          return (
            <Pressable key={lv} onPress={() => onLevelChange(lv)}
              className={`px-4 py-1.5 rounded-full ${on ? "bg-indigo-600" : "bg-slate-100"}`}>
              <Text className={on ? "text-white font-semibold text-sm" : "text-slate-700 text-sm"}>{lv.toUpperCase()}</Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={data}
        keyExtractor={(it) => `${level}:${it.w}`}
        renderItem={({ item }) => (
          <VocabRow
            word={item}
            level={level}
            srs={srs}
            isFav={favSet.has(`${level}::${item.w}`)}
            onPress={() => onPressWord(item)}
            onToggleFav={() => onToggleFav(item)}
          />
        )}
        getItemLayout={(_, idx) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * idx, index: idx })}
        initialNumToRender={20}
        windowSize={7}
        removeClippedSubviews
      />
    </View>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/vocab/VocabList.tsx
git commit -m "feat(vocab): VocabList — virtualized FlatList with level pills"
```

---

### Task 4: Move Flashcard session to modal route

**Files:**
- Create: `app/flashcard-session.tsx`
- Modify: `app/_layout.tsx` (or `app/(tabs)/_layout.tsx`? Actually Stack screens for modal go in root Stack via screenOptions)

- [ ] **Step 1: Create `app/flashcard-session.tsx`**

Lift the existing `app/(tabs)/flashcard.tsx` business logic (settings panel → running session → done screen) into the new file. Same imports + same JSX. The launch-intent consumer effect also moves here.

```tsx
// app/flashcard-session.tsx
import { useCallback, useEffect } from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Pressable } from "react-native";
import { useSession } from "../src/flashcard/session";
import { SettingsPanel } from "../src/flashcard/SettingsPanel";
import { Card } from "../src/flashcard/Card";
import { RatingButtons } from "../src/flashcard/RatingButtons";
import { Countdown } from "../src/flashcard/Countdown";
import { DoneScreen } from "../src/flashcard/DoneScreen";
import { useLaunchIntent } from "../src/stores/launchIntent";
import type { Level } from "../src/types/content";

const COUNTDOWN_SEC = 20;

export default function FlashcardSession() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { status, queue, cur, flipped, score, start, flip, rate, reset } = useSession();

  // Consume launch intent on first mount
  const pendingFlashcard = useLaunchIntent(s => s.pendingFlashcard);
  const setFlashcardIntent = useLaunchIntent(s => s.setFlashcardIntent);
  useEffect(() => {
    if (!pendingFlashcard) return;
    const { range, level } = pendingFlashcard;
    start((level || "n5") as Level, 20, range);
    setFlashcardIntent(null);
  }, [pendingFlashcard]);

  const onAutoFlip = useCallback(() => { if (!flipped) flip(); }, [flipped, flip]);

  if (status === "idle") {
    return (
      <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: "white" }}>
        <Header onClose={() => { reset(); router.back(); }} />
        <SettingsPanel onStart={start} />
      </View>
    );
  }
  if (status === "done") {
    const lv = queue[0]?.level ?? "n5";
    return (
      <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: "white" }}>
        <Header onClose={() => { reset(); router.back(); }} />
        <DoneScreen
          level={lv}
          score={score}
          totalCards={queue.length}
          onAgain={() => start(lv, queue.length, "new")}
          onExit={() => { reset(); router.back(); }}
        />
      </View>
    );
  }

  const item = queue[cur];
  if (!item) return null;
  return (
    <View style={{ flex: 1, paddingTop: insets.top + 16, paddingBottom: 24, paddingHorizontal: 20, backgroundColor: "white" }}>
      <Header onClose={() => { reset(); router.back(); }} />
      <View className="flex-row justify-between items-center mb-3">
        <Text className="text-slate-700">{cur + 1} / {queue.length}</Text>
        <Text className="text-xs text-slate-400">{item.isNew ? "新詞" : "複習"}</Text>
      </View>
      <Countdown seconds={COUNTDOWN_SEC} resetKey={String(cur)} onComplete={onAutoFlip} />
      <View className="mt-4">
        <Card item={item} index={cur} flipped={flipped} onFlip={flip} onRate={rate} />
      </View>
      {flipped && <RatingButtons onRate={rate} />}
    </View>
  );
}

function Header({ onClose }: { onClose: () => void }) {
  return (
    <View style={{ position: "absolute", top: 16, right: 16, zIndex: 10 }}>
      <Pressable onPress={onClose} hitSlop={12}>
        <Ionicons name="close" size={28} color="#94a3b8" />
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 2: Declare modal screen in root layout**

In `app/_layout.tsx`, add a `<Stack.Screen name="flashcard-session" options={{ presentation: "modal", headerShown: false }} />`. Already using `<Stack>`; just add the screen entry. Need to wrap Stack body:

```tsx
<Stack screenOptions={{ headerShown: false }}>
  <Stack.Screen name="(auth)" />
  <Stack.Screen name="(tabs)" />
  <Stack.Screen name="flashcard-session" options={{ presentation: "modal" }} />
</Stack>
```

- [ ] **Step 3: Commit**

```bash
git add app/flashcard-session.tsx app/_layout.tsx
git commit -m "feat(flashcard): move SRS session to modal route /flashcard-session"
```

---

### Task 5: Rewrite 單字 tab as browse list

**Files:**
- Modify: `app/(tabs)/flashcard.tsx`

- [ ] **Step 1: Replace contents**

```tsx
// app/(tabs)/flashcard.tsx
import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { VocabList } from "../../src/vocab/VocabList";
import { getPref } from "../../src/stores/prefsStore";
import type { Level } from "../../src/types/content";

export default function VocabTab() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  // Default to user's goal level if set, else N5
  const goal = getPref("goal_level");
  const [level, setLevel] = useState<Level>((goal as Level) || "n5");

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: "#f8fafc" }}>
      <View className="flex-row items-center justify-between px-5 py-3 bg-white border-b border-slate-100">
        <Text className="text-2xl font-bold text-slate-900">單字</Text>
        <Pressable
          onPress={() => router.push("/flashcard-session")}
          className="flex-row items-center gap-1 px-3 py-1.5 rounded-full bg-indigo-600 active:bg-indigo-700"
        >
          <Ionicons name="flash" size={14} color="white" />
          <Text className="text-white text-sm font-semibold">速習</Text>
        </Pressable>
      </View>
      <VocabList level={level} onLevelChange={setLevel} />
    </View>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(tabs\)/flashcard.tsx
git commit -m "feat(vocab): 單字 tab is now a browse list (速習 modal launches session)"
```

---

### Task 6: Word detail route

**Files:**
- Create: `app/word/[level]/[w].tsx`

- [ ] **Step 1: Implement detail page**

```tsx
// app/word/[level]/[w].tsx
import { ScrollView, Text, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState } from "react";
import { vocab } from "../../../src/lib/content";
import { playWord } from "../../../src/lib/audio";
import { isFav, toggleVocabFav } from "../../../src/shadow/favs";
import type { Level } from "../../../src/types/content";

export default function WordDetail() {
  const { level, w } = useLocalSearchParams<{ level: string; w: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const lvl = level as Level;
  const target = decodeURIComponent(w as string);
  const word = vocab(lvl).find((v) => v.w === target);
  const [fav, setFav] = useState(word ? isFav({ j: word.r || word.w, z: "", w: word.w, lv: lvl }) : false);

  if (!word) {
    return (
      <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: "white" }} className="items-center justify-center">
        <Text>找不到單字</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: "white" }}>
      <View className="flex-row items-center justify-between px-5 py-3">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color="#475569" />
        </Pressable>
        <Pressable onPress={() => {
          toggleVocabFav({ j: word.r || word.w, z: "", w: word.w, r: word.r, m: word.m, lv: lvl });
          setFav((f) => !f);
        }} hitSlop={12}>
          <Ionicons name={fav ? "star" : "star-outline"} size={24} color={fav ? "#f59e0b" : "#cbd5e1"} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 48 }}>
        <Text className="text-xs text-slate-500 uppercase tracking-widest font-semibold mt-4">{lvl.toUpperCase()}</Text>
        <Text style={{ fontFamily: "NotoSansJP_700Bold" }} className="text-6xl font-extrabold text-slate-900 mt-2">{word.w}</Text>
        {word.r && word.r !== word.w ? (
          <Text style={{ fontFamily: "NotoSansJP_500Medium" }} className="text-2xl text-slate-600 mt-2">{word.r}</Text>
        ) : null}
        <View className="flex-row items-center gap-3 mt-3">
          <Pressable onPress={() => void playWord(word.r || word.w)} className="flex-row items-center gap-1 px-3 py-1.5 rounded-full bg-indigo-50 active:bg-indigo-100">
            <Ionicons name="volume-medium" size={16} color="#1d4ed8" />
            <Text className="text-indigo-700 font-semibold text-sm">發音</Text>
          </Pressable>
          <Text className="text-xs text-slate-400">{word.c}</Text>
        </View>
        <Text className="text-lg text-slate-800 mt-6">{word.m}</Text>
      </ScrollView>
    </View>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/word
git commit -m "feat(vocab): word detail route with audio + star"
```

---

### Task 7: GrammarRow + GrammarList

**Files:**
- Create: `src/grammar/GrammarRow.tsx`
- Create: `src/grammar/GrammarList.tsx`

- [ ] **Step 1: Implement GrammarRow.tsx**

```tsx
// src/grammar/GrammarRow.tsx
import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import type { GrammarItem } from "../types/content";

interface Props {
  item: GrammarItem;
  onPress: () => void;
}

export const GrammarRow = memo(function GrammarRow({ item, onPress }: Props) {
  // Strip <em> from first example for preview
  const preview = item.eg[0]?.j.replace(/<\/?em>/g, "") ?? "";
  return (
    <Pressable onPress={onPress} className="px-5 py-4 bg-white border-b border-slate-100 active:bg-slate-50">
      <View className="flex-row items-baseline gap-2">
        <Text className="text-xs text-indigo-700 font-semibold uppercase tracking-widest">{item.cat}</Text>
      </View>
      <Text style={{ fontFamily: "NotoSansJP_500Medium" }} className="text-lg font-bold text-slate-900 mt-1">{item.t}</Text>
      <Text className="text-sm text-slate-500 mt-1" numberOfLines={1}>{item.p}</Text>
      {preview ? (
        <Text style={{ fontFamily: "NotoSansJP_400Regular" }} className="text-sm text-slate-600 mt-2" numberOfLines={1}>{preview}</Text>
      ) : null}
    </Pressable>
  );
});
```

- [ ] **Step 2: Implement GrammarList.tsx**

```tsx
// src/grammar/GrammarList.tsx
import { useMemo } from "react";
import { FlatList, View, Pressable, Text } from "react-native";
import { useRouter } from "expo-router";
import { allLevels, grammar } from "../lib/content";
import { GrammarRow } from "./GrammarRow";
import type { Level } from "../types/content";

interface Props {
  level: Level;
  onLevelChange: (l: Level) => void;
}

export function GrammarList({ level, onLevelChange }: Props) {
  const router = useRouter();
  const data = useMemo(() => grammar(level), [level]);

  return (
    <View style={{ flex: 1 }}>
      <View className="flex-row gap-2 px-5 py-3 bg-white border-b border-slate-100">
        {allLevels.map((lv) => {
          const on = lv === level;
          return (
            <Pressable key={lv} onPress={() => onLevelChange(lv)}
              className={`px-4 py-1.5 rounded-full ${on ? "bg-indigo-600" : "bg-slate-100"}`}>
              <Text className={on ? "text-white font-semibold text-sm" : "text-slate-700 text-sm"}>{lv.toUpperCase()}</Text>
            </Pressable>
          );
        })}
      </View>
      <FlatList
        data={data}
        keyExtractor={(it) => it.id}
        renderItem={({ item }) => (
          <GrammarRow item={item} onPress={() => router.push(`/grammar/${level}/${item.id}`)} />
        )}
        initialNumToRender={15}
        windowSize={7}
      />
    </View>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/grammar/
git commit -m "feat(grammar): GrammarRow + GrammarList with FlatList virtualization"
```

---

### Task 8: 文法 tab + grammar detail route

**Files:**
- Modify: `app/(tabs)/grammar.tsx`
- Create: `app/grammar/[level]/[id].tsx`

- [ ] **Step 1: Rewrite 文法 tab**

```tsx
// app/(tabs)/grammar.tsx
import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { GrammarList } from "../../src/grammar/GrammarList";
import { getPref } from "../../src/stores/prefsStore";
import { useLaunchIntent } from "../../src/stores/launchIntent";
import type { Level } from "../../src/types/content";

export default function GrammarTab() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const goal = getPref("goal_level");
  const [level, setLevel] = useState<Level>((goal as Level) || "n5");
  const setShadowIntent = useLaunchIntent(s => s.setShadowIntent);

  function shadowAll() {
    setShadowIntent({ kind: "grammar", level });
    router.push("/(tabs)/shadowing");
  }

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: "#f8fafc" }}>
      <View className="flex-row items-center justify-between px-5 py-3 bg-white border-b border-slate-100">
        <Text className="text-2xl font-bold text-slate-900">文法</Text>
        <Pressable
          onPress={shadowAll}
          className="flex-row items-center gap-1 px-3 py-1.5 rounded-full bg-indigo-600 active:bg-indigo-700"
        >
          <Ionicons name="mic-outline" size={14} color="white" />
          <Text className="text-white text-sm font-semibold">跟讀本級</Text>
        </Pressable>
      </View>
      <GrammarList level={level} onLevelChange={setLevel} />
    </View>
  );
}
```

- [ ] **Step 2: Create grammar detail**

```tsx
// app/grammar/[level]/[id].tsx
import { ScrollView, Text, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { grammar } from "../../../src/lib/content";
import { useLaunchIntent } from "../../../src/stores/launchIntent";
import { useShadow } from "../../../src/shadow/session";
import type { Level } from "../../../src/types/content";

export default function GrammarDetail() {
  const { level, id } = useLocalSearchParams<{ level: string; id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const lvl = level as Level;
  const item = grammar(lvl).find((g) => g.id === id);
  const startShadow = useShadow(s => s.start);

  if (!item) {
    return (
      <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: "white" }} className="items-center justify-center">
        <Text>找不到此文法</Text>
      </View>
    );
  }

  // Strip <em> from example j strings for display (web wraps em around target syntax; could highlight separately later)
  function clean(s: string) { return s.replace(/<\/?em>/g, ""); }

  function shadowThese() {
    const queue = item!.eg.map((eg) => ({ j: clean(eg.j), z: eg.z }));
    startShadow(queue);
    router.push("/(tabs)/shadowing");
  }

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: "white" }}>
      <View className="flex-row items-center justify-between px-5 py-3">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color="#475569" />
        </Pressable>
        <Pressable onPress={shadowThese} className="flex-row items-center gap-1 px-3 py-1.5 rounded-full bg-indigo-600 active:bg-indigo-700">
          <Ionicons name="mic-outline" size={14} color="white" />
          <Text className="text-white text-sm font-semibold">跟讀</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 48 }}>
        <Text className="text-xs text-indigo-700 uppercase tracking-widest font-semibold mt-4">{lvl.toUpperCase()} · {item.cat}</Text>
        <Text style={{ fontFamily: "NotoSansJP_700Bold" }} className="text-3xl font-extrabold text-slate-900 mt-2">{item.t}</Text>
        <Text className="text-sm text-slate-500 mt-2">{item.p}</Text>
        <Text className="text-base text-slate-700 mt-4 leading-relaxed">{item.ex}</Text>

        {item.eg.map((eg, i) => (
          <View key={i} className="mt-5 bg-slate-50 rounded-2xl p-4">
            <Text style={{ fontFamily: "NotoSansJP_500Medium" }} className="text-base text-slate-900 leading-relaxed">{clean(eg.j)}</Text>
            <Text className="text-sm text-slate-500 mt-2">{eg.z}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/\(tabs\)/grammar.tsx app/grammar
git commit -m "feat(grammar): browse tab + detail route with shadow-launch"
```

---

### Task 9: Verify

- [ ] **Step 1: Run tests + tsc**

```bash
pnpm test
npx tsc --noEmit
```

- [ ] **Step 2: Confirm grep result**

```bash
grep -rn "useLaunchIntent" app src
```

Should match: `app/(tabs)/today.tsx`, `app/(tabs)/shadowing.tsx`, `app/flashcard-session.tsx`, `app/(tabs)/grammar.tsx`. **NOT** `app/(tabs)/flashcard.tsx` (it's now just a list, doesn't consume intent — the modal does).

- [ ] **Step 3: Manual smoke checklist (user-side)**

1. 單字 tab → list of all N5 vocab (or goal level)
2. Tap a word → push to detail page
3. ★ on row → toggles star
4. 速習 button → opens Flashcard modal
5. Modal close button → returns to list
6. 今日 → 複習今日單字 → opens modal correctly (intent flow)
7. 文法 tab → list of all grammar points at level
8. Tap row → detail with all examples
9. 跟讀按鈕 → switches to 跟讀 tab + starts shadowing those examples

## Done Criteria

- All 8 implementation tasks committed
- `pnpm test` passes (89 baseline + new SRS dot tests)
- `npx tsc --noEmit` 0 errors
- Manual smoke completes

## Out of Scope (P6.1+)

- Search bar in lists
- Filter by SRS state (新詞/待複習/已熟) on the list itself
- Sort options (alphabetical, recently added)
- Grammar SRS state indicator (needs grammar_srs sync)
- Pagination (FlatList virtualization is enough up to ~5000 items)

## Open Questions

(none — every type, store, and helper referenced exists)
