import { NextRequest, NextResponse } from "next/server";

import { exchangeCode } from "@/lib/google-calendar";

export const dynamic = "force-dynamic";

// Retour du consentement Google : échange le code contre les jetons et
// AFFICHE le refresh_token une seule fois, pour qu'on le stocke ensuite dans
// la variable Vercel GOOGLE_REFRESH_TOKEN.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const err = req.nextUrl.searchParams.get("error");
  if (err) {
    return html(`<h1>Autorisation refusée</h1><p>${escapeHtml(err)}</p>`);
  }
  if (!code) {
    return html(`<h1>Code manquant</h1><p>Recommence depuis /api/google/auth.</p>`);
  }

  try {
    const tok = await exchangeCode(code);
    if (!tok.refresh_token) {
      return html(
        `<h1>Pas de refresh_token reçu</h1>
         <p>Google n'a pas renvoyé de refresh_token. Va sur
         <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>,
         retire l'accès de cette application, puis relance
         <a href="/api/google/auth">/api/google/auth</a>.</p>`
      );
    }
    return html(
      `<h1>✅ Autorisation réussie</h1>
       <p>Copie ce <strong>refresh_token</strong> et transmets-le pour le
       stocker dans la variable Vercel <code>GOOGLE_REFRESH_TOKEN</code>.
       Cette valeur ne s'affichera plus :</p>
       <textarea readonly rows="4" style="width:100%;font-family:monospace;font-size:13px;padding:8px">${escapeHtml(
         tok.refresh_token
       )}</textarea>`
    );
  } catch (e) {
    return html(`<h1>Erreur</h1><pre>${escapeHtml((e as Error).message)}</pre>`);
  }
}

function html(body: string) {
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
     <body style="max-width:640px;margin:40px auto;font-family:system-ui;padding:0 16px;line-height:1.5">${body}</body>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string)
  );
}
