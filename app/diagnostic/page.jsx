'use client';
import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

const INK = '#000000';

export default function DiagnosticPage() {
  const [tests, setTests] = useState({
    apiHeures: null,
    apiDossiers: null,
    componentRender: null,
    errorLog: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const runTests = async () => {
      const errors = [];
      const results = { apiHeures: null, apiDossiers: null, componentRender: null, errorLog: [] };

      // Intercepte les erreurs console
      const originalError = console.error;
      console.error = (...args) => {
        errors.push(args.join(' '));
        originalError(...args);
      };

      // Test 1: API Heures
      try {
        const res = await fetch('/api/heures');
        const data = await res.json();
        results.apiHeures = {
          ok: res.ok,
          status: res.status,
          heures: data.heures?.length || 0,
          stats: data.stats?.length || 0,
          synthese: data.synthese,
        };
      } catch (e) {
        results.apiHeures = { ok: false, error: e.message };
        errors.push(`API heures error: ${e.message}`);
      }

      // Test 2: API Dossiers
      try {
        const res = await fetch('/api/dossiers');
        const data = await res.json();
        results.apiDossiers = {
          ok: res.ok,
          status: res.status,
          count: Array.isArray(data) ? data.length : 0,
          sample: Array.isArray(data) ? data[0] : null,
        };
      } catch (e) {
        results.apiDossiers = { ok: false, error: e.message };
        errors.push(`API dossiers error: ${e.message}`);
      }

      // Test 3: Try rendering HeuresModule
      try {
        const { default: HeuresModule } = await import('@/components/HeuresModule');
        results.componentRender = {
          ok: true,
          message: 'HeuresModule importé avec succès',
        };
      } catch (e) {
        results.componentRender = { ok: false, error: e.message };
        errors.push(`HeuresModule import error: ${e.message}`);
      }

      results.errorLog = errors;
      console.error = originalError;
      setTests(results);
      setLoading(false);
    };

    runTests();
  }, []);

  const TestResult = ({ label, result }) => {
    if (result === null) return null;
    const isOk = result.ok;
    return (
      <div style={{ marginBottom: 16, padding: 12, background: isOk ? '#F5F5F5' : '#FFF5F5', border: `1px solid ${isOk ? '#E5E5E5' : '#FF0000'}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          {isOk ? <CheckCircle size={18} color="#000" /> : <XCircle size={18} color="#FF0000" />}
          <span style={{ fontWeight: 700, color: INK }}>{label}</span>
        </div>
        <div style={{ fontSize: 12, color: '#666', fontFamily: 'monospace' }}>
          {isOk ? (
            <div>
              {Object.entries(result).map(([k, v]) => {
                if (k === 'ok') return null;
                return <div key={k}>{k}: {typeof v === 'object' ? JSON.stringify(v) : String(v)}</div>;
              })}
            </div>
          ) : (
            <div style={{ color: '#FF0000' }}>{result.error || 'Unknown error'}</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ fontFamily: 'DM Sans, sans-serif', maxWidth: 900, margin: '0 auto', padding: 40 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Diagnostic — HeuresModule</h1>
      <p style={{ color: '#888', marginBottom: 24 }}>Tests pour identifier pourquoi le module n'apparaît pas</p>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
          <RefreshCw size={24} style={{ display: 'inline-block', marginRight: 12, animation: 'spin 1s linear infinite' }} />
          Tests en cours…
        </div>
      ) : (
        <>
          <TestResult label="API /api/heures" result={tests.apiHeures} />
          <TestResult label="API /api/dossiers" result={tests.apiDossiers} />
          <TestResult label="Component HeuresModule" result={tests.componentRender} />

          {tests.errorLog.length > 0 && (
            <div style={{ padding: 12, background: '#FFF5F5', border: '1px solid #FF0000', marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <AlertTriangle size={18} color="#FF0000" />
                <span style={{ fontWeight: 700, color: INK }}>Erreurs détectées ({tests.errorLog.length})</span>
              </div>
              <div style={{ fontSize: 12, color: '#000', fontFamily: 'monospace' }}>
                {tests.errorLog.map((e, i) => (
                  <div key={i} style={{ marginBottom: 4, color: '#FF0000' }}>{e}</div>
                ))}
              </div>
            </div>
          )}

          {tests.apiHeures?.ok && tests.apiDossiers?.ok && tests.componentRender?.ok && (
            <div style={{ padding: 16, background: '#F5F5F5', border: '2px solid #000', marginTop: 24, textAlign: 'center' }}>
              <CheckCircle size={24} color="#000" style={{ display: 'inline-block', marginBottom: 8 }} />
              <div style={{ fontWeight: 700, color: INK }}>Tous les tests passent ✓</div>
              <p style={{ fontSize: 12, color: '#888', marginTop: 8 }}>Si HeuresModule n'apparaît toujours pas, vérifiez la page principale et le contenu CSS/JS des logs du navigateur.</p>
            </div>
          )}
        </>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
