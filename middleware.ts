import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getParamsSecurite } from "@/lib/securite";
import { COOKIE_SESSION, verifierSession } from "@/lib/auth";

// Adresse IP publique du client vue par Vercel. En prod, `x-forwarded-for`
// contient l'IP réelle (premier élément) ; `req.ip` sert de secours.
function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.ip ?? "";
}

// Porte d'entrée à deux couches. Réglages lus en base (table
// parametres_securite, éditable dans Admin › Sécurité) avec repli sur les
// variables Vercel — voir lib/securite.ts.
//  1) Réseau  — seules les IP publiques autorisées passent (ex. le wifi de
//     l'atelier). Liste vide => aucune restriction réseau.
//  2) Identité — cookie de session signé (voir lib/auth.ts). L'app est protégée
//     dès qu'un code d'accès OU un compte actif existe.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // On expose le chemin courant pour que le layout sache masquer la
  // barre latérale sur la page de connexion.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", pathname);
  const pass = () => NextResponse.next({ request: { headers: requestHeaders } });

  const { codeAcces, ipsAutorisees, aUtilisateursActifs } = await getParamsSecurite();

  // --- Couche 1 : restriction réseau ---------------------------------
  // Deux garde-fous anti-verrouillage :
  //  - ALLOWED_IPS_OFF=1 (variable Vercel) désactive complètement le filtrage
  //    réseau : interrupteur d'urgence pour se débloquer si on s'est exclu.
  //  - Les IP de la variable Vercel ALLOWED_IPS sont TOUJOURS autorisées, en
  //    plus de la liste éditée dans l'app — échappatoire que l'interface ne
  //    peut pas retirer.
  if (process.env.ALLOWED_IPS_OFF !== "1") {
    const ipsEnv = (process.env.ALLOWED_IPS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const liste = Array.from(new Set([...ipsAutorisees, ...ipsEnv]));
    if (liste.length > 0) {
      const ip = clientIp(req);
      if (!liste.includes(ip)) {
        const url = req.nextUrl.clone();
        url.pathname = "/hors-reseau";
        return NextResponse.rewrite(url); // garde l'URL, sert la page de blocage
      }
    }
  }

  // --- Couche 2 : identité -------------------------------------------
  const protege = Boolean(codeAcces) || aUtilisateursActifs;
  if (!protege) return pass(); // rien de configuré -> accès libre
  // Pages joignables sans session : connexion, étape de vérification 2FA
  // (/login/verification) et activation d'un compte invité (/activer).
  if (pathname === "/login" || pathname.startsWith("/login/") || pathname === "/activer") {
    return pass();
  }

  const session = await verifierSession(req.cookies.get(COOKIE_SESSION)?.value);
  if (session) return pass();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  // Tout est protégé sauf : assets statiques Next, favicon, métadonnées PWA
  // (manifeste + icônes), la page publique « hors réseau », le résumé du
  // widget Rainmeter (/api/rainmeter, protégé par son propre jeton).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon|apple-icon|hors-reseau|api/rainmeter).*)",
  ],
};
