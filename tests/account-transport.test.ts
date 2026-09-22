import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountTransport } from '../src/lib/accountTransport';
import { emptyAccount } from '../src/lib/accountData';
import { accountHandler, type AccountRepository } from '../netlify/functions/_shared/account';

const envelope = (userId='alice') => ({userId,data:emptyAccount(),revision:null,updatedAt:null});
const deferred = () => {let resolve!:()=>void;const promise=new Promise<void>(r=>{resolve=r;});return {promise,resolve};};

test('changing account during token refresh never sends the previous account data', async()=>{
  let current={userId:'alice',generation:1},calls=0;const gate=deferred();
  const request=accountTransport(()=>current,()=>gate.promise,async()=>{calls++;return Response.json(envelope());});
  const result=request('PUT',{data:emptyAccount(),revision:null});
  current={userId:'bob',generation:2};gate.resolve();
  await assert.rejects(result,{status:401});assert.equal(calls,0);
});

test('a late response from a previous session cannot hydrate the current session',async()=>{
  let current={userId:'alice',generation:1};const gate=deferred(),sent=deferred();
  const request=accountTransport(()=>current,async()=>{},async()=>{sent.resolve();await gate.promise;return Response.json(envelope());});
  const result=request();await sent.promise;current={userId:'bob',generation:2};gate.resolve();
  await assert.rejects(result,{status:401});
});

test('HTML fallback, incomplete write acknowledgement and foreign responses never count as saved',async()=>{
  const responses=[new Response('<html>SPA fallback</html>',{headers:{'content-type':'text/html'}}),Response.json(envelope()),Response.json(envelope('bob'))];
  for(const response of responses){const request=accountTransport(()=>({userId:'alice',generation:1}),async()=>{},async()=>response);await assert.rejects(request('PUT',{}));}
});

test('transport preserves the server conflict and binds its requests to the expected owner',async()=>{
  const request=accountTransport(()=>({userId:'alice',generation:1}),async()=>{},async(_,options)=>{
    assert.equal(new Headers(options?.headers).get('x-account-id'),'alice');
    assert.equal(options?.credentials,'same-origin');assert.equal(options?.cache,'no-store');
    return Response.json({error:'Conflit'},{status:409});
  });
  await assert.rejects(request('PUT',{}),{status:409,message:'Conflit'});
});

test('two device transports restore saved data, reject stale writes and keep a second user empty',async()=>{
  const records=new Map<string,any>();let version=0;
  const store:AccountRepository={
    async getWithMetadata(key){return records.get(key)??null;},
    async setJSON(key,data,options){const old=records.get(key);if(('onlyIfNew'in options&&old)||('onlyIfMatch'in options&&options.onlyIfMatch!==old?.etag))return {modified:false};const etag=String(++version);records.set(key,{data,etag});return {modified:true,etag};}
  };
  const device=(id:string)=>accountTransport(()=>({userId:id,generation:1}),async()=>{},async(_,options)=>{
    const headers=new Headers(options?.headers);headers.set('origin','https://app.example');
    return accountHandler(async()=>({id,confirmedAt:'2026-09-22T00:00:00Z'}),()=>store)(new Request('https://app.example/.netlify/functions/account',{...options,headers}));
  });
  const phone=device('alice'),computer=device('alice'),bob=device('bob');
  const data=emptyAccount();data.profile={firstName:'Private profile'} as any;
  const first=await phone();const saved=await phone('PUT',{data,revision:first.revision});
  assert.equal((await computer()).data.profile?.firstName,'Private profile');
  assert.equal((await bob()).data.profile,null);
  const changed={...data,profile:{firstName:'Computer edit'}};
  await computer('PUT',{data:changed,revision:saved.revision});
  await assert.rejects(phone('PUT',{data,revision:saved.revision}),{status:409});
  assert.equal((await phone()).data.profile?.firstName,'Computer edit');
});
