import { appendFileSync } from 'fs'

// Define build-time macros that bun normally injects during bundling
declare global {
  var MACRO: { VERSION: string }
}
globalThis.MACRO = { VERSION: '0.1.0' }

// Write errors to a file since Ink swallows console output
const log = (msg: string) => {
  appendFileSync('/tmp/forge-startup.log', msg + '\n')
}

process.on('uncaughtException', (err) => {
  log('UNCAUGHT: ' + err.stack)
  process.exit(1)
})
process.on('unhandledRejection', (reason) => {
  log('UNHANDLED REJECTION: ' + String(reason))
  process.exit(1)
})

// Intercept process.exit to log the call stack
const _origExit = process.exit.bind(process)
process.exit = ((code?: number) => {
  log('process.exit(' + code + ') called from:\n' + new Error().stack)
  _origExit(code)
}) as typeof process.exit

log('preload ok, starting main...')
