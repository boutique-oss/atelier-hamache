// Intégration Google Calendar via OAuth2 (compte utilisateur, sans clé de
// compte de service — bloquée par la règle d'organisation Workspace).
//
// Auth : ID client + secret OAuth + un refresh_token obtenu une seule fois
// via l'écran de consentement (/api/google/auth → /api/google/callback).
// On échange le refresh_token contre un access_token court à chaque appel.
//
// Variables d'environnement (Vercel) :
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN,
//   GOOGLE_CALENDAR_ID, GOOGLE_REDIRECT_URI (optionnel).

export const GOOGLE_SCOPE = "https://www.googleapis.com/auth/calendar.events";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CAL_BASE = "https://www.googleapis.com/calendar/v3/calendars";

// URI de redirection : doit correspondre EXACTEMENT à celle déclarée dans la
// console Google. Surchargée par GOOGLE_REDIRECT_URI si besoin.
export function redirectUri(): string {
  return (
    process.env.GOOGLE_REDIRECT_URI ||
    "https://atelier-hamache.vercel.app/api/google/callback"
  );
}

// URL de l'écran de consentement Google (accès hors-ligne pour obtenir un
// refresh_token, prompt=consent pour forcer son renvoi).
export function consentUrl(): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID manquant");
  const p = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: GOOGLE_SCOPE,
    access_type: "offline",
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

// Échange le code d'autorisation contre des jetons (one-shot, au consentement).
export async function exchangeCode(code: string): Promise<{
  refresh_token?: string;
  access_token: string;
}> {
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
    redirect_uri: redirectUri(),
    grant_type: "authorization_code",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Échange du code échoué : ${res.status} ${await res.text()}`);
  }
  return res.json();
}

// Récupère un access_token frais à partir du refresh_token stocké.
async function getAccessToken(): Promise<string> {
  const refresh = process.env.GOOGLE_REFRESH_TOKEN;
  if (!refresh) throw new Error("GOOGLE_REFRESH_TOKEN manquant");
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
    refresh_token: refresh,
    grant_type: "refresh_token",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Rafraîchissement du jeton échoué : ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

// True si l'intégration est configurée (sinon on n'essaie pas de synchroniser).
export function calendarConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REFRESH_TOKEN &&
      process.env.GOOGLE_CALENDAR_ID
  );
}

export type ChantierEvent = {
  summary: string;
  description?: string;
  // Dates en AAAA-MM-JJ (événement « journée entière »). end = jour de FIN inclus.
  startDate: string;
  endDate: string;
  // Si vrai : événement HORAIRE avec deux rappels — la veille à la même heure
  // et le jour même à l'heure — au lieu d'un événement « journée entière ».
  // L'heure est donnée par `heure` (« HH:MM ») ; défaut 07:00 si absente.
  atSeven?: boolean;
  // Heure de l'événement ponctuel (« HH:MM », fuseau Europe/Paris). Implique un
  // événement horaire (comme atSeven). Durée fixée à 30 min.
  heure?: string | null;
  // Rappels de l'événement horaire : liste de minutes AVANT l'heure de début.
  // Ex : [1440, 0] = la veille à la même heure + le jour même à l'heure ;
  // [60] = 1h avant ; [1440, 60] = la veille + 1h avant. Défaut [1440, 0].
  rappels?: number[];
  // colorId Google Agenda (« 1 »–« 11 ») pour distinguer les types d'événement.
  // 11 = Tomate (rouge), 10 = Basilic (vert), 5 = Banane (jaune)…
  colorId?: string;
};

// Fuseau de l'atelier (pour les rappels et l'horaire des événements ponctuels).
const TIMEZONE = "Europe/Paris";

// Google attend une date de fin EXCLUSIVE pour les all-day → +1 jour.
function endExclusive(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, day + 1));
  return dt.toISOString().slice(0, 10);
}

// Valide/normalise une heure « HH:MM » ; défaut 07:00 si absente/invalide.
function normHeure(h?: string | null): string {
  return h && /^\d{2}:\d{2}$/.test(h) ? h : "07:00";
}

// Ajoute des minutes à une heure « HH:MM » (borné sur 24h, sans passer au jour+1
// pour nos créneaux courts de 30 min qui ne débordent jamais minuit en pratique).
function addMinutes(hm: string, add: number): string {
  const [h, m] = hm.split(":").map(Number);
  const total = h * 60 + m + add;
  const hh = Math.floor((total % 1440) / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function eventBody(ev: ChantierEvent) {
  const base = {
    summary: ev.summary,
    description: ev.description || "",
    // colorId optionnel : Google ignore la clé si non fournie.
    ...(ev.colorId ? { colorId: ev.colorId } : {}),
  };
  // Événement ponctuel : caler à l'heure choisie le jour J (défaut 07:00), avec
  // rappels la veille à la même heure (1440 min avant) et le jour même (0 min).
  if (ev.atSeven || ev.heure) {
    const debut = normHeure(ev.heure);
    const fin = addMinutes(debut, 30);
    // Rappels : minutes avant l'heure de début. Défaut = veille + jour même.
    const rappels =
      ev.rappels && ev.rappels.length ? ev.rappels : [1440, 0];
    return {
      ...base,
      // date: null force la suppression d'un éventuel champ « journée entière »
      // préexistant (sinon un PATCH laisse cohabiter date + dateTime → 400).
      start: { date: null, dateTime: `${ev.startDate}T${debut}:00`, timeZone: TIMEZONE },
      end: { date: null, dateTime: `${ev.startDate}T${fin}:00`, timeZone: TIMEZONE },
      reminders: {
        useDefault: false,
        overrides: rappels.map((minutes) => ({ method: "popup", minutes })),
      },
    };
  }
  return {
    ...base,
    start: { date: ev.startDate },
    end: { date: endExclusive(ev.endDate) },
  };
}

// Crée un événement, renvoie son id Google (à stocker sur le dossier).
export async function createEvent(ev: ChantierEvent): Promise<string> {
  const token = await getAccessToken();
  const calId = encodeURIComponent(process.env.GOOGLE_CALENDAR_ID || "");
  const res = await fetch(`${CAL_BASE}/${calId}/events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(eventBody(ev)),
  });
  if (!res.ok) {
    throw new Error(`Création événement échouée : ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { id: string };
  return json.id;
}

// Met à jour un événement existant.
export async function updateEvent(eventId: string, ev: ChantierEvent): Promise<void> {
  const token = await getAccessToken();
  const calId = encodeURIComponent(process.env.GOOGLE_CALENDAR_ID || "");
  const res = await fetch(`${CAL_BASE}/${calId}/events/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(eventBody(ev)),
  });
  if (!res.ok) {
    throw new Error(`Mise à jour événement échouée : ${res.status} ${await res.text()}`);
  }
}

// Supprime un événement (ignore le 404/410 si déjà absent).
export async function deleteEvent(eventId: string): Promise<void> {
  const token = await getAccessToken();
  const calId = encodeURIComponent(process.env.GOOGLE_CALENDAR_ID || "");
  const res = await fetch(`${CAL_BASE}/${calId}/events/${encodeURIComponent(eventId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Suppression événement échouée : ${res.status} ${await res.text()}`);
  }
}
