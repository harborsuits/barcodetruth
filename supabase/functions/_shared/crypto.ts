// Crypto utilities for encrypting/decrypting sensitive data
const dec = new TextDecoder();
const enc = new TextEncoder();

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToHex(u8: Uint8Array): string {
  return [...u8].map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

async function importKey(): Promise<CryptoKey> {
  const k = Deno.env.get('PUSH_ENC_KEY');
  if (!k) throw new Error('Missing PUSH_ENC_KEY');
  const raw = b64ToBytes(k);
  // Pass Uint8Array directly as BufferSource
  return crypto.subtle.importKey('raw', raw as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

/** 
 * Encrypts utf8 string to versioned hex format
 * Format: "v1:" + HEX( [12-byte IV][ciphertext] )
 */
export async function seal(plain: string): Promise<string> {
  const key = await importKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plain));
  const payload = new Uint8Array(iv.length + ct.byteLength);
  payload.set(iv, 0);
  payload.set(new Uint8Array(ct), iv.length);
  return `v1:${bytesToHex(payload)}`;
}

/** 
 * Decrypts versioned hex payload back to utf8 string 
 */
export async function open(sealed: string): Promise<string> {
  if (!sealed?.startsWith('v1:')) throw new Error('Unknown ciphertext version');
  const key = await importKey();
  const hex = sealed.slice(3);
  const buf = hexToBytes(hex);
  const iv = buf.slice(0, 12);
  const data = buf.slice(12);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return dec.decode(pt);
}

/** 
 * Convert sealed hex format to PostgreSQL bytea hex literal 
 */
export function toByteaLiteral(sealed: string): string {
  if (!sealed?.startsWith('v1:')) throw new Error('Unknown ciphertext version');
  return `\\x${sealed.slice(3)}`;
}

/** 
 * Convert sealed hex to base64 text for easier storage/retrieval
 * Format: "v1:BASE64(iv+ct)" instead of "v1:HEX(iv+ct)"
 */
export function toBase64Text(sealed: string): string {
  if (!sealed?.startsWith('v1:')) throw new Error('Unknown ciphertext version');
  const hex = sealed.slice(3);
  const bytes = hexToBytes(hex);
  const b64 = btoa(String.fromCharCode(...bytes));
  return `v1:${b64}`;
}

/** 
 * Convert base64 text back to sealed format for decryption
 */
export function fromBase64Text(b64Text: string | null): string | null {
  if (!b64Text?.startsWith('v1:')) return null;
  try {
    const b64 = b64Text.slice(3);
    const bytes = b64ToBytes(b64);
    return `v1:${bytesToHex(bytes)}`;
  } catch (e) {
    console.error('Failed to convert base64 text to sealed format:', e);
    return null;
  }
}

/** 
 * Convert PostgreSQL bytea (returned as base64 from Supabase) to sealed format 
 */
export function fromByteaToSealed(b: string | null): string | null {
  if (!b) return null;
  // Supabase returns bytea as base64 by default
  try {
    const bytes = b64ToBytes(b);
    return `v1:${bytesToHex(bytes)}`;
  } catch (e) {
    console.error('Failed to convert bytea to sealed format:', e);
    return null;
  }
}
