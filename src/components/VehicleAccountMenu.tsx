import {useEffect,useRef,useState} from "react";
import {ChevronDown,LogOut,Settings} from "lucide-react";

export function VehicleAccountMenu({name}:{name?:string}){
 const[open,setOpen]=useState(false),root=useRef<HTMLDivElement>(null);
 useEffect(()=>{const close=(event:MouseEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false)};document.addEventListener("mousedown",close);return()=>document.removeEventListener("mousedown",close)},[]);
 const displayName=name||"Account";
 return <div className="vm-account" ref={root}><button className="vm-account-button" aria-expanded={open} onClick={()=>setOpen(value=>!value)}><b>{displayName.charAt(0).toUpperCase()}</b><span><strong>{displayName}</strong><small>Account</small></span><ChevronDown/></button>{open&&<div className="vm-account-menu"><a href="/private/vehicles/account"><Settings/> Settings</a><a href="/api/logout"><LogOut/> Sign out</a></div>}</div>;
}
