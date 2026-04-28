'use client';
import { useState, useRef, useEffect } from 'react';
import { Download, Printer, X } from 'lucide-react';
import Btn from './ui/Btn';

const C = {
  ink: '#000', inkSoft: '#444', inkMuted: '#888',
  bg: '#F5F5F5', surface: '#fff', border: '#000', borderSoft: '#E5E5E5',
};

function fmt(n) {
  return Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseJSON(raw) {
  try { return JSON.parse(raw || '[]'); } catch { return []; }
}

function parseTapOps(raw) {
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}

export default function PredevisPrintView({ predevis, onClose }) {
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'print-predevis';
    style.textContent = `
      @media print {
        @page { size: A4; margin: 12mm 14mm; }
        body > * { display: none !important; }
        #predevis-print-root { display: block !important; position: static !important; overflow: visible !important; background: none !important; padding: 0 !important; }
        #predevis-print-toolbar { display: none !important; }
        #predevis-pdf-content { box-shadow: none !important; }
      }
    `;
    document.head.appendChild(style);
    return () => document.getElementById('print-predevis')?.remove();
  }, []);

  const tapOps = parseTapOps(predevis.tapisserie_ops);
  const tissus = parseJSON(predevis.tissus);
  const fournitures = parseJSON(predevis.fournitures);

  const formatTapOps = () => {
    const ops = [];
    if (tapOps.degarnissage) ops.push('Dégarnissage');
    if (tapOps.recollage) ops.push('Recollage');
    if (tapOps.decouverture) ops.push('Découverture');
    if (tapOps.recouverture) ops.push('Recouverture');
    if (tapOps.creation) ops.push('Création');
    if (tapOps.modificationStructure) ops.push('Modification structure');
    if (tapOps.changement?.actif) {
      ops.push(`Changement ${tapOps.changement.matiere} (${tapOps.changement.zone})`);
    }
    if (tapOps.finition?.actif) {
      const finitions = [];
      if (tapOps.finition.galons) finitions.push('Galons');
      if (tapOps.finition.frange) finitions.push('Frange');
      if (tapOps.finition.invisible) finitions.push('Invisible');
      if (tapOps.finition.clous) finitions.push('Clous');
      if (tapOps.finition.griffe) finitions.push('Griffe');
      if (finitions.length) ops.push(`Finitions: ${finitions.join(', ')}`);
    }
    return ops;
  };

  const handleDownloadPDF = async () => {
    setGenerating(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const element = document.getElementById('predevis-pdf-content');
      const options = {
        margin: 10,
        filename: `predevis-${predevis.reference}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { format: 'a4', orientation: 'portrait' },
      };
      html2pdf().set(options).from(element).save();
    } catch (e) {
      alert('Erreur lors de la génération du PDF: ' + e.message);
    }
    setGenerating(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const tapOpsOps = formatTapOps();

  return (
    <div id="predevis-print-root" className="fixed inset-0 z-[400] overflow-y-auto p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-surface border-2 border-ink max-w-[900px] mx-auto my-8 shadow-lg"
        onClick={e => e.stopPropagation()}
      >
        {/* Toolbar */}
        <div id="predevis-print-toolbar" className="flex items-center justify-between px-6 py-4 border-b border-ink bg-bg">
          <h3 className="font-serif text-[18px] text-ink">Prévisualisation — {predevis.reference}</h3>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 border border-ink bg-surface text-ink font-mono text-[11px] uppercase tracking-[0.1em] hover:bg-bg"
            >
              <Printer size={14} /> Imprimer
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={generating}
              className="flex items-center gap-2 px-4 py-2 bg-ink text-surface font-mono text-[11px] uppercase tracking-[0.1em] hover:opacity-90 disabled:opacity-50"
            >
              <Download size={14} /> {generating ? 'Génération…' : 'Télécharger PDF'}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-muted hover:text-ink"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Contenu PDF */}
        <div id="predevis-pdf-content" className="p-10 bg-white" style={{ fontSize: '12px', lineHeight: 1.6 }}>
          {/* En-tête */}
          <div className="mb-8 pb-4 border-b-2 border-black">
            <div className="flex justify-between items-start mb-6">
              <div>
                <p style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#888', marginBottom: '4px' }}>Atelier Hamache</p>
                <h1 style={{ fontSize: '28px', fontFamily: 'serif', fontWeight: 'normal', margin: 0 }}>PRÉDEVIS</h1>
                <p style={{ fontSize: '13px', color: '#444', marginTop: '4px' }}>{predevis.reference}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '11px', fontWeight: 'bold', margin: '0 0 8px 0' }}>📍 POITIERS</p>
                <p style={{ fontSize: '11px', margin: '0 0 4px 0' }}>boutique@hamachestephan.com</p>
                <p style={{ fontSize: '11px', margin: 0 }}>Validité : 30 jours</p>
              </div>
            </div>
          </div>

          {/* Section Client */}
          <div className="mb-6">
            <p style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#888', marginBottom: '8px', fontWeight: 'bold' }}>CLIENT</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <p style={{ margin: '0 0 4px 0', color: '#888', fontSize: '10px' }}>NOM</p>
                <p style={{ fontSize: '14px', fontFamily: 'serif', margin: 0 }}>{predevis.client_nom || '—'}</p>
              </div>
              <div>
                <p style={{ margin: '0 0 4px 0', color: '#888', fontSize: '10px' }}>ADRESSE</p>
                <p style={{ fontSize: '13px', margin: 0 }}>{predevis.client_adresse || '—'}</p>
              </div>
              <div>
                <p style={{ margin: '0 0 4px 0', color: '#888', fontSize: '10px' }}>TÉLÉPHONE</p>
                <p style={{ fontSize: '13px', margin: 0 }}>{predevis.client_tel || '—'}</p>
              </div>
              <div>
                <p style={{ margin: '0 0 4px 0', color: '#888', fontSize: '10px' }}>EMAIL</p>
                <p style={{ fontSize: '13px', margin: 0 }}>{predevis.client_email || '—'}</p>
              </div>
            </div>
          </div>

          {/* Section Intervention */}
          <div className="mb-6">
            <p style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#888', marginBottom: '8px', fontWeight: 'bold' }}>INTERVENTION</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '12px' }}>
              <div>
                <p style={{ margin: '0 0 4px 0', color: '#888', fontSize: '10px' }}>TYPE</p>
                <p style={{ fontSize: '14px', fontFamily: 'serif', margin: 0 }}>{predevis.type_intervention}</p>
              </div>
              <div>
                <p style={{ margin: '0 0 4px 0', color: '#888', fontSize: '10px' }}>DESCRIPTION</p>
                <p style={{ fontSize: '13px', margin: 0 }}>{predevis.description || '—'}</p>
              </div>
            </div>
            {predevis.urgent && (
              <div style={{ padding: '8px 12px', backgroundColor: '#fff0f0', border: '1px solid #ff0000', color: '#ff0000', fontSize: '11px', fontWeight: 'bold', marginBottom: '8px' }}>
                ⚠ URGENT
              </div>
            )}
            {tapOpsOps.length > 0 && predevis.type_intervention === 'Tapisserie' && (
              <div style={{ padding: '8px 12px', backgroundColor: '#f5f5f5', border: '1px solid #ddd' }}>
                <p style={{ fontSize: '10px', color: '#888', margin: '0 0 4px 0', fontWeight: 'bold' }}>OPÉRATIONS TAPISSERIE</p>
                {tapOpsOps.map((op, i) => (
                  <p key={i} style={{ fontSize: '12px', margin: '2px 0' }}>• {op}</p>
                ))}
              </div>
            )}
          </div>

          {/* Tissus */}
          {tissus.length > 0 && (
            <div className="mb-6">
              <p style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#888', marginBottom: '8px', fontWeight: 'bold' }}>TISSUS</p>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #000' }}>
                    <th style={{ textAlign: 'left', padding: '4px 8px', fontSize: '10px', fontWeight: 'bold', color: '#888' }}>FOURNISSEUR</th>
                    <th style={{ textAlign: 'left', padding: '4px 8px', fontSize: '10px', fontWeight: 'bold', color: '#888' }}>RÉFÉRENCE</th>
                    <th style={{ textAlign: 'right', padding: '4px 8px', fontSize: '10px', fontWeight: 'bold', color: '#888' }}>PRIX/M</th>
                    <th style={{ textAlign: 'right', padding: '4px 8px', fontSize: '10px', fontWeight: 'bold', color: '#888' }}>MÉTRAGE</th>
                    <th style={{ textAlign: 'right', padding: '4px 8px', fontSize: '10px', fontWeight: 'bold', color: '#888' }}>TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {tissus.map((t, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #ddd' }}>
                      <td style={{ padding: '6px 8px', fontSize: '12px' }}>{t.fournisseur || '—'}</td>
                      <td style={{ padding: '6px 8px', fontSize: '12px' }}>{t.reference || '—'}</td>
                      <td style={{ textAlign: 'right', padding: '6px 8px', fontSize: '12px', fontFamily: 'monospace' }}>{fmt(t.prixMetre)} €</td>
                      <td style={{ textAlign: 'right', padding: '6px 8px', fontSize: '12px', fontFamily: 'monospace' }}>{fmt(t.metrage)} m</td>
                      <td style={{ textAlign: 'right', padding: '6px 8px', fontSize: '12px', fontFamily: 'monospace', fontWeight: 'bold' }}>
                        {fmt((parseFloat(t.prixMetre) || 0) * (parseFloat(t.metrage) || 0))} €
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Fournitures */}
          {fournitures.length > 0 && (
            <div className="mb-6">
              <p style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#888', marginBottom: '8px', fontWeight: 'bold' }}>FOURNITURES & MATÉRIEL</p>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #000' }}>
                    <th style={{ textAlign: 'left', padding: '4px 8px', fontSize: '10px', fontWeight: 'bold', color: '#888' }}>DÉSIGNATION</th>
                    <th style={{ textAlign: 'right', padding: '4px 8px', fontSize: '10px', fontWeight: 'bold', color: '#888' }}>QTÉ</th>
                    <th style={{ textAlign: 'left', padding: '4px 8px', fontSize: '10px', fontWeight: 'bold', color: '#888' }}>UNITÉ</th>
                    <th style={{ textAlign: 'right', padding: '4px 8px', fontSize: '10px', fontWeight: 'bold', color: '#888' }}>PRIX UNIT.</th>
                    <th style={{ textAlign: 'right', padding: '4px 8px', fontSize: '10px', fontWeight: 'bold', color: '#888' }}>TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {fournitures.map((f, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #ddd' }}>
                      <td style={{ padding: '6px 8px', fontSize: '12px' }}>{f.designation || '—'}</td>
                      <td style={{ textAlign: 'right', padding: '6px 8px', fontSize: '12px', fontFamily: 'monospace' }}>{fmt(f.quantite)}</td>
                      <td style={{ padding: '6px 8px', fontSize: '12px' }}>{f.unite}</td>
                      <td style={{ textAlign: 'right', padding: '6px 8px', fontSize: '12px', fontFamily: 'monospace' }}>{fmt(f.prixUnit)} €</td>
                      <td style={{ textAlign: 'right', padding: '6px 8px', fontSize: '12px', fontFamily: 'monospace', fontWeight: 'bold' }}>
                        {fmt((parseFloat(f.prixUnit) || 0) * (parseFloat(f.quantite) || 0))} €
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Détail des coûts */}
          <div className="mb-6">
            <p style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#888', marginBottom: '8px', fontWeight: 'bold' }}>DÉTAIL DES COÛTS</p>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {[
                  ['Heures estimées', predevis.heures_estimees, 'h'],
                  ['Taux horaire', predevis.taux_horaire, '€/h'],
                  ['Forfait pose', predevis.forfait_pose, '€'],
                  ['Km déplacement', predevis.km_deplacement, 'km'],
                  ['Tarif km', predevis.tarif_km, '€/km'],
                ].map(([label, val, unit], i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '4px 8px', fontSize: '12px' }}>{label}</td>
                    <td style={{ textAlign: 'right', padding: '4px 8px', fontSize: '12px', fontFamily: 'monospace' }}>{fmt(val)} {unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Notes */}
          {predevis.notes && (
            <div className="mb-6">
              <p style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#888', marginBottom: '8px', fontWeight: 'bold' }}>NOTES</p>
              <p style={{ fontSize: '12px', margin: 0, whiteSpace: 'pre-wrap', backgroundColor: '#f9f9f9', padding: '8px', border: '1px solid #eee' }}>
                {predevis.notes}
              </p>
            </div>
          )}

          {/* Totaux */}
          <div className="mb-6" style={{ borderTop: '2px solid #000', paddingTop: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '16px', marginBottom: '8px' }}>
              <p style={{ fontSize: '12px', color: '#888', margin: 0 }}>TOTAL HT</p>
              <p style={{ fontSize: '13px', fontFamily: 'monospace', fontWeight: 'bold', margin: 0 }}>{fmt(predevis.total_ht)} €</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '16px', marginBottom: '12px' }}>
              <p style={{ fontSize: '12px', color: '#888', margin: 0 }}>TVA ({(parseFloat(predevis.taux_tva) * 100) || 20}%)</p>
              <p style={{ fontSize: '13px', fontFamily: 'monospace', fontWeight: 'bold', margin: 0 }}>
                {fmt(predevis.total_ttc - predevis.total_ht)} €
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '16px', padding: '12px', backgroundColor: '#000', color: '#fff', marginBottom: '8px' }}>
              <p style={{ fontSize: '16px', fontFamily: 'serif', margin: 0 }}>TOTAL TTC</p>
              <p style={{ fontSize: '20px', fontFamily: 'serif', fontWeight: 'bold', margin: 0 }}>{fmt(predevis.total_ttc)} €</p>
            </div>
            <p style={{ fontSize: '10px', color: '#888', textAlign: 'center', margin: '8px 0 0 0' }}>
              Acompte demandé : 30 % · Validité : 30 jours
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
