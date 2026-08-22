import {DatabaseSync} from "node:sqlite";
import {mkdir,cp,writeFile} from "node:fs/promises";
import path from "node:path";

const root=process.cwd(),stamp=new Date().toISOString().replace(/[:.]/g,"-"),base=path.resolve(process.env.VEHICLE_BACKUP_DIR||path.join(root,"backups")),dest=path.join(base,stamp);await mkdir(dest,{recursive:true});
const dbPath=path.join(root,"data","site.db"),backupDb=path.join(dest,"site.db"),db=new DatabaseSync(dbPath),escaped=backupDb.replaceAll("'","''");db.exec(`VACUUM INTO '${escaped}'`);db.close();
await cp(path.join(root,"data","private-vehicle-documents"),path.join(dest,"private-vehicle-documents"),{recursive:true});await writeFile(path.join(dest,"manifest.json"),JSON.stringify({createdAt:new Date().toISOString(),database:"site.db",documents:"private-vehicle-documents"},null,2));console.log(dest);
