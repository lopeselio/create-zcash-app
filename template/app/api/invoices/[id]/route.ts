import { refreshInvoice, toJSON } from '../../../../lib/invoices.ts';
import { getWallet } from '../../../../lib/wallet.ts';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const wallet = getWallet();
  const invoice = await refreshInvoice(wallet, id).catch(() => undefined);
  if (!invoice) return Response.json({ error: 'No such invoice' }, { status: 404 });
  return Response.json({ ...toJSON(invoice), canTestPay: typeof wallet.payFromTestWallet === 'function' });
}
