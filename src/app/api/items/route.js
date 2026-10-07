import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { itemsCollection } from '@/lib/mongodb';
import { deleteImage, signedImageUrl } from '@/lib/imagekit';

const starterItems = [
  { id: 'rice', name: 'Basmati Rice', unit: 'kg', history: [145, 140, 135] },
  { id: 'oil', name: 'Sunflower Oil', unit: 'litre', history: [168, 165, 160] },
  { id: 'biscuits', name: 'Butter Biscuits', unit: 'packet', history: [35, 30] }
];

function authorized(request) { 
  try { 
    const value = request.headers.get('authorization') || ''; 
    return value.startsWith('Bearer ') && jwt.verify(value.slice(7), process.env.AUTH_SECRET || 'fallback-secret'); 
  } catch { 
    return false; 
  } 
}

export async function GET(request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  
  const collection = await itemsCollection();
  
  if (await collection.countDocuments() === 0) {
    await collection.insertMany(starterItems);
  }
  
  const items = await collection.find({}, { projection: { _id: 0 } }).sort({ name: 1 }).toArray();
  
  return NextResponse.json(items.map(item => ({
    ...item,
    images: (item.images || []).map(image => ({
      ...image,
      signedUrl: signedImageUrl(image.filePath, image.url)
    }))
  })));
}

export async function POST(request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  
  const collection = await itemsCollection();
  const body = await request.json();
  const { name, unit, history, images = [] } = body;
  
  if (!name || !unit || !Array.isArray(history) || !Array.isArray(images) || images.length > 3) {
    return NextResponse.json({ error: 'Invalid item' }, { status: 400 });
  }
  
  const item = {
    id: randomUUID(),
    name: name.trim(),
    unit,
    history: history.slice(0, 3),
    images: images.map(({ fileId, filePath, name, url }) => ({ fileId, filePath, name, url }))
  };
  
  await collection.insertOne(item);
  return NextResponse.json(item, { status: 201 });
}

export async function PUT(request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
  
  const collection = await itemsCollection();
  const body = await request.json();
  const { name, unit, history, images = [], removedImageIds = [] } = body;
  
  if (!name || !unit || !Array.isArray(history) || !Array.isArray(images) || images.length > 3) {
    return NextResponse.json({ error: 'Invalid item' }, { status: 400 });
  }
  
  await collection.updateOne(
    { id },
    { $set: {
        name: name.trim(),
        unit,
        history: history.slice(0, 3),
        images: images.map(({ fileId, filePath, name, url }) => ({ fileId, filePath, name, url }))
      }
    }
  );
  
  await Promise.all(removedImageIds.map(deleteImage));
  return NextResponse.json({ ok: true });
}

export async function DELETE(request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
  
  const collection = await itemsCollection();
  const item = await collection.findOneAndDelete({ id });
  
  if (item && item.images) {
    await Promise.all(item.images.map(image => deleteImage(image.fileId)));
  }
  
  return new NextResponse(null, { status: 204 });
}
