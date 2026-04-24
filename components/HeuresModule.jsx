'use client';
import { useState, useEffect, useCallback } from 'react';
import { Clock, Plus, Trash2, ChevronUp } from 'lucide-react';

const INK    = '#000000';
const ACCENT = '#000000';
const SOFT   = '#EEEEEE';
const BG     = '#F5F5F5';

const OPERATEURS    = ['Stéphan', 'Christophe', 'Morgane', 'Vivianne'];
const TYPES_TRAVAIL = ['Atelier', 'Pose', 'Dépose', 'Livraison', 'Admin', 'Autre'];

// ── Barre de progression prévues/réelles ─────────────────────────────────
function BarreHeures({ prevues, reelles }) {
  const pct     = prevues > 0 ? Math.min((reelles / prevues) * 100, 150) : 0;
  const depasse = reelles > prevues;
  const ecart   = Math.abs(reelles - prevues).toFixed(1);
  const color   = depasse ? '#000' : reelles >= prevues * 0.8 ? '#444' : '#666';

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4, color: INK }}>
        <span><b>{reelles}h</b> réelles / <b>{prevues}h</b> prévues</span>
        <span style={{ color, fontWeight: 600 }}>
          {depasse ? `+${ecart}h dépassé` : `${ecart}h restantes`}
        </span>
      </div>
      <div style={{ background: '#E5E5E5', height: 8, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, background: color, height: '100%' }} />
      </div>
    </div>
  );
}

// ── Ligne d'une saisie heures ─────────────────────────────────────────────
function LigneHeure({ entry, onDelete }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #E5E5E5', fontSize: 13 }}>
      <span style={{ color: '#888', minWidth: 80 }}>{entry.date}</span>
      <span style={{ fontWeight: 600, minWidth: 80 }}>{entry.operateur}</span>
      <span style={{ background: SOFT, color: ACCENT, borderRadius: 4, padding: '2px 8px', fontWeight: 700, minWidth: 50, textAlign: 'center' }}>{entry.heures_passees}h</span>
      <span style={{ color: '#888', minWidth: 70 }}>{entry.type_travail}</span>
      <span style={{ flex: 1, color: INK }}>{entry.description}</span>
      <button onClick={() => onDelete(entry.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#000', padding: 4 }}>
        <Trash2 size={14} />
      </button>
    </div>
  );
}

// ── Formulaire multi-opérateurs ───────────────────────────────────────────
function FormulaireHeure({ dossierId, dossiers, onSaved }) {
  const today = new Date().toISOString().split('T')[0];

  const [dossierSelect, setDossierSelect] = useState(dossierId || '');
  const [date,          setDate]          = useState(today);
  const [typeTravail,   setTypeTravail]   = useState('Atelier');
  const [description,   setDescription]  = useState('');
  const [lignes,        setLignes]        = useState(
    OPERATEURS.map(op => ({ operateur: op, heures: '' }))
  );
  const [saving, setSaving] = useState(false);

  const setHeures = (i, val) =>
    setLignes(ls => ls.map((l, j) => j === i ? { ...l, heures: val } : l));

  const lignesValides = lignes.filter(l => l.heures !== '' && parseFloat(l.heures) > 0);
  const dossierCible  = dossierId || dossierSelect;
  const canSave       = dossierCible && lignesValides.length > 0;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    await Promise.all(lignesValides.map(l =>
      fetch('/api/heures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dossier_id:    parseInt(dossierCible),
          operateur:     l.operateur,
          date,
          heures_passees: parseFloat(l.heures),
          type_travail:  typeTravail,
          description,
        }),
      })
    ));
    setSaving(false);
    setLignes(OPERATEURS.map(op => ({ operateur: op, heures: '' })));
    setDescription('');
    onSaved();
  };

  const inp = { border: '1px solid #E5E5E5', padding: '6px 10px', fontSize: 13, background: '#fff', color: INK };

  return (
    <div style={{ background: SOFT, padding: 16, marginBottom: 16, border: '1px solid #E5E5E5' }}>

      {/* Ligne contexte : dossier + date + type + description */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'flex-end' }}>
        {!dossierId && dossiers && (
          <div style={{ flex: '2 1 200px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: '#888', fontWeight: 600 }}>DOSSIER</label>
            <select value={dossierSelect} onChange={e => setDossierSelect(e.target.value)} style={inp}>
              <option value="">— Choisir un dossier —</option>
              {dossiers.map(d => (
                <option key={d.id} value={d.id}>{d.client_nom || d.nom_dossier} — {d.nom_dossier}</option>
              ))}
            </select>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, color: '#888', fontWeight: 600 }}>DATE</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, color: '#888', fontWeight: 600 }}>TYPE</label>
          <select value={typeTravail} onChange={e => setTypeTravail(e.target.value)} style={inp}>
            {TYPES_TRAVAIL.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div style={{ flex: '2 1 180px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, color: '#888', fontWeight: 600 }}>DESCRIPTION (optionnel)</label>
          <input type="text" placeholder="Ex: Dépose velours fauteuil"
            value={description} onChange={e => setDescription(e.target.value)} style={inp} />
        </div>
      </div>

      {/* Grille opérateurs — une carte par personne */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
        {lignes.map((l, i) => {
          const actif = l.heures !== '' && parseFloat(l.heures) > 0;
          return (
            <div key={l.operateur} style={{
              background: actif ? '#fff' : 'rgba(255,255,255,0.55)',
              border: `1.5px solid ${actif ? ACCENT : '#E5E5E5'}`,
              padding: '10px 12px',
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: actif ? INK : '#999', marginBottom: 8 }}>
                {l.operateur}
              </div>
              <input
                type="number" step="0.5" min="0" placeholder="—"
                value={l.heures}
                onChange={e => setHeures(i, e.target.value)}
                style={{
                  width: '100%', textAlign: 'center', fontWeight: 700, fontSize: 18,
                  border: `1px solid ${actif ? ACCENT : '#E5E5E5'}`,
                  padding: '6px 4px',
                  background: actif ? SOFT : '#fff',
                  color: actif ? ACCENT : '#AAAAAA',
                  outline: 'none',
                }}
              />
              {actif && (
                <div style={{ fontSize: 11, color: '#888', marginTop: 5, textAlign: 'center' }}>
                  {parseFloat(l.heures)}h · {typeTravail}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Récap + bouton */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 12, color: '#888' }}>
          {lignesValides.length > 0
            ? lignesValides.map(l => `${l.operateur} ${l.heures}h`).join(' · ')
            : <span style={{ color: '#BBB' }}>Saisis les heures de chaque opérateur présent</span>
          }
        </div>
        <button
          onClick={save}
          disabled={saving || !canSave}
          style={{
            background: ACCENT, color: '#fff', border: 'none', borderRadius: 6,
            padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            opacity: !canSave ? 0.4 : 1,
          }}
        >
          <Plus size={14} />
          {saving
            ? 'Enregistrement…'
            : `Enregistrer${lignesValides.length > 0 ? ` (${lignesValides.length} saisie${lignesValides.length > 1 ? 's' : ''})` : ''}`
          }
        </button>
      </div>
    </div>
  );
}

// ── Carte récap par opérateur ─────────────────────────────────────────────
function CarteOperateur({ stat }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E5E5', padding: 14, minWidth: 160 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginBottom: 4 }}>{stat.operateur}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: ACCENT }}>{stat.total_heures}h</div>
      <div style={{ fontSize: 11, color: '#888' }}>{stat.nb_saisies} saisies · {stat.nb_dossiers} dossiers</div>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────
export default function HeuresModule({ dossierId = null, heuresPrevues = 0, compact = false }) {
  const [data, setData]         = useState({ heures: [], stats: [], synthese: null });
  const [dossiers, setDossiers] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const url = dossierId ? `/api/heures?dossier_id=${dossierId}` : '/api/heures';
    const r = await fetch(url);
    setData(await r.json());
    setLoading(false);
  }, [dossierId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!dossierId) {
      fetch('/api/dossiers')
        .then(r => r.json())
        .then(d => setDossiers((Array.isArray(d) ? d : d.dossiers || []).filter(x => x.statut !== 'Clos')));
    }
  }, [dossierId]);

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette saisie ?')) return;
    await fetch(`/api/heures?id=${id}`, { method: 'DELETE' });
    load();
  };

  const { heures, stats, synthese } = data;
  const prevues = synthese?.prevues ?? heuresPrevues ?? 0;
  const reelles = synthese?.reelles ?? 0;

  if (loading) return <div style={{ padding: 20, color: '#888', fontSize: 13 }}>Chargement heures…</div>;

  return (
    <div style={{ fontFamily: 'DM Sans, sans-serif' }}>
      {/* En-tête */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={18} color={ACCENT} />
          <span style={{ fontWeight: 700, fontSize: 16, color: INK }}>
            {dossierId ? 'Heures du dossier' : 'Suivi heures global'}
          </span>
        </div>
        <button onClick={() => setShowForm(f => !f)} style={{
          background: showForm ? '#E5E5E5' : ACCENT, color: showForm ? INK : '#fff',
          border: 'none', padding: '7px 14px', fontSize: 13, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {showForm ? <><ChevronUp size={14} /> Fermer</> : <><Plus size={14} /> Saisir des heures</>}
        </button>
      </div>

      {/* Barre prévues/réelles */}
      {dossierId && prevues > 0 && <BarreHeures prevues={prevues} reelles={reelles} />}
      {dossierId && prevues === 0 && (
        <div style={{ background: '#F5F5F5', border: '1px solid #000', padding: '8px 12px', fontSize: 12, color: '#000', marginBottom: 12 }}>
          Pas d'heures prévues — édite le dossier pour ajouter un devis horaire.
        </div>
      )}

      {/* Stats par opérateur (vue globale) */}
      {!dossierId && stats.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          {stats.map(s => <CarteOperateur key={s.operateur} stat={s} />)}
        </div>
      )}

      {/* Stats par opérateur (vue dossier) */}
      {dossierId && stats.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          {stats.map(s => (
            <div key={s.operateur} style={{ background: SOFT, borderRadius: 6, padding: '6px 12px', fontSize: 13 }}>
              <b style={{ color: ACCENT }}>{s.total_heures}h</b>
              <span style={{ color: '#888' }}> · {s.operateur} ({s.nb_saisies} saisies)</span>
            </div>
          ))}
        </div>
      )}

      {/* Formulaire */}
      {showForm && (
        <FormulaireHeure
          dossierId={dossierId}
          dossiers={dossiers}
          onSaved={() => { load(); setShowForm(false); }}
        />
      )}

      {/* Liste des saisies */}
      {heures.length === 0 ? (
        <div style={{ padding: '24px 0', textAlign: 'center', color: '#AAA', fontSize: 13 }}>
          Aucune saisie d'heures pour le moment
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
            {heures.length} saisie{heures.length > 1 ? 's' : ''}
          </div>
          {!dossierId && (
            <div style={{ display: 'grid', gridTemplateColumns: '80px 90px 60px 70px 1fr 120px 24px', gap: 8, fontSize: 11, color: '#AAA', padding: '4px 0', borderBottom: '2px solid #EDE8E0', textTransform: 'uppercase' }}>
              <span>Date</span><span>Opérateur</span><span>Heures</span><span>Type</span>
              <span>Description</span><span>Dossier</span><span></span>
            </div>
          )}
          {heures.map(h => (
            <div key={h.id}>
              {!dossierId && (
                <div style={{ display: 'grid', gridTemplateColumns: '80px 90px 60px 70px 1fr 120px 24px', gap: 8, alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #E5E5E5', fontSize: 13 }}>
                  <span style={{ color: '#888' }}>{h.date}</span>
                  <span style={{ fontWeight: 600 }}>{h.operateur}</span>
                  <span style={{ background: SOFT, color: ACCENT, borderRadius: 4, padding: '1px 6px', fontWeight: 700, textAlign: 'center' }}>{h.heures_passees}h</span>
                  <span style={{ color: '#888' }}>{h.type_travail}</span>
                  <span style={{ color: INK, fontSize: 12 }}>{h.description}</span>
                  <span style={{ fontSize: 11, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.nom_client}</span>
                  <button onClick={() => handleDelete(h.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#000' }}><Trash2 size={13} /></button>
                </div>
              )}
              {dossierId && <LigneHeure entry={h} onDelete={handleDelete} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
