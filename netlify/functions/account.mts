import { getUser } from '@netlify/identity';
import { getStore, getDeployStore } from '@netlify/blobs';
import type { Context } from '@netlify/functions';
import { accountHandler } from './_shared/account';

export default async (req:Request, context:Context) => accountHandler(getUser,()=>{
  // Preview deployments must never share the production account collection.
  return context.deploy.context==='production'
    ? getStore({name:'patrimoine-accounts-v1',consistency:'strong'})
    : getDeployStore({name:'patrimoine-accounts-v1',consistency:'strong'});
})(req);
