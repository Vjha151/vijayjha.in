import {createSmtpTransport,smtpSettings} from "./mailer.mjs";

const settings=smtpSettings(),transport=createSmtpTransport();
try{await transport.verify();console.log(JSON.stringify({ok:true,provider:settings.host,user:settings.user,from:settings.fromAddress}))}finally{transport.close()}
