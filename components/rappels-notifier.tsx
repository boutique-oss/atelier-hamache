"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, X } from "lucide-react";

type Item = {
  key: string;
  dossierId: number;
  titre: string;
  detail: string;
  date: string;
  heure: string;
  rappels: number[];
};

type Alerte = { id: string; titre: string; corps: string; dossierId: number };

const DEJA_KEY = "planning-rappels-envoyes";
// Un rappel manqué (onglet fermé) est encore affiché s'il date de moins de 2h.
const RATTRAPAGE_MS = 2 * 3600 * 1000;

function lireEnvoyes(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(DEJA_KEY) || "{}");
  } catch {
    return {};
  }
}
function ecrireEnvoyes(v: Record<string, number>) {
  try {
    // On ne garde que les 10 derniers jours.
    const limite = Date.now() - 10 * 86400000;
    const propre = Object.fromEntries(Object.entries(v).filter(([, t]) => t > limite));
    localStorage.setItem(DEJA_KEY, JSON.stringify(propre));
  } catch {}
}

// Heure de l'intervention (heure locale du poste, supposée Europe/Paris).
const instant = (it: Item) => new Date(`${it.date}T${it.heure}:00`).getTime();

function quand(min: number) {
  if (min === 0) return "maintenant";
  if (min % 1440 === 0) return min === 1440 ? "demain" : `dans ${min / 1440} jours`;
  if (min >= 60) return `dans ${Math.floor(min / 60)} h${min % 60 ? " " + (min % 60) : ""}`;
  return `dans ${min} min`;
}

// Notifie les rappels des interventions du planning tant que l'application
// est ouverte (n'importe quelle page) : notification système si autorisée,
// sinon bandeau dans la page. Monté une fois dans le layout.
export function RappelsNotifier() {
  const [items, setItems] = useState<Item[]>([]);
  const [alertes, setAlertes] = useState<Alerte[]>([]);

  // Rafraîchit la liste toutes les 5 min.
  useEffect(() => {
    let actif = true;
    const charger = () =>
      fetch("/api/planning/rappels", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((j) => actif && setItems(j.items ?? []))
        .catch(() => {});
    charger();
    const t = setInterval(charger, 5 * 60 * 1000);
    return () => {
      actif = false;
      clearInterval(t);
    };
  }, []);

  // Vérifie toutes les 30 s les rappels arrivés à échéance.
  useEffect(() => {
    const verifier = () => {
      const now = Date.now();
      const envoyes = lireEnvoyes();
      const nouvelles: Alerte[] = [];
      for (const it of items) {
        for (const min of it.rappels) {
          const id = `${it.key}-${it.date}-${it.heure}-${min}`;
          const echeance = instant(it) - min * 60000;
          if (envoyes[id] || echeance > now || now - echeance > RATTRAPAGE_MS) continue;
          envoyes[id] = now;
          const corps = `${it.date.slice(8)}/${it.date.slice(5, 7)} à ${it.heure} (${quand(min)})${
            it.detail ? "\n" + it.detail : ""
          }`;
          nouvelles.push({ id, titre: it.titre, corps, dossierId: it.dossierId });
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            try {
              const n = new Notification(it.titre, { body: corps, tag: id });
              n.onclick = () => {
                window.focus();
                window.location.href = `/dossiers/${it.dossierId}`;
              };
            } catch {}
          }
        }
      }
      if (nouvelles.length) {
        ecrireEnvoyes(envoyes);
        setAlertes((a) => [...a, ...nouvelles]);
      }
    };
    verifier();
    const t = setInterval(verifier, 30 * 1000);
    return () => clearInterval(t);
  }, [items]);

  if (!alertes.length) return null;
  return (
    <div className="fixed bottom-24 right-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 lg:bottom-4">
      {alertes.map((a) => (
        <div key={a.id} className="rounded-lg border bg-background p-3 shadow-lg">
          <div className="flex items-start gap-2">
            <Bell className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <a href={`/dossiers/${a.dossierId}`} className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{a.titre}</p>
              <p className="whitespace-pre-line text-xs text-muted-foreground">{a.corps}</p>
            </a>
            <button
              type="button"
              onClick={() => setAlertes((l) => l.filter((x) => x.id !== a.id))}
              className="rounded p-0.5 text-muted-foreground hover:bg-muted"
              aria-label="Fermer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// Bouton d'autorisation des notifications système (page Planning).
export function ActiverNotifications() {
  const [etat, setEtat] = useState<NotificationPermission | "indispo" | null>(null);
  useEffect(() => {
    setEtat(typeof Notification === "undefined" ? "indispo" : Notification.permission);
  }, []);

  if (etat === null || etat === "indispo") return null;
  if (etat === "granted")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Bell className="h-3.5 w-3.5" /> Notifications activées
      </span>
    );
  if (etat === "denied")
    return (
      <span
        className="inline-flex items-center gap-1 text-xs text-muted-foreground"
        title="Autorise les notifications pour ce site dans les réglages du navigateur"
      >
        <BellOff className="h-3.5 w-3.5" /> Notifications bloquées
      </span>
    );
  return (
    <button
      type="button"
      onClick={() => Notification.requestPermission().then(setEtat)}
      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted"
    >
      <Bell className="h-3.5 w-3.5" /> Activer les notifications
    </button>
  );
}
