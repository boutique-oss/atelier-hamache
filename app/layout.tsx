import type { Metadata, Viewport } from "next";
import { Rethink_Sans, Hedvig_Letters_Serif } from "next/font/google";
import "./globals.css";

// Polices de la charte Redo : Rethink Sans (principale, titres + corps) et
// Hedvig Letters Serif (serif d'accent / display). Exposées en variables CSS
// consommées par tailwind.config.ts (font-sans / font-serif) et globals.css.
const rethinkSans = Rethink_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const hedvigSerif = Hedvig_Letters_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Atelier Stéphan Hamache — ERP",
  description: "Mini-ERP de l'atelier ASH (hub dossiers)",
  // PWA : ouverture en plein écran une fois ajouté à l'écran d'accueil iOS.
  applicationName: "Atelier ASH",
  appleWebApp: {
    capable: true,
    title: "Atelier ASH",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#F7F5F2",
  // Occupe toute la zone écran (sous l'encoche) en mode plein écran iOS.
  viewportFit: "cover",
};

// Layout racine minimal : ni barre latérale, ni logique de route. Les pages
// applicatives (avec volet latéral) sont dans le groupe (main) ; /login et
// /fiche-impression restent volontairement en plein écran, sans volet.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={`${rethinkSans.variable} ${hedvigSerif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
