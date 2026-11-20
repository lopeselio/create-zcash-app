import { parseZec } from 'zcash-zip321';
import { createInvoice, toJSON } from '../../../lib/invoices.ts';
import { getWallet } from '../../../lib/wallet.ts';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { amount?: string; description?: string };
  let amount: bigint;
  try {
    amount = parseZec(String(body.amount ?? ''));
  } catch {
    return Response.json({ error: 'Enter an amount in ZEC, e.g. 0.25' }, { status: 400 });
  }
  if (amount === 0n) return Response.json({ error: 'The amount must be more than zero' }, { status: 400 });
  const description = String(body.description ?? '').trim().slice(0, 120) || 'Order';
  try {
    const invoice = await createInvoice(getWallet(), { amount, description });
    return Response.json(toJSON(invoice), { status: 201 });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 503 });
  }
}
