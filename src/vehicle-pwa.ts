type InstallPromptEvent=Event&{
 prompt:()=>Promise<void>;
 userChoice:Promise<{outcome:"accepted"|"dismissed"}>;
};

let installPrompt:InstallPromptEvent|null=null;
let installed=window.matchMedia("(display-mode: standalone)").matches;
const listeners=new Set<()=>void>();
const notify=()=>listeners.forEach(listener=>listener());

function meta(name:string,content:string){
 let element=document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
 if(!element){element=document.createElement("meta");element.name=name;document.head.append(element)}
 element.content=content;
}

export function setupVehiclePwa(){
 const portal=location.pathname==="/login"||location.pathname==="/cars"||location.pathname.startsWith("/cars/");
 if(!portal)return;
 document.title="GaadiFile";
 meta("theme-color","#102a3d");
 meta("description","GaadiFile securely manages your vehicles, documents and expiry reminders.");
 meta("application-name","GaadiFile");
 meta("apple-mobile-web-app-capable","yes");
 meta("apple-mobile-web-app-status-bar-style","black-translucent");
 meta("apple-mobile-web-app-title","GaadiFile");
 if(!document.head.querySelector('link[rel="manifest"]')){
  const manifest=document.createElement("link");manifest.rel="manifest";manifest.href="/vehicle-manifest.webmanifest";document.head.append(manifest);
 }
 if(!document.head.querySelector('link[rel="apple-touch-icon"]')){
  const icon=document.createElement("link");icon.rel="apple-touch-icon";icon.href="/pwa/icon-180.png?v=2";document.head.append(icon);
 }
 if(!document.head.querySelector('link[data-gaadifile-icon]')){
  const icon=document.createElement("link");icon.rel="icon";icon.type="image/png";icon.href="/pwa/icon-192.png?v=2";icon.dataset.gaadifileIcon="true";document.head.append(icon);
 }
 window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();installPrompt=event as InstallPromptEvent;notify()});
 window.addEventListener("appinstalled",()=>{installed=true;installPrompt=null;notify()});
 if(import.meta.env.PROD&&"serviceWorker" in navigator)window.addEventListener("load",()=>{navigator.serviceWorker.register("/vehicle-sw.js",{scope:"/cars"}).then(registration=>registration.update()).catch(()=>{})},{once:true});
}

export function vehicleInstallState(){return{canInstall:!!installPrompt&&!installed,installed}}
export function subscribeVehicleInstall(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener)}}
export async function promptVehicleInstall(){
 if(!installPrompt)return false;
 const prompt=installPrompt;
 await prompt.prompt();
 const choice=await prompt.userChoice;
 if(choice.outcome==="accepted")installPrompt=null;
 notify();
 return choice.outcome==="accepted";
}
