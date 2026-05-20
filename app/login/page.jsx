'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError('Email ou mot de passe incorrect.');
      setLoading(false);
      return;
    }

    router.push('/');
    router.refresh();
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#FAF7F2',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Arial, sans-serif',
    }}>
      <div style={{
        background: '#fff',
        border: '1px solid #E8E2D5',
        borderRadius: '8px',
        padding: '48px',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
      }}>
        <div style={{ marginBottom: '32px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: '#9B5E2A', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '8px' }}>
            Atelier
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#1A1814' }}>
            Stéphan Hamache
          </div>
          <div style={{ fontSize: '12px', color: '#9A9387', marginTop: '4px' }}>
            Accès sécurisé
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6B6557', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #E8E2D5',
                borderRadius: '5px',
                fontSize: '14px',
                color: '#1A1814',
                background: '#FAF7F2',
                boxSizing: 'border-box',
                outline: 'none',
              }}
              placeholder="boutique@hamachestephan.com"
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6B6557', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #E8E2D5',
                borderRadius: '5px',
                fontSize: '14px',
                color: '#1A1814',
                background: '#FAF7F2',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          </div>

          {error && (
            <div style={{
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '5px',
              padding: '10px 12px',
              fontSize: '13px',
              color: '#B91C1C',
              marginBottom: '16px',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              background: loading ? '#C5BFB5' : '#1A1814',
              color: '#FAF7F2',
              border: 'none',
              borderRadius: '5px',
              fontSize: '14px',
              fontWeight: '700',
              cursor: loading ? 'default' : 'pointer',
              letterSpacing: '0.02em',
            }}
          >
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}
