import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';

export function AuriCoinBadge({ initialCoins, initialResetDate }: { initialCoins?: number, initialResetDate?: string }) {
  const [coins, setCoins] = useState(initialCoins ?? 0);
  const [nextReset, setNextReset] = useState(initialResetDate);

  useEffect(() => {
    const handleUpdate = (e: CustomEvent) => {
      if (e.detail?.remainingCoins !== undefined) {
        setCoins(e.detail.remainingCoins);
      }
      if (e.detail?.nextResetDate !== undefined) {
        setNextReset(e.detail.nextResetDate);
      }
    };

    window.addEventListener('aurikrex:coins-updated', handleUpdate as EventListener);
    return () => {
      window.removeEventListener('aurikrex:coins-updated', handleUpdate as EventListener);
    };
  }, []);

  return (
    <Badge variant="outline" className="flex items-center gap-2">
      <span className="font-semibold text-yellow-500">🪙 {coins}</span>
      <span className="text-xs text-muted-foreground">AuriCoins</span>
    </Badge>
  );
}
