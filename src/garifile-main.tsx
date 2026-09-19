import React from "react";
import {createRoot} from "react-dom/client";
import {VehicleManager} from "./components/VehicleManager";
import {VehicleAccount,VehiclePasswordReset} from "./components/VehicleAccount";
import {VehicleImport} from "./components/VehicleImport";
import {setupVehiclePwa} from "./vehicle-pwa";
import "./style.css";
import "./garifile.css";

function GariFile(){
 const path=location.pathname;
 if((path==="/"||path==="/cars")&&new URLSearchParams(location.search).has("reset"))return <VehiclePasswordReset/>;
 if(path.startsWith("/cars/account"))return <VehicleAccount/>;
 if(path.startsWith("/cars/import"))return <VehicleImport/>;
 return <VehicleManager/>;
}
setupVehiclePwa({standalone:true});
createRoot(document.getElementById("root")!).render(<React.StrictMode><GariFile/></React.StrictMode>);
