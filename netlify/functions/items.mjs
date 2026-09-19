import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { itemsCollection } from '../../lib/mongodb.js';
import { deleteImage, signedImageUrl } from '../../lib/imagekit.js';

const starterItems = [{id:'rice',name:'Basmati Rice',unit:'kg',history:[145,140,135]},{id:'oil',name:'Sunflower Oil',unit:'litre',history:[168,165,160]},{id:'biscuits',name:'Butter Biscuits',unit:'packet',history:[35,30]}];
function authorized(request) { try { const value = request.headers.get('authorization') || ''; return value.startsWith('Bearer ') && jwt.verify(value.slice(7), process.env.AUTH_SECRET); } catch { return false; } }
export default async (request) => {
  if (!authorized(request)) return Response.json({error:'Please sign in.'}, {status:401});
  const collection = await itemsCollection(), id = new URL(request.url).searchParams.get('id');
  if (request.method === 'GET') { if (await collection.countDocuments() === 0) await collection.insertMany(starterItems); const items = await collection.find({}, {projection:{_id:0}}).sort({name:1}).toArray(); return Response.json(items.map(item=>({...item,images:(item.images||[]).map(image=>({...image,signedUrl:signedImageUrl(image.filePath,image.url)}))}))); }
  if (request.method === 'POST') { const {name,unit,history,images=[]} = await request.json(); if (!name || !unit || !Array.isArray(history) || !Array.isArray(images) || images.length>3) return Response.json({error:'Invalid item'}, {status:400}); const item = {id:randomUUID(), name:name.trim(), unit, history:history.slice(0,3), images:images.map(({fileId,filePath,name,url})=>({fileId,filePath,name,url}))}; await collection.insertOne(item); return Response.json(item, {status:201}); }
  if (request.method === 'PUT' && id) { const {name,unit,history,images=[],removedImageIds=[]} = await request.json(); if (!name || !unit || !Array.isArray(history) || !Array.isArray(images) || images.length>3) return Response.json({error:'Invalid item'}, {status:400}); await collection.updateOne({id}, {$set:{name:name.trim(),unit,history:history.slice(0,3),images:images.map(({fileId,filePath,name,url})=>({fileId,filePath,name,url}))}}); await Promise.all(removedImageIds.map(deleteImage)); return Response.json({ok:true}); }
  if (request.method === 'DELETE' && id) { const item=await collection.findOneAndDelete({id}); await Promise.all((item?.images||[]).map(image=>deleteImage(image.fileId))); return new Response(null, {status:204}); }
  return new Response(null, {status:405});
};
