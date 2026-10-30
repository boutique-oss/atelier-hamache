import { ImageResponse } from "next/og";

// Icône PWA générée à la volée (pas de fichier binaire à committer).
// Carré marine + monogramme « ASH » orange, aligné sur la charte Redo.
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
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
          fontSize: 220,
          fontWeight: 800,
          letterSpacing: -8,
          fontFamily: "sans-serif",
        }}
      >
        ASH
      </div>
    ),
    { ...size }
  );
}
