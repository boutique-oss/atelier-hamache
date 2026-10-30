// Squelette affiché pendant le chargement d'une page applicative (requêtes
// base en cours) : l'écran répond tout de suite au clic au lieu de rester figé
// sur la page précédente.
export default function Chargement() {
  return (
    <main className="container mx-auto py-8" aria-busy="true">
      <p className="sr-only" role="status">
        Chargement…
      </p>
      <div className="animate-pulse space-y-6 motion-reduce:animate-none" aria-hidden>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-muted" />
          <div className="h-7 w-56 rounded-md bg-muted" />
        </div>
        <div className="space-y-2 rounded-lg border p-4">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-5 rounded bg-muted" style={{ width: `${92 - i * 9}%` }} />
          ))}
        </div>
      </div>
    </main>
  );
}
