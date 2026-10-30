import { DocumentsExplorateur } from "@/components/documents-explorateur";
import { arbreDossier } from "@/lib/documents-arbre";
import { estAdmin } from "@/lib/session";

// Charge l'arborescence d'un dossier client et l'affiche. Composant serveur
// partagé entre la page /documents et la section Documents de la fiche
// dossier. Une erreur de lecture n'empêche pas le reste de la page de
// s'afficher.
export async function DocumentsDossier({ dossierId }: { dossierId: number }) {
  const [arbre, admin] = await Promise.all([
    arbreDossier(dossierId).catch((e) => {
      console.error("Documents du dossier", dossierId, e);
      return null;
    }),
    estAdmin(),
  ]);

  if (!arbre) {
    return (
      <p role="alert" className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
        Les documents de ce dossier n&apos;ont pas pu être chargés. Réessayez dans un instant.
      </p>
    );
  }
  return <DocumentsExplorateur key={dossierId} arbre={arbre} estAdmin={admin} />;
}
