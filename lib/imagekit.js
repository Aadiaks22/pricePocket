import crypto from 'crypto';

export function signedImageUrl(filePath, sourceUrl, expiresIn = 900) {
  const relativePath = String(filePath || '');
  const uploadedEndpoint = sourceUrl && relativePath ? sourceUrl.slice(0, sourceUrl.indexOf(relativePath)) : '';
  const endpoint = (process.env.IMAGEKIT_URL_ENDPOINT || uploadedEndpoint).replace(/\/$/, '');
  if (!endpoint) return null;
  const path = relativePath.replace(/^\//, '');
  const expiry = Math.floor(Date.now() / 1000) + expiresIn;
  const signature = crypto.createHmac('sha1', process.env.IMAGEKIT_PRIVATE_KEY).update(`${path}${expiry}`).digest('hex');
  return `${endpoint}/${path}?ik-t=${expiry}&ik-s=${signature}`;
}
export function uploadCredentials() {
  const token = crypto.randomUUID(), expire = Math.floor(Date.now() / 1000) + 600;
  const signature = crypto.createHmac('sha1', process.env.IMAGEKIT_PRIVATE_KEY).update(`${token}${expire}`).digest('hex');
  return {token, expire, signature, publicKey:process.env.IMAGEKIT_PUBLIC_KEY};
}
export async function deleteImage(fileId) {
  if (!fileId) return;
  const key = Buffer.from(`${process.env.IMAGEKIT_PRIVATE_KEY}:`).toString('base64');
  await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(fileId)}`, {method:'DELETE', headers:{Authorization:`Basic ${key}`}});
}
