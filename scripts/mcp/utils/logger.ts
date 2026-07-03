export type LogLevel = 'info' | 'warn' | 'error' | 'success'

let jsonMode = false

export function setJsonMode(v: boolean) {
  jsonMode = v
}

const colors: Record<LogLevel, string> = {
  info: '\x1b[36m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  success: '\x1b[32m',
}
const reset = '\x1b[0m'

function timestamp() {
  return new Date().toISOString()
}

export function log(level: LogLevel, msg: string, data?: Record<string, unknown>) {
  if (jsonMode) {
    console.log(JSON.stringify({ level, msg, data, timestamp: timestamp() }))
    return
  }
  const color = colors[level]
  console.error(`${color}[MCP]${reset} ${msg}`)
  if (data) console.error(JSON.stringify(data, null, 2))
}

export const info = (msg: string, data?: Record<string, unknown>) => log('info', msg, data)
export const warn = (msg: string, data?: Record<string, unknown>) => log('warn', msg, data)
export const error = (msg: string, data?: Record<string, unknown>) => log('error', msg, data)
export const success = (msg: string, data?: Record<string, unknown>) => log('success', msg, data)
