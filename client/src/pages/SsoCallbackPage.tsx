import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { trpc } from '../lib/trpc';

export default function SsoCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const ssoExchange = trpc.auth.ssoExchange.useMutation();

  useEffect(() => {
    async function handleSso() {
      const code = searchParams.get('code');
      if (!code) {
        setError('Missing authorization code from Identity Provider.');
        return;
      }

      try {
        await ssoExchange.mutateAsync({
          code,
          redirect_uri: window.location.origin + '/sso/callback',
        });
        window.location.href = '/';
      } catch (err: any) {
        setError(err.message || 'Single Sign-On authentication failed');
      }
    }

    handleSso();
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-4">
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl max-w-md w-full text-center shadow-2xl">
        {error ? (
          <div>
            <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4 text-xl font-bold">
              ✕
            </div>
            <h2 className="text-xl font-bold text-red-400 mb-2">SSO Authentication Failed</h2>
            <p className="text-sm text-slate-400 mb-6">{error}</p>
            <a
              href="/auth"
              className="inline-block px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium transition-colors"
            >
              Return to Login
            </a>
          </div>
        ) : (
          <div>
            <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h2 className="text-xl font-bold text-white mb-2">Authenticating with Aurikrex ID...</h2>
            <p className="text-sm text-slate-400">Exchanging session tokens with central identity provider.</p>
          </div>
        )}
      </div>
    </div>
  );
}
