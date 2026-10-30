// Primitives d'authentification, sans dépendance externe et compatibles Edge
// (middleware) comme Node (server actions) : tout passe par Web Crypto.
//
//  - Mots de passe : PBKDF2-SHA256 (sel aléatoire par utilisateur).
//  - Session : jeton signé HMAC-SHA256 « corps.signature » posé en cookie
//    httpOnly. Le corps porte l'id, le rôle, le nom et l'expiration → le
//    middleware valide sans requête base.
//
// Secret de signature : variable AUTH_SECRET si définie, sinon dérivé de
// DATABASE_URL (toujours présente) pour que ça fonctionne sans configuration.
// Recommandé : définir un AUTH_SECRET dédié dans Vercel.

const enc = new TextEncoder();
const dec = new TextDecoder();

export const COOKIE_SESSION = "ash_session";
export const DUREE_SESSION_MS = 60 * 60 * 24 * 30 * 1000; // 30 jours

// Étape intermédiaire de la double authentification (2FA) : après le mot de
// passe validé, on pose un cookie « pré-auth » court le temps de saisir le code
// reçu par e-mail. Le cookie « appareil de confiance » évite de renvoyer un code
// à chaque connexion depuis un poste déjà vérifié.
export const COOKIE_PREAUTH = "ash_preauth";
export const COOKIE_TRUST = "ash_trust";
export const DUREE_PREAUTH_MS = 10 * 60 * 1000; // 10 minutes
export const DUREE_TRUST_MS = 60 * 60 * 24 * 30 * 1000; // 30 jours

const ITERATIONS = 100_000;

export type Role = "admin" | "operateur";
export type SessionPayload = {
  uid: number;
  role: Role;
  nom: string;
  exp: number; // timestamp ms
};

function secretAuth(): string {
  return process.env.AUTH_SECRET || `ash::${process.env.DATABASE_URL || "dev"}`;
}

/* --- Encodages -------------------------------------------------------- */

function bytesToHex(b: Uint8Array): string {
  let s = "";
  for (const x of b) s += x.toString(16).padStart(2, "0");
  return s;
}
function hexToBytes(h: string): Uint8Array {
  const a = new Uint8Array(h.length / 2);
  for (let i = 0; i < a.length; i++) a[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return a;
}
function b64urlFromBytes(b: Uint8Array): string {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function bytesFromB64url(s: string): Uint8Array {
  let t = s.replace(/-/g, "+").replace(/_/g, "/");
  while (t.length % 4) t += "=";
  const bin = atob(t);
  const b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  return b;
}
const b64urlFromString = (s: string) => b64urlFromBytes(enc.encode(s));
const stringFromB64url = (s: string) => dec.decode(bytesFromB64url(s));

/* --- Mots de passe ---------------------------------------------------- */

async function pbkdf2Hex(mdp: string, selHex: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(mdp), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: hexToBytes(selHex) as BufferSource, iterations: ITERATIONS, hash: "SHA-256" },
    key,
    256
  );
  return bytesToHex(new Uint8Array(bits));
}

export async function hacherMotDePasse(mdp: string): Promise<{ sel: string; hash: string }> {
  const sel = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
  const hash = await pbkdf2Hex(mdp, sel);
  return { sel, hash };
}

export async function verifierMotDePasse(mdp: string, sel: string, hash: string): Promise<boolean> {
  if (!sel || !hash) return false;
  const calcule = await pbkdf2Hex(mdp, sel);
  return egaliteConstante(calcule, hash);
}

// Comparaison à temps constant (évite les attaques temporelles sur le hash).
export function egaliteConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/* --- Session (jeton signé) -------------------------------------------- */

async function cleHmac(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secretAuth()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function signerSession(p: SessionPayload): Promise<string> {
  const body = b64urlFromString(JSON.stringify(p));
  const sig = await crypto.subtle.sign("HMAC", await cleHmac(), enc.encode(body));
  return `${body}.${b64urlFromBytes(new Uint8Array(sig))}`;
}

export async function verifierSession(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  try {
    const ok = await crypto.subtle.verify(
      "HMAC",
      await cleHmac(),
      bytesFromB64url(sig) as BufferSource,
      enc.encode(body) as BufferSource
    );
    if (!ok) return null;
    const p = JSON.parse(stringFromB64url(body)) as SessionPayload;
    if (!p || typeof p.exp !== "number" || Date.now() > p.exp) return null;
    if (p.role !== "admin" && p.role !== "operateur") return null;
    return p;
  } catch {
    return null;
  }
}

/* --- Jetons signés génériques (2FA, appareil de confiance) ------------- */

// Enveloppe « corps.signature » pour de petits jetons signés hors session : le
// pré-auth 2FA (uid+role+nom+exp) et l'appareil de confiance (uid+exp). La
// vérification contrôle la signature puis, si présent, le champ `exp` (ms).
export async function signerEnveloppe(obj: Record<string, unknown>): Promise<string> {
  const body = b64urlFromString(JSON.stringify(obj));
  const sig = await crypto.subtle.sign("HMAC", await cleHmac(), enc.encode(body));
  return `${body}.${b64urlFromBytes(new Uint8Array(sig))}`;
}

export async function verifierEnveloppe<T extends { exp?: number }>(
  token: string | undefined | null
): Promise<T | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  try {
    const ok = await crypto.subtle.verify(
      "HMAC",
      await cleHmac(),
      bytesFromB64url(sig) as BufferSource,
      enc.encode(body) as BufferSource
    );
    if (!ok) return null;
    const p = JSON.parse(stringFromB64url(body)) as T;
    if (p && typeof p.exp === "number" && Date.now() > p.exp) return null;
    return p;
  } catch {
    return null;
  }
}

/* --- Codes 2FA & jetons d'invitation ---------------------------------- */

// Code numérique à 6 chiffres (tirage uniforme), envoyé par e-mail.
export function genererCode6(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return n.toString().padStart(6, "0");
}

// Jeton d'URL non devinable (32 octets aléatoires en hexadécimal) pour les
// liens d'activation. On ne stocke que son empreinte SHA-256 en base.
export function genererJetonUrl(): string {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
}

export async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", enc.encode(s));
  return bytesToHex(new Uint8Array(d));
}
