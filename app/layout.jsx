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
        <script src="https://cdn.tailwindcss.com"></script>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
        <style dangerouslySetInnerHTML={{ __html: `
          *, *::before, *::after { border-radius: 0 !important; transition: none !important; animation: none !important; box-shadow: none !important; }
          body { margin: 0; font-family: 'DM Sans', system-ui, sans-serif; background: #F5F5F5; color: #000; }
          input:focus, select:focus, textarea:focus { outline: 2px solid #000; outline-offset: -2px; }
          button:focus-visible { outline: 2px solid #000; outline-offset: 2px; }
        `}} />
      </head>
      <body>{children}</body>
    </html>
  );
}
