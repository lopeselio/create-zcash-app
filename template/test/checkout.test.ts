// End-to-end checkout against a disposable Zcash regtest network (Thus Spoke Zakura, via ths-js).
// Needs the `ths` launcher with Docker, or its native runtime with THS_NATIVE=1: https://github.com/zcashlabs/thus-spoke-zakura
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestTHSClient } from 'ths-js';
import { memoText, parsePaymentRequest, parseZec } from 'zcash-zip321';
import { createInvoice, refreshInvoice } from '../lib/invoices.ts';
import { thsWallet, type Wallet } from '../lib/wallet.ts';

const ths = createTestTHSClient();
let shop: Wallet;

before(async () => {
  await ths.start();
  shop = thsWallet({ apiUrl: ths.config().apiUrl, account: 1 });
  // Development accounts start empty; fund the customers.
  for (const customer of [3, 4] as const) await ths.faucet({ to: customer, amount: parseZec('2') });
});
after(() => ths.stop());

test('an invoice is paid by a wallet that scans its ZIP-321 request', async () => {
  const invoice = await createInvoice(shop, { amount: parseZec('0.25'), description: 'Two flat whites' });
  assert.equal((await refreshInvoice(shop, invoice.id))?.status, 'pending');

  // The customer's wallet reads the QR code...
  const [request] = parsePaymentRequest(invoice.uri, { network: 'regtest' }).payments;
  assert.equal(request!.amount, 25_000_000n);
  assert.equal(request!.message, 'Two flat whites');

  // ...and pays it from a funded test account.
  const payment = await ths.send({ from: 3, to: request!.address, amount: request!.amount!, memo: memoText(request!.memo!) });

  const paid = await refreshInvoice(shop, invoice.id);
  assert.equal(paid?.status, 'paid');
  assert.equal(paid?.txid, payment.txid);
});

test('an underpayment leaves the invoice pending', async () => {
  const invoice = await createInvoice(shop, { amount: parseZec('1'), description: 'Beans' });
  await ths.send({ from: 3, to: invoice.address, amount: parseZec('0.5'), memo: invoice.memo });
  assert.equal((await refreshInvoice(shop, invoice.id))?.status, 'pending');
});

test('a payment with another memo does not count', async () => {
  const invoice = await createInvoice(shop, { amount: parseZec('0.1'), description: 'Tea' });
  await ths.send({ from: 4, to: invoice.address, amount: parseZec('0.1'), memo: 'invoice:someone-else' });
  assert.equal((await refreshInvoice(shop, invoice.id))?.status, 'pending');
});

test('a payment is still found after newer payments push it past the first activity page', async (t) => {
  const probe = await fetch(`${ths.config().apiUrl}/api/v1/activity?limit=1`);
  if (!probe.headers.has('x-ths-has-more')) return t.skip('this THS release predates activity paging');

  const smallPages = thsWallet({ apiUrl: ths.config().apiUrl, account: 1, pageSize: 2 });
  const invoice = await createInvoice(smallPages, { amount: parseZec('0.02'), description: 'Cookie' });
  const payment = await ths.send({ from: 4, to: invoice.address, amount: invoice.amount, memo: invoice.memo });
  for (const tip of ['tip-1', 'tip-2', 'tip-3']) {
    await ths.send({ from: 3, to: invoice.address, amount: parseZec('0.01'), memo: tip });
  }

  const paid = await refreshInvoice(smallPages, invoice.id);
  assert.equal(paid?.status, 'paid');
  assert.equal(paid?.txid, payment.txid);
});

test('the built-in test wallet funds itself and pays an invoice end to end', async () => {
  const invoice = await createInvoice(shop, { amount: parseZec('0.05'), description: 'Espresso' });
  const { txid } = await shop.payFromTestWallet!(invoice.uri);
  const paid = await refreshInvoice(shop, invoice.id);
  assert.equal(paid?.status, 'paid');
  assert.equal(paid?.txid, txid);
});
