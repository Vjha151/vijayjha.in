import {Download} from "lucide-react";
import {useEffect,useState} from "react";
import {promptVehicleInstall,subscribeVehicleInstall,vehicleInstallState} from "../vehicle-pwa";

export function VehicleInstallButton({afterInstall}:{afterInstall?:()=>void}){
 const[state,setState]=useState(vehicleInstallState);
 useEffect(()=>subscribeVehicleInstall(()=>setState(vehicleInstallState())),[]);
 if(!state.canInstall)return null;
 return <button className="vm-install-app" type="button" onClick={async()=>{if(await promptVehicleInstall())afterInstall?.()}}><Download/> Install JHA Vehicles</button>;
}
