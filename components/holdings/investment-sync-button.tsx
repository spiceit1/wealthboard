"use client";
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function InvestmentSyncButton() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  return <div className="space-y-1"><Button size="sm" variant="outline" disabled={busy} onClick={async () => {
    setBusy(true);
    try {
      const response = await fetch('/api/plaid/sync-investments', {method:'POST'});
      if (!response.ok) throw new Error('Could not start the import. Please try again.');
      setMessage('Import queued. Holdings will refresh automatically; see Sync Logs for results. Plaid may report recent trades after market close.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Import failed.'); }
    finally { setBusy(false); }
  }}>{busy ? 'Starting import…' : 'Sync balances & holdings now'}</Button>{message && <p className="text-xs text-muted-foreground">{message}</p>}</div>;
}
