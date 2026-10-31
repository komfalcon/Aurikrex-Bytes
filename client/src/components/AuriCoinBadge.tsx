import React, { useState, useEffect, useRef } from 'react';
import { Clock3, Sparkles } from 'lucide-react';
import { trpc } from '@/lib/trpc';

export interface CoinBalanceData {
  balance: number;
  allowance: number;
  costPerRequest: number;
  lastResetDate: string;
  nextResetDate: string;
}

function AuriCoinSvg({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <circle cx="12" cy="12" r="9.5" fill="url(#auriCoinGrad)" stroke="#F59E0B" strokeWidth="1.5" />
      <path
        d="M12 6.8L13.65 10.25L17.45 10.75L14.68 13.4L15.35 17.15L12 15.35L8.65 17.15L9.32 13.4L6.55 10.75L10.35 10.25L12 6.8Z"
        fill="#FFFBEB"
      />
      <defs>
        <linearGradient id="auriCoinGrad" x1="4" y1="4" x2="20" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FBBF24" />
          <stop offset="1" stopColor="#D97706" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function AuriCoinBadge({ className = '', compact = false }: { className?: string; compact?: boolean }) {
  const [balanceData, setBalanceData] = useState<CoinBalanceData | null>(() => {
    if (typeof window === 'undefined') return null;
    const cachedBalance = localStorage.getItem('aurikrex:last-coin-balance');
    const cachedReset = localStorage.getItem('aurikrex:last-coin-reset-date');
    if (cachedBalance !== null && !isNaN(Number(cachedBalance))) {
      return {
        balance: Math.min(Number(cachedBalance), 2500),
        allowance: 2500,
        costPerRequest: 5,
        lastResetDate: new Date().toISOString(),
        nextResetDate: cachedReset || new Date(Date.now() + 30 * 86400000).toISOString(),
      };
    }
    return null;
  });
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const coinsQuery = trpc.auth.coinsBalance.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: true,
    staleTime: 10000,
  });

  useEffect(() => {
    if (coinsQuery.data) {
      const data = coinsQuery.data as CoinBalanceData;
      const sanitized = {
        ...data,
        balance: Math.min(data.balance, 2500),
        allowance: 2500,
      };
      setBalanceData(sanitized);
      if (typeof window !== 'undefined' && typeof sanitized.balance === 'number') {
        localStorage.setItem('aurikrex:last-coin-balance', String(sanitized.balance));
        if (sanitized.nextResetDate) localStorage.setItem('aurikrex:last-coin-reset-date', sanitized.nextResetDate);
      }
    }
  }, [coinsQuery.data]);

  useEffect(() => {
    const handleCoinsUpdated = (event: Event) => {
      const customEv = event as CustomEvent<{ remainingCoins?: number; nextResetDate?: string }>;
      if (typeof customEv.detail?.remainingCoins === 'number') {
        const newCoins = Math.min(customEv.detail.remainingCoins, 2500);
        const newReset = customEv.detail.nextResetDate;
        if (typeof window !== 'undefined') {
          localStorage.setItem('aurikrex:last-coin-balance', String(newCoins));
          if (newReset) localStorage.setItem('aurikrex:last-coin-reset-date', newReset);
        }
        setBalanceData((prev) =>
          prev
            ? { ...prev, balance: newCoins, nextResetDate: newReset || prev.nextResetDate }
            : { balance: newCoins, allowance: 2500, costPerRequest: 5, lastResetDate: new Date().toISOString(), nextResetDate: newReset || new Date().toISOString() }
        );
      } else {
        coinsQuery.refetch();
      }
    };

    window.addEventListener('aurikrex:coins-updated', handleCoinsUpdated);
    window.addEventListener('auricoins:updated', handleCoinsUpdated);
    window.addEventListener('auricobadge:refresh', () => coinsQuery.refetch());
    return () => {
      window.removeEventListener('aurikrex:coins-updated', handleCoinsUpdated);
      window.removeEventListener('auricoins:updated', handleCoinsUpdated);
      window.removeEventListener('auricobadge:refresh', () => coinsQuery.refetch());
    };
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

  const balance = Math.min(balanceData?.balance ?? 2500, 2500);
  const isLow = balance < 5;

  const formatCountdown = (targetIso?: string) => {
    if (!targetIso) return '30 days';
    const diff = new Date(targetIso).getTime() - Date.now();
    if (diff <= 0) return 'Resetting soon...';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return `${days}d ${hours}h remaining`;
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        type="button"
        className={`px-coin-pill ${isLow ? 'is-low' : ''} ${className}`}
        title="Auri Coin Ecosystem AI Balance"
        aria-label={`Auri Coin balance: ${balance.toLocaleString()} coins`}
      >
        <AuriCoinSvg size={15} />
        <span className="tabular-nums">{coinsQuery.isLoading && !balanceData ? '...' : balance.toLocaleString()}</span>
        <span className={`${compact ? 'hidden xl:inline' : ''} px-coin-unit`}>AuriCoins</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 rounded-xl bg-slate-900 border border-slate-800 p-4 shadow-2xl z-50 text-left">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <AuriCoinSvg size={20} />
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Auri Coin Balance</h4>
                <p className="text-[10px] text-slate-400">Aurikrex Ecosystem AI Credits</p>
              </div>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${isLow ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
              {isLow ? 'Low Coins' : 'Active'}
            </span>
          </div>

          <div className="my-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Current Balance:</span>
              <span className="font-bold text-amber-300 text-sm">{balance.toLocaleString()} Coins</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Monthly Allowance:</span>
              <span className="font-semibold text-slate-200">{(balanceData?.allowance || 2500).toLocaleString()} Coins</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Cost per AI Request:</span>
              <span className="font-semibold text-slate-200">5 Coins</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Next Monthly Refresh:</span>
              <span className="font-semibold text-sky-400">{formatCountdown(balanceData?.nextResetDate)}</span>
            </div>
          </div>

          <div className="rounded-lg bg-slate-950 p-2.5 text-[11px] text-slate-400 leading-relaxed flex items-start gap-2">
            <Sparkles size={14} className="text-amber-400 shrink-0 mt-0.5" />
            <span>
              Every registered user receives {(balanceData?.allowance || 2500).toLocaleString()} Auri Coins every 30 days ({Math.floor((balanceData?.allowance || 2500) / 5).toLocaleString()} AI requests). Coins reset automatically on your monthly anniversary date.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export function OutOfCoinsModal({
  isOpen,
  onClose,
  nextResetDate,
}: {
  isOpen: boolean;
  onClose: () => void;
  nextResetDate?: string;
}) {
  if (!isOpen) return null;

  const formatDays = (targetIso?: string) => {
    if (!targetIso) return '30 days';
    const diff = new Date(targetIso).getTime() - Date.now();
    if (diff <= 0) return 'a few moments';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return `${days} days, ${hours} hours`;
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10">
          <AuriCoinSvg size={28} />
        </div>
        <h3 className="text-lg font-bold text-white">Out of Auri Coins for this Month</h3>
        <p className="mt-2 text-sm text-slate-400 leading-relaxed">
          You've used all 2,500 Auri Coins for your current 30-day period (500 AI requests across Bytes and Phorynt).
        </p>

        <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200 flex items-center justify-center gap-2">
          <Clock3 size={14} className="text-amber-400 shrink-0" />
          <span>Next 2,500 Coin Refresh in: <strong className="font-bold text-white">{formatDays(nextResetDate)}</strong></span>
        </div>

        <button
          onClick={onClose}
          type="button"
          className="mt-6 w-full rounded-xl bg-blue-600 hover:bg-blue-500 py-2.5 text-sm font-semibold text-white transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
