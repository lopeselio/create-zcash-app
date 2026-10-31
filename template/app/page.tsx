'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

export default function Checkout() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    const res = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ amount: form.get('amount'), description: form.get('description') }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? 'Something went wrong');
      setBusy(false);
      return;
    }
    router.push(`/invoice/${json.id}`);
  }

  return (
    <section className="card">
      <p className="eyebrow">Zcash Coffee</p>
      <h1>Accept a shielded payment</h1>
      <p className="muted">Create an invoice. The customer scans a ZIP-321 QR code, and the page updates when the payment confirms.</p>
      <form onSubmit={submit}>
        <label>
          What is it for?
          <input name="description" defaultValue="Flat white" maxLength={120} />
        </label>
        <label>
          Amount (ZEC)
          <input name="amount" defaultValue="0.05" inputMode="decimal" pattern="\d+(\.\d{1,8})?" required />
        </label>
        <button disabled={busy}>{busy ? 'Creating…' : 'Create invoice'}</button>
        {error && <p className="error">{error}</p>}
      </form>
    </section>
  );
}
