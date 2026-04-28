'use client';
import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, ChevronUp } from 'lucide-react';
import Kicker from './ui/Kicker';
import Btn from './ui/Btn';

const OPERATEURS    = ['Stéphan', 'Christophe', 'Morgane', 'Vivianne'];
const TYPES_TRAVAIL = ['Atelier', 'Pose', 'Dépose', 'Livraison', 'Admin', 'Autre'];

function BarreHeures({ prevues, reelles }) {
  const pct     = prevues > 0 ? Math.min((reelles / prevues) * 100, 150) : 0;
  const depasse = reelles > prevues;
  const ecart   = Math.abs(reelles - prevues).toFixed(1);

  return (
    <div className="mb-4">
      <div className="flex justify-between font-sans text-[13px] mb-1 text-ink">
        <span>
          <span className="font-serif tnum text-[18px]">{reelles}h</span>
          <span className="text-muted"> réelles / </span>
          <span className="font-serif tnum text-[18px]">{prevues}h</span>
          <span className="text-muted"> prévues</span>
        </span>
        <span className="font-mono text-[11px] tnum" style={{ color: depasse ? '#FF0000' : '#000' }}>
          {depasse ? `+${ecart}h dépassé` : `${ecart}h restantes`}
        </span>
      </div>
      <div className="bg-line h-1.5">
        <div
          className="h-full"
          style={{ width: `${Math.min(pct, 100)}%`, background: depasse ? '#FF0000' : '#000' }}
        />
      </div>
    </div>
  );
}

function FormulaireHeure({ dossierId, dossiers, onSaved }) {
  const today = new Date().toISOString().split('T')[0];
  const [dossierSelect, setDossierSelect] = useState(dossierId || '');
  const [date,          setDate]          = useState(today);
  const [typeTravail,   setTypeTravail]   = useState('Atelier');
  const [description,   setDescription]  = useState('');
  const [lignes,        setLignes]        = useState(OPERATEURS.map(op => ({ operateur: op, heures: '' })));
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
          dossier_id: parseInt(dossierCible),
          operateur: l.operateur,
          date,
          heures_passees: parseFloat(l.heures),
          type_travail: typeTravail,
          description,
        }),
      })
    ));
    setSaving(false);
    setLignes(OPERATEURS.map(op => ({ operateur: op, heures: '' })));
    setDescription('');
    onSaved();
  };

  return (
    <div className="bg-bg border border-ink p-4 mb-5">
      <Kicker className="mb-3">Saisie rapide</Kicker>

      <div className="flex gap-3 flex-wrap mb-4 items-end">
        {!dossierId && dossiers && (
          <div className="flex-[2_1_200px] flex flex-col gap-1">
            <label className="font-mono uppercase tracking-[0.16em] text-[10px] text-muted">Dossier</label>
            <select
              value={dossierSelect}
              onChange={e => setDossierSelect(e.target.value)}
              className="px-3 py-2 bg-surface border border-ink font-sans text-[13px] text-ink"
            >
              <option value="">— Choisir un dossier —</option>
              {dossiers.filter(d => d.statut !== 'Clos').map(d => (
                <option key={d.id} value={d.id}>{d.client_nom || d.nom_dossier} — {d.nom_dossier}</option>
              ))}
              {dossiers.some(d => d.statut === 'Clos') && (
                <optgroup label="── Dossiers clos ──">
                  {dossiers.filter(d => d.statut === 'Clos').map(d => (
                    <option key={d.id} value={d.id}>[CLOS] {d.client_nom || d.nom_dossier} — {d.nom_dossier}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
        )}
        <div className="flex flex-col gap-1">
          <label className="font-mono uppercase tracking-[0.16em] text-[10px] text-muted">Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="px-3 py-2 bg-surface border border-ink font-sans text-[13px] text-ink"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-mono uppercase tracking-[0.16em] text-[10px] text-muted">Type</label>
          <select
            value={typeTravail}
            onChange={e => setTypeTravail(e.target.value)}
            className="px-3 py-2 bg-surface border border-ink font-sans text-[13px] text-ink"
          >
            {TYPES_TRAVAIL.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="flex-[2_1_180px] flex flex-col gap-1">
          <label className="font-mono uppercase tracking-[0.16em] text-[10px] text-muted">Description (optionnel)</label>
          <input
            type="text"
            placeholder="Ex : Dépose velours fauteuil"
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="px-3 py-2 bg-surface border border-ink font-sans text-[13px] text-ink"
          />
        </div>
      </div>

      {/* Grille opérateurs */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {lignes.map((l, i) => {
          const actif = l.heures !== '' && parseFloat(l.heures) > 0;
          return (
            <div
              key={l.operateur}
              className="p-3"
              style={{ background: actif ? '#fff' : 'rgba(255,255,255,0.55)', border: `1.5px solid ${actif ? '#000' : '#E5E5E5'}` }}
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] mb-2" style={{ color: actif ? '#000' : '#999' }}>
                {l.operateur}
              </p>
              <input
                type="number" step="0.5" min="0" placeholder="—"
                value={l.heures}
                onChange={e => setHeures(i, e.target.value)}
                className="w-full text-center font-serif tnum border bg-surface"
                style={{
                  fontSize: 22, fontWeight: 500,
                  border: `1px solid ${actif ? '#000' : '#E5E5E5'}`,
                  padding: '6px 4px',
                  color: actif ? '#000' : '#AAAAAA',
                  outline: 'none',
                }}
              />
              {actif && (
                <p className="font-mono text-[10px] text-muted text-center mt-1">
                  {parseFloat(l.heures)}h · {typeTravail}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-between items-center flex-wrap gap-2">
        <p className="font-mono text-[11px] text-muted">
          {lignesValides.length > 0
            ? lignesValides.map(l => `${l.operateur} ${l.heures}h`).join(' · ')
            : 'Saisis les heures de chaque opérateur présent'}
        </p>
        <Btn onClick={save} disabled={saving || !canSave}>
          <Plus size={14} />
          {saving
            ? 'Enregistrement…'
            : `Enregistrer${lignesValides.length > 0 ? ` (${lignesValides.length})` : ''}`}
        </Btn>
      </div>
    </div>
  );
}

function CarteOperateur({ stat }) {
  return (
    <div className="bg-surface border border-line p-4 flex-1" style={{ minWidth: 160 }}>
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted mb-1">{stat.operateur}</p>
      <p className="font-serif tnum text-[32px] leading-none text-ink">{stat.total_heures}h</p>
      <p className="font-mono text-[10px] text-muted mt-1">
        {stat.nb_saisies} saisies · {stat.nb_dossiers} dossiers
      </p>
    </div>
  );
}

export default function HeuresModule({ dossierId = null, heuresPrevues = 0 }) {
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
        .then(d => setDossiers(Array.isArray(d) ? d : d.dossiers || []));
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

  if (loading) return (
    <div className="p-5 font-sans text-[13px] text-muted">Chargement heures…</div>
  );

  return (
    <div>
      {/* En-tête */}
      <div className="flex justify-between items-end mb-6">
        <div>
          <Kicker className="mb-2">Module 04</Kicker>
          <h2 className="font-serif text-[36px] tracking-[-0.01em] leading-[1.0] text-ink">
            {dossierId ? 'Heures du dossier' : 'Suivi heures'}
          </h2>
        </div>
        <Btn
          variant={showForm ? 'outline' : 'primary'}
          onClick={() => setShowForm(f => !f)}
        >
          {showForm ? <><ChevronUp size={14} /> Fermer</> : <><Plus size={14} /> Saisir des heures</>}
        </Btn>
      </div>

      {/* Barre prévues/réelles */}
      {dossierId && prevues > 0 && <BarreHeures prevues={prevues} reelles={reelles} />}
      {dossierId && prevues === 0 && (
        <div className="border border-ink bg-bg px-3 py-2 font-sans text-[13px] text-ink mb-4">
          Pas d&apos;heures prévues — édite le dossier pour ajouter un devis horaire.
        </div>
      )}

      {/* Stats par opérateur */}
      {!dossierId && stats.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-5">
          {stats.map(s => <CarteOperateur key={s.operateur} stat={s} />)}
        </div>
      )}
      {dossierId && stats.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-4">
          {stats.map(s => (
            <div key={s.operateur} className="bg-bg border border-line px-3 py-1.5 font-sans text-[13px]">
              <span className="font-serif tnum text-[15px]">{s.total_heures}h</span>
              <span className="text-muted"> · {s.operateur} ({s.nb_saisies} saisies)</span>
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

      {/* Liste */}
      {heures.length === 0 ? (
        <div className="py-10 text-center font-sans text-[13px] text-muted border border-line">
          Aucune saisie d&apos;heures pour le moment
        </div>
      ) : (
        <div>
          <Kicker className="mb-2">{heures.length} saisie{heures.length > 1 ? 's' : ''}</Kicker>

          {/* Table globale */}
          {!dossierId && (
            <div className="border border-ink bg-surface">
              <table className="w-full">
                <thead>
                  <tr className="bg-bg border-b border-ink">
                    {['Date', 'Opérateur', 'Heures', 'Type', 'Description', 'Dossier', ''].map((h, i) => (
                      <th key={i} className="text-left px-3 py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heures.map(h => (
                    <tr key={h.id} className="border-t border-dotted border-black/30 hover:bg-bg">
                      <td className="px-3 py-2 font-mono text-[11px] tnum text-muted whitespace-nowrap">{h.date}</td>
                      <td className="px-3 py-2 font-serif text-[14px] text-ink">{h.operateur}</td>
                      <td className="px-3 py-2">
                        <span className="font-serif tnum text-[16px] text-ink">{h.heures_passees}h</span>
                      </td>
                      <td className="px-3 py-2 font-sans text-[12px] text-muted">{h.type_travail}</td>
                      <td className="px-3 py-2 font-sans text-[13px] text-ink">{h.description}</td>
                      <td className="px-3 py-2 font-sans text-[12px] text-muted truncate max-w-[160px]">
                        {h.nom_client}
                        {h.statut === 'Clos' && (
                          <span className="ml-1 font-mono text-[9px] uppercase tracking-[0.1em] px-1 py-0.5 border border-ink/40 text-muted">clos</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <button onClick={() => handleDelete(h.id)} className="p-1 text-muted">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Table par dossier */}
          {dossierId && (
            <div className="border border-ink bg-surface">
              <table className="w-full">
                <thead>
                  <tr className="bg-bg border-b border-ink">
                    {['Date', 'Opérateur', 'Heures', 'Type', 'Description', ''].map((h, i) => (
                      <th key={i} className="text-left px-3 py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heures.map(h => (
                    <tr key={h.id} className="border-t border-dotted border-black/30 hover:bg-bg">
                      <td className="px-3 py-2 font-mono text-[11px] tnum text-muted">{h.date}</td>
                      <td className="px-3 py-2 font-serif text-[14px] text-ink">{h.operateur}</td>
                      <td className="px-3 py-2 font-serif tnum text-[16px] text-ink">{h.heures_passees}h</td>
                      <td className="px-3 py-2 font-sans text-[12px] text-muted">{h.type_travail}</td>
                      <td className="px-3 py-2 font-sans text-[13px] text-ink">{h.description}</td>
                      <td className="px-3 py-2">
                        <button onClick={() => handleDelete(h.id)} className="p-1 text-muted">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
