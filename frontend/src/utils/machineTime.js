export function machineMinutes(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : fallback
}

export function getWorkingTimeMinutes(machine = {}) {
  return machineMinutes(
    machine.workingTimeMinutes,
    machineMinutes(machine.runTime, 0)
  )
}

export function getStopTimeMinutes(machine = {}) {
  const workingTimeMinutes = getWorkingTimeMinutes(machine)
  const totalTime = machineMinutes(machine.totalTime, workingTimeMinutes)
  return machineMinutes(
    machine.stopTimeMinutes,
    Math.max(0, totalTime - workingTimeMinutes)
  )
}

export function getPublicRuntime(machine = {}) {
  const workingTimeMinutes = getWorkingTimeMinutes(machine)
  const stopTimeMinutes = getStopTimeMinutes(machine)
  return {
    workingTimeMinutes,
    stopTimeMinutes,
    runTime: workingTimeMinutes,
    totalTime: workingTimeMinutes + stopTimeMinutes,
  }
}
