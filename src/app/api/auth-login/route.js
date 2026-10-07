import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { email, password } = await request.json().catch(() => ({}));
    const users = JSON.parse(process.env.STAFF_USERS || '{}');
    
    if (!email || users[email.toLowerCase()] !== password) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    
    const token = jwt.sign(
      { email: email.toLowerCase() }, 
      process.env.AUTH_SECRET || 'fallback-secret', 
      { expiresIn: '7d' }
    );
    
    return NextResponse.json({ token });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
