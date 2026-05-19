# StayJP P1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a runnable Expo (TypeScript) app named StayJP with Firebase Auth (Email + Google + Apple), Firestore sync, MMKV local mirror, NativeWind styling, expo-router 4-tab navigation, and a smoke test that proves write/read round-trips locally and to the cloud.

**Architecture:** Single Expo app. `app/` holds expo-router file routes. `src/` holds non-route code: `lib/` (firebase, storage, sync), `stores/` (Zustand), `components/`, `types/`. Sync is optimistic: writes go to MMKV first, then a debounced background job pushes to Firestore. Reads hydrate from MMKV on cold start, then merge Firestore diffs by `updatedAt`.

**Tech Stack:** Expo SDK 52, React Native 0.76, TypeScript, expo-router v4, NativeWind v4, Firebase JS SDK v10, react-native-mmkv, Zustand, expo-apple-authentication, @react-native-google-signin/google-signin.

**Reference spec:** `stay-jp-notes/docs/superpowers/specs/2026-05-19-stayjp-app-design.md`

---

## File Structure

```
stayjp-app/
├── app/                          # expo-router routes
│   ├── _layout.tsx               # root layout, auth gate
│   ├── (auth)/
│   │   ├── _layout.tsx           # stack for unauthed
│   │   └── login.tsx             # email/google/apple buttons
│   └── (tabs)/
│       ├── _layout.tsx           # tab bar
│       ├── shadowing.tsx         # placeholder
│       ├── flashcard.tsx         # placeholder
│       ├── quiz.tsx              # placeholder
│       └── profile.tsx           # placeholder + smoke-test UI
├── src/
│   ├── lib/
│   │   ├── firebase.ts           # initializeApp + auth + firestore
│   │   ├── storage.ts            # MMKV singleton + typed helpers
│   │   ├── sync.ts               # optimistic write + debounced push + diff merge
│   │   └── auth.ts               # signInWithEmail / Google / Apple
│   ├── stores/
│   │   └── userStore.ts          # Zustand: currentUser, profile
│   ├── components/
│   │   └── Button.tsx            # NativeWind button
│   └── types/
│       └── models.ts             # UserProfile, SmokeDoc, ...
├── __tests__/
│   ├── storage.test.ts
│   ├── sync.test.ts
│   └── auth.test.ts
├── app.json
├── babel.config.js
├── metro.config.js
├── tailwind.config.js
├── tsconfig.json
├── package.json
└── .env.local                    # firebase keys (gitignored)
```

---

### Task 1: Init Expo project + git

**Files:**
- Create: `stayjp-app/` (entire project)

- [ ] **Step 1: Scaffold Expo TS app**

```bash
cd ~/Documents/GitHub
npx create-expo-app@latest stayjp-app --template blank-typescript
cd stayjp-app
```

- [ ] **Step 2: Verify it runs**

```bash
npx expo start --no-dev --tunnel-off
```
Expected: Metro bundler starts, QR code shown. Ctrl+C to stop.

- [ ] **Step 3: Init git + first commit**

```bash
git init
git add -A
git commit -m "chore: initial Expo TS scaffold"
```

---

### Task 2: Install dependencies

**Files:**
- Modify: `stayjp-app/package.json`

- [ ] **Step 1: Install runtime deps**

```bash
cd ~/Documents/GitHub/stayjp-app
npx expo install expo-router expo-linking expo-constants expo-status-bar \
  expo-apple-authentication expo-secure-store
pnpm add firebase zustand react-native-mmkv \
  @react-native-google-signin/google-signin nativewind
pnpm add -D tailwindcss@3.4.0 jest jest-expo @types/jest @testing-library/react-native
```

- [ ] **Step 2: Verify install**

```bash
pnpm list firebase react-native-mmkv zustand expo-router
```
Expected: all four show installed versions.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add core deps (firebase, mmkv, zustand, expo-router, nativewind)"
```

---

### Task 3: Configure NativeWind + Tailwind

**Files:**
- Create: `stayjp-app/tailwind.config.js`
- Create: `stayjp-app/babel.config.js`
- Create: `stayjp-app/metro.config.js`
- Create: `stayjp-app/global.css`
- Modify: `stayjp-app/app.json`

- [ ] **Step 1: Create tailwind.config.js**

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: { extend: {} },
  plugins: [],
};
```

- [ ] **Step 2: Create babel.config.js**

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }], "nativewind/babel"],
  };
};
```

- [ ] **Step 3: Create metro.config.js**

```js
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const config = getDefaultConfig(__dirname);
module.exports = withNativeWind(config, { input: "./global.css" });
```

- [ ] **Step 4: Create global.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 5: Commit**

```bash
git add tailwind.config.js babel.config.js metro.config.js global.css
git commit -m "chore: configure NativeWind"
```

---

### Task 4: Configure expo-router

**Files:**
- Modify: `stayjp-app/package.json` (main entry)
- Modify: `stayjp-app/app.json`
- Delete: `stayjp-app/App.tsx`
- Create: `stayjp-app/app/_layout.tsx`
- Create: `stayjp-app/app/index.tsx`

- [ ] **Step 1: Set main entry in package.json**

In `package.json`, change `"main"` to:
```json
"main": "expo-router/entry"
```

- [ ] **Step 2: Add router scheme + plugin to app.json**

In `app.json` under `"expo"`, add:
```json
"scheme": "stayjp",
"plugins": ["expo-router"]
```

- [ ] **Step 3: Delete App.tsx**

```bash
rm App.tsx
```

- [ ] **Step 4: Create app/_layout.tsx**

```tsx
import "../global.css";
import { Stack } from "expo-router";

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 5: Create app/index.tsx (placeholder)**

```tsx
import { Text, View } from "react-native";
export default function Index() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-2xl font-bold">StayJP</Text>
    </View>
  );
}
```

- [ ] **Step 6: Run and verify**

```bash
npx expo start -c
```
Expected: App boots, shows "StayJP" centered. Ctrl+C.

- [ ] **Step 7: Commit**

```bash
git add app/ app.json package.json
git commit -m "feat: switch to expo-router with NativeWind"
```

---

### Task 5: Configure Jest

**Files:**
- Modify: `stayjp-app/package.json`
- Create: `stayjp-app/jest.setup.js`

- [ ] **Step 1: Add jest config to package.json**

Append to `package.json` (top level):
```json
"jest": {
  "preset": "jest-expo",
  "setupFilesAfterEach": ["./jest.setup.js"],
  "transformIgnorePatterns": [
    "node_modules/(?!((jest-)?react-native|@react-native|expo(nent)?|@expo(nent)?/.*|react-clone-referenced-element|@react-navigation|nativewind|firebase|@firebase|react-native-mmkv))"
  ]
}
```
And add to `"scripts"`:
```json
"test": "jest --watchAll=false"
```

- [ ] **Step 2: Create jest.setup.js**

```js
jest.mock("react-native-mmkv", () => {
  const store = new Map();
  return {
    MMKV: jest.fn().mockImplementation(() => ({
      set: (k, v) => store.set(k, v),
      getString: (k) => store.get(k),
      delete: (k) => store.delete(k),
      clearAll: () => store.clear(),
      contains: (k) => store.has(k),
      getAllKeys: () => Array.from(store.keys()),
    })),
  };
});
```

- [ ] **Step 3: Verify**

```bash
pnpm test
```
Expected: "No tests found" (passes with 0 tests).

- [ ] **Step 4: Commit**

```bash
git add package.json jest.setup.js
git commit -m "chore: configure jest with MMKV mock"
```

---

### Task 6: Implement MMKV storage helper (TDD)

**Files:**
- Create: `stayjp-app/__tests__/storage.test.ts`
- Create: `stayjp-app/src/lib/storage.ts`

- [ ] **Step 1: Write failing tests**

```ts
// __tests__/storage.test.ts
import { storage, getJSON, setJSON } from "../src/lib/storage";

beforeEach(() => storage.clearAll());

test("setJSON / getJSON round-trip", () => {
  setJSON("k1", { a: 1, b: "x" });
  expect(getJSON<{ a: number; b: string }>("k1")).toEqual({ a: 1, b: "x" });
});

test("getJSON returns undefined for missing key", () => {
  expect(getJSON("nope")).toBeUndefined();
});

test("getJSON returns undefined on corrupt JSON", () => {
  storage.set("bad", "{not json");
  expect(getJSON("bad")).toBeUndefined();
});
```

- [ ] **Step 2: Run, expect FAIL**

```bash
pnpm test storage
```
Expected: Cannot find module `../src/lib/storage`.

- [ ] **Step 3: Implement storage.ts**

```ts
// src/lib/storage.ts
import { MMKV } from "react-native-mmkv";

export const storage = new MMKV({ id: "stayjp-default" });

export function setJSON(key: string, value: unknown): void {
  storage.set(key, JSON.stringify(value));
}

export function getJSON<T>(key: string): T | undefined {
  const raw = storage.getString(key);
  if (raw === undefined) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}
```

- [ ] **Step 4: Run, expect PASS**

```bash
pnpm test storage
```
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add __tests__/storage.test.ts src/lib/storage.ts
git commit -m "feat(storage): MMKV JSON helpers with TDD"
```

---

### Task 7: Firebase config + initialization

**Files:**
- Create: `stayjp-app/.env.local` (gitignored)
- Create: `stayjp-app/.env.example`
- Create: `stayjp-app/src/lib/firebase.ts`
- Modify: `stayjp-app/.gitignore`
- Modify: `stayjp-app/app.json`

- [ ] **Step 1: Gather Firebase config**

From Firebase console for the shared hayashi.log project, add a new iOS + Android app (bundle id `com.stayjp.app`). Copy the web config (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId).

- [ ] **Step 2: Create .env.local**

```
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
```

- [ ] **Step 3: Create .env.example (no values)**

```
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
```

- [ ] **Step 4: Add to .gitignore**

Append to `.gitignore`:
```
.env.local
```

- [ ] **Step 5: Create src/lib/firebase.ts**

```ts
import { initializeApp, getApps } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID!,
};

export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
export const db = getFirestore(app);
```

- [ ] **Step 6: Install AsyncStorage**

```bash
npx expo install @react-native-async-storage/async-storage
```

- [ ] **Step 7: Smoke verify**

In `app/index.tsx`, temporarily add:
```tsx
import { auth } from "../src/lib/firebase";
console.log("auth project:", auth.app.options.projectId);
```
Run `npx expo start -c`, open Expo Go, watch logs for project id. Then revert the import.

- [ ] **Step 8: Commit**

```bash
git add src/lib/firebase.ts .env.example .gitignore package.json
git commit -m "feat(firebase): init Auth + Firestore singletons"
```

---

### Task 8: Implement sync layer (TDD)

**Files:**
- Create: `stayjp-app/__tests__/sync.test.ts`
- Create: `stayjp-app/src/lib/sync.ts`
- Create: `stayjp-app/src/types/models.ts`

- [ ] **Step 1: Create types/models.ts**

```ts
// src/types/models.ts
export interface SmokeDoc {
  message: string;
  updatedAt: number;
}

export interface SyncedDoc<T> {
  data: T;
  updatedAt: number;
}
```

- [ ] **Step 2: Write failing tests**

```ts
// __tests__/sync.test.ts
import { storage } from "../src/lib/storage";
import { writeLocal, readLocal, mergeRemote } from "../src/lib/sync";

beforeEach(() => storage.clearAll());

test("writeLocal then readLocal returns same doc with updatedAt", () => {
  writeLocal("smoke/hello", { message: "hi" });
  const got = readLocal<{ message: string }>("smoke/hello");
  expect(got?.data.message).toBe("hi");
  expect(typeof got?.updatedAt).toBe("number");
});

test("mergeRemote keeps newer local on conflict", () => {
  writeLocal("k", { v: "local" });
  const local = readLocal<{ v: string }>("k")!;
  mergeRemote("k", { data: { v: "remote" }, updatedAt: local.updatedAt - 1000 });
  expect(readLocal<{ v: string }>("k")?.data.v).toBe("local");
});

test("mergeRemote overwrites with newer remote", () => {
  writeLocal("k", { v: "local" });
  const local = readLocal<{ v: string }>("k")!;
  mergeRemote("k", { data: { v: "remote" }, updatedAt: local.updatedAt + 1000 });
  expect(readLocal<{ v: string }>("k")?.data.v).toBe("remote");
});
```

- [ ] **Step 3: Run, expect FAIL**

```bash
pnpm test sync
```
Expected: module not found.

- [ ] **Step 4: Implement sync.ts**

```ts
// src/lib/sync.ts
import { getJSON, setJSON } from "./storage";
import type { SyncedDoc } from "../types/models";

export function writeLocal<T>(key: string, data: T): void {
  setJSON<SyncedDoc<T>>(key, { data, updatedAt: Date.now() });
}

export function readLocal<T>(key: string): SyncedDoc<T> | undefined {
  return getJSON<SyncedDoc<T>>(key);
}

export function mergeRemote<T>(key: string, remote: SyncedDoc<T>): void {
  const local = readLocal<T>(key);
  if (!local || remote.updatedAt > local.updatedAt) {
    setJSON<SyncedDoc<T>>(key, remote);
  }
}
```

Note: `setJSON` is currently untyped. Update `src/lib/storage.ts`:
```ts
export function setJSON<T = unknown>(key: string, value: T): void {
  storage.set(key, JSON.stringify(value));
}
```

- [ ] **Step 5: Run, expect PASS**

```bash
pnpm test sync
```
Expected: 3 passed.

- [ ] **Step 6: Commit**

```bash
git add src/types/ src/lib/sync.ts src/lib/storage.ts __tests__/sync.test.ts
git commit -m "feat(sync): optimistic local write + last-write-wins merge"
```

---

### Task 9: Firestore push (debounced)

**Files:**
- Modify: `stayjp-app/src/lib/sync.ts`

- [ ] **Step 1: Extend sync.ts with pushRemote**

Append to `src/lib/sync.ts`:
```ts
import { doc, setDoc } from "firebase/firestore";
import { db, auth } from "./firebase";

const pending = new Map<string, NodeJS.Timeout>();
const DEBOUNCE_MS = 5000;

export function schedulePush(key: string): void {
  const existing = pending.get(key);
  if (existing) clearTimeout(existing);
  const t = setTimeout(() => flushOne(key), DEBOUNCE_MS);
  pending.set(key, t);
}

async function flushOne(key: string): Promise<void> {
  pending.delete(key);
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const local = readLocal(key);
  if (!local) return;
  await setDoc(doc(db, `users/${uid}/${key}`), local, { merge: true });
}

export async function flushAll(): Promise<void> {
  await Promise.all(Array.from(pending.keys()).map(flushOne));
}
```

Also update `writeLocal` to call `schedulePush`:
```ts
export function writeLocal<T>(key: string, data: T): void {
  setJSON<SyncedDoc<T>>(key, { data, updatedAt: Date.now() });
  schedulePush(key);
}
```

- [ ] **Step 2: Re-run sync tests**

```bash
pnpm test sync
```
Expected: still 3 passed (push is a no-op without auth user in tests).

- [ ] **Step 3: Commit**

```bash
git add src/lib/sync.ts
git commit -m "feat(sync): debounced Firestore push"
```

---

### Task 10: Zustand user store

**Files:**
- Create: `stayjp-app/src/stores/userStore.ts`

- [ ] **Step 1: Implement userStore**

```ts
// src/stores/userStore.ts
import { create } from "zustand";
import type { User } from "firebase/auth";

interface UserState {
  user: User | null;
  ready: boolean;
  setUser: (u: User | null) => void;
  setReady: (b: boolean) => void;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  ready: false,
  setUser: (user) => set({ user }),
  setReady: (ready) => set({ ready }),
}));
```

- [ ] **Step 2: Commit**

```bash
git add src/stores/userStore.ts
git commit -m "feat(stores): minimal user store with Zustand"
```

---

### Task 11: Auth hookup — Email sign-in (TDD-light)

**Files:**
- Create: `stayjp-app/src/lib/auth.ts`
- Create: `stayjp-app/__tests__/auth.test.ts`

- [ ] **Step 1: Write smoke test (mocking firebase/auth)**

```ts
// __tests__/auth.test.ts
jest.mock("../src/lib/firebase", () => ({ auth: {}, db: {} }));
jest.mock("firebase/auth", () => ({
  signInWithEmailAndPassword: jest.fn().mockResolvedValue({ user: { uid: "u1" } }),
  createUserWithEmailAndPassword: jest.fn().mockResolvedValue({ user: { uid: "u2" } }),
  signOut: jest.fn().mockResolvedValue(undefined),
  onAuthStateChanged: jest.fn(),
}));

import { signInEmail, signUpEmail, signOutCurrent } from "../src/lib/auth";

test("signInEmail resolves with user", async () => {
  const u = await signInEmail("a@b.com", "pw");
  expect(u.uid).toBe("u1");
});

test("signUpEmail resolves with user", async () => {
  const u = await signUpEmail("a@b.com", "pw");
  expect(u.uid).toBe("u2");
});

test("signOutCurrent resolves", async () => {
  await expect(signOutCurrent()).resolves.toBeUndefined();
});
```

- [ ] **Step 2: Run, expect FAIL**

```bash
pnpm test auth
```

- [ ] **Step 3: Implement auth.ts (email only for now)**

```ts
// src/lib/auth.ts
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { auth } from "./firebase";

export async function signInEmail(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function signUpEmail(email: string, password: string): Promise<User> {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function signOutCurrent(): Promise<void> {
  await signOut(auth);
}

export function subscribeAuth(cb: (u: User | null) => void): () => void {
  return onAuthStateChanged(auth, cb);
}
```

- [ ] **Step 4: Run, expect PASS**

```bash
pnpm test auth
```
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts __tests__/auth.test.ts
git commit -m "feat(auth): email sign-in/up/out with tests"
```

---

### Task 12: Auth hookup — Apple Sign In

**Files:**
- Modify: `stayjp-app/src/lib/auth.ts`
- Modify: `stayjp-app/app.json`

- [ ] **Step 1: Add Apple plugin to app.json**

In `app.json` `"plugins"` array, add:
```json
"expo-apple-authentication"
```
And ensure `"ios"` has:
```json
"ios": { "bundleIdentifier": "com.stayjp.app", "usesAppleSignIn": true }
```

- [ ] **Step 2: Append Apple sign-in to auth.ts**

```ts
import * as AppleAuthentication from "expo-apple-authentication";
import { OAuthProvider, signInWithCredential } from "firebase/auth";

export async function signInApple(): Promise<User> {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });
  if (!credential.identityToken) throw new Error("Apple: no identity token");
  const provider = new OAuthProvider("apple.com");
  const oauthCred = provider.credential({ idToken: credential.identityToken });
  const result = await signInWithCredential(auth, oauthCred);
  return result.user;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth.ts app.json
git commit -m "feat(auth): Apple Sign In via expo-apple-authentication"
```

---

### Task 13: Auth hookup — Google Sign In

**Files:**
- Modify: `stayjp-app/src/lib/auth.ts`
- Modify: `stayjp-app/app.json`

- [ ] **Step 1: Configure Google plugin in app.json**

In `"plugins"`:
```json
[
  "@react-native-google-signin/google-signin",
  { "iosUrlScheme": "com.googleusercontent.apps.YOUR_REVERSED_CLIENT_ID" }
]
```
Replace `YOUR_REVERSED_CLIENT_ID` with the value from GoogleService-Info.plist (download from Firebase console → iOS app → GoogleService-Info.plist).

- [ ] **Step 2: Append Google sign-in to auth.ts**

```ts
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { GoogleAuthProvider } from "firebase/auth";

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
});

export async function signInGoogle(): Promise<User> {
  await GoogleSignin.hasPlayServices();
  const info = await GoogleSignin.signIn();
  const idToken = info.data?.idToken;
  if (!idToken) throw new Error("Google: no idToken");
  const cred = GoogleAuthProvider.credential(idToken);
  const result = await signInWithCredential(auth, cred);
  return result.user;
}
```

- [ ] **Step 3: Add web client id to .env.example + .env.local**

Append to both:
```
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
```
Fill `.env.local` with the Web client ID from Firebase Auth → Sign-in method → Google.

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth.ts app.json .env.example
git commit -m "feat(auth): Google Sign In via @react-native-google-signin"
```

---

### Task 14: Login screen

**Files:**
- Create: `stayjp-app/app/(auth)/_layout.tsx`
- Create: `stayjp-app/app/(auth)/login.tsx`
- Create: `stayjp-app/src/components/Button.tsx`

- [ ] **Step 1: Create Button component**

```tsx
// src/components/Button.tsx
import { Pressable, Text } from "react-native";

interface Props {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
}

export function Button({ label, onPress, variant = "primary" }: Props) {
  const cls =
    variant === "primary"
      ? "bg-black active:bg-gray-800"
      : "bg-white border border-gray-300 active:bg-gray-50";
  const textCls = variant === "primary" ? "text-white" : "text-black";
  return (
    <Pressable onPress={onPress} className={`${cls} rounded-2xl py-4 px-6 my-2`}>
      <Text className={`${textCls} text-center font-semibold text-base`}>{label}</Text>
    </Pressable>
  );
}
```

- [ ] **Step 2: Create (auth)/_layout.tsx**

```tsx
import { Stack } from "expo-router";
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 3: Create (auth)/login.tsx**

```tsx
import { useState } from "react";
import { View, Text, TextInput, Alert } from "react-native";
import { Button } from "../../src/components/Button";
import { signInEmail, signUpEmail, signInApple, signInGoogle } from "../../src/lib/auth";

export default function Login() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");

  async function run(fn: () => Promise<unknown>) {
    try { await fn(); } catch (e: any) { Alert.alert("Auth", e.message); }
  }

  return (
    <View className="flex-1 bg-white px-6 justify-center">
      <Text className="text-3xl font-bold mb-8 text-center">StayJP</Text>
      <TextInput
        className="border border-gray-300 rounded-2xl px-4 py-3 mb-3"
        placeholder="Email" value={email} onChangeText={setEmail}
        autoCapitalize="none" keyboardType="email-address"
      />
      <TextInput
        className="border border-gray-300 rounded-2xl px-4 py-3 mb-3"
        placeholder="Password" value={pw} onChangeText={setPw} secureTextEntry
      />
      <Button label="Sign in" onPress={() => run(() => signInEmail(email, pw))} />
      <Button label="Sign up" variant="secondary" onPress={() => run(() => signUpEmail(email, pw))} />
      <View className="h-4" />
      <Button label="Continue with Apple" variant="secondary" onPress={() => run(signInApple)} />
      <Button label="Continue with Google" variant="secondary" onPress={() => run(signInGoogle)} />
    </View>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add app/\(auth\)/ src/components/Button.tsx
git commit -m "feat(auth): login screen with email + Apple + Google"
```

---

### Task 15: Auth gate in root layout

**Files:**
- Modify: `stayjp-app/app/_layout.tsx`
- Delete: `stayjp-app/app/index.tsx`

- [ ] **Step 1: Replace _layout.tsx with auth gate**

```tsx
// app/_layout.tsx
import "../global.css";
import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { useUserStore } from "../src/stores/userStore";
import { subscribeAuth } from "../src/lib/auth";

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { user, ready, setUser, setReady } = useUserStore();

  useEffect(() => {
    const unsub = subscribeAuth((u) => {
      setUser(u);
      setReady(true);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!ready) return;
    const inAuth = segments[0] === "(auth)";
    if (!user && !inAuth) router.replace("/(auth)/login");
    else if (user && inAuth) router.replace("/(tabs)/flashcard");
  }, [user, ready, segments]);

  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 2: Delete app/index.tsx**

```bash
rm app/index.tsx
```

- [ ] **Step 3: Commit**

```bash
git add app/_layout.tsx
git rm app/index.tsx
git commit -m "feat(auth): root auth gate routing to login or tabs"
```

---

### Task 16: Tab navigation + placeholder screens

**Files:**
- Create: `stayjp-app/app/(tabs)/_layout.tsx`
- Create: `stayjp-app/app/(tabs)/shadowing.tsx`
- Create: `stayjp-app/app/(tabs)/flashcard.tsx`
- Create: `stayjp-app/app/(tabs)/quiz.tsx`
- Create: `stayjp-app/app/(tabs)/profile.tsx`

- [ ] **Step 1: Create tab layout**

```tsx
// app/(tabs)/_layout.tsx
import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="shadowing" options={{ title: "跟讀" }} />
      <Tabs.Screen name="flashcard" options={{ title: "單字" }} />
      <Tabs.Screen name="quiz" options={{ title: "測驗" }} />
      <Tabs.Screen name="profile" options={{ title: "我的" }} />
    </Tabs>
  );
}
```

- [ ] **Step 2: Create three placeholder tabs**

Each of `shadowing.tsx`, `flashcard.tsx`, `quiz.tsx` (substitute name):
```tsx
import { Text, View } from "react-native";
export default function Screen() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-xl">Shadowing (coming in P4)</Text>
    </View>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/\(tabs\)/_layout.tsx app/\(tabs\)/shadowing.tsx app/\(tabs\)/flashcard.tsx app/\(tabs\)/quiz.tsx
git commit -m "feat(nav): 4-tab layout with placeholder screens"
```

---

### Task 17: Profile screen with smoke-test sync UI

**Files:**
- Create: `stayjp-app/app/(tabs)/profile.tsx`

- [ ] **Step 1: Create profile.tsx with sync round-trip UI**

```tsx
import { useEffect, useState } from "react";
import { View, Text, TextInput } from "react-native";
import { doc, getDoc } from "firebase/firestore";
import { Button } from "../../src/components/Button";
import { writeLocal, readLocal, flushAll, mergeRemote } from "../../src/lib/sync";
import { signOutCurrent } from "../../src/lib/auth";
import { useUserStore } from "../../src/stores/userStore";
import { db } from "../../src/lib/firebase";
import type { SyncedDoc } from "../../src/types/models";

interface Smoke { message: string }

export default function Profile() {
  const user = useUserStore((s) => s.user);
  const [msg, setMsg] = useState("");
  const [local, setLocalState] = useState<SyncedDoc<Smoke> | undefined>();
  const [remote, setRemote] = useState<SyncedDoc<Smoke> | undefined>();

  useEffect(() => {
    setLocalState(readLocal<Smoke>("smoke/hello"));
  }, []);

  async function save() {
    writeLocal<Smoke>("smoke/hello", { message: msg });
    setLocalState(readLocal<Smoke>("smoke/hello"));
  }

  async function pushNow() {
    await flushAll();
  }

  async function pull() {
    if (!user) return;
    const snap = await getDoc(doc(db, `users/${user.uid}/smoke/hello`));
    if (snap.exists()) {
      const r = snap.data() as SyncedDoc<Smoke>;
      mergeRemote("smoke/hello", r);
      setRemote(r);
      setLocalState(readLocal<Smoke>("smoke/hello"));
    }
  }

  return (
    <View className="flex-1 bg-white px-6 pt-16">
      <Text className="text-xl font-bold mb-4">Profile</Text>
      <Text className="mb-2 text-gray-500">uid: {user?.uid ?? "—"}</Text>

      <Text className="mt-4 mb-1">Smoke message</Text>
      <TextInput
        className="border border-gray-300 rounded-xl px-3 py-2 mb-2"
        value={msg} onChangeText={setMsg} placeholder="type and save"
      />
      <Button label="Save local" onPress={save} />
      <Button label="Push to Firestore" variant="secondary" onPress={pushNow} />
      <Button label="Pull from Firestore" variant="secondary" onPress={pull} />

      <Text className="mt-4 text-xs text-gray-500">
        local: {JSON.stringify(local)}
      </Text>
      <Text className="text-xs text-gray-500">
        last remote: {JSON.stringify(remote)}
      </Text>

      <View className="h-8" />
      <Button label="Sign out" variant="secondary" onPress={signOutCurrent} />
    </View>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(tabs\)/profile.tsx
git commit -m "feat(profile): smoke-test UI for sync round-trip + sign out"
```

---

### Task 18: Firestore security rules (basic, per-user)

**Files:**
- Create: `stayjp-app/firestore.rules`
- Create: `stayjp-app/firebase.json`

- [ ] **Step 1: Write firestore.rules**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

- [ ] **Step 2: Write firebase.json**

```json
{
  "firestore": { "rules": "firestore.rules" }
}
```

- [ ] **Step 3: Deploy rules**

```bash
npx firebase-tools deploy --only firestore:rules --project YOUR_PROJECT_ID
```
Expected: "Deploy complete!"

> Note: if `firebase-tools` not installed globally, prefix with `npx -y firebase-tools@latest`.

- [ ] **Step 4: Commit**

```bash
git add firestore.rules firebase.json
git commit -m "chore(firestore): per-user security rules"
```

---

### Task 19: End-to-end manual smoke test

**Files:** none

- [ ] **Step 1: Run app on iOS simulator**

```bash
cd ~/Documents/GitHub/stayjp-app
npx expo run:ios
```
(First run takes a while; it builds a dev client.)

- [ ] **Step 2: Walk through scenarios**

| # | Action | Expected |
|---|---|---|
| 1 | Open app | Land on Login screen |
| 2 | Sign up with new email/password | Navigate into tabs, Flashcard tab active |
| 3 | Open Profile tab | Shows uid, smoke fields empty |
| 4 | Type "hello" → Save local | local field shows `{data:{message:"hello"},updatedAt:N}` |
| 5 | Push to Firestore | No error |
| 6 | Open Firebase console → Firestore → users/{uid}/smoke/hello | Doc exists with same payload |
| 7 | Sign out → sign back in | Profile still shows local "hello" |
| 8 | Pull from Firestore | remote field populated, local unchanged (same ts) |
| 9 | Edit doc in Firebase console (change message, bump updatedAt) → Pull | local updates to new message |
| 10 | Continue with Apple (on physical device) | Sign in succeeds, uid changes |

- [ ] **Step 3: If all pass, tag the milestone**

```bash
cd ~/Documents/GitHub/stayjp-app
git tag p1-foundation-complete
```

---

### Task 20: README + handoff notes

**Files:**
- Create: `stayjp-app/README.md`

- [ ] **Step 1: Write README**

```markdown
# StayJP

JLPT N5~N1 shadowing + SRS flashcard app. P1 foundation milestone.

## Setup

1. `pnpm install`
2. Copy `.env.example` to `.env.local` and fill in Firebase + Google web client id.
3. `npx expo run:ios` or `npx expo run:android`.

## Scripts

- `pnpm test` — Jest
- `npx expo start -c` — dev server (clear cache)
- `npx firebase-tools deploy --only firestore:rules` — push security rules

## Structure

See `docs/superpowers/specs/2026-05-19-stayjp-app-design.md` (in stay-jp-notes repo)
and `docs/superpowers/plans/2026-05-19-stayjp-p1-foundation.md`.

## Next milestones

- P2: content pipeline (web → JSON bundle)
- P3: Flashcard 26s mode + SRS port
```

- [ ] **Step 2: Commit + push**

```bash
git add README.md
git commit -m "docs: README for P1 milestone"
```

- [ ] **Step 3: Push to GitHub**

(After creating remote `stayjp-app` on GitHub:)
```bash
git remote add origin git@github.com:miafrontend2026/stayjp-app.git
git push -u origin main
git push --tags
```

---

## Done Criteria for P1

- [ ] All 20 tasks committed
- [ ] `pnpm test` passes (storage + sync + auth)
- [ ] Manual smoke test in Task 19 passes 10/10
- [ ] `p1-foundation-complete` tag pushed
- [ ] Repo public/private set, README live

## Out of Scope for P1 (handled in later plans)

- Content JSON (P2)
- Flashcard UI + SRS (P3)
- Shadowing UI (P4)
- Quiz (P5)
- Onboarding + paywall + RevenueCat (P6, P7)
- Offline audio download + push (P8)
- ASO assets + TestFlight + submission (P8)
