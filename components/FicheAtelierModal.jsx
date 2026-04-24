'use client';
import { useState, useEffect } from 'react';
import { FileText, Save, Printer, ExternalLink, X } from 'lucide-react';

const INK    = '#000000';
const ACCENT = '#000000';
const SOFT   = '#EEEEEE';
const BG     = '#F5F5F5';

const INP_STYLE = {
  border: '1px solid #000000',
  padding: '7px 10px', fontSize: 13,
  background: '#fff', color: INK, width: '100%', boxSizing: 'border-box',
};
const TEXTAREA_STYLE = { ...INP_STYLE, minHeight: 72, resize: 'vertical', fontFamily: 'DM Sans, sans-serif' };

function Champ({ field, value, onChange }) {
  const label = (
    <label style={{ fontSize: 11, color: '#737373', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 4 }}>
      {field.label}{field.unit ? ` (${field.unit})` : ''}
    </label>
  );

  if (field.type === 'textarea') return (
    <div style={{ gridColumn: 'span 2' }}>
      {label}
      <textarea value={value || ''} onChange={e => onChange(field.key, e.target.value)} style={TEXTAREA_STYLE} />
    </div>
  );
  if (field.type === 'select') return (
    <div>
      {label}
      <select value={value || ''} onChange={e => onChange(field.key, e.target.value)} style={INP_STYLE}>
        <option value="">— Choisir —</option>
        {field.options.map(o => <option key={o}>{o}</option>)}
      </select>
    </div>
  );
  if (field.type === 'number') return (
    <div>
      {label}
      <input type="number" step="any" value={value || ''} onChange={e => onChange(field.key, e.target.value)} style={INP_STYLE} />
    </div>
  );
  return (
    <div>
      {label}
      <input type="text" value={value || ''} onChange={e => onChange(field.key, e.target.value)} style={INP_STYLE} />
    </div>
  );
}

function VueImpression({ dossier, fiche, schema, onClose }) {
  const champs = schema[fiche.type_intervention] || [];
  const contenu = JSON.parse(fiche.contenu_json || '{}');

  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'print-fiche';
    style.textContent = `
      @media print {
        body > * { display: none !important; }
        #fiche-print { display: block !important; }
      }
    `;
    document.head.appendChild(style);
    return () => document.getElementById('print-fiche')?.remove();
  }, []);

  return (
    <div id="fiche-print" style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 9999,
    }}>
      <div style={{ background: '#fff', padding: 32, maxWidth: 680, width: '95%', maxHeight: '90vh', overflowY: 'auto', position: 'relative', border: '1px solid #000' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer' }}>
          <X size={20} />
        </button>

        <div style={{ borderBottom: '2px solid #000', paddingBottom: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#737373', textTransform: 'uppercase', letterSpacing: 1 }}>Atelier Stéphan Hamache</div>
          <div style={{ fontSize: 22, fontFamily: 'Fraunces, serif', fontWeight: 700, color: INK }}>Fiche {fiche.type_intervention}</div>
          <div style={{ display: 'flex', gap: 20, fontSize: 13, color: '#737373', marginTop: 4 }}>
            <span><b>Client :</b> {dossier.nom_client}</span>
            <span><b>Réf. :</b> {dossier.ref_dossier}</span>
            <span><b>Statut :</b> {dossier.statut}</span>
            {dossier.heures_a_realiser > 0 && <span><b>Heures devis :</b> {dossier.heures_a_realiser}h</span>}
            {dossier.montant_ht > 0 && <span><b>Devis HT :</b> {dossier.montant_ht}€</span>}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', marginBottom: 16 }}>
          {champs.filter(f => f.type !== 'textarea').map(f => (
            <div key={f.key}>
              <div style={{ fontSize: 11, color: '#737373', textTransform: 'uppercase', letterSpacing: .5 }}>{f.label}{f.unit ? ` (${f.unit})` : ''}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: INK, padding: '4px 0', borderBottom: '1px solid #E5E5E5' }}>
                {contenu[f.key] || <span style={{ color: '#BBBBBB' }}>—</span>}
              </div>
            </div>
          ))}
        </div>

        {champs.filter(f => f.type === 'textarea').map(f => (
          <div key={f.key} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#737373', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>{f.label}</div>
            <div style={{ fontSize: 13, color: INK, background: BG, padding: '8px 12px', minHeight: 40, whiteSpace: 'pre-wrap', border: '1px solid #E5E5E5' }}>
              {contenu[f.key] || <span style={{ color: '#BBBBBB' }}>—</span>}
            </div>
          </div>
        ))}

        {fiche.notes_libres && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, color: '#737373', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>Notes libres</div>
            <div style={{ fontSize: 13, color: INK, background: BG, border: '1px solid #E5E5E5', padding: '8px 12px', whiteSpace: 'pre-wrap' }}>
              {fiche.notes_libres}
            </div>
          </div>
        )}

        <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {['Réalisé par', 'Contrôlé par'].map(label => (
            <div key={label}>
              <div style={{ fontSize: 11, color: '#737373', marginBottom: 4 }}>{label}</div>
              <div style={{ borderBottom: '1px solid #000', paddingBottom: 2, marginBottom: 4 }}>&nbsp;</div>
              <div style={{ fontSize: 11, color: '#AAAAAA' }}>Date : ___________</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ border: '1px solid #000', background: '#fff', padding: '8px 18px', cursor: 'pointer', fontSize: 13 }}>Fermer</button>
          <button onClick={() => window.print()} style={{
            background: INK, color: '#fff', border: 'none', padding: '8px 18px', cursor: 'pointer', fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Printer size={14} /> Imprimer
          </button>
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

  const handleChange = (key, value) => {
    setContenu(c => ({ ...c, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    await fetch('/api/fiches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dossier_id: dossier.id,
        type_intervention: typeIntervention,
        contenu_json: contenu,
        notes_libres: notes,
      }),
    });
    setSaving(false);
    setSaved(true);
  };

  const champsActuels = schemas[typeIntervention] || [];
  const currentFiche  = ficheId ? { type_intervention: typeIntervention, contenu_json: JSON.stringify(contenu), notes_libres: notes } : null;

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
        <div style={{ background: '#fff', border: '1px solid #000', padding: 28, maxWidth: 760, width: '95%', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 12, color: '#737373', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                <FileText size={12} /> Fiche atelier
              </div>
              <div style={{ fontFamily: 'Fraunces, serif', fontSize: 22, fontWeight: 700, color: INK }}>
                {dossier.nom_client}
              </div>
              <div style={{ fontSize: 13, color: '#737373' }}>{dossier.ref_dossier} · {dossier.statut}</div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
              <X size={20} color="#737373" />
            </button>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, color: '#737373', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 4 }}>Type d'intervention</label>
            <select value={typeIntervention} onChange={e => { setType(e.target.value); setContenu({}); setSaved(false); }} style={{ ...INP_STYLE, maxWidth: 260 }}>
              {Object.keys(schemas).map(t => <option key={t}>{t}</option>)}
            </select>
          </div>

          {champsActuels.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              {champsActuels.map(f => (
                <Champ key={f.key} field={f} value={contenu[f.key]} onChange={handleChange} />
              ))}
            </div>
          ) : (
            <div style={{ color: '#AAAAAA', fontSize: 13, padding: 20, textAlign: 'center' }}>Chargement du schéma…</div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: '#737373', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 4 }}>Notes libres</label>
            <textarea value={notes} onChange={e => { setNotes(e.target.value); setSaved(false); }} placeholder="Informations complémentaires, particularités client…" style={TEXTAREA_STYLE} />
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <a
              href={`/fiche-impression/${dossier.id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                border: '1px solid #000', background: '#000', color: '#fff',
                padding: '8px 18px', cursor: 'pointer', fontSize: 13,
                display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none',
              }}
            >
              <ExternalLink size={14} /> Fiche papier atelier
            </a>
            {currentFiche && (
              <button onClick={() => setShowPrint(true)} style={{
                border: '1px solid #000', background: '#fff', padding: '8px 18px', cursor: 'pointer', fontSize: 13,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <Printer size={14} /> Aperçu données
              </button>
            )}
            <button onClick={onClose} style={{ border: '1px solid #000', background: '#fff', padding: '8px 18px', cursor: 'pointer', fontSize: 13 }}>Annuler</button>
            <button onClick={handleSave} disabled={saving} style={{
              background: saved ? '#444' : ACCENT, color: '#fff', border: 'none',
              padding: '8px 22px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 6,
              opacity: saving ? 0.5 : 1,
            }}>
              <Save size={14} /> {saving ? 'Enregistrement…' : saved ? 'Enregistre' : 'Enregistrer la fiche'}
            </button>
          </div>
        </div>
      </div>

      {showPrint && currentFiche && (
        <VueImpression
          dossier={dossier}
          fiche={currentFiche}
          schema={schemas}
          onClose={() => setShowPrint(false)}
        />
      )}
    </>
  );
}
