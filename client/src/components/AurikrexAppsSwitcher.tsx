import React, { useState, useRef, useEffect } from 'react';
import { ExternalLink } from 'lucide-react';

export function CbtLogo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0 }}>
      <rect width="32" height="32" rx="8" fill="url(#cbt-grad-b)" />
      <circle cx="16" cy="16" r="8" stroke="#ffffff" strokeWidth="2.5" fill="none" />
      <path d="M12 16h8M16 12v8" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
      <defs>
        <linearGradient id="cbt-grad-b" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2563eb" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function LibraryLogo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0 }}>
      <rect width="32" height="32" rx="8" fill="url(#lib-grad-b)" />
      <path d="M7.25 24.5 14.4 7.5h3.2l7.15 17M10.15 18h11.7" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <defs>
        <linearGradient id="lib-grad-b" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#059669" />
          <stop offset="1" stopColor="#047857" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function BytesLogo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0 }}>
      <rect width="32" height="32" rx="8" fill="url(#bytes-grad-b)" />
      <path d="M9 10h11a3 3 0 0 1 0 6H13h7a3 3 0 0 1 0 6H9V10z" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <defs>
        <linearGradient id="bytes-grad-b" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3b82f6" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function PhoryntLogo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0 }}>
      <rect width="32" height="32" rx="8" fill="url(#phor-grad-b)" />
      <path d="M10 8h7a5 5 0 0 1 0 10h-7V8zm0 10v6" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="21" cy="22" r="2" fill="#38bdf8" />
      <defs>
        <linearGradient id="phor-grad-b" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#6d28d9" />
        </linearGradient>
      </defs>
    </svg>
  );
}

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
    icon: <CbtLogo size={22} />,
  },
  {
    id: 'library',
    name: 'Aurikrex Library',
    description: 'Digital E-Library & Academic Resources',
    defaultUrl: 'https://library.aurikrex.com',
    clientId: 'aurikrex_library',
    redirectUri: 'https://library.aurikrex.com/sso/callback',
    icon: <LibraryLogo size={22} />,
  },
  {
    id: 'bytes',
    name: 'Aurikrex Bytes',
    description: 'Bite-Sized Summaries & Study Flashcards',
    defaultUrl: 'https://bytes.aurikrex.com',
    clientId: 'aurikrex_bytes',
    redirectUri: 'https://bytes.aurikrex.com/sso/callback',
    icon: <BytesLogo size={22} />,
  },
  {
    id: 'vault',
    name: 'Aurikrex Phorynt',
    description: 'Interactive STEM & Exam Prep Vault',
    defaultUrl: 'https://phorynt.aurikrex.com',
    clientId: 'aurikrex_vault',
    redirectUri: 'https://phorynt.aurikrex.com/sso/callback',
    icon: <PhoryntLogo size={22} />,
  },
];

export function AurikrexAppsSwitcher({ currentAppId = 'bytes' }: { currentAppId?: 'cbt' | 'library' | 'bytes' | 'vault' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 640);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
    let apiBase = (import.meta.env.VITE_API_BASE_URL || 'https://cbt.pxxl.click').replace(/\/+$/, '');
    if (!apiBase || !apiBase.includes('pxxl.click')) {
      apiBase = 'https://cbt.pxxl.click';
    }

    if (token && app.id !== 'cbt') {
      const endpoint = apiBase.endsWith('/api/v1') ? `${apiBase}/auth/sso/authorize` : `${apiBase}/api/v1/auth/sso/authorize`;
      return `${endpoint}?client_id=${app.clientId}&redirect_uri=${encodeURIComponent(app.redirectUri)}&token=${encodeURIComponent(token)}`;
    }
    return app.defaultUrl;
  };

  const dropdownStyle: React.CSSProperties = isMobile
    ? {
        position: 'fixed',
        top: '68px',
        left: '12px',
        right: '12px',
        maxWidth: '340px',
        margin: '0 auto',
        borderRadius: '16px',
        backgroundColor: '#0f172a',
        border: '1px solid #334155',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85)',
        zIndex: 99999,
        overflow: 'hidden',
        textAlign: 'left',
      }
    : {
        position: 'absolute',
        right: 0,
        top: 'calc(100% + 8px)',
        width: '280px',
        borderRadius: '12px',
        backgroundColor: '#0f172a',
        border: '1px solid #334155',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
        zIndex: 9999,
        overflow: 'hidden',
        textAlign: 'left',
      };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        type="button"
        className="flex items-center gap-2 px-2.5 py-1.5 text-sm font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 rounded-lg transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        title="Aurikrex Ecosystem Apps"
      >
        <span className="inline-flex items-center justify-center shrink-0">
          <img src="/aurikrex-logo.png" alt="Aurikrex Logo" className="w-5 h-5 object-contain rounded" style={{ width: '20px', height: '20px', minWidth: '20px', minHeight: '20px', objectFit: 'contain' }} />
        </span>
        <span className="whitespace-nowrap">
          {isMobile ? 'Apps' : 'Aurikrex Apps'}
        </span>
      </button>

      {isOpen && (
        <div style={dropdownStyle}>
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
                  <div className="shrink-0 mt-0.5">
                    {app.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-200 group-hover:text-white flex items-center gap-1">
                        {app.name}
                        {!isCurrent && <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-medium">
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
