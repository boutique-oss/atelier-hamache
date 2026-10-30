/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Fiches atelier : les photos sont envoyées en base64 dans la Server
    // Action. La limite par défaut (1 Mo) faisait planter l'enregistrement.
    serverActions: {
      bodySizeLimit: "15mb",
    },
  },
};

export default nextConfig;
