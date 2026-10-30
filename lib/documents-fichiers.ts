// Règles de dépôt des fichiers du module Documents, partagées entre le
// navigateur (composant de dépôt) et le serveur (route d'upload, action
// d'enregistrement). Aucun accès base ici : importable côté client.
//
// Confidentialité : store Vercel Blob PRIVÉ. Le navigateur envoie le fichier
// directement au Blob (pas de limite de taille des fonctions Vercel), avec un
// jeton à usage unique délivré par /api/documents/upload après vérification de
// la session. L'ERP enregistre ensuite la ligne `documents` par une action
// authentifiée, qui revérifie le fichier sur le Blob. Les fichiers ne sont lus
// que par /api/documents/[id], derrière la connexion.

export const DOCUMENT_TAILLE_MAX = 50 * 1024 * 1024; // 50 Mo
// Au-delà, envoi en plusieurs morceaux (reprise des morceaux en échec).
export const DOCUMENT_SEUIL_MULTIPART = 8 * 1024 * 1024;

// Extension → type MIME. Sous Windows, un .heic arrive souvent sans type :
// on le déduit alors de l'extension.
const TYPES_PAR_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  heic: "image/heic",
  heif: "image/heif",
};

export const DOCUMENT_TYPES_ACCEPTES = Array.from(new Set(Object.values(TYPES_PAR_EXTENSION)));

// Valeur de l'attribut `accept` du <input type="file">.
export const DOCUMENT_ACCEPT = [
  ...Object.keys(TYPES_PAR_EXTENSION).map((e) => `.${e}`),
  ...DOCUMENT_TYPES_ACCEPTES,
].join(",");

export function extension(nom: string): string {
  const i = nom.lastIndexOf(".");
  return i < 0 ? "" : nom.slice(i + 1).toLowerCase();
}

// Type retenu pour un fichier, ou null s'il n'est pas accepté.
export function typeDocument(nom: string, typeNavigateur?: string | null): string | null {
  const t = (typeNavigateur ?? "").toLowerCase();
  if (t && DOCUMENT_TYPES_ACCEPTES.includes(t)) return t;
  return TYPES_PAR_EXTENSION[extension(nom)] ?? null;
}

export function formatTaille(o: number | null | undefined): string {
  if (!o) return "";
  if (o < 1024) return `${o} o`;
  if (o < 1024 * 1024) return `${Math.round(o / 1024)} Ko`;
  return `${(o / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`;
}

// Nom de fichier sûr pour un chemin Blob : sans accents ni caractères
// spéciaux, extension conservée. Le nom d'origine reste en base (`nom`).
export function nomSur(nom: string): string {
  const ext = extension(nom);
  const base = (ext ? nom.slice(0, -(ext.length + 1)) : nom)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 80);
  return `${base || "fichier"}${ext ? `.${ext}` : ""}`;
}

// Segment « dossier » du chemin : l'id du dossier client, ou « non-classes ».
export function segmentDossier(dossierId: number | null): string {
  return dossierId == null ? "non-classes" : String(dossierId);
}

// Chemin Blob : dossiers/{dossierId}/{categorie}/{horodatage}-{nom}.
// Horodatage à la milliseconde : deux dépôts du même nom ne se télescopent pas.
export function cheminDocument(dossierId: number | null, categorie: string, nom: string, date = new Date()): string {
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  const horodatage =
    `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-` +
    `${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}${p(date.getMilliseconds(), 3)}`;
  return `dossiers/${segmentDossier(dossierId)}/${categorie}/${horodatage}-${nomSur(nom)}`;
}

// Vérifie qu'un chemin reçu du navigateur correspond bien au dossier et à la
// catégorie annoncés (le jeton d'upload est lié à ce chemin).
export function cheminValide(pathname: string, dossierId: number | null, categorie: string): boolean {
  const prefixe = `dossiers/${segmentDossier(dossierId)}/${categorie}/`;
  if (!pathname.startsWith(prefixe)) return false;
  const fichier = pathname.slice(prefixe.length);
  return /^\d{8}-\d{9}-[a-zA-Z0-9._-]+$/.test(fichier) && TYPES_PAR_EXTENSION[extension(fichier)] != null;
}
