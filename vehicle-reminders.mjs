import {DatabaseSync} from "node:sqlite";
import path from "node:path";
import {createSmtpTransport,mailFrom,smtpSettings} from "./mailer.mjs";
import {indiaDate,runVehicleReminders} from "./vehicle-reminder-service.mjs";

const db=new DatabaseSync(path.join(process.cwd(),"data","site.db"));
const transport=createSmtpTransport();
const settings=smtpSettings();

try{
 await transport.verify();
 const result=await runVehicleReminders({db,transport,from:mailFrom(),fromName:settings.fromName,baseUrl:process.env.APP_BASE_URL||"https://vijayjha.in",today:indiaDate()});
 console.log(JSON.stringify(result));
 if(result.failed)process.exitCode=1;
}finally{
 transport.close();
 db.close();
}
