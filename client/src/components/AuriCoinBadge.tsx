import React, { useState, useEffect, useRef } from 'react';
import { getSanitizedCbtBackendUrl } from './AurikrexAppsSwitcher';

export interface CoinBalanceData {
  balance: number;
  allowance: number;
  costPerRequest: number;
  lastResetDate: string;
  nextResetDate: string;
}

export function AuriCoinBadge({ className = '' }: { className?: string }) {
  const [balanceData, setBalanceData] = useState<CoinBalanceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const token = typeof window !== 'undefined' ? (localStorage.getItem('accessToken') || localStorage.getItem('token')) : null;

  const fetchBalance = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const apiBase = getSanitizedCbtBackendUrl();
      const res = await fetch(`${apiBase}/api/v1/coins/balance`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (res.ok) {
        const data = await res.json();
        setBalanceData(data);
      }
    } catch (err) {
      console.warn('Failed to fetch Auri Coin balance', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalance();
    const interval = setInterval(fetchBalance, 60000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!token) return null;

  const balance = balanceData?.balance ?? 5000;
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
        className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors shadow-sm focus:outline-none ${
          isLow
            ? 'bg-rose-500/10 text-rose-300 border-rose-500/30 hover:bg-rose-500/20'
            : 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
        } ${className}`}
        title="Auri Coin Ecosystem AI Balance"
      >
        <span className="text-sm">🪙</span>
        <span className="tabular-nums">{loading && !balanceData ? '...' : balance.toLocaleString()}</span>
        <span className="text-[10px] opacity-75 font-normal">Coins</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 rounded-xl bg-slate-900 border border-slate-800 p-4 shadow-2xl z-50 text-left">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">🪙</span>
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Auri Coin Balance</h4>
                <p className="text-[10px] text-slate-400">Aurikrex Ecosystem AI Credits</p>
              </div>
            </div>
          </div>

          <div className="my-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Current Balance:</span>
              <span className="font-bold text-amber-300 text-sm">{balance.toLocaleString()} Coins</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Monthly Allowance:</span>
              <span className="font-semibold text-slate-200">5,000 Coins</span>
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

          <div className="rounded-lg bg-slate-950 p-2.5 text-[11px] text-slate-400 leading-relaxed">
            💡 Every registered student receives 5,000 Auri Coins every 30 days (1,000 AI requests). Coins reset automatically on your monthly anniversary date.
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
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 text-3xl">
          🪙
        </div>
        <h3 className="text-lg font-bold text-white">Out of Auri Coins for this Month</h3>
        <p className="mt-2 text-sm text-slate-400 leading-relaxed">
          You've used all 5,000 Auri Coins for your current 30-day period (1,000 AI requests across CBT, Library, Bytes, and Phorynt).
        </p>

        <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200">
          ⏳ Next 5,000 Coin Refresh in: <strong className="font-bold text-white">{formatDays(nextResetDate)}</strong>
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
