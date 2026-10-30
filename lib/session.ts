// Accès à l'utilisateur courant côté serveur (Server Components / Server
// Actions). Séparé de lib/auth.ts pour que le middleware n'importe jamais
// next/headers (interdit dans le bundle Edge du middleware).
import { cookies } from "next/headers";

import { COOKIE_SESSION, verifierSession, type SessionPayload } from "@/lib/auth";

export async function utilisateurCourant(): Promise<SessionPayload | null> {
  return verifierSession(cookies().get(COOKIE_SESSION)?.value);
}

export async function estAdmin(): Promise<boolean> {
  const u = await utilisateurCourant();
  return u?.role === "admin";
}
