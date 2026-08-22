import {useState} from "react";
import {BarChart3,Bell,Car,FileText,LayoutDashboard,LogOut,MapPin,Menu,Settings,Users} from "lucide-react";

export function VehicleSidebar({name,active="vehicles",accountKind="customer"}:{name?:string;active?:string;accountKind?:string}){
 const[open,setOpen]=useState(false);
 const links=[
  [LayoutDashboard,"Dashboard","/vehicles#dashboard","dashboard"],
  [Car,"Vehicles","/vehicles","vehicles"],
  [Bell,"Reminders","/vehicles#reminders","reminders"],
  [FileText,"Documents","/vehicles#documents","documents"],
  [MapPin,"Locations","/vehicles/account#locations","locations"],
  [Users,"Sharing & Users","/vehicles/account#sharing","sharing"],
  [BarChart3,"Reports","/api/private/vehicles/export?format=xlsx","reports"],
  [Settings,"Settings","/vehicles/account","settings"]
 ] as const;
 return <>
  <button className="vm-menu-toggle" onClick={()=>setOpen(value=>!value)} aria-label="Toggle navigation"><Menu/></button>
  <aside className={`vm-sidebar ${open?"open":""}`}>
   <div className="vm-sidebar-brand"><span><Car/></span><div><b>Vehicle Manager</b><small>{name?.split(" ")[0].toUpperCase()||"VIJAY"}</small></div></div>
   <nav>{links.filter(([,label])=>accountKind!=="managed"||!["Locations","Sharing & Users","Reports"].includes(label)).map(([Icon,label,href,key])=><a className={active===key?"active":""} href={href} key={label} onClick={()=>setOpen(false)}><Icon/>{label}</a>)}</nav>
   <a className="vm-sidebar-logout" href="/api/logout"><LogOut/> Sign out</a>
  </aside>
  {open&&<button className="vm-sidebar-scrim" onClick={()=>setOpen(false)} aria-label="Close navigation"/>}
 </>;
}
