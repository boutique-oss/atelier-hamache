export const metadata = {
  title: "Hors réseau — Atelier Stéphan Hamache",
};

// Page servie quand l'IP publique du client n'est pas dans ALLOWED_IPS.
// Volontairement sobre et sans lien vers l'app (aucune donnée exposée).
export default function HorsReseauPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm space-y-3 rounded-lg border bg-background p-6 text-center shadow-sm">
        <p className="text-base font-bold leading-tight">Accès restreint</p>
        <p className="text-sm text-muted-foreground">
          L&apos;ERP n&apos;est accessible que depuis le réseau de
          l&apos;atelier. Connecte-toi au wifi de l&apos;atelier puis réessaie.
        </p>
      </div>
    </main>
  );
}
