/**
 * PATCH page.js — Intégration des nouveaux modules
 * 
 * Colle ces extraits aux bons endroits dans ton page.js existant.
 * Les marqueurs [PATCH ICI] t'indiquent exactement où.
 */

// ══════════════════════════════════════════════════════════════════
// 1. IMPORTS — Ajouter en haut du fichier, avec les autres imports
// ══════════════════════════════════════════════════════════════════

import HeuresModule      from '../components/HeuresModule';
import ImportExportPanel from '../components/ImportExportPanel';
import ReportsPanel      from '../components/ReportsPanel';
import FicheAtelierModal from '../components/FicheAtelierModal';


// ══════════════════════════════════════════════════════════════════
// 2. ÉTATS — Ajouter dans le corps du composant principal (avec les useState existants)
// ══════════════════════════════════════════════════════════════════

const [activeTab, setActiveTab] = useState('dossiers'); // remplace ton état de vue actuel
const [ficheOuverteDossier, setFicheOuverteDossier] = useState(null);


// ══════════════════════════════════════════════════════════════════
// 3. ONGLETS NAVIGATION — Remplacer/compléter ta barre de navigation
//    (les 3 onglets existants + 3 nouveaux)
// ══════════════════════════════════════════════════════════════════

const TABS = [
  { key: 'dossiers',   label: 'Dossiers actifs' },
  { key: 'commandes',  label: 'Commandes' },
  { key: 'archives',   label: 'Archives' },
  { key: 'heures',     label: '⏱ Heures' },       // NOUVEAU
  { key: 'rapports',   label: '📊 Rapports' },     // NOUVEAU
  { key: 'import',     label: '↕ Import / Export'}, // NOUVEAU
];

// Dans le JSX, ta barre de navigation devient :
/*
<nav style={{ display: 'flex', gap: 4, borderBottom: '2px solid #EDE8E0', marginBottom: 20 }}>
  {TABS.map(tab => (
    <button
      key={tab.key}
      onClick={() => setActiveTab(tab.key)}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        padding: '10px 16px', fontSize: 13, fontWeight: activeTab === tab.key ? 700 : 400,
        color: activeTab === tab.key ? '#9B5E2A' : '#888',
        borderBottom: activeTab === tab.key ? '2px solid #9B5E2A' : '2px solid transparent',
        marginBottom: -2,
      }}
    >
      {tab.label}
    </button>
  ))}
</nav>
*/


// ══════════════════════════════════════════════════════════════════
// 4. RENDU DES NOUVELLES VUES — Ajouter dans le switch/if de rendu
// ══════════════════════════════════════════════════════════════════

/*
  Dans ton JSX principal, là où tu switches sur l'onglet actif,
  ajouter ces 3 cas :

  {activeTab === 'heures' && (
    <HeuresModule />
  )}

  {activeTab === 'rapports' && (
    <ReportsPanel />
  )}

  {activeTab === 'import' && (
    <ImportExportPanel onDataChanged={loadDossiers} />
  )}
*/


// ══════════════════════════════════════════════════════════════════
// 5. BOUTONS DANS LA CARTE DOSSIER — Ajouter dans ton composant DossierCard
//    ou là où tu renders chaque dossier dans la liste
// ══════════════════════════════════════════════════════════════════

/*
  Dans chaque carte/ligne de dossier, ajouter ces 2 boutons :

  <button
    onClick={() => setFicheOuverteDossier(dossier)}
    style={{ background: 'none', border: '1px solid #D9D0C5', borderRadius: 6,
      padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: '#555' }}
  >
    📋 Fiche
  </button>

  <button
    onClick={() => { setActiveTab('heures'); /* optionnel : filtrer par dossier */ }}
    style={{ background: 'none', border: '1px solid #D9D0C5', borderRadius: 6,
      padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: '#555' }}
  >
    ⏱ Heures
  </button>
*/


// ══════════════════════════════════════════════════════════════════
// 6. MODAL FICHE ATELIER — Ajouter à la fin du JSX (avant le dernier </div>)
// ══════════════════════════════════════════════════════════════════

/*
  {ficheOuverteDossier && (
    <FicheAtelierModal
      dossier={ficheOuverteDossier}
      onClose={() => setFicheOuverteDossier(null)}
    />
  )}
*/


// ══════════════════════════════════════════════════════════════════
// 7. CHAMP heures_a_realiser — Ajouter dans ton formulaire d'ajout/édition dossier
// ══════════════════════════════════════════════════════════════════

/*
  Dans ton formulaire de dossier (là où tu as les champs nom_client, type, statut, etc.)
  ajouter ce champ :

  <div>
    <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>
      HEURES PRÉVUES (devis)
    </label>
    <input
      type="number"
      step="0.5"
      min="0"
      placeholder="ex: 8.5"
      value={form.heures_a_realiser || ''}
      onChange={e => setForm(f => ({ ...f, heures_a_realiser: parseFloat(e.target.value) || 0 }))}
      style={{ border: '1px solid #D9D0C5', borderRadius: 6, padding: '7px 10px', fontSize: 13, width: '100%' }}
    />
    <div style={{ fontSize: 11, color: '#AAA', marginTop: 2 }}>
      Sera comparé aux heures saisies réellement
    </div>
  </div>

  Et dans l'objet envoyé à l'API (POST/PUT /api/dossiers) ajouter :
  heures_a_realiser: form.heures_a_realiser || 0,
*/


// ══════════════════════════════════════════════════════════════════
// 8. MISE À JOUR /api/dossiers — Ajouter heures_a_realiser au PUT
//    dans app/api/dossiers/route.js
// ══════════════════════════════════════════════════════════════════

/*
  Dans le PUT de /api/dossiers/route.js, ajouter heures_a_realiser à la requête SQL :

  db.prepare(`
    UPDATE dossiers SET
      nom_client=?, type_intervention=?, statut=?, telephone=?, email=?,
      adresse=?, montant_ht=?, notes=?, heures_a_realiser=?,  ← AJOUTER
      flag_urgent=?, flag_sav=?, flag_standby=?, date_modif=datetime('now')
    WHERE id=?
  `).run(nom_client, type_intervention, statut, telephone, email,
         adresse, montant_ht, notes, heures_a_realiser,        ← AJOUTER
         flag_urgent, flag_sav, flag_standby, id);

  Et dans le destructuring du body :
  const { id, nom_client, ..., heures_a_realiser } = await request.json();  ← AJOUTER
*/
