# QuikQuiz

AI-powered quiz generation SaaS for teachers and tutors. Generate multi-format quizzes in seconds, share them with students, and track results — all from your browser.

## Architecture

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS 4
- **Backend**: Express.js (Node 20)
- **Database**: Supabase (PostgreSQL) with in-memory fallback
- **Auth**: Supabase Auth (Google OAuth)
- **AI**: OpenRouter API + Groq fallback
- **Payments**: Stripe subscriptions
- **Deployment**: Render / Docker

## Quick Start

### Prerequisites

- Node.js 20+
- npm 10+
- Supabase project (free tier works)
- OpenRouter API key (or Groq API key)
- (Optional) Stripe account for payments

### 1. Clone and install

```bash
git clone <repo-url>
cd quikquiz

# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install

# Return to root
cd ..
```

### 2. Environment variables

```bash
# Root-level .env (used by server)
cp .env.example .env
# Edit .env with your keys

# Client .env
cp client/.env.example client/.env
# Edit with your Supabase public keys
```

**Required variables:**

| Variable | Where | Description |
|----------|-------|-------------|
| `VITE_SUPABASE_URL` | `client/.env` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | `client/.env` | Supabase anon/public key |
| `VITE_SITE_URL` | `client/.env` | App origin for OAuth redirect (e.g. `http://localhost:5173` or `https://my-app.onrender.com`). Falls back to `window.location.origin` |
| `SUPABASE_URL` | Root `.env` | Same as above (server-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | Root `.env` | Supabase service role key (secret) |
| `SUPABASE_ENABLED` | Root `.env` | Must be `true` in production (server aborts if missing). When `false`, usage/profile endpoints return a 503 message. |
| `USE_LOCAL_FALLBACK` | Root `.env` | Dev‑only: set to `true` to store usage data in `data/usage.json` instead of Supabase profiles table. Requires `SUPABASE_ENABLED=true` for auth. |
| `OPENROUTER_KEY` | Root `.env` | OpenRouter API key |
| `GOOGLE_CLIENT_ID` | Root `.env` | Google OAuth client ID |

### 3. Database setup

Run the SQL in `server/supabase-schema.sql` against your Supabase project's SQL editor.

### 4. Start development

```bash
# Terminal 1: Server
cd server && npm start

# Terminal 2: Client
cd client && npm run dev
```

Open `http://localhost:5173` in your browser. The Vite dev server proxies `/api` requests to `http://localhost:3000`.

## Project Structure

```
quikquiz/
├── client/               # React frontend (Vite)
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── hooks/        # Custom React hooks
│   │   ├── pages/        # Route pages
│   │   ├── services/     # API client + Supabase client
│   │   └── types/        # TypeScript type definitions
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
├── server/               # Express.js backend
│   ├── index.js          # Main server entry
│   ├── utils/            # PDF/PPTX extraction, validation
│   ├── supabase-schema.sql
│   ├── Dockerfile
│   └── package.json
├── .env.example
├── .github/workflows/    # CI pipeline
└── README.md
```

## Available Scripts

### Client

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Type-check + build for production |
| `npm run lint` | Run oxlint |
| `npm run test` | Run vitest |
| `npm run preview` | Preview production build |

### Server

| Script | Description |
|--------|-------------|
| `npm start` | Start Express (port 3000) |
| `npm run test` | Run vitest |
| `npm run test:watch` | Run tests in watch mode |

## Production Deployment (Render)

1. Push to GitHub
2. Create a **Web Service** on Render
3. Connect your GitHub repo
4. Set:
   - **Root Directory**: (leave blank — Dockerfile is in `server/`)
   - **Dockerfile**: `server/Dockerfile`
   - **Environment**: Add all variables from `.env.example`
5. Deploy

The Dockerfile builds the client and serves static assets from the Express server, so only one service is needed.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/generate` | — | Generate quiz from topic |
| POST | `/api/generate-from-file` | — | Generate quiz from uploaded file |
| POST | `/api/suggest-topics` | — | AI topic suggestions |
| GET | `/api/config` | — | Public config (Stripe publishable key, etc.) |
| GET | `/api/quiz/:id` | — | Get shared quiz (student view) |
| POST | `/api/quiz/save` | JWT | Save quiz for sharing |
| PUT | `/api/quiz/:id` | JWT | Update shared quiz settings |
| POST | `/api/quiz/:id/submit` | — | Submit student answers |
| GET | `/api/quiz/:id/results` | JWT | Get quiz results (teacher) |
| GET | `/api/usage` | JWT | Get usage count |
| POST | `/api/usage/increment` | JWT | Increment usage count |
| POST | `/api/create-checkout-session` | JWT | Create Stripe checkout |
| GET | `/api/status` | — | Check Stripe payment status |

## Testing

```bash
# Run all tests
cd client && npm test
cd server && npm test

# Watch mode
cd client && npm run test:watch
```

## Demo Quota

Each signed-in user gets **three free quiz generations** (the "demo"). After using them, the quota is permanently tied to their account and cannot be reset by logging out, clearing browser data, or restarting the server.

### How it’s persisted

1. **Primary path** — When Supabase is configured with a `SUPABASE_SERVICE_ROLE_KEY`, the usage count is stored in the `profiles.usage_count` column. This survives server restarts and device changes.
2. **Fallback path** — If Supabase is not configured, the server writes usage data to `data/usage.json`. This file is created automatically on first server start (or by `npm install`). It is not committed to Git (`data/` is in `.gitignore`).

### Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Demo quota resets after page reload | Supabase not configured and `data/usage.json` was deleted or is unwritable. | Run `npm run postinstall` (or `npm install`) to recreate the file. |
| Demo quota resets after deployment | The `data/` directory is inside a temporary filesystem on Render and is lost on each deploy. | Configure Supabase (`SUPABASE_SERVICE_ROLE_KEY`) to use the database instead. |
| Demo button stays disabled after paying | The `paid` flag in the profile (`subscription_status`) hasn’t been updated. | Verify Stripe webhook is calling `/api/stripe-webhook` correctly. |

## Contributing

1. Fork the repo
2. Create a feature branch
3. Run lint and tests before committing
4. Open a pull request

## Management CLI (MCP)

A CLI tool to manage **Supabase** and **Render** — migrations, env vars, deployments, secrets, scaling, and more.

```bash
# Full deployment (migrate DB + deploy to Render)
npm run mcp -- deploy --yes

# Or use a pre-built script
npm run mcp:deploy
```

See [`docs/mcp.md`](docs/mcp.md) for the full command reference and CI setup.

## License

MIT
