'use client';
import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, X, FileText, Check, ChevronDown, ChevronUp } from 'lucide-react';

const C = {
  ink: '#000', inkSoft: '#444', inkMuted: '#888',
  bg: '#F5F5F5', surface: '#fff', border: '#000', borderSoft: '#E5E5E5', soft: '#EEEEEE',
};
const inp = { border: `1px solid ${C.borderSoft}`, padding: '7px 10px', fontSize: 13, background: '#fff', color: C.ink, width: '100%' };
const TYPES = ['Tapisserie', 'Rideaux', 'Stores', 'Tête de lit', 'Habillage de lit', 'Coussins', 'Pose seule', 'Autre'];
const MATIERES = ['mousse', 'crin', 'ressorts', 'sangles', 'tissu'];
const ZONES    = ['dessus', 'dessous', 'les_deux'];
const STATUT_COLORS = { brouillon: '#888', envoyé: '#000', accepté: '#000', refusé: '#ccc', converti: '#000' };

function fmt(n) { return Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function defaultTapOps() {
  return { degarnissage: false, recollage: false, decouverture: false, recouverture: false, creation: false, modificationStructure: false, changement: { actif: false, matiere: 'mousse', zone: 'les_deux' }, finition: { actif: false, galons: false, frange: false, invisible: false, clous: false, griffe: false } };
}
function parseTapOps(raw) { try { return { ...defaultTapOps(), ...JSON.parse(raw || '{}') }; } catch { return defaultTapOps(); } }
function parseJSON(raw) { try { return JSON.parse(raw || '[]'); } catch { return []; } }

function calcTotaux(form) {
  const tissus     = parseJSON(form.tissus).reduce((s, t) => s + (parseFloat(t.prixMetre) || 0) * (parseFloat(t.metrage) || 0), 0);
  const fournitures = parseJSON(form.fournitures).reduce((s, f) => s + (parseFloat(f.prixUnit) || 0) * (parseFloat(f.quantite) || 0), 0);
  const mdo        = (parseFloat(form.heures_estimees) || 0) * (parseFloat(form.taux_horaire) || 55);
  const pose       = parseFloat(form.forfait_pose) || 0;
  const deplacement = (parseFloat(form.km_deplacement) || 0) * (parseFloat(form.tarif_km) || 0.5);
  const ht         = tissus + fournitures + mdo + pose + deplacement;
  const ttc        = ht * (1 + (parseFloat(form.taux_tva) || 0.20));
  return { tissus, fournitures, mdo, pose, deplacement, ht, ttc };
}

// ── Formulaire prédevis ─────────────────────────────────────────────────────
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

  const s = { border: `1px solid ${C.borderSoft}`, padding: '6px 10px', fontSize: 13, background: '#fff', color: C.ink };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 300, overflowY: 'auto', padding: '24px 16px' }}>
      <div style={{ background: '#fff', border: '2px solid #000', maxWidth: 760, margin: '0 auto', padding: 28 }}>

        {/* En-tête */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs uppercase tracking-widest mb-1" style={{ color: C.inkMuted }}>
              {initial?.id ? `Prédevis ${initial.reference}` : 'Nouveau prédevis'}
            </p>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 500, color: C.ink }}>Chiffrage</h2>
          </div>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        {/* Client */}
        <fieldset className="mb-5" style={{ border: `1px solid ${C.borderSoft}`, padding: 14 }}>
          <legend className="text-xs uppercase tracking-wider px-1" style={{ color: C.inkMuted }}>Client</legend>
          <div className="grid grid-cols-2 gap-3">
            {[['client_nom','Nom'],['client_tel','Téléphone'],['client_email','Email'],['client_adresse','Adresse']].map(([k, label]) => (
              <div key={k}>
                <label className="block text-xs mb-1" style={{ color: C.inkMuted }}>{label}</label>
                <input style={s} value={form[k]} onChange={e => set(k, e.target.value)} />
              </div>
            ))}
          </div>
        </fieldset>

        {/* Intervention */}
        <fieldset className="mb-5" style={{ border: `1px solid ${C.borderSoft}`, padding: 14 }}>
          <legend className="text-xs uppercase tracking-wider px-1" style={{ color: C.inkMuted }}>Intervention</legend>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: C.inkMuted }}>Type</label>
              <select style={s} value={form.type_intervention} onChange={e => set('type_intervention', e.target.value)}>
                {TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: C.inkMuted }}>Description</label>
              <input style={s} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Ex: Bergère Louis XV" />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.urgent} onChange={e => set('urgent', e.target.checked)} />
                <span style={{ color: form.urgent ? '#FF0000' : C.inkSoft, fontWeight: form.urgent ? 700 : 400 }}>Urgent</span>
              </label>
            </div>
          </div>

          {/* Tapisserie ops */}
          {form.type_intervention === 'Tapisserie' && (
            <div>
              <button onClick={() => setShowTap(v => !v)} className="flex items-center gap-2 text-xs mb-2" style={{ color: C.inkSoft }}>
                {showTap ? <ChevronUp size={13} /> : <ChevronDown size={13} />} Opérations tapisserie
              </button>
              {showTap && (
                <div style={{ background: C.bg, border: `1px solid ${C.borderSoft}`, padding: 12 }}>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {['degarnissage','recollage','decouverture','recouverture','creation','modificationStructure'].map(op => (
                      <label key={op} className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input type="checkbox" checked={!!tapOps[op]} onChange={e => setTap(op, e.target.checked)} />
                        {op.charAt(0).toUpperCase() + op.slice(1).replace(/([A-Z])/g, ' $1')}
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-4 mb-2 flex-wrap">
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input type="checkbox" checked={!!tapOps.changement?.actif} onChange={e => setTap('changement', { ...tapOps.changement, actif: e.target.checked })} />
                      Changement matière
                    </label>
                    {tapOps.changement?.actif && (
                      <>
                        <select style={{ ...s, width: 'auto' }} value={tapOps.changement.matiere} onChange={e => setTap('changement', { ...tapOps.changement, matiere: e.target.value })}>
                          {MATIERES.map(m => <option key={m}>{m}</option>)}
                        </select>
                        <select style={{ ...s, width: 'auto' }} value={tapOps.changement.zone} onChange={e => setTap('changement', { ...tapOps.changement, zone: e.target.value })}>
                          {ZONES.map(z => <option key={z}>{z}</option>)}
                        </select>
                      </>
                    )}
                  </div>
                  <div className="flex gap-4 flex-wrap">
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input type="checkbox" checked={!!tapOps.finition?.actif} onChange={e => setTap('finition', { ...tapOps.finition, actif: e.target.checked })} />
                      Finitions
                    </label>
                    {tapOps.finition?.actif && ['galons','frange','invisible','clous','griffe'].map(f => (
                      <label key={f} className="flex items-center gap-1.5 text-xs cursor-pointer">
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
        <fieldset className="mb-5" style={{ border: `1px solid ${C.borderSoft}`, padding: 14 }}>
          <legend className="text-xs uppercase tracking-wider px-1" style={{ color: C.inkMuted }}>Tissus</legend>
          {tissus.map((t, i) => (
            <div key={t.id} className="grid gap-2 mb-2" style={{ gridTemplateColumns: '1fr 1fr 80px 80px 24px', alignItems: 'end' }}>
              <div><label className="block text-xs mb-1" style={{ color: C.inkMuted }}>Fournisseur</label><input style={s} value={t.fournisseur} onChange={e => setTissu(i, 'fournisseur', e.target.value)} /></div>
              <div><label className="block text-xs mb-1" style={{ color: C.inkMuted }}>Référence</label><input style={s} value={t.reference} onChange={e => setTissu(i, 'reference', e.target.value)} /></div>
              <div><label className="block text-xs mb-1" style={{ color: C.inkMuted }}>Prix/m</label><input type="number" step="0.01" style={s} value={t.prixMetre} onChange={e => setTissu(i, 'prixMetre', e.target.value)} /></div>
              <div><label className="block text-xs mb-1" style={{ color: C.inkMuted }}>Métrage</label><input type="number" step="0.1" style={s} value={t.metrage} onChange={e => setTissu(i, 'metrage', e.target.value)} /></div>
              <button onClick={() => delTissu(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', paddingBottom: 2 }}><Trash2 size={13} color="#888" /></button>
            </div>
          ))}
          <button onClick={addTissu} className="flex items-center gap-1 text-xs mt-1" style={{ color: C.inkSoft, border: `1px dashed ${C.borderSoft}`, padding: '4px 10px' }}>
            <Plus size={11} /> Ajouter tissu
          </button>
        </fieldset>

        {/* Fournitures */}
        <fieldset className="mb-5" style={{ border: `1px solid ${C.borderSoft}`, padding: 14 }}>
          <legend className="text-xs uppercase tracking-wider px-1" style={{ color: C.inkMuted }}>Fournitures</legend>
          {fournitures.map((f, i) => (
            <div key={f.id} className="grid gap-2 mb-2" style={{ gridTemplateColumns: '2fr 70px 60px 80px 24px', alignItems: 'end' }}>
              <div><label className="block text-xs mb-1" style={{ color: C.inkMuted }}>Désignation</label><input style={s} value={f.designation} onChange={e => setFourn(i, 'designation', e.target.value)} /></div>
              <div><label className="block text-xs mb-1" style={{ color: C.inkMuted }}>Qté</label><input type="number" step="0.5" style={s} value={f.quantite} onChange={e => setFourn(i, 'quantite', e.target.value)} /></div>
              <div><label className="block text-xs mb-1" style={{ color: C.inkMuted }}>Unité</label>
                <select style={s} value={f.unite} onChange={e => setFourn(i, 'unite', e.target.value)}>
                  {['u','m²','ml','kg','lot'].map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div><label className="block text-xs mb-1" style={{ color: C.inkMuted }}>Prix unit.</label><input type="number" step="0.01" style={s} value={f.prixUnit} onChange={e => setFourn(i, 'prixUnit', e.target.value)} /></div>
              <button onClick={() => delFourn(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', paddingBottom: 2 }}><Trash2 size={13} color="#888" /></button>
            </div>
          ))}
          <button onClick={addFourn} className="flex items-center gap-1 text-xs mt-1" style={{ color: C.inkSoft, border: `1px dashed ${C.borderSoft}`, padding: '4px 10px' }}>
            <Plus size={11} /> Ajouter fourniture
          </button>
        </fieldset>

        {/* Main-d'œuvre & frais */}
        <fieldset className="mb-5" style={{ border: `1px solid ${C.borderSoft}`, padding: 14 }}>
          <legend className="text-xs uppercase tracking-wider px-1" style={{ color: C.inkMuted }}>Main-d'œuvre & frais</legend>
          <div className="grid grid-cols-3 gap-3 mb-3">
            {[['heures_estimees','Heures estimées','number'],['taux_horaire','Taux horaire (€/h)','number'],['forfait_pose','Forfait pose (€)','number'],['km_deplacement','Km déplacement','number'],['tarif_km','Tarif km (€)','number']].map(([k, label, type]) => (
              <div key={k}>
                <label className="block text-xs mb-1" style={{ color: C.inkMuted }}>{label}</label>
                <input type={type} step="0.5" style={s} value={form[k]} onChange={e => set(k, e.target.value)} />
              </div>
            ))}
            <div>
              <label className="block text-xs mb-1" style={{ color: C.inkMuted }}>TVA</label>
              <select style={s} value={form.taux_tva} onChange={e => set('taux_tva', parseFloat(e.target.value))}>
                <option value={0.10}>10 %</option>
                <option value={0.20}>20 %</option>
              </select>
            </div>
          </div>
        </fieldset>

        {/* Total */}
        <div className="mb-5 p-4" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm mb-3">
            <span style={{ color: C.inkSoft }}>Tissus</span><span className="text-right">{fmt(totaux.tissus)} €</span>
            <span style={{ color: C.inkSoft }}>Fournitures</span><span className="text-right">{fmt(totaux.fournitures)} €</span>
            <span style={{ color: C.inkSoft }}>Main-d'œuvre</span><span className="text-right">{fmt(totaux.mdo)} €</span>
            {totaux.pose > 0 && <><span style={{ color: C.inkSoft }}>Pose</span><span className="text-right">{fmt(totaux.pose)} €</span></>}
            {totaux.deplacement > 0 && <><span style={{ color: C.inkSoft }}>Déplacement</span><span className="text-right">{fmt(totaux.deplacement)} €</span></>}
          </div>
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
            <div className="flex justify-between text-sm mb-1">
              <span style={{ color: C.inkSoft }}>Total HT</span>
              <span style={{ fontWeight: 600 }}>{fmt(totaux.ht)} €</span>
            </div>
            <div className="flex justify-between">
              <span style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 500 }}>Total TTC</span>
              <span style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 700 }}>{fmt(totaux.ttc)} €</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="mb-5">
          <label className="block text-xs mb-1 uppercase tracking-wide" style={{ color: C.inkMuted }}>Notes internes</label>
          <textarea rows={2} style={{ ...s, resize: 'vertical' }} value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm" style={{ border: `1px solid ${C.borderSoft}`, color: C.inkSoft }}>Annuler</button>
          <button onClick={save} disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-semibold"
                  style={{ background: '#000', color: '#fff', border: 'none', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
            <Check size={14} /> {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Liste prédevis ─────────────────────────────────────────────────────────
export default function PredevisModule() {
  const [list, setList]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | {} | {id,...}

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
    total: list.length,
    brouillons: list.filter(p => p.statut === 'brouillon').length,
    envoyes: list.filter(p => p.statut === 'envoyé').length,
    convertis: list.filter(p => p.statut === 'converti').length,
  }), [list]);

  if (loading) return <div style={{ padding: 20, color: C.inkMuted, fontSize: 13 }}>Chargement…</div>;

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 28, fontWeight: 500, color: C.ink, lineHeight: 1.1 }}>Prédevis</h2>
          <p className="text-sm mt-1" style={{ color: C.inkSoft }}>{list.length} chiffrage{list.length > 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setEditing({})} className="flex items-center gap-2 px-4 py-2 text-sm font-medium"
                style={{ background: '#000', color: '#fff', border: 'none', cursor: 'pointer' }}>
          <Plus size={14} /> Nouveau prédevis
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 mb-6">
        {[['Total',stats.total,C.surface],[`Brouillons`,stats.brouillons,C.surface],[`Envoyés`,stats.envoyes,C.surface],[`Convertis`,stats.convertis,'#000']].map(([label, val, bg]) => (
          <div key={label} className="p-4" style={{ background: bg, border: `1px solid ${bg === '#000' ? '#000' : C.borderSoft}` }}>
            <p className="text-xs mb-2" style={{ color: bg === '#000' ? 'rgba(255,255,255,0.6)' : C.inkMuted }}>{label}</p>
            <p style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 500, color: bg === '#000' ? '#fff' : C.ink, lineHeight: 1 }}>{val}</p>
          </div>
        ))}
      </div>

      {/* Tableau */}
      {list.length === 0 ? (
        <div className="text-center py-16" style={{ color: C.inkMuted, border: `1px dashed ${C.borderSoft}` }}>
          <FileText size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
          <p className="text-sm">Aucun prédevis — créez-en un</p>
        </div>
      ) : (
        <div>
          <div className="grid text-xs uppercase tracking-wide pb-1 mb-1"
               style={{ gridTemplateColumns: '110px 1fr 1fr 90px 90px 90px 60px', gap: 8, borderBottom: `2px solid ${C.border}`, color: C.inkMuted }}>
            <span>Réf.</span><span>Client</span><span>Intervention</span><span>Total HT</span><span>Total TTC</span><span>Statut</span><span></span>
          </div>
          {list.map(p => (
            <div key={p.id} className="grid text-sm py-2"
                 style={{ gridTemplateColumns: '110px 1fr 1fr 90px 90px 90px 60px', gap: 8, borderBottom: `1px solid ${C.borderSoft}`, alignItems: 'center' }}>
              <span className="font-mono text-xs" style={{ color: C.inkSoft }}>{p.reference}</span>
              <span style={{ color: C.ink, fontWeight: 500 }}>{p.client_nom || '—'}</span>
              <span style={{ color: C.inkSoft }}>{p.type_intervention}{p.description ? ` · ${p.description}` : ''}</span>
              <span style={{ color: C.inkSoft }}>{fmt(p.total_ht)} €</span>
              <span style={{ fontWeight: 600 }}>{fmt(p.total_ttc)} €</span>
              <span>
                <span className="px-2 py-0.5 text-xs" style={{ background: p.statut === 'converti' ? '#000' : C.soft, color: p.statut === 'converti' ? '#fff' : STATUT_COLORS[p.statut] || C.inkMuted }}>
                  {p.statut}
                </span>
              </span>
              <div className="flex gap-1">
                <button onClick={() => setEditing(p)} className="p-1 text-xs" style={{ border: `1px solid ${C.borderSoft}`, color: C.inkSoft }}>Éditer</button>
                <button onClick={() => handleDelete(p.id)} className="p-1" style={{ border: `1px solid ${C.borderSoft}`, color: C.inkMuted }}>
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing !== null && (
        <FormulairePredevis
          initial={editing?.id ? editing : undefined}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
