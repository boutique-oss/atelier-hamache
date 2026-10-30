// Jeton d'écriture/lecture Vercel Blob. Le SDK lit par défaut
// `BLOB_READ_WRITE_TOKEN`, mais selon le préfixe choisi à la création du store,
// Vercel peut le nommer autrement (ex. `BLOB_READ_WRITE_TOKEN_READ_WRITE_TOKEN`
// quand le préfixe saisi était déjà « BLOB_READ_WRITE_TOKEN »). On teste
// plusieurs noms pour rester robuste sans dépendre du réglage du dashboard.
export function blobToken(): string | undefined {
  return (
    process.env.BLOB_READ_WRITE_TOKEN ||
    process.env.BLOB_READ_WRITE_TOKEN_READ_WRITE_TOKEN ||
    process.env.atelier_hamache_READ_WRITE_TOKEN ||
    undefined
  );
}
