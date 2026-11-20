// The app talks to Zcash only through this interface, so the backend can change without
// touching pages or invoices. Today: a Thus Spoke Zakura (THS) regtest node for local
// development and tests. Next: a zcash.js light client with a viewing key for test/mainnet.
import { memoText, parsePaymentRequest, type Network } from 'zip321';

export interface IncomingPayment {
  txid: string;
  /** Zatoshi. */
  amount: bigint;
  memos: string[];
  confirmed: boolean;
}

export interface Wallet {
  network: Network;
  /** The address customers pay. */
  receiveAddress(): Promise<string>;
  /**
   * Payments into the receive address, newest first. With `since`, the wallet may stop looking once it reaches
   * payments first seen before that time.
   */
  incomingPayments(options?: { since?: Date }): Promise<IncomingPayment[]>;
  /** Development only: pay a ZIP-321 URI from a funded test account, like a customer's wallet would. */
  payFromTestWallet?(uri: string): Promise<{ txid: string }>;
}

interface THSAccount {
  id: number;
  unified_address: string;
  ironwood_zatoshi: number;
}
interface THSActivity {
  id: string;
  created_at: string | null;
  txid: string;
  from_account: number | null;
  to_accounts: number[];
  amount_zatoshi: number;
  status: string;
  memos: string[];
}

const ONE_ZEC = 100_000_000n;
const FEE_MARGIN = 1_000_000n; // 0.01 ZEC, comfortably above a regtest fee
const MAX_ACTIVITY_PAGES = 50;

/** THS records `created_at` in UTC as `YYYY-MM-DD HH:MM:SS`, which `Date` would otherwise read as local time. */
function utc(timestamp: string): Date {
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(timestamp) ? timestamp : `${timestamp.replace(' ', 'T')}Z`);
}

/**
 * A wallet backed by a THS development account. `account` receives payments; `payer` is the
 * test customer used by `payFromTestWallet`. `pageSize` (1–100) is the activity page size.
 */
export function thsWallet(options: { apiUrl: string; account?: number; payer?: number; pageSize?: number }): Wallet {
  const api = options.apiUrl.replace(/\/$/, '');
  const account = options.account ?? 1;
  const payer = options.payer ?? 2;
  const pageSize = options.pageSize ?? 100;

  async function call<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${api}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    });
    const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    if (!res.ok) throw new Error(`THS ${path}: ${json?.error?.message ?? res.statusText}`);
    return json as T;
  }

  /** Funds a test account from the THS faucet when it holds less than `needed`, and waits until confirmed. */
  async function topUp(id: number, needed: bigint) {
    const accounts = await call<THSAccount[]>('/api/v1/accounts');
    const balance = BigInt(accounts.find((a) => a.id === id)?.ironwood_zatoshi ?? 0);
    if (balance >= needed) return;
    const key = crypto.randomUUID();
    const amount = needed - balance > ONE_ZEC ? needed - balance : ONE_ZEC;
    await call('/api/v1/faucet', { account_id: id, pool: 'ironwood', amount_zatoshi: Number(amount), idempotency_key: key });
    await confirmed(key);
  }

  /** Waits for a THS payment (by idempotency key) to confirm; THS mines a block per payment by default. */
  async function confirmed(key: string): Promise<THSActivity> {
    for (let i = 0; i < 120; i++) {
      const [entry] = await call<THSActivity[]>(`/api/v1/activity?idempotency_key=${key}`);
      if (entry?.status === 'confirmed') return entry;
      if (entry?.status === 'failed') throw new Error('The THS payment failed');
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error('Timed out waiting for the THS payment to confirm');
  }

  return {
    network: 'regtest',

    async receiveAddress() {
      const accounts = await call<THSAccount[]>('/api/v1/accounts');
      const match = accounts.find((a) => a.id === account);
      if (!match) throw new Error(`THS has no development account ${account}`);
      return match.unified_address;
    },

    async incomingPayments({ since } = {}) {
      const payments: IncomingPayment[] = [];
      let before: string | undefined;
      for (let page = 0; page < MAX_ACTIVITY_PAGES; page++) {
        const query = new URLSearchParams({ limit: String(pageSize), account: String(account) });
        if (before) query.set('before', before);
        const res = await fetch(`${api}/api/v1/activity?${query}`, { cache: 'no-store' });
        if (res.status === 409) {
          // The cursor entry is gone (THS reorganised its history); start again from the newest page.
          payments.length = 0;
          before = undefined;
          continue;
        }
        const activity = (await res.json().catch(() => null)) as THSActivity[] | { error?: { message?: string } } | null;
        if (!res.ok || !Array.isArray(activity)) {
          throw new Error(`THS /api/v1/activity: ${(activity as { error?: { message?: string } })?.error?.message ?? res.statusText}`);
        }
        // THS releases before activity paging ignore `account`, so check the recipient here as well.
        for (const a of activity) {
          if (a.to_accounts.includes(account) && a.from_account !== account && a.status !== 'failed') {
            payments.push({ txid: a.txid, amount: BigInt(a.amount_zatoshi), memos: a.memos, confirmed: a.status === 'confirmed' });
          }
        }
        // Pages are in first-seen order, newest first, so an older page cannot hold a payment seen after `since`.
        // Without the header, THS predates paging and has returned only the newest entries.
        const oldest = activity.at(-1);
        const reachedSince = since && oldest?.created_at && utc(oldest.created_at) < since;
        if (res.headers.get('x-ths-has-more') !== 'true' || !oldest || reachedSince) break;
        before = oldest.id;
      }
      return payments;
    },

    async payFromTestWallet(uri) {
      // Read the request exactly as a customer's wallet would.
      const [payment] = parsePaymentRequest(uri, { network: 'regtest' }).payments;
      if (!payment || payment.amount === undefined) throw new Error('The payment request has no amount');
      await topUp(payer, payment.amount + FEE_MARGIN);
      const key = crypto.randomUUID();
      await call('/api/v1/send', {
        from_account: payer,
        to_address: payment.address,
        source_pool: 'ironwood',
        destination_pool: 'ironwood',
        amount_zatoshi: Number(payment.amount),
        memo: payment.memo && memoText(payment.memo),
        idempotency_key: key,
      });
      return { txid: (await confirmed(key)).txid };
    },
  };
}

/**
 * Picks the wallet from the environment. `ths run -- npm run dev` sets THS_API_URL; in
 * development the default THS port is tried as well, so `ths start` in another terminal works.
 */
export function getWallet(): Wallet {
  const apiUrl =
    process.env.THS_API_URL ?? (process.env.NODE_ENV === 'production' ? undefined : 'http://127.0.0.1:32805');
  if (!apiUrl) {
    throw new Error(
      'No wallet configured. Set THS_API_URL to a Thus Spoke Zakura instance (see README); ' +
        'a zcash.js viewing-key wallet for testnet/mainnet is the next step.',
    );
  }
  return thsWallet({ apiUrl, account: Number(process.env.MERCHANT_ACCOUNT ?? 1) });
}
