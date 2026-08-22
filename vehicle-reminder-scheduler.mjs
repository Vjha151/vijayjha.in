import {spawn} from "node:child_process";
import path from "node:path";
import {INDIA_TIME_ZONE} from "./vehicle-reminder-service.mjs";

const CHECK_INTERVAL_MS=60_000;
const RETRY_INTERVAL_MS=15*60_000;
const SCHEDULE_MINUTES=8*60;

export function kolkataClock(now=new Date()){
 const parts=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:INDIA_TIME_ZONE,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(now).filter(part=>part.type!=="literal").map(part=>[part.type,part.value]));
 return{date:`${parts.year}-${parts.month}-${parts.day}`,minutes:Number(parts.hour)*60+Number(parts.minute)};
}

export function createDailyReminderScheduler({runJob,now=()=>new Date(),logger=console,checkIntervalMs=CHECK_INTERVAL_MS,retryIntervalMs=RETRY_INTERVAL_MS,startImmediately=true}={}){
 if(typeof runJob!=="function")throw new Error("runJob is required");
 let running=false,lastSuccessfulDate="",lastAttemptAt=0;
 const tick=async()=>{
  const current=now(),clock=kolkataClock(current),timestamp=current.getTime();
  if(clock.minutes<SCHEDULE_MINUTES||running||lastSuccessfulDate===clock.date||timestamp-lastAttemptAt<retryIntervalMs)return false;
  running=true;lastAttemptAt=timestamp;
  try{await runJob();lastSuccessfulDate=clock.date;logger.info?.(`[vehicle-reminders] Daily job completed for ${clock.date}`);return true}
  catch(error){logger.error?.(`[vehicle-reminders] Daily job failed: ${String(error?.message||error).replace(/[\r\n]+/g," ").slice(0,300)}`);return false}
  finally{running=false}
 };
 const timer=setInterval(()=>void tick(),checkIntervalMs);timer.unref?.();if(startImmediately)void tick();
 return{tick,stop:()=>clearInterval(timer),state:()=>({running,lastSuccessfulDate,lastAttemptAt})};
}

export function runReminderProcess({root=process.cwd(),env=process.env}={}){
 return new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,[path.join(root,"vehicle-reminders.mjs")],{cwd:root,env,stdio:["ignore","inherit","inherit"]});
  child.once("error",reject);
  child.once("exit",(code,signal)=>code===0?resolve():reject(new Error(signal?`Reminder process stopped by ${signal}`:`Reminder process exited with code ${code}`)));
 });
}

export function startVehicleReminderScheduler({root=process.cwd(),env=process.env,logger=console}={}){
 if(String(env.VEHICLE_REMINDERS_ENABLED??"true").toLowerCase()==="false"){logger.info?.("[vehicle-reminders] Container scheduler disabled by VEHICLE_REMINDERS_ENABLED=false");return null}
 if(!env.SMTP_HOST||!env.SMTP_USER||!env.SMTP_PASSWORD){logger.warn?.("[vehicle-reminders] Container scheduler not started because SMTP configuration is incomplete");return null}
 logger.info?.(`[vehicle-reminders] Container scheduler active: daily 08:00 ${INDIA_TIME_ZONE}`);
 return createDailyReminderScheduler({runJob:()=>runReminderProcess({root,env}),logger});
}
