function requirePositiveInteger(value, name) {
    if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`)
    return value
}

function requireFunction(value, name) {
    if (typeof value !== 'function') throw new Error(`${name} must be a function`)
    return value
}

export function createPeriodicTask(name, operation, options = {}) {
    if (typeof name !== 'string' || name.trim() === '') throw new Error('Task name must be a non-empty string')
    requireFunction(operation, 'Task operation')
    const intervalMs = requirePositiveInteger(options.intervalMs, 'intervalMs')
    const schedule = options.schedule ?? setTimeout
    const cancel = options.cancel ?? clearTimeout
    requireFunction(schedule, 'schedule')
    requireFunction(cancel, 'cancel')

    let timer
    let activeRun
    let running = false
    let stopped = true
    const stats = { runs: 0, successes: 0, failures: 0 }

    function scheduleNext(delayMs = intervalMs) {
        if (stopped) return
        timer = schedule(execute, delayMs)
        timer?.unref?.()
    }

    async function execute() {
        timer = undefined
        if (stopped || running) return
        running = true
        stats.runs++
        activeRun = Promise.resolve().then(operation)
        try {
            await activeRun
            stats.successes++
        } catch (error) {
            stats.failures++
            options.onError?.(error, { name, ...stats })
        } finally {
            activeRun = undefined
            running = false
            scheduleNext()
        }
    }

    return Object.freeze({
        start() {
            if (!stopped) return false
            stopped = false
            scheduleNext(options.runImmediately ? 0 : intervalMs)
            return true
        },
        async stop() {
            if (stopped) return false
            stopped = true
            if (timer !== undefined) {
                cancel(timer)
                timer = undefined
            }
            await activeRun?.catch(() => {})
            return true
        },
        trigger: execute,
        stats: () => Object.freeze({ name, running, stopped, ...stats })
    })
}

export function createTaskScheduler(options = {}) {
    const tasks = new Map()

    return Object.freeze({
        every(name, intervalMs, operation, taskOptions = {}) {
            if (tasks.has(name)) throw new Error(`Scheduled task already exists: ${name}`)
            const task = createPeriodicTask(name, operation, {
                ...taskOptions,
                intervalMs,
                onError: taskOptions.onError ?? options.onError
            })
            tasks.set(name, task)
            task.start()
            return task
        },
        async stopAll() {
            await Promise.all([...tasks.values()].map(task => task.stop()))
            tasks.clear()
        },
        stats() {
            return Object.freeze([...tasks.values()].map(task => task.stats()))
        },
        get size() {
            return tasks.size
        }
    })
}
