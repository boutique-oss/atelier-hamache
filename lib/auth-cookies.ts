// Pose du cookie de session signé. Isolé ici pour être réutilisé par la
// connexion (app/login), la vérification 2FA et l'activation de compte
// (app/activer) sans dupliquer les options du cookie. À n'appeler que depuis une
// Server Action ou un Route Handler (écriture de cookie autorisée uniquement là).
import { cookies } from "next/headers";

import { COOKIE_SESSION, DUREE_SESSION_MS, signerSession, type Role } from "@/lib/auth";

export async function poserSession(base: { uid: number; role: Role; nom: string }) {
  const token = await signerSession({ ...base, exp: Date.now() + DUREE_SESSION_MS });
  cookies().set(COOKIE_SESSION, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(DUREE_SESSION_MS / 1000),
  });
}
