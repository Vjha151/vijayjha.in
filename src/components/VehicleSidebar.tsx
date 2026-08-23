import {useState} from "react";
import {BarChart3,Bell,Car,FileText,LayoutDashboard,LogOut,MapPin,Menu,Settings,Users} from "lucide-react";

export function VehicleSidebar({name,active="vehicles",accountKind="customer"}:{name?:string;active?:string;accountKind?:string}){
 const[open,setOpen]=useState(false);
 const links=[
  [LayoutDashboard,"Dashboard","/cars#dashboard","dashboard"],
  [Car,"Vehicles","/cars","vehicles"],
  [Bell,"Reminders","/cars#reminders","reminders"],
  [FileText,"Documents","/cars#documents","documents"],
  [MapPin,"Locations","/cars/account#locations","locations"],
  [Users,"Sharing & Users","/cars/account#sharing","sharing"],
  [BarChart3,"Reports","/api/private/vehicles/export?format=xlsx","reports"],
  [Settings,"Settings","/cars/account","settings"]
 ] as const;
 return <>
  <button className="vm-menu-toggle" onClick={()=>setOpen(value=>!value)} aria-label="Toggle navigation"><Menu/></button>
  <aside className={`vm-sidebar ${open?"open":""}`}>
   <div className="vm-sidebar-brand"><img src="/gaadifile-logo.png" alt="GaadiFile — Your Vehicle, All in One Place"/><small>{name?.split(" ")[0].toUpperCase()||"VIJAY"}</small></div>
   <nav>{links.filter(([,label])=>accountKind!=="managed"||!["Locations","Sharing & Users","Reports"].includes(label)).map(([Icon,label,href,key])=><a className={active===key?"active":""} href={href} key={label} onClick={()=>setOpen(false)}><Icon/>{label}</a>)}</nav>
   <a className="vm-sidebar-logout" href="/api/logout"><LogOut/> Sign out</a>
  </aside>
  {open&&<button className="vm-sidebar-scrim" onClick={()=>setOpen(false)} aria-label="Close navigation"/>}
 </>;
}
