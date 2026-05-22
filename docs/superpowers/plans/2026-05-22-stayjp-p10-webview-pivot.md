# StayJP P10 — WebView Pivot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Pivot the App's main body from native screens to a WebView wrapping `https://stayjp.study/`. Keep native shell for: onboarding (level/goal/exam/reminder), local push reminders, theme preference, future IAP. Auth happens entirely inside the webview using web's existing Firebase Auth flow.

**Why:** Web UI/UX has good user feedback. Maintaining two codebases costs weeks of parity work (比較/聽力/讀解/模考 still missing native). WebView eliminates that overhead — improvements to stayjp.study reach App users immediately.

**Apple risk mitigation:** Per Apple 4.2/4.3 review history, pure webview wrappers get rejected. Adding meaningful native value reduces risk:
- ✅ Local onboarding wizard (native)
- ✅ Local push notifications (native)
- ✅ Theme system pref (native)
- ✅ Future IAP via StoreKit (native shell handles)
- Description in App Store metadata emphasizes "study tracking + reminders + offline cache" rather than "web wrapper"

**Reversibility:** Native tabs + screens (`(tabs)/*`, `(auth)/*`, modals) NOT deleted in this phase — they stay in the codebase as a feature-flag fallback. New main flow is `/web` route. If Apple rejects, flip default landing back to `/(tabs)/today` in one line.

---

## File Structure

```
stayjp-app/
├── app/
│   ├── web.tsx                # NEW — full-screen WebView main
│   ├── _layout.tsx            # MODIFY — gate routes to /web after onboarding (not /(tabs)/today)
│   ├── onboarding.tsx         # MODIFY — onDone → /web (was /(tabs)/today)
│   └── settings.tsx           # MODIFY — small "→ 學習" button to push back to /web
├── src/
│   └── lib/
│       └── webBridge.ts       # NEW — postMessage helpers (web → native, native → web)
└── app.json                    # MODIFY — register WKWebView config if needed
```

---

### Task 1: Install react-native-webview

**Files:**
- Modify: `package.json` / `pnpm-lock.yaml`

- [ ] **Step 1: Install**

```bash
cd ~/Documents/GitHub/stayjp-app
npx expo install react-native-webview
```

- [ ] **Step 2: Verify install**

```bash
ls node_modules/react-native-webview
```

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: install react-native-webview"
```

---

### Task 2: web.tsx full-screen WebView screen

**Files:**
- Create: `app/web.tsx`

- [ ] **Step 1: Implement**

```tsx
// app/web.tsx
import { useEffect, useRef } from "react";
import { Platform, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "../src/theme/ThemeContext";
import { getPref, setPref } from "../src/stores/prefsStore";
import { scheduleReminder } from "../src/lib/notifications";

const WEB_URL = "https://stayjp.study/";

/**
 * Native → Web injection: push current theme preference, reminder time, and onboarded prefs
 * as window globals so the web can render in the correct mode immediately. Optional —
 * web has its own user prefs too once signed in; this just makes the first paint match.
 */
function injectedJS(theme: "light" | "dark"): string {
  const onboardingPrefs = {
    base_level: getPref("base_level"),
    goal_level: getPref("goal_level"),
    exam_date: getPref("exam_date"),
    reminder_time: getPref("reminder_time"),
  };
  return `
    window.STAYJP_NATIVE = {
      isNativeApp: true,
      platform: ${JSON.stringify(Platform.OS)},
      theme: ${JSON.stringify(theme)},
      onboardingPrefs: ${JSON.stringify(onboardingPrefs)}
    };
    try {
      // Apply theme attribute immediately so first paint is correct
      document.documentElement.setAttribute('data-theme', ${JSON.stringify(theme)});
    } catch(_) {}
    true;
  `;
}

export default function WebMain() {
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const ref = useRef<WebView>(null);

  function onMessage(e: WebViewMessageEvent) {
    try {
      const msg = JSON.parse(e.nativeEvent.data) as { type?: string; payload?: unknown };
      if (msg.type === "OPEN_SETTINGS") {
        router.push("/settings");
      } else if (msg.type === "SET_REMINDER" && typeof (msg.payload as { time?: unknown })?.time === "string") {
        const time = (msg.payload as { time: string }).time;
        setPref("reminder_time", time);
        void scheduleReminder(time);
      } else if (msg.type === "EDIT_ONBOARDING") {
        router.push("/onboarding");
      }
    } catch { /* ignore malformed */ }
  }

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.bg }}>
      <WebView
        ref={ref}
        source={{ uri: WEB_URL }}
        injectedJavaScriptBeforeContentLoaded={injectedJS(scheme)}
        onMessage={onMessage}
        style={{ flex: 1, backgroundColor: colors.bg }}
        allowsBackForwardNavigationGestures
        startInLoadingState
        scalesPageToFit
        decelerationRate="normal"
        // iOS-specific:
        contentInsetAdjustmentBehavior="never"
      />
    </View>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/web.tsx
git commit -m "feat(web): full-screen WebView wrapping stayjp.study + message bridge"
```

---

### Task 3: Route gate — after onboarding land on /web

**Files:**
- Modify: `app/_layout.tsx`
- Modify: `app/onboarding.tsx`

- [ ] **Step 1: onboarding redirects to /web**

In `app/onboarding.tsx`, change `onDone` callback:

```tsx
return <OnboardingScreen onDone={() => router.replace("/web")} />;
```

- [ ] **Step 2: Update auth gate**

In `app/_layout.tsx`, the route gating logic — replace current conditions with:

```ts
useEffect(() => {
  if (!ready) return;
  const seg0 = segments[0];
  const onboarded = getPref("onboarded");

  // Anyone NOT onboarded → /onboarding
  if (!onboarded && seg0 !== "onboarding") {
    router.replace("/onboarding");
    return;
  }
  // Onboarded but at root or in legacy (auth)/(tabs) → /web
  if (onboarded && (seg0 === undefined || seg0 === "(auth)" || seg0 === "(tabs)")) {
    router.replace("/web");
  }
}, [ready, segments]);
```

This drops the requirement of being signed-in with Firebase Auth. The webview handles auth from there. Anyone who's done onboarding lands on /web; web's own login modal pops if not authed inside.

Note: `subscribeAuth` listener can stay — useful for future bridge — but route gate no longer checks `user`.

- [ ] **Step 3: Declare /web in Stack**

In `app/_layout.tsx`'s `<Stack>` child list, add:

```tsx
<Stack.Screen name="web" />
```

- [ ] **Step 4: Commit**

```bash
git add app/_layout.tsx app/onboarding.tsx
git commit -m "feat(routing): post-onboarding → /web (WebView), drop Firebase auth gate"
```

---

### Task 4: Settings backlink to /web

**Files:**
- Modify: `app/settings.tsx`

- [ ] **Step 1: Back button returns to /web**

Currently settings back button falls back to `/(tabs)/profile`. After P10 the main app is /web, not tabs. Update fallback:

```tsx
onPress={() => {
  if (router.canGoBack()) router.back();
  else router.replace("/web");
}}
```

- [ ] **Step 2: Commit**

```bash
git add app/settings.tsx
git commit -m "feat(settings): back falls through to /web (main app)"
```

---

### Task 5: app.json — WKWebView + iOS NSAppTransportSecurity

**Files:**
- Modify: `app.json`

- [ ] **Step 1: Verify HTTPS-only**

`stayjp.study` is HTTPS, so no NSAppTransportSecurity exception needed. Just ensure `ios.usesAppleSignIn` and other existing settings remain.

- [ ] **Step 2: Add useWebView config (Expo SDK 54 may need plugin)**

Check `app.json` after `npx expo install react-native-webview` — Expo's config plugin auto-registers. Verify by running `npx expo prebuild --check` (don't actually prebuild; just check).

- [ ] **Step 3: Commit (only if changes made)**

```bash
git add app.json
git commit -m "chore(app.json): WebView config alignment"
```

(Skip if no changes.)

---

### Task 6: Verification + smoke

- [ ] **Step 1: Tests + tsc**

```bash
pnpm test
npx tsc --noEmit
```

Expect: ~106 PASS (no test changes; WebView is integration).

- [ ] **Step 2: Manual smoke (user-side)**

1. Sign out from current build (or reset MMKV via fresh install)
2. Open App → lands on /onboarding
3. Tap thru, choose reminder time → 開始
4. Lands on /web — sees stayjp.study fully rendered inside the App frame
5. Web's own login pops if user not authenticated in webview's cookie store
6. After login, web's full bottom nav is visible inside the webview
7. Reminder fires at chosen time
8. Settings can be reached via... TBD. For v1 maybe a small floating button overlay OR navigate via web's UI calling `window.ReactNativeWebView.postMessage('{"type":"OPEN_SETTINGS"}')` — this requires web-side changes (out of P10 scope, document for stay-jp-notes follow-up).

---

## Done Criteria for P10

- All 5 task batches committed (Task 5 optional)
- `pnpm test` passes
- `npx tsc --noEmit` 0 errors
- After onboarding, App opens stayjp.study in a full-screen WebView
- Reminders still fire (native side decoupled)

## Out of Scope (P10.1+)

- **Web-side bridge** — stay-jp-notes needs to add `window.ReactNativeWebView.postMessage` calls for "open settings", "edit onboarding", reminder writes. Document but don't implement in this repo.
- **Auth token bridge** — single-sign-in across native/web requires server-side custom token minting (or duplicate auth flow). v1 accepts that web handles its own auth.
- **Offline behavior** — webview shows the browser's default offline page. Could add a native offline detector + cached HTML, P10.2 work.
- **Deep linking** — when user taps push notification, open into /web with a deep link to specific level/screen. Webview can take `?screen=vocab&level=n5` params; native side appends them on push tap.
- **iOS pull-to-refresh** — disabled by default in WebView; can enable via `pullToRefreshEnabled`. Defer.
- **Native side learning prefs sync** — currently MMKV-only on native after this pivot. Web continues its own Firestore sync. Maybe acceptable; revisit.
- **Removing the unused native screens** — keep `(tabs)/*` and `(auth)/*` in repo as fallback. Can clean up in P10.cleanup once stable.

## Open Questions

(none — all key interaction patterns documented)
