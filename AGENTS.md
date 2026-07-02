# AGENTS.md — QuikQuiz

## Do not start the server
Never use `Start-Process` to launch the server. It creates orphaned background processes.
Instead: validate syntax with `node -c` and tell the user to run `npm start`.
