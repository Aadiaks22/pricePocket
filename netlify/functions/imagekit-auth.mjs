import jwt from 'jsonwebtoken';
import { uploadCredentials } from '../../lib/imagekit.js';

function authorized(request) { try { const value=request.headers.get('authorization')||''; return value.startsWith('Bearer ') && jwt.verify(value.slice(7),process.env.AUTH_SECRET); } catch { return false; } }
export default async request => {
  if (!authorized(request)) return Response.json({error:'Please sign in.'},{status:401});
  if (!process.env.IMAGEKIT_PRIVATE_KEY || !process.env.IMAGEKIT_PUBLIC_KEY) return Response.json({error:'Image upload is not configured.'},{status:503});
  return Response.json(uploadCredentials());
};
