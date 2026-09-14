import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import handler from '../netlify/functions/analyze-listing.mts';
const root=path.resolve('dist');
createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1:5199');
  if(url.pathname==='/.netlify/functions/analyze-listing'){
   const chunks=[];for await(const c of req)chunks.push(c);
   const response=await handler(new Request(url,{method:req.method,headers:{'content-type':'application/json'},body:req.method==='POST'?Buffer.concat(chunks):undefined}));
   res.writeHead(response.status,{'content-type':'application/json'});res.end(await response.text());return;
  }
  const rel=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));let file=path.resolve(root,rel);
  if(!file.startsWith(root+path.sep)&&file!==root)throw new Error();
  let body;try{body=await readFile(file);}catch{file=path.join(root,'index.html');body=await readFile(file);}
  const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json'}[path.extname(file)]??'application/octet-stream';
  res.writeHead(200,{'content-type':mime});res.end(body);
 }catch(e){res.writeHead(500);res.end(String(e));}
}).listen(5199,'127.0.0.1',()=>console.log('QA server http://127.0.0.1:5199'));
