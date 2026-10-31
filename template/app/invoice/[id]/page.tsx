'use client';

import { useParams } from 'next/navigation';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

interface InvoiceView {
  id: string;
  description: string;
  amountZec: string;
  address: string;
  memo: string;
  uri: string;
  status: 'pending' | 'paid';
  txid?: string;
  canTestPay: boolean;
}

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<InvoiceView>();
  const [qr, setQr] = useState('');
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    let stop = false;
    async function poll() {
      const res = await fetch(`/api/invoices/${id}`, { cache: 'no-store' });
      const json = await res.json();
      if (stop) return;
      if (!res.ok) return setError(json.error ?? 'Could not load the invoice');
      setInvoice(json);
      if (json.status !== 'paid') setTimeout(poll, 2000);
    }
    poll();
    return () => {
      stop = true;
    };
  }, [id]);

  useEffect(() => {
    if (invoice) QRCode.toDataURL(invoice.uri, { margin: 1, width: 280 }).then(setQr);
  }, [invoice?.uri]); // eslint-disable-line react-hooks/exhaustive-deps

  async function testPay() {
    setPaying(true);
    const res = await fetch(`/api/invoices/${id}/test-pay`, { method: 'POST' });
    if (!res.ok) setError((await res.json()).error ?? 'Test payment failed');
    setPaying(false);
  }

  if (error) return <section className="card"><p className="error">{error}</p></section>;
  if (!invoice) return <section className="card"><p className="muted">Loading…</p></section>;

  return (
    <section className="card">
      <p className="eyebrow">Invoice {invoice.id}</p>
      <h1>
        {invoice.amountZec} ZEC <span className="muted">· {invoice.description}</span>
      </h1>
      {invoice.status === 'paid' ? (
        <div className="paid">
          <strong>Paid</strong>
          <code>{invoice.txid}</code>
        </div>
      ) : (
        <>
          {qr && <img className="qr" src={qr} alt="ZIP-321 payment request QR code" width={280} height={280} />}
          <a className="button" href={invoice.uri}>Open in wallet</a>
          <p className="status">Waiting for a confirmed payment with memo <code>{invoice.memo}</code>…</p>
          {invoice.canTestPay && (
            <button className="secondary" onClick={testPay} disabled={paying}>
              {paying ? 'Paying…' : 'Pay from test wallet (THS)'}
            </button>
          )}
        </>
      )}
      <details>
        <summary>Payment request</summary>
        <code className="uri">{invoice.uri}</code>
      </details>
    </section>
  );
}
