import nodemailer from "nodemailer";

const clean=(value="")=>String(value??"").trim();

export function smtpSettings(env=process.env){
 const host=clean(env.SMTP_HOST),user=clean(env.SMTP_USER),password=clean(env.SMTP_PASSWORD),port=Number(env.SMTP_PORT||465),secure=String(env.SMTP_SECURE??"true").toLowerCase()==="true";
 if(!host||!user||!password)throw new Error("SMTP_HOST, SMTP_USER and SMTP_PASSWORD are required");
 if(!Number.isSafeInteger(port)||port<1||port>65535)throw new Error("SMTP_PORT must be a valid port number");
 const legacyFrom=clean(env.SMTP_FROM),legacyMatch=legacyFrom.match(/^(?:"?([^"<]+)"?\s*)?<([^<>\s]+@[^<>\s]+)>$/),fromAddress=clean(env.MAIL_FROM||(legacyMatch?.[2]||legacyFrom)||user),fromName=clean(env.MAIL_FROM_NAME||(legacyMatch?.[1]||"")||"GaadiFile");
 if(!/^\S+@\S+\.\S+$/.test(fromAddress))throw new Error("MAIL_FROM must be a valid email address");
 return{host,port,secure,user,password,fromAddress,fromName};
}

export function smtpConfigured(env=process.env){
 return Boolean(clean(env.SMTP_HOST)&&clean(env.SMTP_USER)&&clean(env.SMTP_PASSWORD));
}

export function createSmtpTransport(env=process.env){
 const settings=smtpSettings(env);
 return nodemailer.createTransport({host:settings.host,port:settings.port,secure:settings.secure,requireTLS:!settings.secure,auth:{user:settings.user,pass:settings.password},connectionTimeout:15000,greetingTimeout:15000,socketTimeout:30000,tls:{minVersion:"TLSv1.2",servername:settings.host}});
}

export function mailFrom(env=process.env){
 const settings=smtpSettings(env),safeName=settings.fromName.replace(/[\r\n"]/g,"").trim();
 return safeName?`"${safeName}" <${settings.fromAddress}>`:settings.fromAddress;
}
