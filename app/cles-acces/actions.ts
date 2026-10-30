"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";

import { poserSession } from "@/lib/auth-cookies";
import { signerEnveloppe, verifierEnveloppe, type Role } from "@/lib/auth";
import { COOKIE_WEBAUTHN, DUREE_DEFI_MS, ensureClesAcces, partieConfiance } from "@/lib/cles-acces";
import { sql } from "@/lib/raw-sql";
import { getParamsSecurite } from "@/lib/securite";
import { utilisateurCourant } from "@/lib/session";

type Defi = { c: string; but: "creation" | "connexion"; uid?: number; exp: number };

// Le défi (challenge) est gardé dans un cookie signé de 5 minutes : la
// réponse du téléphone doit signer exactement ce défi.
async function poserDefi(d: Omit<Defi, "exp">) {
  const token = await signerEnveloppe({ ...d, exp: Date.now() + DUREE_DEFI_MS });
  cookies().set(COOKIE_WEBAUTHN, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: Math.floor(DUREE_DEFI_MS / 1000),
  });
}

async function lireDefi(but: Defi["but"]): Promise<Defi | null> {
  const d = await verifierEnveloppe<Defi>(cookies().get(COOKIE_WEBAUTHN)?.value);
  cookies().delete(COOKIE_WEBAUTHN); // usage unique
  return d && d.but === but ? d : null;
}

/* --- Création d'une clé (utilisateur connecté) -------------------------- */

export async function optionsCreationCle(): Promise<
  { ok: true; options: PublicKeyCredentialCreationOptionsJSON } | { ok: false; error: string }
> {
  const moi = await utilisateurCourant();
  if (!moi) return { ok: false, error: "Session expirée : reconnectez-vous." };
  await ensureClesAcces();
  const { rpID } = partieConfiance();
  const existantes = await sql`SELECT credential_id, transports FROM cles_acces
    WHERE utilisateur_id IS NOT DISTINCT FROM ${moi.uid > 0 ? moi.uid : null}`;
  const options = await generateRegistrationOptions({
    rpName: "Atelier Stéphan Hamache",
    rpID,
    userName: moi.nom,
    userDisplayName: moi.nom,
    userID: isoBase64URL.toBuffer(isoBase64URL.fromUTF8String(`ash-${moi.uid}`)),
    attestationType: "none",
    excludeCredentials: existantes.map((r) => ({
      id: String(r.credential_id),
      transports: String(r.transports || "").split(",").filter(Boolean) as AuthenticatorTransportFuture[],
    })),
    // Clé « découvrable » : on se connecte sans taper d'identifiant.
    authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
  });
  await poserDefi({ c: options.challenge, but: "creation", uid: moi.uid });
  return { ok: true, options };
}

export async function terminerCreationCle(
  reponse: RegistrationResponseJSON,
  nom: string
): Promise<{ ok: boolean; error?: string }> {
  const moi = await utilisateurCourant();
  if (!moi) return { ok: false, error: "Session expirée : reconnectez-vous." };
  const defi = await lireDefi("creation");
  if (!defi || defi.uid !== moi.uid) return { ok: false, error: "Délai dépassé : recommencez." };
  const { rpID, origin } = partieConfiance();
  try {
    const v = await verifyRegistrationResponse({
      response: reponse,
      expectedChallenge: defi.c,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });
    if (!v.verified || !v.registrationInfo) return { ok: false, error: "Clé refusée." };
    const { credential } = v.registrationInfo;
    await sql`INSERT INTO cles_acces (utilisateur_id, credential_id, cle_publique, compteur, transports, nom)
      VALUES (${moi.uid > 0 ? moi.uid : null}, ${credential.id},
        ${isoBase64URL.fromBuffer(credential.publicKey)}, ${credential.counter},
        ${(credential.transports ?? []).join(",")}, ${String(nom || "").trim().slice(0, 60) || "Téléphone"})
      ON CONFLICT (credential_id) DO NOTHING`;
    revalidatePath("/cles-acces");
    return { ok: true };
  } catch (e) {
    console.error("Création clé d'accès refusée :", (e as Error).message);
    return { ok: false, error: "La clé n'a pas pu être vérifiée. Réessayez." };
  }
}

export async function supprimerCle(id: number): Promise<{ ok: boolean; error?: string }> {
  const moi = await utilisateurCourant();
  if (!moi) return { ok: false, error: "Session expirée : reconnectez-vous." };
  await ensureClesAcces();
  // Ses propres clés ; l'admin peut retirer n'importe laquelle.
  await sql`DELETE FROM cles_acces WHERE id = ${Number(id)}
    AND (${moi.role === "admin"} OR utilisateur_id IS NOT DISTINCT FROM ${moi.uid > 0 ? moi.uid : null})`;
  revalidatePath("/cles-acces");
  return { ok: true };
}

/* --- Connexion par clé (page de connexion, sans session) ---------------- */

export async function optionsConnexionCle(): Promise<
  { ok: true; options: PublicKeyCredentialRequestOptionsJSON } | { ok: false; error: string }
> {
  await ensureClesAcces();
  const { rpID } = partieConfiance();
  // Liste vide : le navigateur propose les clés de ce site, ou le QR code
  // pour utiliser celle du téléphone.
  const options = await generateAuthenticationOptions({ rpID, userVerification: "preferred" });
  await poserDefi({ c: options.challenge, but: "connexion" });
  return { ok: true, options };
}

export async function terminerConnexionCle(
  reponse: AuthenticationResponseJSON
): Promise<{ ok: boolean; error?: string }> {
  const defi = await lireDefi("connexion");
  if (!defi) return { ok: false, error: "Délai dépassé : recommencez." };
  await ensureClesAcces();
  const [cle] = await sql`SELECT id, utilisateur_id, credential_id, cle_publique, compteur, transports
    FROM cles_acces WHERE credential_id = ${String(reponse?.id ?? "")}`;
  if (!cle) return { ok: false, error: "Cette clé n'est pas enregistrée dans l'ERP." };

  const { rpID, origin } = partieConfiance();
  let nouveauCompteur: number;
  try {
    const v = await verifyAuthenticationResponse({
      response: reponse,
      expectedChallenge: defi.c,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
      credential: {
        id: String(cle.credential_id),
        publicKey: isoBase64URL.toBuffer(String(cle.cle_publique)),
        counter: Number(cle.compteur),
        transports: String(cle.transports || "").split(",").filter(Boolean) as AuthenticatorTransportFuture[],
      },
    });
    if (!v.verified) return { ok: false, error: "Clé refusée." };
    nouveauCompteur = v.authenticationInfo.newCounter;
  } catch (e) {
    console.error("Connexion par clé refusée :", (e as Error).message);
    return { ok: false, error: "La clé n'a pas pu être vérifiée." };
  }

  let base: { uid: number; role: Role; nom: string };
  if (cle.utilisateur_id == null) {
    // Clé de l'admin « par code » : valable seulement tant qu'aucun compte
    // admin n'existe (sinon les comptes nominatifs prennent le relais).
    const { aAdminActif } = await getParamsSecurite();
    if (aAdminActif) return { ok: false, error: "Clé du mode sans comptes : créez une clé depuis votre compte." };
    base = { uid: 0, role: "admin", nom: "Admin (code)" };
  } else {
    const [u] = await sql`SELECT id, nom, role, actif FROM utilisateurs WHERE id = ${cle.utilisateur_id}`;
    if (!u || !u.actif) return { ok: false, error: "Compte désactivé ou supprimé." };
    base = { uid: Number(u.id), role: u.role === "admin" ? "admin" : "operateur", nom: String(u.nom) };
  }

  await sql`UPDATE cles_acces SET compteur = ${nouveauCompteur}, derniere_utilisation = now()
    WHERE id = ${cle.id}`;
  // La clé vaut double authentification (téléphone + déverrouillage) : pas
  // de code e-mail en plus.
  await poserSession(base);
  return { ok: true };
}
