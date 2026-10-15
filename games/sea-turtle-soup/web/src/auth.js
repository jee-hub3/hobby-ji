// 로그인 없는 베타: 기기마다 무작위 ID를 서명된 쿠키로 준다. 결제를 붙일 때 계정이 이 ID를 이어받는다.

const COOKIE = 'sts';
const enc = new TextEncoder();

function b64url(buf) {
  let s = '';
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmac(secret, text) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(text)));
}

export async function sha256hex(text) {
  const d = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export function randomId(bytes = 16) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return b64url(a);
}

function readCookie(req, name) {
  const raw = req.headers.get('Cookie') || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

/** Returns {deviceId, setCookie|null}. A missing or forged cookie gets a fresh device. */
export async function deviceFrom(req, env) {
  const secret = env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET is not set');
  const raw = readCookie(req, COOKIE);
  if (raw) {
    const dot = raw.lastIndexOf('.');
    if (dot > 0) {
      const id = raw.slice(0, dot);
      if (/^[A-Za-z0-9_-]{16,64}$/.test(id) && (await hmac(secret, id)) === raw.slice(dot + 1)) return { deviceId: id, setCookie: null, fresh: false };
    }
  }
  const id = randomId();
  const value = `${id}.${await hmac(secret, id)}`;
  const secure = new URL(req.url).protocol === 'https:' ? '; Secure' : '';
  return { deviceId: id, setCookie: `${COOKIE}=${value}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax${secure}`, fresh: true };
}
