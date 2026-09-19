// Retire the vehicle PWA previously installed on this origin.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(/^(jha-vehicles-|gaadifile-|garifile-)/.test(key))await caches.delete(key);await self.registration.unregister();})()));
