import jwt from 'jsonwebtoken';

export default async (request) => {
  if (request.method !== 'POST') return new Response(null, {status:405});
  const {email, password} = await request.json().catch(() => ({}));
  const users = JSON.parse(process.env.STAFF_USERS || '{}');
  if (!email || users[email.toLowerCase()] !== password) return Response.json({error:'Invalid credentials'}, {status:401});
  const token = jwt.sign({email:email.toLowerCase()}, process.env.AUTH_SECRET, {expiresIn:'7d'});
  return Response.json({token});
};
