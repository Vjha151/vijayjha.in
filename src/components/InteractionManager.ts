import * as THREE from "three";

export const interaction = {
  pointer: new THREE.Vector2(), velocity: new THREE.Vector2(), speed: 0,
  scroll: 0, section: 0, dragging: false, pulse: 0, uiEnergy: 0,
};

let lastX=0,lastY=0,lastTime=performance.now();
export function startInteractionManager(){
  const move=(e:PointerEvent)=>{const now=performance.now(),dt=Math.max(16,now-lastTime);const nx=e.clientX/innerWidth*2-1,ny=-(e.clientY/innerHeight*2-1);interaction.velocity.set((e.clientX-lastX)/dt,(e.clientY-lastY)/dt);interaction.speed=Math.min(1,interaction.velocity.length()*1.8);interaction.pointer.set(nx,ny);lastX=e.clientX;lastY=e.clientY;lastTime=now};
  const down=()=>{interaction.dragging=true;interaction.pulse=1};const up=()=>interaction.dragging=false;
  addEventListener("pointermove",move,{passive:true});addEventListener("pointerdown",down);addEventListener("pointerup",up);
  return()=>{removeEventListener("pointermove",move);removeEventListener("pointerdown",down);removeEventListener("pointerup",up)};
}
export function energizeWorld(amount=.8){interaction.uiEnergy=Math.max(interaction.uiEnergy,amount);interaction.pulse=1}
