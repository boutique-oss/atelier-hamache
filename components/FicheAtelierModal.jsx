'use client';
import { useState, useEffect } from 'react';
import { FileText, Save, Printer, ExternalLink, X, Plus, Trash2 } from 'lucide-react';
import Kicker from './ui/Kicker';
import Btn from './ui/Btn';

const labelCls = 'font-mono uppercase tracking-[0.16em] text-[10px] text-muted block mb-1';
const fieldCls = 'w-full px-3 py-2 bg-surface border border-ink font-sans text-[13px] text-ink';
const textareaCls = `${fieldCls} resize-y`;

// Clés gérées par leurs propres sections — ne pas rendre via Champ
const SCHEMA_SKIP_KEYS = new Set(['tissu_ref', 'tissu_fournisseur', 'ml_tissu', 'tissu_rapport', 'etapes', 'fournitures']);

function Champ({ field, value, onChange }) {
  const label = <label className={labelCls}>{field.label}{field.unit ? ` (${field.unit})` : ''}</label>;

  if (field.type === 'textarea') return (
    <div style={{ gridColumn: 'span 2' }}>
      {label}
      <textarea value={value || ''} onChange={e => onChange(field.key, e.target.value)}
                className={textareaCls} style={{ minHeight: 72 }} />
    </div>
  );
  if (field.type === 'select') return (
    <div>
      {label}
      <select value={value || ''} onChange={e => onChange(field.key, e.target.value)} className={fieldCls}>
        <option value="">— Choisir —</option>
        {field.options.map(o => <option key={o}>{o}</option>)}
      </select>
    </div>
  );
  if (field.type === 'number') return (
    <div>
      {label}
      <input type="number" step="any" value={value || ''} onChange={e => onChange(field.key, e.target.value)} className={fieldCls} />
    </div>
  );
  return (
    <div>
      {label}
      <input type="text" value={value || ''} onChange={e => onChange(field.key, e.target.value)} className={fieldCls} />
    </div>
  );
}

function VueImpression({ dossier, fiche, schema, onClose }) {
  const champs = schema[fiche.type_intervention] || [];
  const contenu = JSON.parse(fiche.contenu_json || '{}');

  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'print-fiche';
    style.textContent = `@media print { @page { size: A4; margin: 12mm 14mm; } body > * { display: none !important; } #fiche-print { display: block !important; } }`;
    document.head.appendChild(style);
    return () => document.getElementById('print-fiche')?.remove();
  }, []);

  return (
    <div id="fiche-print" className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ background: 'rgba(0,0,0,.5)' }}>
      <div className="bg-surface border border-ink p-8 max-w-[680px] w-[95%] max-h-[90vh] overflow-y-auto relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-muted"><X size={20} /></button>

        <div className="border-b border-ink pb-4 mb-5">
          <Kicker className="mb-1">Atelier Stéphan Hamache · Poitiers</Kicker>
          <h2 className="font-serif text-[28px] text-ink">Fiche {fiche.type_intervention}</h2>
          <div className="flex gap-5 font-sans text-[13px] text-muted mt-2">
            <span><span className="font-mono text-[10px] uppercase tracking-[0.1em]">Client :</span> {dossier.nom_client}</span>
            <span><span className="font-mono text-[10px] uppercase tracking-[0.1em]">Réf. :</span> {dossier.ref_dossier}</span>
            <span><span className="font-mono text-[10px] uppercase tracking-[0.1em]">Statut :</span> {dossier.statut}</span>
            {dossier.heures_a_realiser > 0 && <span><span className="font-mono text-[10px] uppercase">H. devis :</span> {dossier.heures_a_realiser}h</span>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-5 gap-y-3 mb-5">
          {champs.filter(f => f.type !== 'textarea' && !SCHEMA_SKIP_KEYS.has(f.key)).map(f => (
            <div key={f.key}>
              <Kicker>{f.label}{f.unit ? ` (${f.unit})` : ''}</Kicker>
              <div className="font-serif text-[14px] text-ink py-1 border-b border-dotted border-black/30">
                {contenu[f.key] || <span className="text-muted">—</span>}
              </div>
            </div>
          ))}
        </div>

        {champs.filter(f => f.type === 'textarea').map(f => (
          <div key={f.key} className="mb-4">
            <Kicker className="mb-1">{f.label}</Kicker>
            <div className="font-sans text-[13px] text-ink bg-bg border border-line p-3 min-h-[40px] whitespace-pre-wrap">
              {contenu[f.key] || <span className="text-muted">—</span>}
            </div>
          </div>
        ))}

        {fiche.notes_libres && (
          <div className="mt-4">
            <Kicker className="mb-1">Notes libres</Kicker>
            <div className="font-sans text-[13px] text-ink bg-bg border border-line p-3 whitespace-pre-wrap">
              {fiche.notes_libres}
            </div>
          </div>
        )}

        <div className="mt-6 grid grid-cols-2 gap-5">
          {['Réalisé par', 'Contrôlé par'].map(label => (
            <div key={label}>
              <Kicker className="mb-2">{label}</Kicker>
              <div className="border-b border-ink pb-0.5 mb-1">&nbsp;</div>
              <p className="font-mono text-[10px] text-muted">Date : ___________</p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex gap-2 justify-end">
          <Btn variant="outline" onClick={onClose}>Fermer</Btn>
          <Btn onClick={() => window.print()}>
            <Printer size={14} /> Imprimer
          </Btn>
        </div>
      </div>
    </div>
  );
}

export default function FicheAtelierModal({ dossier, onClose }) {
  const initialType = dossier.type_intervention || 'Tapisserie';

  const [schemas, setSchemas]       = useState({});
  const [contenu, setContenu]       = useState({});
  const [notes, setNotes]           = useState('');
  const [typeIntervention, setType] = useState(initialType);
  const [etapes, setEtapes]           = useState([]);
  const [tissus, setTissus]           = useState([]);
  const [fournitures, setFournitures] = useState([]);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [showPrint, setShowPrint]   = useState(false);
  const [ficheId, setFicheId]       = useState(null);

  useEffect(() => {
    fetch(`/api/fiches?dossier_id=${dossier.id}`)
      .then(r => r.json())
      .then(({ fiche, schema }) => {
        setSchemas(schema);
        if (fiche) {
          setFicheId(fiche.id);
          const type = fiche.type_intervention;
          setType(type);
          const c = JSON.parse(fiche.contenu_json || '{}');
          setContenu(c);
          setNotes(fiche.notes_libres || '');
          setEtapes(Array.isArray(c.etapes_custom) ? c.etapes_custom : []);
          setTissus(Array.isArray(c.tissus_list) ? c.tissus_list : []);
          setFournitures(Array.isArray(c.fournitures_list) ? c.fournitures_list : []);
        }
      });
  }, [dossier.id]);

  const handleChange = (key, value) => { setContenu(c => ({ ...c, [key]: value })); setSaved(false); };

  // ── Tissus ──────────────────────────────────────────────────────────────
  const addTissu    = () => { setTissus(t => [...t, { ref: '', coloris: '', placement: '', metrage: '' }]); setSaved(false); };
  const setTissuField = (i, k, v) => { setTissus(t => t.map((x, j) => j === i ? { ...x, [k]: v } : x)); setSaved(false); };
  const delTissu    = (i) => { setTissus(t => t.filter((_, j) => j !== i)); setSaved(false); };

  // ── Fournitures ─────────────────────────────────────────────────────────
  const addFourniture      = () => { setFournitures(f => [...f, { ref: '', coloris: '', placement: '', metrage: '' }]); setSaved(false); };
  const setFournitureField = (i, k, v) => { setFournitures(f => f.map((x, j) => j === i ? { ...x, [k]: v } : x)); setSaved(false); };
  const delFourniture      = (i) => { setFournitures(f => f.filter((_, j) => j !== i)); setSaved(false); };

  // ── Étapes ──────────────────────────────────────────────────────────────
  const addEtape    = () => { setEtapes(e => [...e, { etape: '', type: '' }]); setSaved(false); };
  const setEtapeField = (i, k, v) => { setEtapes(e => e.map((x, j) => j === i ? { ...x, [k]: v } : x)); setSaved(false); };
  const delEtape    = (i) => { setEtapes(e => e.filter((_, j) => j !== i)); setSaved(false); };
  const moveEtape   = (i, dir) => {
    setEtapes(e => {
      const arr = [...e];
      const ni = i + dir;
      if (ni < 0 || ni >= arr.length) return arr;
      [arr[i], arr[ni]] = [arr[ni], arr[i]];
      return arr;
    });
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const contenuComplet = { ...contenu, etapes_custom: etapes, tissus_list: tissus, fournitures_list: fournitures };
    await fetch('/api/fiches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dossier_id: dossier.id,
        type_intervention: typeIntervention,
        contenu_json: contenuComplet,
        notes_libres: notes,
      }),
    });
    setSaving(false);
    setSaved(true);
  };

  const champsActuels = schemas[typeIntervention] || [];
  const currentFiche  = ficheId
    ? { type_intervention: typeIntervention, contenu_json: JSON.stringify({ ...contenu, etapes_custom: etapes, tissus_list: tissus, fournitures_list: fournitures }), notes_libres: notes }
    : null;

  return (
    <>
      <div className="fixed inset-0 z-[1000] flex items-center justify-center" style={{ background: 'rgba(0,0,0,.5)' }}>
        <div className="bg-surface border border-ink p-7 max-w-[760px] w-[95%] max-h-[90vh] overflow-y-auto relative">

          {/* En-tête */}
          <div className="flex justify-between items-start mb-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <FileText size={12} className="text-muted" />
                <Kicker>Fiche atelier</Kicker>
              </div>
              <h2 className="font-serif text-[24px] text-ink">{dossier.nom_client}</h2>
              <p className="font-mono text-[11px] text-muted">{dossier.ref_dossier} · {dossier.statut}</p>
            </div>
            <button onClick={onClose} className="p-1 text-muted"><X size={20} /></button>
          </div>

          {/* Type */}
          <div className="mb-5">
            <label className={labelCls}>Type d&apos;intervention</label>
            <select
              value={typeIntervention}
              onChange={e => {
                const t = e.target.value;
                setType(t);
                setContenu({});
                setEtapes([]);
                setTissus([]);
                setFournitures([]);
                setSaved(false);
              }}
              className={fieldCls}
              style={{ maxWidth: 260 }}
            >
              {Object.keys(schemas).length > 0
                ? Object.keys(schemas).map(t => <option key={t}>{t}</option>)
                : <option>{typeIntervention}</option>
              }
            </select>
          </div>

          {/* Champs schéma (hors champs tissu gérés séparément) */}
          {champsActuels.filter(f => !SCHEMA_SKIP_KEYS.has(f.key)).length > 0 && (
            <div className="grid grid-cols-2 gap-3 mb-5">
              {champsActuels.filter(f => !SCHEMA_SKIP_KEYS.has(f.key)).map(f => (
                <Champ key={f.key} field={f} value={contenu[f.key]} onChange={handleChange} />
              ))}
            </div>
          )}

          {/* ── Tissus ── */}
          <div className="mb-5 border border-line">
            <div className="flex items-center justify-between px-4 py-2 border-b border-line bg-bg">
              <span className="font-mono uppercase tracking-[0.16em] text-[10px] text-muted">Tissus</span>
              <button onClick={addTissu} className="flex items-center justify-center w-5 h-5 border border-ink text-ink hover:bg-ink hover:text-surface transition-colors" title="Ajouter un tissu">
                <Plus size={11} />
              </button>
            </div>
            <div className="p-4">
              {tissus.length === 0 && (
                <p className="font-sans text-[12px] text-muted">Aucun tissu.</p>
              )}
              {tissus.map((t, i) => (
                <div key={i} className="grid gap-2 mb-2" style={{ gridTemplateColumns: '1fr 1fr 1fr 72px 20px', alignItems: 'end' }}>
                  <div>
                    <label className={labelCls}>Référence</label>
                    <input className={fieldCls} value={t.ref} onChange={e => setTissuField(i, 'ref', e.target.value)} placeholder="Ex: VELOURS-42" />
                  </div>
                  <div>
                    <label className={labelCls}>Coloris</label>
                    <input className={fieldCls} value={t.coloris || ''} onChange={e => setTissuField(i, 'coloris', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Placement</label>
                    <input className={fieldCls} value={t.placement || ''} onChange={e => setTissuField(i, 'placement', e.target.value)} placeholder="Ex: Dossier, Assise…" />
                  </div>
                  <div>
                    <label className={labelCls}>Métrage</label>
                    <input type="number" step="0.1" className={fieldCls} value={t.metrage || ''} onChange={e => setTissuField(i, 'metrage', e.target.value)} />
                  </div>
                  <button onClick={() => delTissu(i)} className="text-muted pb-0.5 self-end"><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          </div>

          {/* ── Fournitures diverses ── */}
          <div className="mb-5 border border-line">
            <div className="flex items-center justify-between px-4 py-2 border-b border-line bg-bg">
              <span className="font-mono uppercase tracking-[0.16em] text-[10px] text-muted">Fournitures diverses</span>
              <button onClick={addFourniture} className="flex items-center justify-center w-5 h-5 border border-ink text-ink hover:bg-ink hover:text-surface transition-colors" title="Ajouter une fourniture">
                <Plus size={11} />
              </button>
            </div>
            <div className="p-4">
              {fournitures.length === 0 && (
                <p className="font-sans text-[12px] text-muted">Aucune fourniture.</p>
              )}
              {fournitures.map((f, i) => (
                <div key={i} className="grid gap-2 mb-2" style={{ gridTemplateColumns: '1fr 1fr 1fr 72px 20px', alignItems: 'end' }}>
                  <div>
                    <label className={labelCls}>Référence</label>
                    <input className={fieldCls} value={f.ref} onChange={e => setFournitureField(i, 'ref', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Coloris</label>
                    <input className={fieldCls} value={f.coloris || ''} onChange={e => setFournitureField(i, 'coloris', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Placement</label>
                    <input className={fieldCls} value={f.placement || ''} onChange={e => setFournitureField(i, 'placement', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Métrage</label>
                    <input type="number" step="0.1" className={fieldCls} value={f.metrage || ''} onChange={e => setFournitureField(i, 'metrage', e.target.value)} />
                  </div>
                  <button onClick={() => delFourniture(i)} className="text-muted pb-0.5 self-end"><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          </div>

          {/* ── Liste des étapes ── */}
          <div className="mb-5 border border-line">
            <div className="flex items-center justify-between px-4 py-2 border-b border-line bg-bg">
              <span className="font-mono uppercase tracking-[0.16em] text-[10px] text-muted">Étapes</span>
              <button onClick={addEtape} className="flex items-center justify-center w-5 h-5 border border-ink text-ink hover:bg-ink hover:text-surface transition-colors" title="Ajouter une étape">
                <Plus size={11} />
              </button>
            </div>
            <div className="p-4">
              {etapes.length === 0 && (
                <p className="font-sans text-[12px] text-muted">Aucune étape.</p>
              )}
              {etapes.length > 0 && (
                <div className="flex gap-2 mb-1">
                  <span className="flex-[2] font-mono text-[9px] uppercase tracking-[0.14em] text-muted pl-1">Désignation</span>
                  <span className="flex-1 font-mono text-[9px] uppercase tracking-[0.14em] text-muted pl-1">Précision</span>
                  <span style={{ width: 72 }} />
                </div>
              )}
              {etapes.map((e, i) => (
              <div key={i} className="flex gap-2 mb-1.5 items-center">
                <input
                  value={e.etape}
                  onChange={ev => setEtapeField(i, 'etape', ev.target.value)}
                  placeholder="Désignation"
                  className="flex-[2] px-3 py-2 bg-surface border border-ink font-mono text-[11px] text-ink uppercase tracking-[0.08em]"
                />
                <input
                  value={e.type}
                  onChange={ev => setEtapeField(i, 'type', ev.target.value)}
                  placeholder="Précision"
                  className="flex-1 px-3 py-2 bg-surface border border-ink font-sans text-[13px] text-ink"
                />
                <button
                  onClick={() => moveEtape(i, -1)}
                  disabled={i === 0}
                  className="px-1.5 py-1 font-mono text-[12px] text-muted disabled:opacity-25 hover:text-ink"
                  title="Remonter"
                >↑</button>
                <button
                  onClick={() => moveEtape(i, 1)}
                  disabled={i === etapes.length - 1}
                  className="px-1.5 py-1 font-mono text-[12px] text-muted disabled:opacity-25 hover:text-ink"
                  title="Descendre"
                >↓</button>
                <button onClick={() => delEtape(i)} className="p-1 text-muted hover:text-ink"><Trash2 size={12} /></button>
              </div>
            ))}
            </div>
          </div>

          {/* Notes libres */}
          <div className="mb-5">
            <label className={labelCls}>Notes libres</label>
            <textarea
              value={notes}
              onChange={e => { setNotes(e.target.value); setSaved(false); }}
              placeholder="Informations complémentaires, particularités client…"
              className={textareaCls}
              style={{ minHeight: 72 }}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end flex-wrap">
            <a
              href={`/fiche-impression/${dossier.id}`}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-ink text-surface font-sans text-[13px] font-medium"
            >
              <ExternalLink size={14} /> Fiche papier A4
            </a>
            {currentFiche && (
              <Btn variant="outline" onClick={() => setShowPrint(true)}>
                <Printer size={14} /> Aperçu
              </Btn>
            )}
            <Btn variant="outline" onClick={onClose}>Annuler</Btn>
            <Btn onClick={handleSave} disabled={saving}>
              <Save size={14} />
              {saving ? 'Enregistrement…' : saved ? '✓ Enregistré' : 'Enregistrer'}
            </Btn>
          </div>
        </div>
      </div>

      {showPrint && currentFiche && (
        <VueImpression dossier={dossier} fiche={currentFiche} schema={schemas} onClose={() => setShowPrint(false)} />
      )}
    </>
  );
}
