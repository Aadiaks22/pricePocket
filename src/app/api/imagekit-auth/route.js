import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';
import { uploadCredentials } from '@/lib/imagekit';

function authorized(request) { 
  try { 
    const value = request.headers.get('authorization') || ''; 
    return value.startsWith('Bearer ') && jwt.verify(value.slice(7), process.env.AUTH_SECRET || 'fallback-secret'); 
  } catch { 
    return false; 
  } 
}

export async function GET(request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  }
  
  if (!process.env.IMAGEKIT_PRIVATE_KEY || !process.env.IMAGEKIT_PUBLIC_KEY) {
    return NextResponse.json({ error: 'Image upload is not configured.' }, { status: 503 });
  }
  
  return NextResponse.json(uploadCredentials());
}
