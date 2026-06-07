import { expect } from "chai";
import { createPeriodicTask, createTaskScheduler } from "../agents/task-scheduler.js";

describe("Agent periodic task scheduler", function () {
    function manualTimers() {
        const callbacks = [];
        return {
            callbacks,
            schedule(callback, delay) {
                callbacks.push({ callback, delay, cancelled: false });
                return callbacks.length - 1;
            },
            cancel(index) {
                callbacks[index].cancelled = true;
            },
        };
    }

    it("schedules the next run only after the current run completes", async function () {
        const timers = manualTimers();
        let release;
        let active = 0;
        const task = createPeriodicTask("monitor-pool", async () => {
            active++;
            await new Promise(resolve => { release = resolve; });
            active--;
        }, { intervalMs: 100, ...timers });

        task.start();
        expect(timers.callbacks).to.have.length(1);
        const firstRun = timers.callbacks[0].callback();
        await Promise.resolve();
        expect(active).to.equal(1);
        expect(timers.callbacks).to.have.length(1);

        release();
        await firstRun;
        expect(active).to.equal(0);
        expect(timers.callbacks).to.have.length(2);
        expect(timers.callbacks[1].delay).to.equal(100);
    });

    it("isolates task errors and continues scheduling", async function () {
        const timers = manualTimers();
        const errors = [];
        const task = createPeriodicTask("heartbeat", async () => {
            throw new Error("network down");
        }, {
            intervalMs: 100,
            onError: error => errors.push(error),
            ...timers,
        });

        task.start();
        await timers.callbacks[0].callback();
        expect(errors[0].message).to.equal("network down");
        expect(task.stats()).to.include({ runs: 1, failures: 1, stopped: false });
        expect(timers.callbacks).to.have.length(2);
    });

    it("drains active tasks and rejects duplicate task names", async function () {
        const scheduler = createTaskScheduler();
        scheduler.every("heartbeat", 10_000, async () => {});
        expect(() => scheduler.every("heartbeat", 10_000, async () => {}))
            .to.throw("already exists");
        expect(scheduler.size).to.equal(1);
        await scheduler.stopAll();
        expect(scheduler.size).to.equal(0);
    });
});
