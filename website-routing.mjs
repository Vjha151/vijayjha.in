// The portfolio has no vehicle application or cross-domain redirects.
export async function handleWebsiteRequest(req,res,url){
 const p=url.pathname;
 const removed=/^\/(?:car|cars|vehicles|private\/vehicles)(?:\/|$)/.test(p)||p.startsWith('/api/private/vehicles')||p.startsWith('/api/admin/vehicle-')||p.startsWith('/admin/vehicle-')||p.startsWith('/garifile')||p.startsWith('/gaadifile')||p.startsWith('/pwa/')||p==='/login'||(p.startsWith('/api/auth/')&&p!=='/api/auth/me');
 if(removed){res.writeHead(404,{'Content-Type':p.startsWith('/api/')?'application/json':'text/plain; charset=utf-8','Cache-Control':'no-store'});res.end(p.startsWith('/api/')?JSON.stringify({error:'Not found'}):'Page not found');return true}
 return false;
}
