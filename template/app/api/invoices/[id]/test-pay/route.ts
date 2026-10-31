// Development only: pays the invoice from a funded THS test account so you can see the whole
// flow without a phone wallet. Refused when the wallet has no test account (testnet/mainnet).
import { getInvoice } from '../../../../../lib/invoices.ts';
import { getWallet } from '../../../../../lib/wallet.ts';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = getInvoice(id);
  if (!invoice) return Response.json({ error: 'No such invoice' }, { status: 404 });
  const wallet = getWallet();
  if (!wallet.payFromTestWallet) return Response.json({ error: 'Test payments need a THS wallet' }, { status: 403 });
  try {
    return Response.json(await wallet.payFromTestWallet(invoice.uri));
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}
