// Envoi d'e-mails via l'API REST de Resend (aucune dépendance : simple fetch,
// cohérent avec le reste du projet). Deux usages : lien d'activation de compte
// (invitation) et code de double authentification (2FA).
//
// Variables Vercel requises pour activer l'envoi :
//   - RESEND_API_KEY : clé API Resend (re_...).
//   - RESEND_FROM    : expéditeur, ex. « Atelier Stéphan Hamache <no-reply@hamachestephan.com> »
//                      (le domaine doit être vérifié dans Resend).
//   - APP_URL (optionnel) : base des liens envoyés. Sinon déduite des en-têtes
//     de la requête courante.
//
// Tant que RESEND_API_KEY / RESEND_FROM sont absents, mailConfigure() renvoie
// false : la 2FA est contournée et l'invitation refusée proprement — rien ne
// casse avant l'activation côté Vercel.
import { headers } from "next/headers";

export function mailConfigure(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM);
}

// Base absolue pour les liens (activation). Priorité à APP_URL, sinon on
// reconstruit depuis les en-têtes de la requête (host + protocole).
export function lienBase(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, "");
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "";
  const proto = h.get("x-forwarded-proto") || "https";
  return `${proto}://${host}`;
}

async function envoyer(to: string, subject: string, html: string): Promise<boolean> {
  if (!mailConfigure()) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: process.env.RESEND_FROM, to: [to], subject, html }),
      // Pas de mise en cache pour un POST transactionnel.
      cache: "no-store",
    });
    return r.ok;
  } catch {
    return false;
  }
}

/* --- Gabarits ---------------------------------------------------------- */

const cadre = (contenu: string) => `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
    <p style="font-weight:700;font-size:15px;margin:0 0 2px">Atelier Stéphan Hamache</p>
    <p style="font-size:12px;color:#666;margin:0 0 20px">ERP atelier · Poitiers</p>
    ${contenu}
    <p style="font-size:11px;color:#999;margin-top:28px">Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.</p>
  </div>`;

// Lien d'activation d'un compte invité.
export async function envoyerInvitation(email: string, lien: string, nom: string): Promise<boolean> {
  const html = cadre(`
    <p style="font-size:14px">Bonjour ${echapper(nom)},</p>
    <p style="font-size:14px">Un accès à l'ERP de l'atelier a été créé pour vous. Cliquez pour choisir votre mot de passe et activer votre compte :</p>
    <p style="margin:20px 0">
      <a href="${lien}" style="background:#1f3a5f;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;display:inline-block">Activer mon compte</a>
    </p>
    <p style="font-size:12px;color:#666">Ce lien est valable 7 jours. S'il ne fonctionne pas, copiez cette adresse dans votre navigateur :<br><span style="word-break:break-all;color:#1f3a5f">${lien}</span></p>`);
  return envoyer(email, "Activez votre accès — Atelier Stéphan Hamache", html);
}

// Code de connexion à usage unique (2FA).
export async function envoyerCode2FA(email: string, code: string, nom: string): Promise<boolean> {
  const html = cadre(`
    <p style="font-size:14px">Bonjour ${echapper(nom)},</p>
    <p style="font-size:14px">Votre code de connexion :</p>
    <p style="font-size:30px;font-weight:700;letter-spacing:6px;margin:12px 0;color:#1f3a5f">${echapper(code)}</p>
    <p style="font-size:12px;color:#666">Valable 10 minutes. Saisissez-le sur la page de connexion pour terminer votre accès.</p>`);
  return envoyer(email, `Votre code de connexion : ${code}`, html);
}

// Échappement minimal pour insérer une valeur dans le HTML de l'e-mail.
function echapper(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
