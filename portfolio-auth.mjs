import crypto from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(crypto.scrypt),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const tokenOf=req=>String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('portfolio_session='))?.slice(18);
export async function createAuth({db,json}){
 db.exec("CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,email TEXT NOT NULL COLLATE NOCASE UNIQUE,password_hash TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'admin',active INTEGER NOT NULL DEFAULT 1);");
 if(!db.prepare('PRAGMA table_info(sessions)').all().some(x=>x.name==='user_id'))db.exec('ALTER TABLE sessions ADD COLUMN user_id INTEGER');
 const email=String(process.env.ADMIN_EMAIL||'').trim().toLowerCase(),password=String(process.env.ADMIN_PASSWORD||'');
 if(!db.prepare("SELECT 1 FROM users WHERE role='admin'").get()&&email&&password.length>=12){const salt=crypto.randomBytes(16).toString('hex'),derived=await scrypt(password,salt,64);db.prepare("INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,'admin')").run('Site Administrator',email,`scrypt$${salt}$${Buffer.from(derived).toString('hex')}`)}
 const currentUser=req=>{const token=tokenOf(req);if(!token)return null;return db.prepare("SELECT u.id,u.name,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1 AND u.role='admin'").get(hash(token),Date.now())||null};
 const attempts=new Map();
 async function api(req,res,url){
  if(url.pathname==='/api/auth/me'&&req.method==='GET'){const user=currentUser(req);return json(res,user?200:401,user?{user}:{error:'Login required'})}
  if(url.pathname==='/api/logout'){const token=tokenOf(req);if(token)db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(token));res.writeHead(302,{Location:'/','Set-Cookie':'portfolio_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});return res.end()}
  if(url.pathname==='/api/login'&&req.method==='POST'){
   const key=req.socket.remoteAddress,now=Date.now(),recent=(attempts.get(key)||[]).filter(t=>now-t<900000);recent.push(now);attempts.set(key,recent);if(recent.length>8)return json(res,429,{error:'Too many attempts. Try again later.'});
   const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>16384)return json(res,413,{error:'Request too large'});chunks.push(c)}
   let body;try{body=JSON.parse(Buffer.concat(chunks).toString())}catch{return json(res,400,{error:'Invalid request'})}
   const user=db.prepare("SELECT * FROM users WHERE email=? AND role='admin' AND active=1").get(String(body.email||'').trim().toLowerCase());
   let valid=false;if(user){const[,salt,wanted]=user.password_hash.split('$');if(salt&&wanted){const got=Buffer.from(await scrypt(String(body.password||''),salt,64)),target=Buffer.from(wanted,'hex');valid=got.length===target.length&&crypto.timingSafeEqual(got,target)}}
   if(!valid)return json(res,401,{error:'Email or password is incorrect'});
   const token=crypto.randomBytes(32).toString('hex');db.prepare('DELETE FROM sessions WHERE expires_at<?').run(now);db.prepare('INSERT INTO sessions(token_hash,expires_at,user_id) VALUES(?,?,?)').run(hash(token),now+604800000,user.id);
   return json(res,200,{ok:true,user:{id:user.id,name:user.name,email:user.email,role:user.role}},{'Set-Cookie':`portfolio_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${process.env.NODE_ENV==='production'?'; Secure':''}`});
  }
  return false;
 }
 return{api,currentUser,authed:req=>!!currentUser(req),admin:req=>!!currentUser(req)};
}
