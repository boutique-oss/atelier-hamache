"use client";

// Bouton d'impression réutilisable (documents A4). Déclenche la boîte
// d'impression du navigateur → « Enregistrer au format PDF ».
export function PrintButton({
  className,
  label = "Télécharger / Imprimer",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <button className={className} onClick={() => window.print()}>
      {label}
    </button>
  );
}
