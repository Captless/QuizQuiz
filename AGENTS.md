# AGENTS.md — QuikQuiz

## Monorepo (non-workspace)
- `/client` — standalone Vite + React app (has its own `node_modules`)
- `/server` — Express server (deps at root `package.json`)
- Root `npm run build` runs `cd client && npm install && npm run build`
- Root `npm start` runs `node server/index.js`
- Root `npm run dev` runs both server and client via `concurrently`

## Do not start the server
Never use `Start-Process` to launch the server. It creates orphaned background processes.
Instead: validate syntax with `node -c` and tell the user to run `npm start`.
