# create-zcash-app

Start a web app that accepts shielded Zcash payments in one command, with a private Zcash network for development and
tests already wired in.

```sh
npx github:lopeselio/create-zcash-app my-shop
cd my-shop
ths run -- npm run dev
```

You get a Next.js checkout:

1. **Create an invoice.** The app builds a [ZIP-321](https://zips.z.cash/zip-0321) payment request with the amount, your
   address and a unique memo, and shows it as a QR code and a `zcash:` link that any Zcash wallet can open.
2. **Get paid.** The page watches for a confirmed payment carrying that memo and switches to *Paid*.
3. **Test it.** `npm test` starts a disposable regtest network, pays invoices the way a wallet would (by reading the
   QR code's request), and checks that underpayments and wrong memos are not accepted.

In development a **Pay from test wallet** button pays the invoice from a funded test account, so you can see the whole
flow without a phone.

## Requirements

- Node 22.18+
- Docker and the [Thus Spoke Zakura](https://github.com/zcashlabs/thus-spoke-zakura) launcher, which runs Zakura,
  lightwalletd and a funded development wallet:
  `curl -fsSL https://raw.githubusercontent.com/zcashlabs/thus-spoke-zakura/main/install.sh | sh`

## Built on

| | |
|---|---|
| [zip321](https://github.com/lopeselio/zip321-js) | Strict ZIP-321 payment requests with full address validation |
| [ths-js](https://github.com/lopeselio/ths-js) | Start and drive a THS regtest network from tests |
| [Thus Spoke Zakura](https://github.com/zcashlabs/thus-spoke-zakura) | The local Zcash network |
| [zcash.js](https://github.com/zcashlabs/zcashjs) | Planned backend for testnet and mainnet (see below) |

The app talks to Zcash through one small interface (`lib/wallet.ts`: a receive address and incoming payments), so the
backend can change without touching pages or invoice logic.

## Roadmap

- **zcash.js wallet adapter** for testnet and mainnet: watch the shop's address with a viewing key, so the server never
  holds spending keys. This is waiting on zcash.js and THS agreeing on network upgrades: THS activates NU7 from block 1,
  and zcash.js 0.1.1 stops at NU6.3.
- Persistent invoice storage, webhooks, and more templates (donations, pay-per-view).

## Options

```
create-zcash-app [directory] [--no-install] [--use-npm | --use-pnpm | --use-yarn]
```

## Develop

```sh
npm test   # CLI tests
```

CI also scaffolds an app, installs it, typechecks it, runs `next build`, and runs its end-to-end tests against a real
THS network.

MIT licensed.
