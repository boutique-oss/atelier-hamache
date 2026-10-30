// Paramètres de sécurité (code d'accès + IP autorisées) lus depuis la base.
//
// Source de vérité : la table `parametres_securite` (ligne id = 1), éditable
// depuis Admin › Sécurité. Les variables Vercel ACCESS_CODE / ALLOWED_IPS
// servent de REPLI : si la base est vide, indisponible, ou renvoie une erreur,
// on retombe sur l'environnement — jamais de verrouillage dur hors de l'app.
//
// Compatible runtime Edge (middleware) : le client Neon est fondé sur `fetch`
// et créé paresseusement pour ne pas lever d'erreur au chargement du module.
import { neon } from "@neondatabase/serverless";

export type ParamsSecurite = {
  codeAcces: string; // code d'accès partagé courant ("" = aucun code -> accès libre)
  ipsAutorisees: string[]; // liste d'IP publiques ([] = aucune restriction réseau)
  aUtilisateursActifs: boolean; // au moins un compte actif existe
  aAdminActif: boolean; // au moins un compte admin actif existe (sinon: bootstrap par code)
};

// Cache mémoire court, par instance (l'infrastructure réutilise les instances
// tièdes). Évite un aller-retour base à chaque requête tout en propageant un
// changement de code/IP en quelques secondes.
let cache: { at: number; val: ParamsSecurite } | null = null;
const TTL_MS = 15_000;

function listeIp(brut: string): string[] {
  return brut
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Valeurs de repli issues des variables d'environnement Vercel.
function depuisEnv(): ParamsSecurite {
  return {
    codeAcces: process.env.ACCESS_CODE || "",
    ipsAutorisees: listeIp(process.env.ALLOWED_IPS || ""),
    aUtilisateursActifs: false,
    aAdminActif: false,
  };
}

export async function getParamsSecurite(): Promise<ParamsSecurite> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.val;

  const val = depuisEnv();
  const url = process.env.DATABASE_URL;
  if (!url) {
    cache = { at: Date.now(), val };
    return val;
  }

  const sql = neon(url);

  // Réglages code/IP — repli sur l'env si vide ou table absente.
  try {
    const rows = (await sql`
      SELECT code_acces, ips_autorisees
      FROM parametres_securite
      WHERE id = 1
    `) as { code_acces: string | null; ips_autorisees: string | null }[];
    if (rows.length) {
      const r = rows[0];
      const codeBase = (r.code_acces || "").trim();
      const ipsBase = (r.ips_autorisees || "").trim();
      if (codeBase) val.codeAcces = codeBase;
      if (ipsBase) val.ipsAutorisees = listeIp(ipsBase);
    }
  } catch {
    // Table absente / base indisponible -> on garde le repli env.
  }

  // Présence de comptes — détermine si l'auth par comptes est active et si le
  // bootstrap par code est encore permis (aucun admin). Table peut ne pas
  // exister avant migration : l'échec est silencieux (aucun compte).
  try {
    const rows = (await sql`
      SELECT
        count(*) FILTER (WHERE actif) AS actifs,
        count(*) FILTER (WHERE actif AND role = 'admin') AS admins
      FROM utilisateurs
    `) as { actifs: number | string; admins: number | string }[];
    if (rows.length) {
      val.aUtilisateursActifs = Number(rows[0].actifs) > 0;
      val.aAdminActif = Number(rows[0].admins) > 0;
    }
  } catch {
    // Table utilisateurs absente -> aucun compte.
  }

  cache = { at: Date.now(), val };
  return val;
}

// À appeler après une écriture pour rafraîchir immédiatement l'instance courante
// (les autres instances se mettent à jour au plus tard au bout du TTL).
export function invaliderCacheSecurite(): void {
  cache = null;
}
