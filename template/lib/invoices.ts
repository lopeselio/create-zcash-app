import { formatPaymentRequest, formatZec } from 'zip321';
import type { Wallet } from './wallet.ts';

export interface Invoice {
  id: string;
  description: string;
  /** Zatoshi. */
  amount: bigint;
  address: string;
  /** The memo a payment must carry; it ties the payment to this invoice. */
  memo: string;
  /** ZIP-321 payment request: show it as a QR code or a `zcash:` link. */
  uri: string;
  status: 'pending' | 'paid';
  txid?: string;
  createdAt: string;
}

// In-memory store, kept on globalThis so it survives Next.js hot reloads. Use a database in production.
const store: Map<string, Invoice> = ((globalThis as { __invoices?: Map<string, Invoice> }).__invoices ??= new Map());

export const STORE_NAME = 'Zcash Coffee';

export async function createInvoice(wallet: Wallet, input: { amount: bigint; description: string }): Promise<Invoice> {
  if (input.amount <= 0n) throw new RangeError('amount must be positive');
  const id = crypto.randomUUID().slice(0, 8);
  const address = await wallet.receiveAddress();
  const memo = `invoice:${id}`;
  const uri = formatPaymentRequest(
    [{ address, amount: input.amount, memo, label: STORE_NAME, message: input.description }],
    { network: wallet.network },
  );
  const invoice: Invoice = {
    id,
    description: input.description,
    amount: input.amount,
    address,
    memo,
    uri,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  store.set(id, invoice);
  return invoice;
}

/** Looks for a confirmed payment carrying the invoice memo for at least the invoice amount. */
export async function refreshInvoice(wallet: Wallet, id: string): Promise<Invoice | undefined> {
  const invoice = store.get(id);
  if (!invoice || invoice.status === 'paid') return invoice;
  const paid = (await wallet.incomingPayments()).find(
    (p) => p.confirmed && p.memos.includes(invoice.memo) && p.amount >= invoice.amount,
  );
  if (paid) {
    invoice.status = 'paid';
    invoice.txid = paid.txid;
  }
  return invoice;
}

export function getInvoice(id: string): Invoice | undefined {
  return store.get(id);
}

/** JSON-safe view for API responses. */
export function toJSON(invoice: Invoice) {
  return { ...invoice, amount: invoice.amount.toString(), amountZec: formatZec(invoice.amount) };
}
