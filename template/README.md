# __APP_NAME__

A Next.js shop that accepts shielded Zcash payments, created with
[create-zcash-app](https://github.com/lopeselio/create-zcash-app).

1. You create an invoice. The app builds a [ZIP-321](https://zips.z.cash/zip-0321) payment request with the amount,
   your address and a unique memo, and shows it as a QR code and a `zcash:` link.
2. The customer scans it with any Zcash wallet and pays.
3. The app sees a confirmed payment carrying that memo and marks the invoice paid.

## Run it locally

You need Node 22.18+, Docker, and the [Thus Spoke Zakura](https://github.com/zcashlabs/thus-spoke-zakura) launcher,
which runs a private Zcash regtest network with five funded test accounts:

```sh
curl -fsSL https://raw.githubusercontent.com/zcashlabs/thus-spoke-zakura/main/install.sh | sh
```

Then either:

```sh
ths start          # in one terminal: a long-running local network
npm run dev        # in another: http://localhost:3000
```

or, in one command with a fresh network that is deleted afterwards:

```sh
ths run -- npm run dev
```

### Without Docker

THS can also run its services as local processes ([native runtime](https://github.com/zcashlabs/thus-spoke-zakura/pull/452)).
Native runtime bundles aren't in a THS release yet; once you have one:

```sh
ths run --native -- npm run dev   # sets THS_API_URL for the app
THS_NATIVE=1 npm test             # runs the checkout tests natively
```

A native `ths start` picks free ports instead of the default `32805`, so the app can't find it on its own. Point it at the
instance with `THS_API_URL=<dashboard URL from ths endpoints> npm run dev`.

Create an invoice and press **Pay from test wallet (THS)** to watch it get paid. The THS dashboard (printed by
`ths start`) shows the transaction, its memo and the blocks.

## Test

```sh
npm test
```

This starts a disposable network, creates invoices, pays them by reading the QR code's ZIP-321 request, and checks that
correct payments mark an invoice paid while underpayments and wrong memos do not. See `test/checkout.test.ts`.

## How it is put together

| | |
|---|---|
| `lib/wallet.ts` | The only place that talks to Zcash: a receive address and incoming payments. |
| `lib/invoices.ts` | Creates invoices (ZIP-321 URIs via [`zcash-zip321`](https://github.com/lopeselio/zcash-zip321)) and matches payments by memo. |
| `app/api/invoices/*` | Create, poll, and (in development) test-pay invoices. |
| `app/page.tsx`, `app/invoice/[id]/page.tsx` | Checkout form and the QR/status page. |

The merchant is THS development account 1 (`MERCHANT_ACCOUNT` to change it), and test payments come from account 2.

## Going to testnet or mainnet

Development keys are public: never send real funds to a THS address. For real payments, implement the `Wallet`
interface in `lib/wallet.ts` with a light client that watches your address with a viewing key, so the server never
holds spending keys. [zcash.js](https://github.com/zcashlabs/zcashjs) is the intended backend; a ready-made adapter is
on the create-zcash-app roadmap. Also replace the in-memory invoice store with a database.
