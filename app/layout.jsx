import './globals.css';

export const metadata = {
  title: 'Atelier Stéphan Hamache',
  description: 'Application de gestion interne',
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body>{children}</body>
    </html>
  );
}
