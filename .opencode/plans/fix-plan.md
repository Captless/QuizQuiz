# Full Fix Plan — Root Cause Analysis & All Fixes

## Root Cause Analysis

### 1. Past quizzes disappear on reload
**Root cause:** `POST /api/quizzes` fails silently. The `ensureProfile` function has no error checking — if the upsert into `profiles` fails (e.g. FK constraint, network), the function returns void without indication. Then the `INSERT INTO quizzes` also fails (FK violation or other), returning a 500 error. The client's `addQuiz` catches the error, logs it to console, but the quiz never reaches Supabase. On reload, it's gone.

**Secondary bug:** After `addQuiz` (which fails silently), `handleGenerate` calls `refreshQuizzes()` — this re-fetches from the server, which returns the OLD list (without the new quiz), **removing the optimistic entry** from the client. The quiz flashes and disappears.

### 2. Toggle score not working
The toggle calls `updateQuiz(id, updates)` which sends `PUT /api/quiz/${id}`. If the quiz was never saved (issue 1), the `id` is a client-generated temp ID. The server's `getQuiz(req.params.id)` returns null → 404 → error caught and silently logged. The optimistic local update works (score toggles visually) but the server state never changes.

### 3. Results not working
`openResults` checks `if (!entry.shareId) return` — since the quiz was never saved, `shareId` is null, so results silently do nothing.

### 4. Generate button not working
The usage counter stays at 0 (or wrong value) because `incrementUsage` server response may sync to a profile row that doesn't persist correctly. `outOfFreeQuota` is false so the user doesn't see the paywall, but the button may appear disabled or generation may fail.

### 5. Profile row may not exist
The `on_auth_user_created` trigger creates profiles for NEW signups, but existing users may not have a profile. `ensureProfile` tries to create one but has no error handling.

## Implementation Plan

### Fix A — Move `ensureProfile` into `requireUser` middleware
**File:** `server/index.js`

Move the `ensureProfile` call inside `requireUser` so the profile is guaranteed to exist before ANY endpoint processes the request.

Change `requireUser`:
```js
async function requireUser(req, res, next) {
  req.user = await getUserFromToken(req);
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  await ensureProfile(req.user.id, req.user.email, req.user.user_metadata?.full_name, req.user.user_metadata?.avatar_url);
  next();
}
```

This eliminates the need for per-endpoint `ensureProfile` calls.

### Fix B — Add error logging to `ensureProfile`
**File:** `server/index.js`

Add console.error logging for upsert failures:
```js
async function ensureProfile(userId, email, name, avatarUrl) {
  if (!SUPABASE_ENABLED || !supabaseAdmin || useLocalFallback) return;
  const profile = await getProfile(userId, email);
  if (!profile) {
    const { error } = await supabaseAdmin.from('profiles').upsert({
      id: userId, email, name: name || email, avatar_url: avatarUrl
    }, { onConflict: 'id' });
    if (error) console.error('[ensureProfile] upsert error:', error);
  }
}
```

### Fix C — Add error logging to `POST /api/quizzes`
**File:** `server/index.js`

The endpoint already returns 500 on error, so the client gets the error. No change needed here for the error path, but let's add server-side logging:
```js
if (error) {
  console.error('[POST /api/quizzes] insert error:', error);
  return res.status(500).json({ error: error.message });
}
```

### Fix D — Make `addQuiz` return success/failure
**File:** `client/src/hooks/useSavedQuizzes.ts`

Change `addQuiz` to return a `boolean` indicating whether the server save succeeded:
```ts
const addQuiz = useCallback(async (entry: QuizEntry): Promise<boolean> => {
  setQuizzes(prev => [entry, ...prev])
  try {
    const serverId = await saveQuizToServer({...})
    setQuizzes(prev => prev.map(q => q.id === entry.id ? { ...q, id: serverId, shareId: serverId } : q))
    return true
  } catch (err: any) {
    console.error('Failed to persist quiz:', err)
    setQuizzes(prev => prev.filter(q => q.id !== entry.id))
    return false
  }
}, [])
```

### Fix E — Update `handleGenerate` to conditionally scroll/refresh
**File:** `client/src/pages/GeneratorPage.tsx`

Only show success toast and scroll if the quiz was saved:
```ts
const saved = await addQuiz(entry)
if (saved) {
  setQuizzesVisible(true)
  document.querySelector('.quiz-stack-section')?.scrollIntoView({ behavior: 'smooth' })
  await refreshQuizzes()
  addToast(isPaid ? 'Quiz generated successfully!' : 'Free demo quiz generated! Upgrade to unlock unlimited.', 'success')
} else {
  addToast('Quiz was generated but could not be saved. Check console for details.', 'warning')
}
```

### Fix F — Remove stale `ensureProfile` calls from endpoints
**File:** `server/index.js`

Remove the individual `ensureProfile` calls from `POST /api/generate`, `POST /api/generate-from-file`, and `POST /api/quizzes` since they now run in `requireUser`.

### Fix G — Remove unused `useSavedQuizzes.authHeaders`
**File:** `client/src/hooks/useSavedQuizzes.ts`

The local `authHeaders` function is only used by `updateQuiz`. Since `api.ts` already exports the same functionality, optionally simplify.

### Summary of changes

| File | Changes |
|------|---------|
| `server/index.js` | Move `ensureProfile` into `requireUser`, add error logging to `ensureProfile` and quiz insert, remove stale `ensureProfile` calls from endpoints |
| `client/src/hooks/useSavedQuizzes.ts` | Make `addQuiz` return `boolean`, remove optimistic entry on failure |
| `client/src/pages/GeneratorPage.tsx` | Check `addQuiz` return value, only scroll/refresh/toast on success |
