# QuikQuiz MCP — Management Control Panel

The **MCP** (Management Control Panel) is a CLI tool that lets you manage **Supabase** and **Render** from the command line — migrations, environment variables, deployments, secrets, scaling, and more.

## Quick Start

```bash
# Run any MCP command via npm
npm run mcp -- <command>

# Or use the shorter alias
npm run mcp -- deploy --yes
```

> **Prerequisites**: Node.js ≥ 18, `.env` file with the required variables (see below).

## Required Environment Variables

Add these to your `.env` file (or export them):

| Variable | Description | Where to find it |
|----------|-------------|-----------------|
| `SUPABASE_URL` | Your Supabase project URL | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (admin) | Supabase Dashboard → Settings → API |
| `RENDER_API_TOKEN` | Render API token | Render Dashboard → Account Settings → API Keys |
| `RENDER_SERVICE_ID` | Render service ID | Render Dashboard → open your service → URL contains `srv-...` |

## Global Flags

| Flag | Description |
|------|-------------|
| `--dry-run` | Print all actions that would be taken without executing them |
| `-y, --yes` | Skip all confirmation prompts (useful in CI) |
| `--json` | Output logs in JSON format (useful for programmatic consumption) |

## Commands Overview

### Supabase

| Command | Description |
|---------|-------------|
| `mcp supabase migrate [--no-reset]` | Run database migrations (reset + push by default) |
| `mcp supabase seed` | Seed the database with initial data |
| `mcp supabase func <path>` | Deploy an Edge Function from a file |
| `mcp supabase secret:set <key> <value>` | Set a secret in the secrets table |
| `mcp supabase secret:delete <key>` | Delete a secret |

### Render

| Command | Description |
|---------|-------------|
| `mcp render env:set <name> <value>` | Set an environment variable on the service |
| `mcp render env:unset <name>` | Remove an environment variable |
| `mcp render env:batch <file>` | Batch set env vars from a JSON or `.env` file |
| `mcp render deploy [-w, --wait]` | Trigger a new deployment (optionally wait for completion) |
| `mcp render service:get` | Display service details (plan, URL, region, etc.) |
| `mcp render service:scale` | Interactively select and apply a new plan |
| `mcp render domain:set <hostname>` | Add a custom domain |

### Composite Workflows

| Command | Description |
|---------|-------------|
| `mcp deploy [-t, --target] [--seed] [-w, --wait]` | Full deployment: migrate DB, optionally seed, deploy to Render |
| `mcp reset-dev` | **⚠️ Destructive** — reset the development database (erases all data) and re-seed |
| `mcp env-sync [file]` | Sync local `.env` or JSON file env vars to Render (default: `.env`) |

## Examples

```bash
# Run database migrations (reset + push)
npm run mcp -- supabase migrate

# Push migrations only (skip reset)
npm run mcp -- supabase migrate --no-reset

# Deploy to production
npm run mcp -- deploy --yes

# Deploy with seed + wait for Render
npm run mcp -- deploy --seed --wait

# Set an environment variable on Render
npm run mcp -- render env:set NODE_ENV production

# Batch sync .env to Render
npm run mcp -- env-sync

# Check what would happen (dry-run)
npm run mcp -- deploy --dry-run

# Reset dev database (with confirmation)
npm run mcp -- reset-dev
```

## CI/CD Integration

Add a step to your GitHub Actions workflow:

```yaml
- name: MCP — Deploy to Production
  if: github.ref == 'refs/heads/main'
  run: npm run mcp:deploy
  env:
    SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
    RENDER_API_TOKEN: ${{ secrets.RENDER_API_TOKEN }}
    RENDER_SERVICE_ID: ${{ secrets.RENDER_SERVICE_ID }}
```

> **Tip**: The `mcp:deploy` script runs `mcp deploy --yes` (non‑interactive). For a dry‑run in CI, use `mcp:dry`.

## Safety

- All destructive operations prompt for confirmation unless `--yes` is passed.
- `--dry-run` prints every action that would be taken (including API payloads) without executing.
- Secrets and sensitive values are masked in the log output.

## Available npm Scripts

| Script | Command |
|--------|---------|
| `npm run mcp -- ...` | Run any MCP command |
| `npm run mcp:deploy` | `mcp deploy --yes` (CI‑ready) |
| `npm run mcp:dry` | `mcp deploy --dry-run` |
| `npm run mcp:reset` | `mcp reset-dev --yes` |
| `npm run mcp:env-sync` | `mcp env-sync` |
