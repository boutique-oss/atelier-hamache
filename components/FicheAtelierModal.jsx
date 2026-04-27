'use client';
import { useState, useEffect } from 'react';
import { FileText, Save, Printer, ExternalLink, X } from 'lucide-react';
import Kicker from './ui/Kicker';
import Btn from './ui/Btn';

const labelCls = 'font-mono uppercase tracking-[0.16em] text-[10px] text-muted block mb-1';
const fieldCls = 'w-full px-3 py-2 bg-surface border border-ink font-sans text-[13px] text-ink';
const textareaCls = `${fieldCls} resize-y`;

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
    style.textContent = `@media print { body > * { display: none !important; } #fiche-print { display: block !important; } }`;
    document.head.appendChild(style);
    return () => document.getElementById('print-fiche')?.remove();
  }, []);

  return (
    <div id="fiche-print" className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ background: 'rgba(0,0,0,.5)' }}>
      <div className="bg-surface border border-ink p-8 max-w-[680px] w-[95%] max-h-[90vh] overflow-y-auto relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-muted"><X size={20} /></button>

        {/* Masthead A4 */}
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

        {/* Champs */}
        <div className="grid grid-cols-2 gap-x-5 gap-y-3 mb-5">
          {champs.filter(f => f.type !== 'textarea').map(f => (
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

        {/* Signatures */}
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
  const [schemas, setSchemas]       = useState({});
  const [contenu, setContenu]       = useState({});
  const [notes, setNotes]           = useState('');
  const [typeIntervention, setType] = useState(dossier.type_intervention || 'Tapisserie');
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
          setType(fiche.type_intervention);
          setContenu(JSON.parse(fiche.contenu_json || '{}'));
          setNotes(fiche.notes_libres || '');
        }
      });
  }, [dossier.id]);

  const handleChange = (key, value) => { setContenu(c => ({ ...c, [key]: value })); setSaved(false); };

  const handleSave = async () => {
    setSaving(true);
    await fetch('/api/fiches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dossier_id: dossier.id, type_intervention: typeIntervention, contenu_json: contenu, notes_libres: notes }),
    });
    setSaving(false);
    setSaved(true);
  };

  const champsActuels = schemas[typeIntervention] || [];
  const currentFiche  = ficheId ? { type_intervention: typeIntervention, contenu_json: JSON.stringify(contenu), notes_libres: notes } : null;

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
              onChange={e => { setType(e.target.value); setContenu({}); setSaved(false); }}
              className={fieldCls}
              style={{ maxWidth: 260 }}
            >
              {Object.keys(schemas).map(t => <option key={t}>{t}</option>)}
            </select>
          </div>

          {/* Champs */}
          {champsActuels.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 mb-5">
              {champsActuels.map(f => (
                <Champ key={f.key} field={f} value={contenu[f.key]} onChange={handleChange} />
              ))}
            </div>
          ) : (
            <div className="text-center font-sans text-[13px] text-muted p-5">Chargement du schéma…</div>
          )}

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
              <ExternalLink size={14} /> Fiche papier atelier
            </a>
            {currentFiche && (
              <Btn variant="outline" onClick={() => setShowPrint(true)}>
                <Printer size={14} /> Aperçu données
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
