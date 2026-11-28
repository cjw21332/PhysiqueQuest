import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import next from 'next';
import { allowedBackendPath, allowedLocalRequest, isolatedCookies, upstreamHeaders } from './admin-dev-proxy.mjs';

// Development gateway only: the application backend remains the deployed Render service.
const port = 3100;
const host = '127.0.0.1';
const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(frontendDir);
const upstream = new URL('https://physiquequest-api.onrender.com');
const trustedOrigin = 'https://physiquequest-web.onrender.com';
process.env.NEXT_PUBLIC_API_URL = '';
process.env.NEXT_PUBLIC_PQ_ADMIN_GATEWAY = '1';
process.env.NEXT_DEV_DIST_DIR = '.next-admin-dev';

let handler;
const server = http.createServer((req,res) => {
  const rawUrl = req.url ?? '/';
  const pathname = rawUrl.split('?')[0];
  const apiRequest = pathname === '/ready' || pathname === '/api' || pathname.startsWith('/api/');
  if (!apiRequest) { void handler(req,res); return; }
  const context = {host:req.headers.host, origin:req.headers.origin, method:req.method, fetchSite:req.headers['sec-fetch-site']};
  if (pathname.includes('%') || pathname.includes('..') || !allowedLocalRequest(context,port) || !allowedBackendPath(req.method,pathname)) {
    res.writeHead(403,{'Content-Type':'application/json','Cache-Control':'no-store'});
    res.end(JSON.stringify({message:'This request is not available through the local admin gateway.'}));
    return;
  }
  const outgoing = https.request({protocol:'https:',hostname:upstream.hostname,port:443,path:rawUrl,method:req.method,headers:upstreamHeaders(req.headers,trustedOrigin),timeout:120000}, response => {
    const headers = {...response.headers, 'cache-control':'no-store'};
    const cookies = isolatedCookies(response.headers['set-cookie']);
    if (cookies.length) headers['set-cookie'] = cookies; else delete headers['set-cookie'];
    res.writeHead(response.statusCode ?? 502,headers);
    response.pipe(res);
  });
  outgoing.on('timeout',()=>outgoing.destroy());
  outgoing.on('error',()=>{
    if (!res.headersSent) res.writeHead(502,{'Content-Type':'application/json','Cache-Control':'no-store'});
    res.end(JSON.stringify({message:'The deployed PhysiqueQuest API is unavailable. Please try again.'}));
  });
  req.pipe(outgoing);
});
const app = next({dev:true,dir:frontendDir,hostname:host,port,httpServer:server});
handler = app.getRequestHandler();
server.on('upgrade',(req,socket,head)=>{void app.getUpgradeHandler()(req,socket,head);});
await app.prepare();
server.listen(port,host,()=>console.log(`PhysiqueQuest admin: http://${host}:${port}/admin`));
