'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Plus, Trash2, Save, ChevronDown, ChevronRight, Printer, ArrowLeft } from 'lucide-react';
import { SCHEMAS, groupBySection } from '@/lib/fiches-schemas';
import { PICTO } from '@/lib/fiches-picto';

const TYPES = [
  'Tapisserie', 'Rideaux', 'Stores',
  'Tête de lit', 'Habillage de lit', 'Coussins',
  'Galettes', 'Tenture murale', 'Pose seule', 'Autre',
];

const labelCls = 'font-mono uppercase tracking-[0.16em] text-[10px] text-muted block mb-1';
const fieldCls = 'w-full px-3 py-2 bg-white border border-black font-sans text-[13px] text-black';
const sectionHd = 'flex items-center justify-between px-4 py-2 border-b border-black/20 bg-black/[0.03]';
const sectionLbl = 'font-mono uppercase tracking-[0.16em] text-[10px] text-black/50';
const addBtn = 'flex items-center justify-center w-5 h-5 border border-black text-black hover:bg-black hover:text-white transition-colors';

function DynField({ field, value, onChange }) {
  const val = value ?? '';
  if (field.type === 'textarea') return (
    <textarea value={val} onChange={e => onChange(field.key, e.target.value)} rows={3}
      placeholder={field.hint || ''}
      className="w-full px-3 py-2 bg-white border border-black font-sans text-[13px] text-black resize-none" />
  );
  if (field.type === 'select') return (
    <select value={val} onChange={e => onChange(field.key, e.target.value)} className={fieldCls}>
      <option value="">—</option>
      {field.options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
  return (
    <div className="flex items-center gap-2">
      <input type={field.type === 'number' ? 'number' : 'text'} value={val}
        onChange={e => onChange(field.key, e.target.value)}
        placeholder={field.hint || ''} className={fieldCls} />
      {field.unit && <span className="font-mono text-[11px] text-black/40 whitespace-nowrap">{field.unit}</span>}
    </div>
  );
}

export default function FichePage() {
  const { id } = useParams();
  const router = useRouter();
  const isNew = id === 'new';

  const [loaded, setLoaded]     = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [type, setType]         = useState('');
  const [contenu, setContenu]   = useState({});
  const [notes, setNotes]       = useState('');
  const [etapes, setEtapes]     = useState([]);
  const [tissus, setTissus]     = useState([]);
  const [fournitures, setFournitures]   = useState([]);
  const [intervenants, setIntervenants] = useState([]);
  const [collapsed, setCollapsed]       = useState({});
  const [saving, setSaving]   = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [dirty, setDirty]     = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  const mark = () => setDirty(true);

  useEffect(() => {
    if (isNew) { setLoaded(true); return; }
    fetch(`/api/fiches/${id}`)
      .then(r => r.json())
      .then(fiche => {
        if (!fiche || fiche.error) {
          setLoadError(fiche?.error || 'Fiche introuvable');
          setLoaded(true);
          return;
        }
        const c = typeof fiche.contenu_json === 'string'
          ? JSON.parse(fiche.contenu_json) : (fiche.contenu_json || {});
        setType(fiche.type_intervention || '');
        setContenu(c);
        setNotes(fiche.notes_libres || '');
        setEtapes(Array.isArray(c.etapes_custom) ? c.etapes_custom : []);
        setTissus(Array.isArray(c.tissus_list) ? c.tissus_list : []);
        setFournitures(Array.isArray(c.fournitures_list) ? c.fournitures_list : []);
        setIntervenants(Array.isArray(c.intervenants_list) ? c.intervenants_list : []);
        setLoaded(true);
      })
      .catch(err => { setLoadError(err.message); setLoaded(true); });
  }, [id, isNew]);

  const setField = (key, val) => { setContenu(p => ({ ...p, [key]: val })); mark(); };

  // ── Étapes ──
  const addEtape      = () => { setEtapes(e => [...e, { etape: '', type: '' }]); mark(); };
  const setEtapeField = (i, k, v) => { setEtapes(e => e.map((x, j) => j === i ? { ...x, [k]: v } : x)); mark(); };
  const delEtape      = (i) => { setEtapes(e => e.filter((_, j) => j !== i)); mark(); };
  const moveEtape     = (i, dir) => {
    setEtapes(e => {
      const a = [...e]; const ni = i + dir;
      if (ni < 0 || ni >= a.length) return a;
      [a[i], a[ni]] = [a[ni], a[i]]; return a;
    }); mark();
  };

  // ── Tissus ──
  const addTissu      = () => { setTissus(t => [...t, { ref: '', coloris: '', placement: '', metrage: '' }]); mark(); };
  const setTissuField = (i, k, v) => { setTissus(t => t.map((x, j) => j === i ? { ...x, [k]: v } : x)); mark(); };
  const delTissu      = (i) => { setTissus(t => t.filter((_, j) => j !== i)); mark(); };

  // ── Fournitures ──
  const addFourniture      = () => { setFournitures(f => [...f, { ref: '', coloris: '', placement: '', metrage: '' }]); mark(); };
  const setFournitureField = (i, k, v) => { setFournitures(f => f.map((x, j) => j === i ? { ...x, [k]: v } : x)); mark(); };
  const delFourniture      = (i) => { setFournitures(f => f.filter((_, j) => j !== i)); mark(); };

  // ── Intervenants ──
  const addIntervenant      = () => { setIntervenants(v => [...v, { nom: '', heures: '' }]); mark(); };
  const setIntervenantField = (i, k, v) => { setIntervenants(a => a.map((x, j) => j === i ? { ...x, [k]: v } : x)); mark(); };
  const delIntervenant      = (i) => { setIntervenants(a => a.filter((_, j) => j !== i)); mark(); };

  const handleSave = useCallback(async () => {
    if (!type) return;
    setSaving(true);
    const contenuComplet = {
      ...contenu,
      etapes_custom: etapes,
      tissus_list: tissus,
      fournitures_list: fournitures,
      intervenants_list: intervenants,
    };
    const body = JSON.stringify({ type_intervention: type, contenu_json: contenuComplet, notes_libres: notes });

    setSaveError(null);
    if (isNew) {
      const res = await fetch('/api/fiches', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
      });
      const data = await res.json();
      if (!res.ok) { setSaveError(data?.error || 'Erreur création'); setSaving(false); return; }
      if (data?.id) { router.replace(`/fiches/${data.id}`); }
    } else {
      const res = await fetch(`/api/fiches/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body,
      });
      if (!res.ok) {
        const data = await res.json();
        setSaveError(data?.error || 'Erreur sauvegarde');
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    setDirty(false);
    setSavedAt(new Date());
  }, [id, isNew, type, contenu, notes, etapes, tissus, fournitures, intervenants, router]);

  // Ctrl+S
  useEffect(() => {
    const handler = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave(); } };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave]);

  const toggleSection = (title) => setCollapsed(p => ({ ...p, [title]: !p[title] }));
  const schema = SCHEMAS[type] || [];
  const groups = groupBySection(schema);

  const timeStr = savedAt ? savedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : null;

  if (!loaded) return (
    <div className="min-h-screen flex items-center justify-center font-mono text-[12px] text-black/40">
      Chargement…
    </div>
  );

  if (loadError) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="border border-red-500 px-6 py-4 font-mono text-[12px] text-red-600">
        Erreur chargement : {loadError}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white">

      {/* ── Barre top fixe ── */}
      <div className="sticky top-0 z-50 bg-white border-b border-black flex items-center justify-between px-6 py-3 gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => window.close()}
            className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-black/50 hover:text-black transition-colors">
            <ArrowLeft size={13} /> Fiches
          </button>
          <span className="text-black/20">·</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-black/40">
            {isNew ? 'Nouvelle fiche' : `#${id}`}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {saveError && (
            <span className="font-mono text-[10px] text-red-600">Erreur : {saveError}</span>
          )}
          {timeStr && !dirty && !saveError && (
            <span className="font-mono text-[10px] text-black/40">Enregistré à {timeStr}</span>
          )}
          {dirty && !saveError && (
            <span className="font-mono text-[10px] text-amber-600">Modifications non enregistrées</span>
          )}
          {!isNew && (
            <a href={`/fiche-impression/${id}`} target="_blank" rel="noreferrer"
               className="flex items-center gap-1.5 px-3 py-1.5 border border-black font-mono text-[10px] uppercase tracking-[0.1em] hover:bg-black hover:text-white transition-colors">
              <Printer size={11} /> Imprimer
            </a>
          )}
          <button onClick={handleSave} disabled={saving || !type}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-black text-white font-mono text-[10px] uppercase tracking-[0.1em] disabled:opacity-40 hover:bg-black/80 transition-colors">
            <Save size={11} /> {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>

      {/* ── Contenu ── */}
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-0">

        {/* Infos client */}
        <section className="pb-8">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-black/40 mb-4">Intervention</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Client *</label>
              <input type="text" value={contenu.client_nom || ''} onChange={e => setField('client_nom', e.target.value)} className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>Référence</label>
              <input type="text" value={contenu.reference || ''} onChange={e => setField('reference', e.target.value)} placeholder="Ex : ASH-2025-001" className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>Téléphone</label>
              <input type="text" value={contenu.client_tel || ''} onChange={e => setField('client_tel', e.target.value)} className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" value={contenu.client_email || ''} onChange={e => setField('client_email', e.target.value)} className={fieldCls} />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label className={labelCls}>Adresse</label>
              <input type="text" value={contenu.client_adresse || ''} onChange={e => setField('client_adresse', e.target.value)} className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>Date d&apos;impression</label>
              <input type="date" value={contenu.date_impression || ''} onChange={e => setField('date_impression', e.target.value)} className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>Heures estimées</label>
              <input type="number" step="0.5" min="0" value={contenu.heures_estimees || ''} onChange={e => setField('heures_estimees', e.target.value)} className={fieldCls} />
            </div>
          </div>
        </section>

        {/* Type d'intervention */}
        <section className="py-8 border-t border-black">
          <label className={labelCls}>Type d&apos;intervention *</label>

          {/* Badge type sélectionné + picto */}
          {type && (
            <div className="flex items-center gap-3 mt-3 mb-4 p-3 border border-black">
              <div className="border border-black p-1 flex-shrink-0">
                {PICTO[type] || PICTO['Autre']}
              </div>
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-black/40 mb-1">Type sélectionné</p>
                <span className="font-mono text-[13px] font-medium uppercase tracking-[0.18em] bg-black text-white px-3 py-1.5">
                  {type}
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-5 gap-1.5 mt-2">
            {TYPES.map(t => (
              <button key={t} type="button" onClick={() => { setType(t); setCollapsed({}); mark(); }}
                className="px-1.5 py-2 font-mono text-[10px] uppercase tracking-[0.06em] text-center leading-tight transition-colors"
                style={{ background: type === t ? '#000' : 'transparent', color: type === t ? '#fff' : '#444', border: '1px solid #000' }}>
                {t}
              </button>
            ))}
          </div>
        </section>

        {/* Sections schéma dépliables */}
        {type && groups.map(group => (
          <div key={group.title || '__top__'} className="border-t border-black">
            {group.title ? (
              <button type="button" onClick={() => toggleSection(group.title)}
                className="flex items-center justify-between w-full py-3 hover:opacity-60 transition-opacity">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-black/50">{group.title}</span>
                <span className="text-black/30">{collapsed[group.title] ? <ChevronRight size={14} /> : <ChevronDown size={14} />}</span>
              </button>
            ) : <div className="py-3" />}
            {!collapsed[group.title] && (
              <div className="pb-5 grid grid-cols-2 gap-3">
                {group.fields.map(field => (
                  <div key={field.key} className={field.type === 'textarea' ? 'col-span-2' : ''}>
                    <label className={labelCls}>{field.label}{field.unit ? ` (${field.unit})` : ''}</label>
                    <DynField field={field} value={contenu[field.key]} onChange={setField} />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* ── Tissus ── */}
        <div className="border-t border-black pt-5 pb-3">
          <div className={sectionHd}>
            <span className={sectionLbl}>Tissus</span>
            <button onClick={addTissu} className={addBtn} title="Ajouter un tissu"><Plus size={11} /></button>
          </div>
          <div className="pt-3 space-y-2">
            {tissus.length === 0 && <p className="font-sans text-[12px] text-black/40 px-1">Aucun tissu.</p>}
            {tissus.map((t, i) => (
              <div key={i} className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr 1fr 80px 20px', alignItems: 'end' }}>
                <div><label className={labelCls}>Référence</label><input className={fieldCls} value={t.ref} onChange={e => setTissuField(i, 'ref', e.target.value)} placeholder="Ex: VELOURS-42" /></div>
                <div><label className={labelCls}>Coloris</label><input className={fieldCls} value={t.coloris || ''} onChange={e => setTissuField(i, 'coloris', e.target.value)} /></div>
                <div><label className={labelCls}>Placement</label><input className={fieldCls} value={t.placement || ''} onChange={e => setTissuField(i, 'placement', e.target.value)} /></div>
                <div><label className={labelCls}>Métrage</label><input type="number" step="0.1" className={fieldCls} value={t.metrage || ''} onChange={e => setTissuField(i, 'metrage', e.target.value)} /></div>
                <button onClick={() => delTissu(i)} className="text-black/30 hover:text-black self-end pb-0.5"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Fournitures ── */}
        <div className="border-t border-black pt-5 pb-3">
          <div className={sectionHd}>
            <span className={sectionLbl}>Fournitures diverses</span>
            <button onClick={addFourniture} className={addBtn} title="Ajouter une fourniture"><Plus size={11} /></button>
          </div>
          <div className="pt-3 space-y-2">
            {fournitures.length === 0 && <p className="font-sans text-[12px] text-black/40 px-1">Aucune fourniture.</p>}
            {fournitures.map((f, i) => (
              <div key={i} className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr 1fr 80px 20px', alignItems: 'end' }}>
                <div><label className={labelCls}>Référence</label><input className={fieldCls} value={f.ref} onChange={e => setFournitureField(i, 'ref', e.target.value)} /></div>
                <div><label className={labelCls}>Coloris</label><input className={fieldCls} value={f.coloris || ''} onChange={e => setFournitureField(i, 'coloris', e.target.value)} /></div>
                <div><label className={labelCls}>Placement</label><input className={fieldCls} value={f.placement || ''} onChange={e => setFournitureField(i, 'placement', e.target.value)} /></div>
                <div><label className={labelCls}>Métrage</label><input type="number" step="0.1" className={fieldCls} value={f.metrage || ''} onChange={e => setFournitureField(i, 'metrage', e.target.value)} /></div>
                <button onClick={() => delFourniture(i)} className="text-black/30 hover:text-black self-end pb-0.5"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Étapes ── */}
        <div className="border-t border-black pt-5 pb-3">
          <div className={sectionHd}>
            <span className={sectionLbl}>Étapes</span>
            <button onClick={addEtape} className={addBtn} title="Ajouter une étape"><Plus size={11} /></button>
          </div>
          <div className="pt-3 space-y-1.5">
            {etapes.length === 0 && <p className="font-sans text-[12px] text-black/40 px-1">Aucune étape.</p>}
            {etapes.length > 0 && (
              <div className="flex gap-2 mb-1 px-1">
                <span className="flex-[2] font-mono text-[9px] uppercase tracking-[0.14em] text-black/40">Désignation</span>
                <span className="flex-1 font-mono text-[9px] uppercase tracking-[0.14em] text-black/40">Précision</span>
                <span style={{ width: 80 }} />
              </div>
            )}
            {etapes.map((e, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input value={e.etape} onChange={ev => setEtapeField(i, 'etape', ev.target.value)} placeholder="Désignation"
                  className="flex-[2] px-3 py-2 bg-white border border-black font-mono text-[11px] text-black uppercase tracking-[0.08em]" />
                <input value={e.type} onChange={ev => setEtapeField(i, 'type', ev.target.value)} placeholder="Précision"
                  className="flex-1 px-3 py-2 bg-white border border-black font-sans text-[13px] text-black" />
                <button onClick={() => moveEtape(i, -1)} disabled={i === 0} className="px-1.5 py-1 font-mono text-[12px] text-black/30 disabled:opacity-20 hover:text-black">↑</button>
                <button onClick={() => moveEtape(i, 1)} disabled={i === etapes.length - 1} className="px-1.5 py-1 font-mono text-[12px] text-black/30 disabled:opacity-20 hover:text-black">↓</button>
                <button onClick={() => delEtape(i)} className="p-1 text-black/30 hover:text-black"><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Notes libres ── */}
        <div className="border-t border-black py-6">
          <label className={labelCls}>Instructions / notes libres</label>
          <textarea value={notes} onChange={e => { setNotes(e.target.value); mark(); }} rows={4}
            className="w-full px-3 py-2 bg-white border border-black font-sans text-[13px] text-black resize-y mt-1" />
        </div>

        {/* ── Intervenants ── */}
        <div className="border-t border-black pt-5 pb-10">
          <div className={sectionHd}>
            <span className={sectionLbl}>Heures réalisées &amp; intervenants</span>
            <button onClick={addIntervenant} className={addBtn} title="Ajouter"><Plus size={11} /></button>
          </div>
          <div className="pt-3">
            {intervenants.length === 0 && <p className="font-sans text-[12px] text-black/40 px-1">Aucun intervenant.</p>}
            {intervenants.length > 0 && (
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="text-left px-3 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-black/40 border border-black/20 bg-black/[0.03]">Nom intervenant</th>
                    <th className="text-left px-3 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-black/40 border border-black/20 bg-black/[0.03]" style={{ width: 140 }}>Heures réalisées</th>
                    <th style={{ width: 28 }} />
                  </tr>
                </thead>
                <tbody>
                  {intervenants.map((v, i) => (
                    <tr key={i}>
                      <td className="border border-black/20 p-0">
                        <input value={v.nom} onChange={e => setIntervenantField(i, 'nom', e.target.value)} placeholder="Nom"
                          className="w-full px-3 py-2 bg-white font-sans text-[13px] text-black border-0 outline-none" />
                      </td>
                      <td className="border border-black/20 p-0">
                        <input type="number" step="0.5" min="0" value={v.heures} onChange={e => setIntervenantField(i, 'heures', e.target.value)} placeholder="0"
                          className="w-full px-3 py-2 bg-white font-mono text-[13px] text-black border-0 outline-none" />
                      </td>
                      <td className="pl-1">
                        <button onClick={() => delIntervenant(i)} className="p-1 text-black/30 hover:text-black"><Trash2 size={12} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
