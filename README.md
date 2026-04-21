# Application Atelier Stéphan Hamache

Application interne de gestion des dossiers, commandes et archives de l'atelier.
Stack : Next.js + SQLite. Prévue pour tourner sur un poste fixe et être accessible par tous les PC du réseau de l'atelier.

---

## Installation initiale (sur le poste serveur uniquement)

### Pré-requis

**Node.js 18 ou supérieur** doit être installé sur le poste qui va héberger l'application.
Si ce n'est pas le cas : https://nodejs.org → version LTS → installer (Suivant, Suivant, Terminer).

Vérifie dans PowerShell :
```powershell
node --version
```
Tu dois voir `v18.x.x` ou plus récent.

### Étape 1 : Mettre les fichiers à un endroit fixe

Décompresse le dossier `atelier-app` à un emplacement définitif sur le poste serveur. Par exemple :
```
C:\AtelierApp\
```
(évite `Documents` ou le bureau qui peuvent être déplacés)

### Étape 2 : Installer les dépendances

Ouvre PowerShell, va dans le dossier, et lance :
```powershell
cd C:\AtelierApp
npm install
```
Cette étape télécharge environ 200 Mo de dépendances et prend 1 à 3 minutes.

### Étape 3 : Initialiser la base de données

```powershell
npm run init-db
```
Ce script crée le fichier `data\atelier.db` et y charge tes 47 dossiers, 92 commandes et 47 fournisseurs.

Tu dois voir s'afficher :
```
Initialisation de la base : C:\AtelierApp\data\atelier.db
Tables créées.
--- Données chargées ---
Dossiers     : 47
Fournisseurs : 47
Commandes    : 92
--- Base prête ---
```

### Étape 4 : Construire l'application pour la production

```powershell
npm run build
```
Compile le front React + génère un build optimisé. Patience 30-60 secondes.

### Étape 5 : Lancer le serveur

```powershell
npm start
```
Ou bien double-clique sur `LANCER-SERVEUR.bat` dans le dossier.

Tu verras :
```
▲ Next.js 14.x.x
- Local:        http://localhost:3000
- Network:      http://192.168.X.X:3000
```

Le serveur tourne. Tu peux fermer toutes les fenêtres de PowerShell qui ont servi pour `npm install`, `npm run build` et `npm run init-db`. Garde uniquement la fenêtre où tourne `npm start`.

---

## Accès depuis les autres PC de l'atelier

### 1. Connaître l'IP du poste serveur

Sur le poste serveur, dans PowerShell :
```powershell
ipconfig
```
Cherche la ligne **Adresse IPv4** dans la section "Carte réseau sans fil Wi-Fi" (ou Ethernet selon la connexion). Tu vas voir quelque chose comme `192.168.1.42`.

### 2. Ouvrir le port 3000 dans le pare-feu Windows

Sur le poste serveur, dans PowerShell **lancée en tant qu'administrateur** (clic droit sur PowerShell → "Exécuter en tant qu'administrateur") :

```powershell
New-NetFirewallRule -DisplayName "Atelier App 3000" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
```

C'est à faire **une seule fois**.

### 3. Sur les autres PC

Ouvre Chrome ou Edge, et va à l'adresse :
```
http://192.168.1.42:3000
```
(remplace `192.168.1.42` par l'IP que tu as trouvée à l'étape 1)

Tu peux mettre cette URL en favori, ou créer un raccourci sur le bureau de chaque poste qui pointe vers cette URL.

---

## Sauvegarder les données

Toutes les données sont dans **un seul fichier** : `data\atelier.db`.

Pour sauvegarder :
- Copie ce fichier régulièrement (clé USB, OneDrive, dossier réseau partagé)
- Une copie hebdomadaire suffit en pratique
- Si tu veux automatiser : crée une tâche planifiée Windows qui copie le fichier dans un dossier de backup

Pour restaurer :
- Remplace `data\atelier.db` par ta copie de sauvegarde
- Relance `npm start`

---

## Mettre à jour les données depuis Excel (plus tard)

Pour le moment, l'app gère Dossiers, Commandes et Archives. Si tu modifies un dossier dans l'app, c'est bien synchronisé avec tous les postes.

Pour ré-importer depuis tes Excel (par exemple pour ajouter des commandes 2027) :
1. Arrête le serveur (Ctrl+C ou ferme la fenêtre)
2. **Sauvegarde le fichier `atelier.db`** par sécurité
3. Modifie le script `scripts/init-db.mjs` pour pointer vers tes nouvelles data
4. Relance `npm run init-db`
   ⚠️ Attention : ce script vide les tables avant d'insérer. À ne lancer que pour une réinitialisation complète.
5. Relance `npm start`

Plus tard on fera un vrai bouton d'import dans l'app.

---

## Commandes utiles (récap)

| Commande | À quoi ça sert |
|---|---|
| `npm install` | Installe les dépendances (1 fois après transfert) |
| `npm run init-db` | Réinitialise la base avec les data initiales (⚠️ efface tout) |
| `npm run build` | Compile l'app pour la production |
| `npm start` | Démarre le serveur (à laisser ouvert en permanence) |
| `npm run dev` | Mode développement (rechargement automatique, plus lent) |
| `npm run first-run` | Enchaîne install + init-db + build + start (premier lancement) |

---

## Dépannage

| Problème | Solution |
|---|---|
| `node : terme non reconnu` | Installe Node.js depuis nodejs.org puis ferme/rouvre PowerShell |
| `Cannot find module 'better-sqlite3'` | Refais `npm install` dans le dossier de l'app |
| Erreur lors de `npm install` (sur Windows) | Tu as peut-être besoin de Visual Studio Build Tools : `npm install --global --production windows-build-tools` (en admin) |
| L'app marche en local mais pas depuis un autre PC | Vérifie le pare-feu (étape 2 de l'accès réseau) et que les deux PC sont sur le même réseau Wi-Fi |
| Page blanche / erreur 500 | Regarde la fenêtre PowerShell où tourne `npm start` — l'erreur s'affiche dedans |
| Le serveur s'arrête tout seul | Arrête `npm run dev` et lance `npm start` à la place (mode production plus stable) |

---

## Structure du projet (pour info)

```
atelier-app/
├── app/                  Pages et routes API
│   ├── layout.jsx          Layout HTML + import Tailwind/fonts
│   ├── page.jsx            Page principale (composants React)
│   └── api/                Routes API REST
│       ├── dossiers/
│       │   ├── route.js      GET /api/dossiers, POST /api/dossiers
│       │   └── [id]/
│       │       └── route.js  PUT /api/dossiers/:id, DELETE /api/dossiers/:id
│       ├── commandes/
│       │   └── route.js      GET /api/commandes
│       └── fournisseurs/
│           └── route.js      GET /api/fournisseurs
├── lib/
│   └── db.js             Connexion SQLite (singleton)
├── scripts/
│   └── init-db.mjs       Script d'init avec les data initiales
├── data/
│   └── atelier.db        ← LA BASE (à sauvegarder régulièrement !)
├── package.json
├── next.config.js
├── jsconfig.json
└── LANCER-SERVEUR.bat    Double-clic pour lancer
```

---

## Pour la suite

- Module **Fiches atelier** typées (Intervention, Rideaux…) — jalon J3
- Module **Heures par opérateur** — jalon J4
- Auto-démarrage du serveur au boot Windows
- Bouton d'import Excel direct dans l'app
- Authentification (un mot de passe par utilisateur)
