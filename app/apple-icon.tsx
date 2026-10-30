import { ImageResponse } from "next/og";

// Icône « Ajouter à l'écran d'accueil » iOS (apple-touch-icon, 180×180).
// iOS n'utilise PAS les icônes du manifeste : c'est ce fichier qui donne
// l'icône sur l'écran d'accueil de l'iPhone.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#52667B",
          color: "#F7F5F2",
          fontSize: 78,
          fontWeight: 800,
          letterSpacing: -3,
          fontFamily: "sans-serif",
        }}
      >
        ASH
      </div>
    ),
    { ...size }
  );
}
