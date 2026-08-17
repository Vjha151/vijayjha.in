import { PerformanceMonitor } from "@react-three/drei";import { useThree } from "@react-three/fiber";import { useEffect } from "react";
export type Quality="high"|"medium"|"low";
export function PerformanceManager({quality,setQuality}:{quality:Quality;setQuality:(q:Quality)=>void}){const{gl}=useThree();useEffect(()=>gl.setPixelRatio(Math.min(devicePixelRatio,quality==="high"?1.75:quality==="medium"?1.25:1)),[quality,gl]);return <PerformanceMonitor onDecline={()=>setQuality(quality==="high"?"medium":"low")} flipflops={3}/>}
