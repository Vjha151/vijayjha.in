import assert from "node:assert/strict";
import test from "node:test";
import {DatabaseSync} from "node:sqlite";
import {dueReminders,indiaDate,reminderMessage,runVehicleReminders} from "../vehicle-reminder-service.mjs";
import {mailFrom,smtpSettings} from "../mailer.mjs";

function testDatabase(){
 const db=new DatabaseSync(":memory:");
 db.exec(`PRAGMA foreign_keys=ON;
  CREATE TABLE users(id INTEGER PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1);
  CREATE TABLE vehicles(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),vehicle_number TEXT NOT NULL,vehicle_name TEXT,brand TEXT,make TEXT,model TEXT,location_id INTEGER,registration_status TEXT,temporary_registration_expiry TEXT,first_party_expiry_date TEXT,third_party_expiry_date TEXT,puc_expiry_date TEXT);
  CREATE TABLE vehicle_documents(id INTEGER PRIMARY KEY,vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,user_id INTEGER NOT NULL REFERENCES users(id),name TEXT NOT NULL,category TEXT NOT NULL,expiry_date TEXT,deleted_at TEXT);
  CREATE TABLE document_versions(id INTEGER PRIMARY KEY,document_id INTEGER NOT NULL REFERENCES vehicle_documents(id) ON DELETE CASCADE,is_active INTEGER NOT NULL,deleted_at TEXT);
  CREATE TABLE vehicle_audit_log(id INTEGER PRIMARY KEY,user_id INTEGER,action TEXT,vehicle_id INTEGER,document_id INTEGER);
  CREATE TABLE location_shares(id INTEGER PRIMARY KEY,owner_user_id INTEGER NOT NULL,grantee_user_id INTEGER NOT NULL,location_id INTEGER,permission TEXT,scope TEXT);
  CREATE TABLE shared_vehicle_assignments(share_id INTEGER NOT NULL,vehicle_id INTEGER NOT NULL);
  INSERT INTO users VALUES(1,'Owner','owner@example.com',1),(2,'Viewer','viewer@example.com',1);
  INSERT INTO vehicles VALUES
   (10,1,'TEN10','Ten day vehicle','Gaadi','', 'Model 10',7,'Permanent','', '2026-09-01','',''),
   (11,1,'FIVE5','Five day vehicle','Gaadi','', 'Model 5',7,'Permanent','', '', '2026-08-27',''),
   (12,1,'ONE1','One day vehicle','Gaadi','', 'Model 1',7,'Permanent','', '', '', '2026-08-23'),
   (13,1,'TODAY0','Today vehicle','Gaadi','', 'Model 0',7,'Temporary','2026-08-22', '', '', ''),
   (14,1,'DOC10','Document vehicle','Gaadi','', 'Model D',7,'Permanent','', '2026-09-01', '', '');
  INSERT INTO vehicle_documents VALUES(20,14,1,'Current First Party Policy','First Party / Own Damage Insurance','2026-09-01',NULL);
  INSERT INTO document_versions VALUES(30,20,1,NULL);
  INSERT INTO location_shares VALUES(40,1,2,7,'view','location');`);
 return db;
}

test("Asia/Kolkata date is deterministic",()=>{
 assert.equal(indiaDate(new Date("2026-08-21T20:00:00Z")),"2026-08-22");
});

test("Gmail SMTP configuration uses App Password variables without exposing it",()=>{
 const env={SMTP_HOST:"smtp.gmail.com",SMTP_PORT:"465",SMTP_SECURE:"true",SMTP_USER:"gaadifile@gmail.com",SMTP_PASSWORD:"secret-app-password",MAIL_FROM:"gaadifile@gmail.com",MAIL_FROM_NAME:"GaadiFile"};
 const settings=smtpSettings(env);
 assert.deepEqual({host:settings.host,port:settings.port,secure:settings.secure,user:settings.user,from:settings.fromAddress},{host:"smtp.gmail.com",port:465,secure:true,user:"gaadifile@gmail.com",from:"gaadifile@gmail.com"});
 assert.equal(mailFrom(env),'"GaadiFile" <gaadifile@gmail.com>');
});

test("finds 10, 5, 1 and expiry-day reminders and avoids duplicate metadata/document reminders",()=>{
 const db=testDatabase(),due=dueReminders(db,"2026-08-22");
 assert.deepEqual([...new Set(due.map(item=>item.reminder_days))].sort((a,b)=>b-a),[10,5,1,0]);
 assert.equal(due.length,10,"five reminders should go to owner and shared viewer");
 assert.equal(due.filter(item=>item.vehicle_id===14).length,2,"active uploaded policy replaces duplicate vehicle-level policy reminder");
 db.close();
});

test("sends branded portal links and the delivery ledger prevents duplicates",async()=>{
 const db=testDatabase(),messages=[],transport={sendMail:async message=>{messages.push(message);return{messageId:`gmail-${messages.length}`}}};
 const first=await runVehicleReminders({db,transport,from:'"GaadiFile" <gaadifile@gmail.com>',today:"2026-08-22",baseUrl:"https://vijayjha.in",sendRetries:0});
 assert.deepEqual({due:first.due,sent:first.sent,failed:first.failed,skipped:first.skipped},{due:10,sent:10,failed:0,skipped:0});
 assert.equal(messages.length,10);
 assert.ok(messages.every(message=>message.html.includes("https://vijayjha.in/cars/")));
 assert.ok(messages.every(message=>!message.html.includes("token=")&&!message.html.includes("/api/private/")));
 const second=await runVehicleReminders({db,transport,from:'"GaadiFile" <gaadifile@gmail.com>',today:"2026-08-22",baseUrl:"https://vijayjha.in",sendRetries:0});
 assert.deepEqual({sent:second.sent,skipped:second.skipped},{sent:0,skipped:10});
 assert.equal(messages.length,10);
 const ledger=db.prepare("SELECT status,attempt_count,provider_message_id,failure_reason FROM email_reminder_deliveries").all();
 assert.equal(ledger.length,10);
 assert.ok(ledger.every(row=>row.status==="sent"&&row.attempt_count===1&&row.provider_message_id&&!row.failure_reason));
 db.close();
});

test("retries temporary SMTP failure and records final success",async()=>{
 const db=testDatabase();let attempts=0;
 const transport={sendMail:async()=>{attempts++;if(attempts<3)throw new Error("Temporary SMTP failure");return{messageId:"gmail-retry-ok"}}};
 const result=await runVehicleReminders({db,transport,from:"gaadifile@gmail.com",today:"2026-08-22",sendRetries:2});
 assert.equal(result.sent,10);
 assert.equal(result.failed,0);
 assert.equal(attempts,12,"the first delivery retries twice; remaining deliveries send once");
 db.close();
});

test("records sanitized SMTP failure without leaking multiline details",async()=>{
 const db=testDatabase(),transport={sendMail:async()=>{throw new Error("SMTP rejected\ncredential detail")}};
 const result=await runVehicleReminders({db,transport,from:"gaadifile@gmail.com",today:"2026-08-22",sendRetries:0});
 assert.equal(result.failed,10);
 const rows=db.prepare("SELECT status,failure_reason FROM email_reminder_deliveries").all();
 assert.ok(rows.every(row=>row.status==="failed"&&!row.failure_reason.includes("\n")));
 db.close();
});

test("email message escapes user-controlled HTML",()=>{
 const message=reminderMessage({vehicle_id:1,vehicle_number:"<CAR>",document_name:"PUC",expiry_date:"2026-08-23",reminder_days:1,name:"<script>",vehicle_name:"Test"});
 assert.ok(!message.html.includes("<script>"));
 assert.ok(message.html.includes("&lt;CAR&gt;"));
});
