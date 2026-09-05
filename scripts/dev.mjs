import { spawn } from 'node:child_process'

const npmExecPath = process.env.npm_execpath
const runCommand = npmExecPath ? process.execPath : process.platform === 'win32' ? 'npm' : 'npm'
const runPrefixArgs = npmExecPath ? [npmExecPath] : []
const useShell = process.platform === 'win32' && !npmExecPath

const services = [
  { name: 'backend', args: ['--prefix', 'backend', 'run', 'dev'] },
  { name: 'frontend', args: ['--prefix', 'frontend', 'run', 'dev'] },
]

const children = services.map((service) => {
  const child = spawn(runCommand, [...runPrefixArgs, ...service.args], {
    stdio: 'inherit',
    shell: useShell,
  })

  child.on('exit', (code, signal) => {
    if (signal) {
      console.log(`[${service.name}] stopped by ${signal}`)
      return
    }
    if (code !== 0) {
      console.error(`[${service.name}] exited with code ${code}`)
      stopAll(code)
    }
  })

  return child
})

let stopping = false

function stopAll(code = 0) {
  if (stopping) return
  stopping = true
  children.forEach((child) => {
    if (!child.killed) child.kill()
  })
  setTimeout(() => process.exit(code), 100)
}

process.on('SIGINT', () => stopAll(0))
process.on('SIGTERM', () => stopAll(0))
