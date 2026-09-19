export const isGariFile=()=>typeof document!=="undefined"&&document.documentElement.dataset.site==="garifile";
export function VehicleBrand(){
 if(!isGariFile())return <img src="/gaadifile-logo.png" alt="GaadiFile — Your Vehicle, All in One Place"/>;
 return <div className="gari-brand" aria-label="GariFile — Your vehicle records, together"><img src="/pwa/icon-192.png?v=2" alt=""/><div><strong>Gari<span>File</span></strong><small>Your vehicle records, together.</small></div></div>;
}
