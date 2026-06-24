'use client';
import { useState, useEffect } from 'react';
import { FileText, Save, Printer, ExternalLink, X, Plus, Trash2, Camera } from 'lucide-react';
import Kicker from './ui/Kicker';
import Btn from './ui/Btn';

const labelCls = 'font-mono uppercase tracking-[0.16em] text-[10px] text-muted block mb-1';
const fieldCls = 'w-full px-3 py-2 bg-surface border border-ink font-sans text-[13px] text-ink';
const textareaCls = `${fieldCls} resize-y`;

const ETAPES_PAR_TYPE = {
  Tapisserie: [
    { etape: 'DÉCOUVERTURE', type: '' },
    { etape: 'SANGLAGE', type: '' },
    { etape: 'GARNISSAGE', type: '' },
    { etape: 'POSE TISSU', type: '' },
    { etape: 'FINITION', type: '' },
  ],
  Rideaux: [
    { etape: 'COUPE', type: '' },
    { etape: 'COUTURE', type: '' },
    { etape: 'TÊTES', type: '' },
    { etape: 'FINITIONS', type: '' },
    { etape: 'POSE', type: '' },
  ],
  Stores: [
    { etape: 'DÉCOUPE', type: '' },
    { etape: 'MONTAGE', type: '' },
    { etape: 'ESSAI', type: '' },
    { etape: 'POSE', type: '' },
  ],
  'Tête de lit': [
    { etape: 'DÉCOUPE', type: '' },
    { etape: 'GARNISSAGE', type: '' },
    { etape: 'POSE TISSU', type: '' },
    { etape: 'FINITION', type: '' },
  ],
  'Habillage de lit': [
    { etape: 'DÉCOUPE', type: '' },
    { etape: 'COUTURE', type: '' },
    { etape: 'ASSEMBLAGE', type: '' },
    { etape: 'FINITION', type: '' },
  ],
  Coussins: [
    { etape: 'DÉCOUPE', type: '' },
    { etape: 'COUTURE', type: '' },
    { etape: 'GARNISSAGE', type: '' },
    { etape: 'FERMETURE', type: '' },
  ],
  'Pose seule': [
    { etape: 'PRÉPARATION', type: '' },
    { etape: 'POSE', type: '' },
    { etape: 'VÉRIFICATION', type: '' },
  ],
  Autre: [
    { etape: 'ÉTAPE 1', type: '' },
    { etape: 'ÉTAPE 2', type: '' },
    { etape: 'ÉTAPE 3', type: '' },
  ],
};

// Ces clés sont gérées par la section Tissus dédiée — ne pas rendre via Champ
const TISSU_KEYS = new Set(['tissu_ref', 'tissu_fournisseur', 'ml_tissu', 'tissu_rapport']);

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
          {champs.filter(f => f.type !== 'textarea' && !TISSU_KEYS.has(f.key)).map(f => (
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
  const [etapes, setEtapes]         = useState(ETAPES_PAR_TYPE[initialType] || ETAPES_PAR_TYPE['Autre']);
  const [tissus, setTissus]         = useState([]); // [{ref, fournisseur, ml, zone}]
  const [schemas_photos, setPhotos] = useState([]); // [url, ...]
  const [photoUrlInput, setPhotoUrlInput] = useState('');
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
          setEtapes(
            Array.isArray(c.etapes_custom) && c.etapes_custom.length > 0
              ? c.etapes_custom
              : (ETAPES_PAR_TYPE[type] || ETAPES_PAR_TYPE['Autre'])
          );
          setTissus(Array.isArray(c.tissus_list) ? c.tissus_list : []);
          setPhotos(Array.isArray(c.schemas_photos) ? c.schemas_photos : []);
        }
      });
  }, [dossier.id]);

  const handleChange = (key, value) => { setContenu(c => ({ ...c, [key]: value })); setSaved(false); };

  // ── Tissus ──────────────────────────────────────────────────────────────
  const addTissu    = () => { setTissus(t => [...t, { ref: '', fournisseur: '', ml: '', zone: '' }]); setSaved(false); };
  const setTissuField = (i, k, v) => { setTissus(t => t.map((x, j) => j === i ? { ...x, [k]: v } : x)); setSaved(false); };
  const delTissu    = (i) => { setTissus(t => t.filter((_, j) => j !== i)); setSaved(false); };

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
    const contenuComplet = { ...contenu, etapes_custom: etapes, tissus_list: tissus, schemas_photos };
    try {
      const r = await fetch('/api/fiches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dossier_id: dossier.id,
          type_intervention: typeIntervention,
          contenu_json: contenuComplet,
          notes_libres: notes,
        }),
      });
      const res = await r.json();
      if (!r.ok) throw new Error(res.error || 'Erreur serveur');
      if (res.id) setFicheId(res.id);
      setSaved(true);
    } catch (err) {
      alert(`Erreur lors de l'enregistrement : ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const champsActuels = schemas[typeIntervention] || [];
  const currentFiche  = ficheId
    ? { type_intervention: typeIntervention, contenu_json: JSON.stringify({ ...contenu, etapes_custom: etapes, tissus_list: tissus, schemas_photos }), notes_libres: notes }
    : null;

  const handleAddPhotoUrl = () => {
    const url = photoUrlInput.trim();
    if (!url) return;
    setPhotos(p => [...p, url]);
    setPhotoUrlInput('');
    setSaved(false);
  };

  const btnDashed = 'flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted border border-dashed border-line px-3 py-1.5 mt-1 hover:bg-bg';

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
                setEtapes(ETAPES_PAR_TYPE[t] || ETAPES_PAR_TYPE['Autre']);
                setTissus([]);
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
          {champsActuels.filter(f => !TISSU_KEYS.has(f.key)).length > 0 && (
            <div className="grid grid-cols-2 gap-3 mb-5">
              {champsActuels.filter(f => !TISSU_KEYS.has(f.key)).map(f => (
                <Champ key={f.key} field={f} value={contenu[f.key]} onChange={handleChange} />
              ))}
            </div>
          )}

          {/* ── Tissus ── */}
          <fieldset className="mb-5 border border-line p-4">
            <legend className="font-mono uppercase tracking-[0.16em] text-[10px] text-muted px-1">Tissus</legend>
            {tissus.length === 0 && (
              <p className="font-sans text-[12px] text-muted mb-2">Aucun tissu — ajoutez-en un ci-dessous.</p>
            )}
            {tissus.map((t, i) => (
              <div key={i} className="grid gap-2 mb-2" style={{ gridTemplateColumns: '1fr 1fr 72px 1fr 20px', alignItems: 'end' }}>
                <div>
                  <label className={labelCls}>Référence</label>
                  <input className={fieldCls} value={t.ref} onChange={e => setTissuField(i, 'ref', e.target.value)} placeholder="Ex: VELOURS-42" />
                </div>
                <div>
                  <label className={labelCls}>Fournisseur</label>
                  <input className={fieldCls} value={t.fournisseur} onChange={e => setTissuField(i, 'fournisseur', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>ML</label>
                  <input type="number" step="0.1" className={fieldCls} value={t.ml} onChange={e => setTissuField(i, 'ml', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Zone à poser</label>
                  <input className={fieldCls} value={t.zone} onChange={e => setTissuField(i, 'zone', e.target.value)} placeholder="Ex: Dossier, Assise…" />
                </div>
                <button onClick={() => delTissu(i)} className="text-muted pb-0.5 self-end"><Trash2 size={13} /></button>
              </div>
            ))}
            <button onClick={addTissu} className={btnDashed}>
              <Plus size={10} /> Ajouter tissu
            </button>
          </fieldset>

          {/* ── Étapes atelier ── */}
          <fieldset className="mb-5 border border-line p-4">
            <legend className="font-mono uppercase tracking-[0.16em] text-[10px] text-muted px-1">Étapes atelier</legend>
            {etapes.map((e, i) => (
              <div key={i} className="flex gap-2 mb-1.5 items-center">
                <input
                  value={e.etape}
                  onChange={ev => setEtapeField(i, 'etape', ev.target.value)}
                  placeholder="ÉTAPE"
                  className="flex-[2] px-3 py-2 bg-surface border border-ink font-mono text-[11px] text-ink uppercase tracking-[0.08em]"
                />
                <input
                  value={e.type}
                  onChange={ev => setEtapeField(i, 'type', ev.target.value)}
                  placeholder="Type / tissu"
                  className="flex-1 px-3 py-2 bg-surface border border-line font-sans text-[13px] text-ink"
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
            <button onClick={addEtape} className={btnDashed}>
              <Plus size={10} /> Ajouter étape
            </button>
          </fieldset>

          {/* ── Schémas photos ── */}
          <fieldset className="mb-5 border border-line p-4">
            <legend className="font-mono uppercase tracking-[0.16em] text-[10px] text-muted px-1">Schémas / photos</legend>
            {schemas_photos.length > 0 && (
              <div className="flex flex-wrap gap-3 mb-3">
                {schemas_photos.map((url, i) => (
                  <div key={i} className="relative" style={{ width: 120 }}>
                    <img src={url} alt={`Schéma ${i + 1}`} style={{ width: 120, height: 90, objectFit: 'cover', border: '1px solid #ccc', display: 'block' }} />
                    <button
                      onClick={() => { setPhotos(p => p.filter((_, j) => j !== i)); setSaved(false); }}
                      className="absolute top-0.5 right-0.5 bg-black text-white"
                      style={{ width: 18, height: 18, fontSize: 11, lineHeight: '18px', textAlign: 'center', padding: 0 }}
                      title="Supprimer"
                    >×</button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 mt-1">
              <input
                type="url"
                value={photoUrlInput}
                onChange={e => setPhotoUrlInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddPhotoUrl())}
                placeholder="Coller une URL d'image…"
                className="flex-1 font-mono text-[11px] border border-line px-2 py-1 bg-bg text-fg"
              />
              <button
                type="button"
                onClick={handleAddPhotoUrl}
                disabled={!photoUrlInput.trim()}
                className={btnDashed}
              >
                <Camera size={10} />
                Ajouter
              </button>
            </div>
            <p className="font-mono text-[9px] text-muted mt-2">URL d'une photo hébergée (Vercel Blob, Drive, etc.)</p>
          </fieldset>

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
