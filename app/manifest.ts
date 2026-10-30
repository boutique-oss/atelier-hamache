import type { MetadataRoute } from "next";

// Manifeste PWA : permet d'« Ajouter à l'écran d'accueil » sur iPhone et
// d'obtenir une icône qui ouvre l'ERP en plein écran (sans barre Safari).
// Servi automatiquement par Next sur /manifest.webmanifest.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Atelier Stéphan Hamache — ERP",
    short_name: "Atelier ASH",
    description: "Mini-ERP de l'atelier (hub dossiers)",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F7F5F2", // papier COS (écran de démarrage)
    theme_color: "#F7F5F2", // papier COS (barre de statut)
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
