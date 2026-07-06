# Implementation Plan — All 6 Fixes

## Fix 1 — `client/src/hooks/useSavedQuizzes.ts`
- Remove `import { useAuth } from './useAuth'` and `const { user } = useAuth()`
- Remove `if (!user) { setQuizzes([]); return }` guard
- Add `refreshKey` state and `refreshQuizzes()` exported function
- Subscribe to `supabase.auth.onAuthStateChange` to bump `refreshKey` on auth change
- `loadQuizzes` depends on `[loadQuizzes, refreshKey]`

## Fix 2 & 3 — `client/src/pages/GeneratorPage.tsx`
- Destructure `refreshQuizzes` from `useSavedQuizzes()`
- Destructure `refreshUsage` from `useAuth()`
- After `await addQuiz(entry)`:
  - `setQuizzesVisible(true)`
  - `document.querySelector('.quiz-stack-section')?.scrollIntoView({ behavior: 'smooth' })`
  - `await refreshQuizzes()`
- After `await incrementUsage()`:
  - `await refreshUsage()`

## Fix 4 — Remove animations
- `client/src/pages/GeneratorPage.tsx`: Remove `import { useScrollReveal }`, remove `useScrollReveal()`, remove `reveal reveal-card` classes from all elements
- `client/src/hooks/useScrollReveal.ts`: Delete file  
- `client/src/index.css`: Delete lines 1322-1353 (`.reveal`, `.reveal-card` CSS blocks)

## Fix 5 — Usage counter (included in Fix 2/3 above via `refreshUsage`)

## Fix 6 — Commit
`git add -A && git commit -m "fix: quiz reload, auto-scroll, usage sync, remove animation" && git push`
