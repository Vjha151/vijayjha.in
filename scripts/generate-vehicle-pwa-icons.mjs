import {mkdir,writeFile} from "node:fs/promises";
import path from "node:path";
import {deflateSync} from "node:zlib";

const output=path.join(process.cwd(),"public","pwa");

function crc32(buffer){
 let crc=0xffffffff;
 for(const byte of buffer){
  crc^=byte;
  for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);
 }
 return(crc^0xffffffff)>>>0;
}

function chunk(type,data){
 const name=Buffer.from(type),length=Buffer.alloc(4),checksum=Buffer.alloc(4);
 length.writeUInt32BE(data.length);
 checksum.writeUInt32BE(crc32(Buffer.concat([name,data])));
 return Buffer.concat([length,name,data,checksum]);
}

function png(size,pixels){
 const ihdr=Buffer.alloc(13);
 ihdr.writeUInt32BE(size,0);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=6;
 const rows=[];
 for(let y=0;y<size;y++)rows.push(Buffer.from([0]),pixels.subarray(y*size*4,(y+1)*size*4));
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk("IHDR",ihdr),chunk("IDAT",deflateSync(Buffer.concat(rows))),chunk("IEND",Buffer.alloc(0))]);
}

function icon(size){
 const pixels=Buffer.alloc(size*size*4),scale=size/512;
 const color=(hex)=>[parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16),255];
 const set=(x,y,fill)=>{if(x<0||y<0||x>=size||y>=size)return;const index=(Math.floor(y)*size+Math.floor(x))*4;pixels.set(fill,index)};
 const rect=(x,y,width,height,fill,radius=0)=>{x*=scale;y*=scale;width*=scale;height*=scale;radius*=scale;for(let py=Math.floor(y);py<Math.ceil(y+height);py++)for(let px=Math.floor(x);px<Math.ceil(x+width);px++){const dx=Math.max(x+radius-px,0,px-(x+width-radius)),dy=Math.max(y+radius-py,0,py-(y+height-radius));if(!radius||dx*dx+dy*dy<=radius*radius)set(px,py,fill)}};
 const circle=(cx,cy,radius,fill)=>{cx*=scale;cy*=scale;radius*=scale;for(let y=Math.floor(cy-radius);y<=Math.ceil(cy+radius);y++)for(let x=Math.floor(cx-radius);x<=Math.ceil(cx+radius);x++)if((x-cx)**2+(y-cy)**2<=radius**2)set(x,y,fill)};
 const navy=color("#102a3d"),green=color("#4f8b5d"),light=color("#e9f4eb"),white=color("#ffffff");
 rect(0,0,512,512,navy);
 rect(76,76,360,360,green,92);
 rect(126,192,260,126,light,30);
 rect(162,151,188,100,light,34);
 rect(184,174,144,62,navy,14);
 rect(112,244,288,82,light,25);
 rect(139,260,60,20,green,10);
 rect(313,260,60,20,green,10);
 circle(170,326,38,navy);circle(342,326,38,navy);
 circle(170,326,18,white);circle(342,326,18,white);
 return png(size,pixels);
}

await mkdir(output,{recursive:true});
for(const size of[180,192,512])await writeFile(path.join(output,`icon-${size}.png`),icon(size));
await writeFile(path.join(output,"maskable-512.png"),icon(512));
console.log("Generated JHA Vehicles PWA icons in public/pwa");
