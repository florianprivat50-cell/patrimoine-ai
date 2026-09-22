import { validAccount, emptyAccount } from '../../../src/lib/accountData';
import type { AccountData } from '../../../src/lib/accountData';

export interface AccountRepository {
  getWithMetadata(key:string, options:{type:'json'}):Promise<{data:any;etag?:string}|null>;
  setJSON(key:string, data:unknown, options:{onlyIfNew:true}|{onlyIfMatch:string}):Promise<{modified:boolean;etag?:string}>;
}
export function accountHandler(authenticate:()=>Promise<{id:string;confirmedAt?:string}|null>, repository:()=>AccountRepository) {
 return async (req:Request):Promise<Response> => {
  const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Netlify-CDN-Cache-Control':'no-store','Vary':'Cookie, X-Account-Id','X-Content-Type-Options':'nosniff'}});
  try {
   if(!['GET','PUT'].includes(req.method))return reply({error:'Méthode non autorisée.'},405);
   if(req.method==='PUT' && req.headers.get('origin')!==new URL(req.url).origin)return reply({error:'Origine non autorisée.'},403);
   const user=await authenticate();
   if(!user || !/^[a-zA-Z0-9_-]{1,200}$/.test(user.id))return reply({error:'Reconnectez-vous à votre compte.'},401);
   if(!user.confirmedAt)return reply({error:'Confirmez votre adresse e-mail avant d’accéder à votre espace.'},403);
   // This header is a session-race guard, never a source of authorization or a storage key.
   if(req.headers.get('x-account-id')!==user.id)return reply({error:'La session a changé. Reconnectez-vous à votre compte.'},401);
   const store=repository(),key=`users/${user.id}/workspace-v1`;
   if(req.method==='GET') {
    const record=await store.getWithMetadata(key,{type:'json'});
    if(record&&(!record.etag||!validAccount(record.data?.data)))throw new Error('Invalid stored account');
    return reply({userId:user.id,data:record?.data.data??emptyAccount(),revision:record?.etag??null,updatedAt:record?.data.updatedAt??null});
   }
   if(!req.headers.get('content-type')?.startsWith('application/json'))return reply({error:'Format JSON requis.'},415);
   const reader=req.body?.getReader();let size=0;const chunks:Uint8Array[]=[];
   if(!reader)return reply({error:'Données manquantes.'},400);
   while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2_000_000){await reader.cancel();return reply({error:'Votre espace dépasse la limite de 2 Mo. Exportez et archivez des dossiers.'},413);}chunks.push(value);}
   const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
   let body:{data:AccountData;revision:string|null};try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{return reply({error:'Document invalide.'},400);}
   if(!body||!validAccount(body.data)||(body.revision!==null&&(typeof body.revision!=='string'||body.revision.length>200)))return reply({error:'Document de compte invalide.'},400);
   const updatedAt=new Date().toISOString();
   // Atomic precondition: two devices cannot silently overwrite the same revision.
   const result=await store.setJSON(key,{data:body.data,updatedAt},body.revision===null?{onlyIfNew:true}:{onlyIfMatch:body.revision});
   if(!result.modified)return reply({error:'Votre compte a été modifié sur un autre appareil.'},409);
   if(!result.etag)throw new Error('Missing write acknowledgement');
   return reply({userId:user.id,revision:result.etag,updatedAt});
  }catch{return reply({error:'Sauvegarde indisponible. Vos modifications restent en attente sur cet appareil.'},503);}
 };
}
