import assert from "node:assert/strict";
import test from "node:test";
import {createDailyReminderScheduler,kolkataClock} from "../vehicle-reminder-scheduler.mjs";

const silent={info(){},error(){}};

test("Kolkata scheduler clock is independent of container timezone",()=>{
 assert.deepEqual(kolkataClock(new Date("2026-08-22T02:29:00Z")),{date:"2026-08-22",minutes:479});
 assert.deepEqual(kolkataClock(new Date("2026-08-22T02:30:00Z")),{date:"2026-08-22",minutes:480});
});

test("daily scheduler runs at 08:00 Kolkata and only once after success",async()=>{
 let current=new Date("2026-08-22T02:29:00Z"),runs=0;
 const scheduler=createDailyReminderScheduler({runJob:async()=>{runs++},now:()=>current,logger:silent,checkIntervalMs:864e5,retryIntervalMs:0,startImmediately:false});
 await scheduler.tick();assert.equal(runs,0);
 current=new Date("2026-08-22T02:30:00Z");await scheduler.tick();assert.equal(runs,1);
 current=new Date("2026-08-22T10:00:00Z");await scheduler.tick();assert.equal(runs,1);
 scheduler.stop();
});

test("container restart after 08:00 performs catch-up while delivery ledger remains authoritative",async()=>{
 const current=new Date("2026-08-22T06:00:00Z");let runs=0;
 const first=createDailyReminderScheduler({runJob:async()=>{runs++},now:()=>current,logger:silent,checkIntervalMs:864e5,retryIntervalMs:0,startImmediately:false});
 await first.tick();first.stop();
 const restarted=createDailyReminderScheduler({runJob:async()=>{runs++},now:()=>current,logger:silent,checkIntervalMs:864e5,retryIntervalMs:0,startImmediately:false});
 await restarted.tick();restarted.stop();
 assert.equal(runs,2,"a restarted container re-invokes the idempotent reminder job for catch-up");
});

test("failed jobs can retry without waiting for the next day",async()=>{
 let attempts=0,current=new Date("2026-08-22T02:30:00Z");
 const scheduler=createDailyReminderScheduler({runJob:async()=>{attempts++;if(attempts===1)throw new Error("temporary")},now:()=>current,logger:silent,checkIntervalMs:864e5,retryIntervalMs:15*60_000,startImmediately:false});
 await scheduler.tick();assert.equal(attempts,1);
 current=new Date("2026-08-22T02:40:00Z");await scheduler.tick();assert.equal(attempts,1);
 current=new Date("2026-08-22T02:45:00Z");await scheduler.tick();assert.equal(attempts,2);
 scheduler.stop();
});
