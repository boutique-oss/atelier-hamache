'use client';
import HeuresModule from '@/components/HeuresModule';

export default function DiagnosticHeuresPage() {
  return (
    <div style={{ padding: 40, fontFamily: 'DM Sans, sans-serif' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Test isolé — HeuresModule</h1>
      <p style={{ color: '#888', marginBottom: 24 }}>Affichage du composant HeuresModule en isolation</p>

      <div style={{ background: '#fff', border: '1px solid #000', padding: 20 }}>
        <HeuresModule />
      </div>

      <div style={{ marginTop: 40, padding: 20, background: '#F5F5F5', border: '1px solid #E5E5E5' }}>
        <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Checklist diagnostique</h3>
        <ul style={{ fontSize: 13, color: '#666', lineHeight: 1.8 }}>
          <li>✓ Affiche-t-il quelque chose ? (loading, tableau, formulaire)</li>
          <li>✓ Reçoit-il les données de /api/heures ?</li>
          <li>✓ Le formulaire est-il interactif ?</li>
          <li>✓ Les icônes lucide-react s'affichent-elles ?</li>
          <li>✓ Ouvre la console F12 et cherche les erreurs</li>
        </ul>
      </div>
    </div>
  );
}
