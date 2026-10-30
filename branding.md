# Charte de marque — Redo (ERP atelier)

Identité appliquée à l'ERP : **Redo** (orange + marine). Rebrand effectué depuis
la charte Figma « Redo — Brand Guidelines ». Remplace l'ancienne palette violette
issue de `Scene.json`.

Personnalité : **Precise · Trustworthy · Approachable · Reliable**.

## Où vivent les tokens

- `app/globals.css` — variables CSS `:root` (clair) + `.dark` (sombre). **Source de
  vérité.** Modifier une variable ici repeint tout l'app (tout passe par
  `hsl(var(--…))`).
- `tailwind.config.ts` — mappe les variables vers les classes Tailwind
  (`bg-primary`, `text-muted-foreground`, `font-sans`, `font-serif`, …).
- `app/layout.tsx` — chargement des polices Google via `next/font`.

## Typographie

| Rôle | Police | Chargement |
|------|--------|-----------|
| Principale (titres + corps) | **Rethink Sans** | `next/font` → `--font-sans` |
| Serif d'accent (display / citations) | **Hedvig Letters Serif** | `next/font` → `--font-serif` |

Classes utilitaires : `.brand-display` (Rethink Sans 800, tracking serré),
`.brand-serif` (Hedvig), `.brand-eyebrow` (capitales espacées).

## Couleurs (thème clair)

| Token | HSL | Hex approx. | Usage |
|-------|-----|-------------|-------|
| `--primary` | `21 89% 54%` | `#F26A21` | Orange signature (boutons, liens, focus) |
| `--destructive` | `6 86% 53%` | `#F0341C` | Rouge (erreurs, danger) |
| `--brand-navy` | `210 57% 20%` | `#16324F` | Marine (surfaces sombres, texte fort) |
| `--brand-blue` | `212 44% 44%` | `#3F6EA3` | Bleu acier |
| `--background` | `210 20% 99%` | `#FBFCFD` | Fond de page |
| `--foreground` | `220 14% 11%` | `#181B20` | Texte principal |

### Accents `--brand-*`

Noms d'emplacement **conservés** de l'ancienne charte pour ne pas casser les
composants qui les référencent (`sidebar.tsx`, `lib/dossiers.ts`, `page-header.tsx`,
etc.). Valeurs remappées sur Redo :

| Variable | Couleur Redo | Rôle courant dans l'app |
|----------|--------------|--------------------------|
| `--brand-purple` | orange `#F26A21` | accent primaire (Board, en-têtes, dégradé sidebar) |
| `--brand-violet` | ambre `#F9A03F` | accent secondaire (dégradé sidebar, Opérateurs) |
| `--brand-blue` | bleu acier `#3F6EA3` | — |
| `--brand-green` | vert `#31A06A` | statuts « validé / signé / clos » |
| `--brand-pink` | rouge `#F0341C` | statuts « perdu » / danger |
| `--brand-orange` | orange profond `#E85D14` | — |
| `--brand-navy` | marine `#16324F` | surfaces sombres |

> Note : les noms `--brand-purple/violet/pink` sont historiques ; leurs **valeurs**
> sont désormais orange/ambre/rouge. À renommer un jour si on refactorise les
> composants qui les consomment.

## Thème sombre

Fonds **marine profond** (`--background: 213 40% 8%`), orange plus lumineux
(`--primary: 24 92% 58%`). Surface `.brand-dark` = `#0d1f30`.
