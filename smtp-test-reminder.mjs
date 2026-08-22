import {createSmtpTransport,mailFrom,smtpSettings} from "./mailer.mjs";
import {reminderMessage} from "./vehicle-reminder-service.mjs";

const settings=smtpSettings(),to=String(process.env.SMTP_TEST_TO||"").trim();
if(!/^\S+@\S+\.\S+$/.test(to))throw new Error("SMTP_TEST_TO must be set to the test recipient email address");
const transport=createSmtpTransport(),content=reminderMessage({vehicle_id:1,vehicle_number:"TEST-VEHICLE",vehicle_name:"SMTP Test",brand:"GaadiFile",model:"Reminder",document_name:"Test Document",expiry_date:"2099-12-31",reminder_days:10,name:"GaadiFile User"},{baseUrl:process.env.APP_BASE_URL||"https://vijayjha.in",fromName:settings.fromName});
try{
 await transport.verify();
 const info=await transport.sendMail({from:mailFrom(),to,subject:`[TEST] ${content.subject}`,text:content.text,html:content.html});
 console.log(JSON.stringify({ok:true,to,messageId:String(info.messageId||"")}));
}finally{transport.close()}
