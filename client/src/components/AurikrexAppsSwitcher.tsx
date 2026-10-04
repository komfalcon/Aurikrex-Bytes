import React, { useState, useRef, useEffect } from 'react';
import { ExternalLink, BookOpen, FileText, Monitor } from 'lucide-react';

export interface AppOption {
  id: string;
  name: string;
  description: string;
  defaultUrl: string;
  clientId: string;
  redirectUri: string;
  icon: React.ReactNode;
}

const AURIKREX_APPS: AppOption[] = [
  {
    id: 'cbt',
    name: 'Aurikrex CBT',
    description: 'JAMB UTME Exam Arena & Practice',
    defaultUrl: 'https://cbt.aurikrex.com',
    clientId: 'aurikrex_cbt',
    redirectUri: 'https://cbt.aurikrex.com',
    icon: <Monitor className="w-5 h-5 text-blue-400" />,
  },
  {
    id: 'library',
    name: 'Aurikrex Library',
    description: 'Digital E-Library & Academic Resources',
    defaultUrl: 'https://library.aurikrex.com',
    clientId: 'aurikrex_library',
    redirectUri: 'https://library.aurikrex.com/sso/callback',
    icon: <BookOpen className="w-5 h-5 text-emerald-400" />,
  },
  {
    id: 'bytes',
    name: 'Aurikrex Bytes',
    description: 'Bite-Sized Summaries & Study Flashcards',
    defaultUrl: 'https://bytes.aurikrex.com',
    clientId: 'aurikrex_bytes',
    redirectUri: 'https://bytes.aurikrex.com/sso/callback',
    icon: <FileText className="w-5 h-5 text-amber-400" />,
  },
];

export function AurikrexAppsSwitcher({ currentAppId = 'bytes' }: { currentAppId?: 'cbt' | 'library' | 'bytes' }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getTargetUrl = (app: AppOption): string => {
    if (app.id === currentAppId) return app.defaultUrl;
    const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
    const apiBase = (import.meta.env.VITE_API_BASE_URL || 'https://cbt.pxxl.click').replace(/\/+$/, '');

    if (token && app.id !== 'cbt') {
      const endpoint = apiBase.endsWith('/api/v1') ? `${apiBase}/auth/sso/authorize` : `${apiBase}/api/v1/auth/sso/authorize`;
      return `${endpoint}?client_id=${app.clientId}&redirect_uri=${encodeURIComponent(app.redirectUri)}&token=${encodeURIComponent(token)}`;
    }
    return app.defaultUrl;
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 rounded-lg transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        title="Aurikrex Ecosystem Apps"
      >
        <img src="/aurikrex-logo.png" alt="Aurikrex Logo" className="w-5 h-5 object-contain rounded" style={{ width: '20px', height: '20px', minWidth: '20px', minHeight: '20px', objectFit: 'contain' }} />
        <span className="hidden sm:inline">Aurikrex Apps</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 text-left">
          <div className="p-3 border-b border-slate-800 bg-slate-950/60">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Aurikrex Ecosystem</p>
            <p className="text-[11px] text-slate-500 mt-0.5">One identity across all applications</p>
          </div>

          <div className="p-1.5 space-y-1">
            {AURIKREX_APPS.map((app) => {
              const isCurrent = app.id === currentAppId;
              return (
                <a
                  key={app.id}
                  href={getTargetUrl(app)}
                  target={isCurrent ? '_self' : '_blank'}
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-slate-800/80 transition-colors group"
                  onClick={() => setIsOpen(false)}
                >
                  <div className="p-2 rounded-lg bg-slate-800 group-hover:bg-slate-700 transition-colors shrink-0">
                    {app.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-200 group-hover:text-white flex items-center gap-1">
                        {app.name}
                        {!isCurrent && <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-medium">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 truncate mt-0.5">{app.description}</p>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
