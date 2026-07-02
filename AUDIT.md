# QuikQuiz — Production Audit

> Last updated: 2026-07-02
>
> Update this file after every major change. Check off items as they're resolved.

---

## 🔴 Critical — Must fix before going public

- [ ] **Auth is entirely client-side**
  - User data saved to `localStorage` from Google JWT, never verified on server
  - `isPaid()` checks `localStorage` — anyone can set `quikquiz_paid=true`
  - Usage counting is client-side — clear localStorage, get infinite free generations
  - **No server-side auth exists.** Every API call is anonymous.

- [ ] **No database — all data is in-memory**
  - `paidSessions`, `sharedQuizzes`, `sharedResults` are plain `Map` objects
  - Server restart wipes everything: payments, shared quizzes, student submissions
  - Teachers' quizzes don't persist across page reloads

- [ ] **Live API keys in `.env` committed to disk**
  - Real Stripe test keys, OpenRouter key, Groq key, Google Client ID are exposed
  - Must not push `.env` to git (ensure `.gitignore` covers it)
  - Use environment variables on the deployment platform instead

---

## 🟠 High — Needs addressing before launch

- [ ] **No rate limiting**
  - Anyone can hit `/api/generate` unlimited times
  - No IP-based or user-based rate limiting anywhere

- [ ] **No HTTPS**
  - Express serves plain HTTP. Needs reverse proxy (Nginx, Caddy) or platform TLS.

- [ ] **No session management**
  - No `express-session` — every request is anonymous
  - No way to associate a user with their quizzes, payments, or submissions

- [ ] **Google OAuth has no server-side verification**
  - JWT parsed on client but never sent to server for verification
  - Server has no way to know who the user is

- [ ] **CORS is wide open**
  - `cors({ origin: true, credentials: true })` allows any domain

- [ ] **File upload security**
  - Only extension check — a renamed `.exe` → `.pdf` passes
  - No cleanup guarantee if server crashes mid-upload

---

## 🟡 Medium — Important for a polished product

- [ ] **No health check endpoint** (`/api/health`)
- [ ] **No error monitoring** (Sentry, etc.)
- [ ] **No structured logging** — only `console.log` / `console.error`
- [ ] **Static serving from project root** — `express.static(path.join(__dirname))` serves everything
- [ ] **SPA fallback too broad** — `app.get('*')` silently sends `index.html` for mistyped API routes
- [ ] **No student authentication** — anyone with a quiz link can submit
- [ ] **Quiz data stored without encryption** — plain JSON in memory

---

## 🟢 Nice-to-have before launch

- [ ] `package.json` scripts for dev vs production (`npm run dev` / `npm start`)
- [ ] Environment validation on startup (fail fast if required keys missing)
- [ ] Database migrations system
- [ ] Terms of Service and Privacy Policy pages
- [ ] `robots.txt` to block crawlers during beta
- [ ] Custom 404 page
- [ ] Proper `npm run build` step

---

## Changelog

| Date | Change |
|------|--------|
| 2026-07-02 | Initial audit created |
| | |

---

## Architecture Decisions

*(Document rationale for significant choices here so we don't second-guess later.)*

| Decision | Rationale |
|----------|-----------|
| (none yet) | |

---

## Known Issues / Tech Debt

*(Minor things to fix but not blocking launch.)*

| Issue | Notes |
|-------|-------|
| (none yet) | |
