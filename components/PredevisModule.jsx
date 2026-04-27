'use client';
import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, X, FileText, Check, ChevronDown, ChevronUp, Printer, Download } from 'lucide-react';
import Kicker from './ui/Kicker';
import Btn from './ui/Btn';
import PredevisPrintView from './PredevisPrintView';

const C = {
  ink: '#000', inkSoft: '#444', inkMuted: '#888',
  bg: '#F5F5F5', surface: '#fff', border: '#000', borderSoft: '#E5E5E5', soft: '#EEEEEE',
};
const inp = { border: `1px solid ${C.borderSoft}`, padding: '7px 10px', fontSize: 13, background: '#fff', color: C.ink, width: '100%' };
const TYPES    = ['Tapisserie', 'Rideaux', 'Stores', 'Tête de lit', 'Habillage de lit', 'Coussins', 'Pose seule', 'Autre'];
const MATIERES = ['mousse', 'crin', 'ressorts', 'sangles', 'tissu'];
const ZONES    = ['dessus', 'dessous', 'les_deux'];

function fmt(n) { return Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function defaultTapOps() { return { degarnissage: false, recollage: false, decouverture: false, recouverture: false, creation: false, modificationStructure: false, changement: { actif: false, matiere: 'mousse', zone: 'les_deux' }, finition: { actif: false, galons: false, frange: false, invisible: false, clous: false, griffe: false } }; }
function parseTapOps(raw) { try { return { ...defaultTapOps(), ...JSON.parse(raw || '{}') }; } catch { return defaultTapOps(); } }
function parseJSON(raw) { try { return JSON.parse(raw || '[]'); } catch { return []; } }

function calcTotaux(form) {
  const tissus      = parseJSON(form.tissus).reduce((s, t) => s + (parseFloat(t.prixMetre) || 0) * (parseFloat(t.metrage) || 0), 0);
  const fournitures = parseJSON(form.fournitures).reduce((s, f) => s + (parseFloat(f.prixUnit) || 0) * (parseFloat(f.quantite) || 0), 0);
  const mdo         = (parseFloat(form.heures_estimees) || 0) * (parseFloat(form.taux_horaire) || 55);
  const pose        = parseFloat(form.forfait_pose) || 0;
  const deplacement = (parseFloat(form.km_deplacement) || 0) * (parseFloat(form.tarif_km) || 0.5);
  const ht          = tissus + fournitures + mdo + pose + deplacement;
  const ttc         = ht * (1 + (parseFloat(form.taux_tva) || 0.20));
  return { tissus, fournitures, mdo, pose, deplacement, ht, ttc };
}

const labelCls = 'font-mono uppercase tracking-[0.16em] text-[10px] text-muted block mb-1';
const fieldCls = 'w-full px-3 py-2 bg-surface border border-line font-sans text-[13px] text-ink';

function FormulairePredevis({ initial, onSave, onClose }) {
  const [form, setForm] = useState({
    client_nom: '', client_tel: '', client_email: '', client_adresse: '',
    description: '', type_intervention: 'Tapisserie', urgent: false,
    heures_estimees: '', taux_horaire: 55, forfait_pose: 0,
    km_deplacement: 0, tarif_km: 0.5, taux_tva: 0.20, notes: '',
    tissus: '[]', fournitures: '[]', statut: 'brouillon',
    tapisserie_ops: JSON.stringify(defaultTapOps()),
    ...initial,
  });
  const [saving, setSaving] = useState(false);
  const [showTap, setShowTap] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const tapOps = parseTapOps(form.tapisserie_ops);
  const setTap = (k, v) => set('tapisserie_ops', JSON.stringify({ ...tapOps, [k]: v }));

  const tissus      = parseJSON(form.tissus);
  const fournitures = parseJSON(form.fournitures);
  const totaux      = useMemo(() => calcTotaux(form), [form]);

  const addTissu = () => set('tissus', JSON.stringify([...tissus, { id: Date.now(), fournisseur: '', reference: '', prixMetre: '', metrage: '' }]));
  const setTissu = (i, k, v) => set('tissus', JSON.stringify(tissus.map((t, j) => j === i ? { ...t, [k]: v } : t)));
  const delTissu = (i) => set('tissus', JSON.stringify(tissus.filter((_, j) => j !== i)));

  const addFourn = () => set('fournitures', JSON.stringify([...fournitures, { id: Date.now(), designation: '', quantite: '', unite: 'u', prixUnit: '' }]));
  const setFourn = (i, k, v) => set('fournitures', JSON.stringify(fournitures.map((f, j) => j === i ? { ...f, [k]: v } : f)));
  const delFourn = (i) => set('fournitures', JSON.stringify(fournitures.filter((_, j) => j !== i)));

  const save = async () => {
    setSaving(true);
    const payload = { ...form, total_ht: totaux.ht, total_ttc: totaux.ttc, tapisserie_ops: tapOps, tissus, fournitures };
    await onSave(payload);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[300] overflow-y-auto p-6" style={{ background: 'rgba(0,0,0,0.55)' }}>
      <div className="bg-surface border-2 border-ink max-w-[760px] mx-auto p-7">

        {/* En-tête */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <Kicker className="mb-1">{initial?.id ? `Prédevis ${initial.reference}` : 'Nouveau prédevis'}</Kicker>
            <h2 className="font-serif text-[28px] text-ink">Chiffrage</h2>
          </div>
          <button onClick={onClose} className="p-1 text-muted"><X size={20} /></button>
        </div>

        {/* Client */}
        <fieldset className="mb-5 border border-line p-4">
          <legend className="font-mono uppercase tracking-[0.16em] text-[10px] text-muted px-1">Client</legend>
          <div className="grid grid-cols-2 gap-3">
            {[['client_nom','Nom'],['client_tel','Téléphone'],['client_email','Email'],['client_adresse','Adresse']].map(([k, label]) => (
              <div key={k}>
                <label className={labelCls}>{label}</label>
                <input className={fieldCls} value={form[k]} onChange={e => set(k, e.target.value)} />
              </div>
            ))}
          </div>
        </fieldset>

        {/* Intervention */}
        <fieldset className="mb-5 border border-line p-4">
          <legend className="font-mono uppercase tracking-[0.16em] text-[10px] text-muted px-1">Intervention</legend>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className={labelCls}>Type</label>
              <select className={fieldCls} value={form.type_intervention} onChange={e => set('type_intervention', e.target.value)}>
                {TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Description</label>
              <input className={fieldCls} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Ex: Bergère Louis XV" />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 font-sans text-[13px] cursor-pointer">
                <input type="checkbox" checked={form.urgent} onChange={e => set('urgent', e.target.checked)} />
                <span style={{ color: form.urgent ? '#FF0000' : C.inkSoft, fontWeight: form.urgent ? 700 : 400 }}>Urgent</span>
              </label>
            </div>
          </div>

          {form.type_intervention === 'Tapisserie' && (
            <div>
              <button onClick={() => setShowTap(v => !v)} className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted mb-2">
                {showTap ? <ChevronUp size={12} /> : <ChevronDown size={12} />} Opérations tapisserie
              </button>
              {showTap && (
                <div className="bg-bg border border-line p-3">
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {['degarnissage','recollage','decouverture','recouverture','creation','modificationStructure'].map(op => (
                      <label key={op} className="flex items-center gap-1.5 font-sans text-[12px] cursor-pointer">
                        <input type="checkbox" checked={!!tapOps[op]} onChange={e => setTap(op, e.target.checked)} />
                        {op.charAt(0).toUpperCase() + op.slice(1).replace(/([A-Z])/g, ' $1')}
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-4 mb-2 flex-wrap">
                    <label className="flex items-center gap-1.5 font-sans text-[12px] cursor-pointer">
                      <input type="checkbox" checked={!!tapOps.changement?.actif} onChange={e => setTap('changement', { ...tapOps.changement, actif: e.target.checked })} />
                      Changement matière
                    </label>
                    {tapOps.changement?.actif && (
                      <>
                        <select className="px-2 py-1 border border-line text-[12px]" value={tapOps.changement.matiere} onChange={e => setTap('changement', { ...tapOps.changement, matiere: e.target.value })}>
                          {MATIERES.map(m => <option key={m}>{m}</option>)}
                        </select>
                        <select className="px-2 py-1 border border-line text-[12px]" value={tapOps.changement.zone} onChange={e => setTap('changement', { ...tapOps.changement, zone: e.target.value })}>
                          {ZONES.map(z => <option key={z}>{z}</option>)}
                        </select>
                      </>
                    )}
                  </div>
                  <div className="flex gap-4 flex-wrap">
                    <label className="flex items-center gap-1.5 font-sans text-[12px] cursor-pointer">
                      <input type="checkbox" checked={!!tapOps.finition?.actif} onChange={e => setTap('finition', { ...tapOps.finition, actif: e.target.checked })} />
                      Finitions
                    </label>
                    {tapOps.finition?.actif && ['galons','frange','invisible','clous','griffe'].map(f => (
                      <label key={f} className="flex items-center gap-1.5 font-sans text-[12px] cursor-pointer">
                        <input type="checkbox" checked={!!tapOps.finition?.[f]} onChange={e => setTap('finition', { ...tapOps.finition, [f]: e.target.checked })} />
                        {f}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </fieldset>

        {/* Tissus */}
        <fieldset className="mb-5 border border-line p-4">
          <legend className="font-mono uppercase tracking-[0.16em] text-[10px] text-muted px-1">Tissus</legend>
          {tissus.map((t, i) => (
            <div key={t.id} className="grid gap-2 mb-2" style={{ gridTemplateColumns: '1fr 1fr 80px 80px 24px', alignItems: 'end' }}>
              <div><label className={labelCls}>Fournisseur</label><input className={fieldCls} value={t.fournisseur} onChange={e => setTissu(i, 'fournisseur', e.target.value)} /></div>
              <div><label className={labelCls}>Référence</label><input className={fieldCls} value={t.reference} onChange={e => setTissu(i, 'reference', e.target.value)} /></div>
              <div><label className={labelCls}>Prix/m</label><input type="number" step="0.01" className={fieldCls} value={t.prixMetre} onChange={e => setTissu(i, 'prixMetre', e.target.value)} /></div>
              <div><label className={labelCls}>Métrage</label><input type="number" step="0.1" className={fieldCls} value={t.metrage} onChange={e => setTissu(i, 'metrage', e.target.value)} /></div>
              <button onClick={() => delTissu(i)} className="text-muted pb-0.5"><Trash2 size={13} /></button>
            </div>
          ))}
          <button onClick={addTissu} className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted border border-dashed border-line px-3 py-1 mt-1">
            <Plus size={10} /> Ajouter tissu
          </button>
        </fieldset>

        {/* Fournitures */}
        <fieldset className="mb-5 border border-line p-4">
          <legend className="font-mono uppercase tracking-[0.16em] text-[10px] text-muted px-1">Fournitures</legend>
          {fournitures.map((f, i) => (
            <div key={f.id} className="grid gap-2 mb-2" style={{ gridTemplateColumns: '2fr 70px 60px 80px 24px', alignItems: 'end' }}>
              <div><label className={labelCls}>Désignation</label><input className={fieldCls} value={f.designation} onChange={e => setFourn(i, 'designation', e.target.value)} /></div>
              <div><label className={labelCls}>Qté</label><input type="number" step="0.5" className={fieldCls} value={f.quantite} onChange={e => setFourn(i, 'quantite', e.target.value)} /></div>
              <div><label className={labelCls}>Unité</label>
                <select className={fieldCls} value={f.unite} onChange={e => setFourn(i, 'unite', e.target.value)}>
                  {['u','m²','ml','kg','lot'].map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div><label className={labelCls}>Prix unit.</label><input type="number" step="0.01" className={fieldCls} value={f.prixUnit} onChange={e => setFourn(i, 'prixUnit', e.target.value)} /></div>
              <button onClick={() => delFourn(i)} className="text-muted pb-0.5"><Trash2 size={13} /></button>
            </div>
          ))}
          <button onClick={addFourn} className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted border border-dashed border-line px-3 py-1 mt-1">
            <Plus size={10} /> Ajouter fourniture
          </button>
        </fieldset>

        {/* MO & frais */}
        <fieldset className="mb-5 border border-line p-4">
          <legend className="font-mono uppercase tracking-[0.16em] text-[10px] text-muted px-1">Main-d&apos;œuvre &amp; frais</legend>
          <div className="grid grid-cols-3 gap-3 mb-3">
            {[['heures_estimees','Heures estimées'],['taux_horaire','Taux horaire (€/h)'],['forfait_pose','Forfait pose (€)'],['km_deplacement','Km déplacement'],['tarif_km','Tarif km (€)']].map(([k, label]) => (
              <div key={k}>
                <label className={labelCls}>{label}</label>
                <input type="number" step="0.5" className={fieldCls} value={form[k]} onChange={e => set(k, e.target.value)} />
              </div>
            ))}
            <div>
              <label className={labelCls}>TVA</label>
              <select className={fieldCls} value={form.taux_tva} onChange={e => set('taux_tva', parseFloat(e.target.value))}>
                <option value={0.10}>10 %</option>
                <option value={0.20}>20 %</option>
              </select>
            </div>
          </div>
        </fieldset>

        {/* Devis papier — récap TTC */}
        <div className="mb-5 border border-ink">
          {/* Masthead */}
          <div className="text-center px-4 py-3 border-b border-ink bg-bg">
            <Kicker>Atelier Hamache · Devis</Kicker>
          </div>
          {/* Lignes */}
          <div className="px-4 py-3">
            {[
              ['Tissus', totaux.tissus],
              ['Fournitures', totaux.fournitures],
              ['Main-d\'œuvre', totaux.mdo],
              ...(totaux.pose > 0 ? [['Pose', totaux.pose]] : []),
              ...(totaux.deplacement > 0 ? [['Déplacement', totaux.deplacement]] : []),
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between py-1.5 border-b border-dotted border-black/30">
                <span className="font-sans text-[13px] text-muted">{label}</span>
                <span className="font-mono tnum text-[13px] text-ink">{fmt(val)} €</span>
              </div>
            ))}
          </div>
          {/* Total */}
          <div className="px-4 py-2 border-t border-ink">
            <div className="flex justify-between mb-1">
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">Total HT</span>
              <span className="font-mono tnum text-[13px] text-ink">{fmt(totaux.ht)} €</span>
            </div>
          </div>
          <div className="flex justify-between items-center px-4 py-3 bg-ink text-surface">
            <span className="font-serif text-[16px]">Total TTC</span>
            <span className="font-serif tnum text-[28px]">{fmt(totaux.ttc)} €</span>
          </div>
          <div className="px-4 py-2 border-t border-line bg-bg">
            <p className="font-mono text-[10px] text-muted text-center">Validité 30 jours · Acompte 30 %</p>
          </div>
        </div>

        {/* Notes */}
        <div className="mb-5">
          <label className={labelCls}>Notes internes</label>
          <textarea rows={2} className="w-full px-3 py-2 bg-surface border border-line font-sans text-[13px] text-ink resize-y" value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Btn variant="outline" onClick={onClose}>Annuler</Btn>
          <Btn onClick={save} disabled={saving}>
            <Check size={14} /> {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Btn>
        </div>
      </div>
    </div>
  );
}

export default function PredevisModule() {
  const [list, setList]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [printing, setPrinting] = useState(null);

  const load = async () => {
    const r = await fetch('/api/predevis');
    setList(await r.json());
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleSave = async (payload) => {
    if (editing?.id) {
      await fetch(`/api/predevis/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    } else {
      await fetch('/api/predevis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    }
    await load();
    setEditing(null);
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce prédevis ?')) return;
    await fetch(`/api/predevis/${id}`, { method: 'DELETE' });
    await load();
  };

  const stats = useMemo(() => ({
    total:      list.length,
    brouillons: list.filter(p => p.statut === 'brouillon').length,
    envoyes:    list.filter(p => p.statut === 'envoyé').length,
    convertis:  list.filter(p => p.statut === 'converti').length,
  }), [list]);

  if (loading) return <div className="p-5 font-sans text-[13px] text-muted">Chargement…</div>;

  const STATUT_PILL = {
    brouillon: 'border border-line text-muted',
    'envoyé':   'border border-ink text-ink',
    accepté:    'bg-ink text-surface',
    refusé:     'border border-line text-muted',
    converti:   'bg-ink text-surface',
  };

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <Kicker className="mb-2">Module 07</Kicker>
          <h2 className="font-serif text-[36px] tracking-[-0.01em] leading-[1.0] text-ink">Prédevis</h2>
          <p className="font-sans text-[13px] text-muted mt-1">{list.length} chiffrage{list.length > 1 ? 's' : ''}</p>
        </div>
        <Btn onClick={() => setEditing({})}>
          <Plus size={14} /> Nouveau prédevis
        </Btn>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 mb-6 border border-ink">
        {[['Total', stats.total, false], ['Brouillons', stats.brouillons, false], ['Envoyés', stats.envoyes, false], ['Convertis', stats.convertis, true]].map(([label, val, inverted], idx) => (
          <div key={label} className={`p-4 ${idx > 0 ? 'border-l border-ink' : ''} ${inverted ? 'bg-ink text-surface' : 'bg-surface text-ink'}`}>
            <Kicker className={`mb-2 ${inverted ? 'text-white/60' : ''}`}>{label}</Kicker>
            <p className="font-serif tnum text-[28px] leading-none">{val}</p>
          </div>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-line font-sans text-[13px] text-muted">
          <FileText size={32} className="mx-auto mb-3 opacity-30" />
          Aucun prédevis — créez-en un
        </div>
      ) : (
        <div className="border border-ink bg-surface">
          <table className="w-full">
            <thead>
              <tr className="bg-bg border-b border-ink">
                {['Réf.', 'Client', 'Intervention', 'Total HT', 'Total TTC', 'Statut', ''].map((h, i) => (
                  <th key={i} className="text-left px-3 py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map(p => (
                <tr key={p.id} className="border-t border-dotted border-black/30 hover:bg-bg">
                  <td className="px-3 py-2 font-mono text-[11px] text-muted">{p.reference}</td>
                  <td className="px-3 py-2 font-serif text-[14px] text-ink">{p.client_nom || '—'}</td>
                  <td className="px-3 py-2 font-sans text-[13px] text-muted">
                    {p.type_intervention}{p.description ? ` · ` : ''}
                    {p.description ? <em>{p.description}</em> : null}
                  </td>
                  <td className="px-3 py-2 font-mono tnum text-[12px] text-muted">{fmt(p.total_ht)} €</td>
                  <td className="px-3 py-2 font-serif tnum text-[15px] text-ink">{fmt(p.total_ttc)} €</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block font-mono text-[10px] uppercase tracking-[0.1em] px-2 py-0.5 ${STATUT_PILL[p.statut] || 'border border-line text-muted'}`}>
                      {p.statut}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button onClick={() => setPrinting(p)} title="Imprimer/Télécharger PDF" className="px-2 py-1 border border-line font-mono text-[10px] text-muted hover:bg-bg">
                        <Printer size={12} />
                      </button>
                      <button onClick={() => setEditing(p)} className="px-2 py-1 border border-line font-mono text-[10px] text-muted hover:bg-bg">Éditer</button>
                      <button onClick={() => handleDelete(p.id)} className="px-2 py-1 border border-line text-muted hover:bg-bg">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing !== null && (
        <FormulairePredevis
          initial={editing?.id ? editing : undefined}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}

      {printing !== null && (
        <PredevisPrintView
          predevis={printing}
          onClose={() => setPrinting(null)}
        />
      )}
    </div>
  );
}
