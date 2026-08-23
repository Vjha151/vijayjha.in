import {useState} from "react";
import {BarChart3,Bell,Car,FileText,LayoutDashboard,LogOut,MapPin,Menu,Settings,Users} from "lucide-react";

const customerNavigation=[
 {Icon:LayoutDashboard,label:"Dashboard",href:"/cars#dashboard",key:"dashboard"},
 {Icon:Car,label:"Vehicles",href:"/cars",key:"vehicles"},
 {Icon:Bell,label:"Reminders",href:"/cars#reminders",key:"reminders"},
 {Icon:FileText,label:"Documents",href:"/cars#documents",key:"documents"},
 {Icon:MapPin,label:"Locations",href:"/cars/account#locations",key:"locations"},
 {Icon:Users,label:"Sharing & Users",href:"/cars/account#sharing",key:"sharing"},
 {Icon:BarChart3,label:"Reports",href:"/api/private/vehicles/export?format=xlsx",key:"reports"},
 {Icon:Settings,label:"Settings",href:"/cars/account",key:"settings"},
] as const;

export function VehicleSidebar({name,active="vehicles"}:{name?:string;active?:string;accountKind?:string}){
 const[open,setOpen]=useState(false);
 return <>
  <button className="vm-menu-toggle" onClick={()=>setOpen(value=>!value)} aria-label="Toggle customer navigation" aria-expanded={open} aria-controls="customer-sidebar"><Menu/></button>
  <aside id="customer-sidebar" className={`vm-sidebar ${open?"open":""}`} aria-label="Customer navigation">
   <div className="vm-sidebar-brand"><img src="/gaadifile-logo.png" alt="GaadiFile — Your Vehicle, All in One Place"/><small>{name?.split(" ")[0].toUpperCase()||"VIJAY"}</small></div>
   <nav className="vm-sidebar-links" aria-label="Customer portal pages">
    {customerNavigation.map(({Icon,label,href,key})=><a className={active===key?"active":""} href={href} key={key} onClick={()=>setOpen(false)}><Icon/>{label}</a>)}
   </nav>
   <div className="vm-sidebar-footer"><a className="vm-sidebar-logout" href="/api/logout"><LogOut/> Sign out</a></div>
  </aside>
  {open&&<button className="vm-sidebar-scrim" onClick={()=>setOpen(false)} aria-label="Close customer navigation"/>}
 </>;
}
