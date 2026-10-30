import { RappelsNotifier } from "@/components/rappels-notifier";
import { Sidebar } from "@/components/sidebar";
import { utilisateurCourant } from "@/lib/session";

// Layout des pages applicatives : volet latéral toujours présent. On récupère
// l'utilisateur courant (session) pour l'afficher + proposer la déconnexion, et
// pour masquer l'entrée Admin aux opérateurs.
export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const u = await utilisateurCourant();

  return (
    <div className="min-h-screen lg:flex">
      <Sidebar utilisateur={u ? { nom: u.nom, role: u.role } : null} />
      <div className="min-w-0 flex-1 pb-20 lg:pb-0">{children}</div>
      <RappelsNotifier />
    </div>
  );
}
