import {useEffect,useRef,useState} from "react";
import {Crop,RotateCcw,RotateCw,ZoomIn,ZoomOut} from "lucide-react";
import {Cropper,type CropperRef} from "react-advanced-cropper";
import "react-advanced-cropper/dist/style.css";

const canvasBlob=(canvas:HTMLCanvasElement,type:string,quality?:number)=>new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("Could not process this image.")),type,quality));
const fileBase=(name:string)=>name.replace(/\.[^.]+$/,"").replace(/[^a-zA-Z0-9._-]+/g,"-").replace(/^-|-$/g,"")||"document";

async function editedFile(cropper:CropperRef,source:File,maxBytes:number){
 const canvas=cropper.getCanvas({maxWidth:4096,maxHeight:4096,maxArea:16_000_000,imageSmoothingEnabled:true,imageSmoothingQuality:"high",fillColor:"#fff"});
 if(!canvas)throw new Error("Complete the crop before continuing.");
 let type=source.type==="image/png"?"image/png":"image/jpeg",blob=await canvasBlob(canvas,type,type==="image/jpeg"?.96:undefined);
 if(blob.size>maxBytes){
  type="image/jpeg";
  for(const quality of[.94,.9,.86,.82,.78,.74]){blob=await canvasBlob(canvas,type,quality);if(blob.size<=maxBytes)break}
 }
 let current=canvas;
 for(let attempt=0;blob.size>maxBytes&&attempt<4;attempt++){
  const scaled=document.createElement("canvas"),ratio=.85;
  scaled.width=Math.max(1,Math.round(current.width*ratio));scaled.height=Math.max(1,Math.round(current.height*ratio));
  const context=scaled.getContext("2d");if(!context)break;
  context.fillStyle="#fff";context.fillRect(0,0,scaled.width,scaled.height);context.imageSmoothingEnabled=true;context.imageSmoothingQuality="high";context.drawImage(current,0,0,scaled.width,scaled.height);
  current=scaled;blob=await canvasBlob(current,"image/jpeg",.82);type="image/jpeg";
 }
 if(blob.size>maxBytes)throw new Error("Edited image is still larger than 5 MB. Crop a smaller area and try again.");
 const extension=type==="image/png"?"png":"jpg";
 return new File([blob],`${fileBase(source.name)}-edited.${extension}`,{type,lastModified:Date.now()});
}

export function DocumentPhotoEditor({active,sourceUrl,sourceFile,maxBytes,onApply,onCancel,onError}:{active:boolean;sourceUrl:string;sourceFile:File;maxBytes:number;onApply:(file:File)=>void;onCancel:()=>void;onError:(message:string)=>void}){
 const cropper=useRef<CropperRef>(null),[mode,setMode]=useState<"free"|"document">("free"),[processing,setProcessing]=useState(false),[localError,setLocalError]=useState("");
 useEffect(()=>{if(active)setTimeout(()=>cropper.current?.refresh(),0)},[active]);
 const apply=async()=>{if(!cropper.current)return;setProcessing(true);setLocalError("");onError("");try{onApply(await editedFile(cropper.current,sourceFile,maxBytes))}catch(error:any){setLocalError(error.message);onError(error.message)}finally{setProcessing(false)}};
 return <section className={`vm-photo-editor${active?"":" hidden"}`} aria-hidden={!active}>
  <header><div><Crop/><span><b>Crop & Rotate</b><small>Drag the corners around the document. Pinch to zoom.</small></span></div><button type="button" aria-label="Close editor" onClick={onCancel}>×</button></header>
  <div className="vm-cropper-stage"><Cropper ref={cropper} key={mode} src={sourceUrl} className="vm-cropper" checkOrientation stencilProps={mode==="document"?{aspectRatio:1.414,grid:true}:{minAspectRatio:.25,maxAspectRatio:4,grid:true}} resizeImage={{touch:true,wheel:true}} moveImage={{touch:true,mouse:true}} imageRestriction="stencil"/></div>
  <div className="vm-editor-toolbar" aria-label="Photo editing controls">
   <div><button type="button" className={mode==="free"?"active":""} onClick={()=>setMode("free")}>Free Crop</button><button type="button" className={mode==="document"?"active":""} onClick={()=>setMode("document")}>Document</button></div>
   <div><button type="button" title="Zoom out" aria-label="Zoom out" onClick={()=>cropper.current?.zoomImage(.85)}><ZoomOut/></button><button type="button" title="Zoom in" aria-label="Zoom in" onClick={()=>cropper.current?.zoomImage(1.15)}><ZoomIn/></button><button type="button" title="Rotate left" aria-label="Rotate left 90 degrees" onClick={()=>cropper.current?.rotateImage(-90)}><RotateCcw/> <span>Left</span></button><button type="button" title="Rotate right" aria-label="Rotate right 90 degrees" onClick={()=>cropper.current?.rotateImage(90)}><RotateCw/> <span>Right</span></button></div>
  </div>
  {localError&&<div className="vm-editor-error">{localError}</div>}
  <footer><button type="button" className="secondary" onClick={onCancel}>Choose Again</button><button type="button" disabled={processing} onClick={apply}>{processing?"Processing…":"Preview Crop"}</button></footer>
 </section>
}
