import { NextResponse } from "next/server";

import { consentUrl } from "@/lib/google-calendar";

export const dynamic = "force-dynamic";

// Démarre le flux OAuth : redirige vers l'écran de consentement Google.
// À ouvrir une seule fois (connecté à l'ERP) pour autoriser l'accès agenda.
export function GET() {
  try {
    return NextResponse.redirect(consentUrl());
  } catch (e) {
    return new NextResponse(
      `Configuration Google incomplète : ${(e as Error).message}`,
      { status: 500 }
    );
  }
}
