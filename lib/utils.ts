import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Helper shadcn/ui : fusionne les classes Tailwind sans conflit
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Convertit une saisie de formulaire en nombre en tolérant la virgule décimale
// française (« 1,5 » -> 1.5) et les espaces (« 1 250 » -> 1250). Renvoie null si
// le champ est vide ou illisible — au lieu de 0 (silencieux) ou NaN.
export function parseNum(
  v: FormDataEntryValue | string | null | undefined
): number | null {
  if (v == null) return null;
  const s = String(v).trim().replace(/\s/g, "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
