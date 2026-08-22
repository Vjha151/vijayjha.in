import {readFile} from "node:fs/promises";
import path from "node:path";

const root=process.cwd();
const expected=[
 ["icon-180.png",180],
 ["icon-192.png",192],
 ["icon-512.png",512],
 ["maskable-512.png",512]
];

await readFile(path.join(root,"public","gaadifile-logo.png"));
for(const[name,size]of expected){
 const file=await readFile(path.join(root,"public","pwa",name));
 const validSignature=file.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 const validSize=file.readUInt32BE(16)===size&&file.readUInt32BE(20)===size;
 if(!validSignature||!validSize)throw new Error(`${name} must be a ${size}x${size} PNG generated from the approved GaadiFile logo.`);
}

console.log("GaadiFile PWA logo assets are present and valid in public/pwa");
