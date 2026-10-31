#!/usr/bin/env node
// Scaffolds a Zcash payments app from ../template. No dependencies.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HELP = `Usage: create-zcash-app [directory] [options]

Creates a Next.js app that accepts shielded Zcash payments with ZIP-321 payment requests,
with a local regtest network (Thus Spoke Zakura) for development and tests.

Options:
  --no-install   Skip installing dependencies
  --use-npm | --use-pnpm | --use-yarn
                 Package manager (default: the one running this command)
  -h, --help     Show this help`;

const args = process.argv.slice(2);
if (args.includes('-h') || args.includes('--help')) {
  console.log(HELP);
  process.exit(0);
}
const unknown = args.filter((a) => a.startsWith('-') && !['--no-install', '--use-npm', '--use-pnpm', '--use-yarn'].includes(a));
if (unknown.length) fail(`Unknown option ${unknown[0]}\n\n${HELP}`);

const dirArg = args.find((a) => !a.startsWith('-')) ?? 'zcash-app';
const target = resolve(dirArg);
const name = basename(target)
  .toLowerCase()
  .replace(/[^a-z0-9-._~]/g, '-')
  .replace(/^[._]+/, '');
if (!name) fail(`"${dirArg}" is not a usable package name`);
if (existsSync(target) && readdirSync(target).length > 0) fail(`${target} already exists and is not empty`);

const pm = args.includes('--use-pnpm') ? 'pnpm'
  : args.includes('--use-yarn') ? 'yarn'
  : args.includes('--use-npm') ? 'npm'
  : (process.env.npm_config_user_agent ?? '').split('/')[0] || 'npm';

const template = fileURLToPath(new URL('../template', import.meta.url));
cpSync(template, target, { recursive: true, filter: (src) => !/[\\/](node_modules|\.next)$/.test(src) });
// npm drops .gitignore from published packages, so the template ships it without the dot.
renameSync(join(target, 'gitignore'), join(target, '.gitignore'));
for (const file of ['package.json', 'README.md']) {
  const path = join(target, file);
  writeFileSync(path, readFileSync(path, 'utf8').replaceAll('__APP_NAME__', name));
}

console.log(`\nCreated ${name} in ${target}`);

if (!args.includes('--no-install')) {
  console.log(`\nInstalling dependencies with ${pm}…\n`);
  const result = spawnSync(pm, ['install'], { cwd: target, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) fail(`${pm} install failed. Fix the error above, then run it again inside ${dirArg}.`);
}

const run = pm === 'npm' ? 'npm run' : pm;
const cd = relative(process.cwd(), target) || '.';
const dev = `ths run -- ${run} dev`;
const test = `${pm} test`;
const width = Math.max(dev.length, test.length) + 2;
console.log(`
Done. Next:

  cd ${cd}${args.includes('--no-install') ? `\n  ${pm} install` : ''}

  # Local Zcash network (needs Docker), once:
  curl -fsSL https://raw.githubusercontent.com/zcashlabs/thus-spoke-zakura/main/install.sh | sh

  ${dev.padEnd(width)}# app on http://localhost:3000 with a fresh regtest network
  ${test.padEnd(width)}# end-to-end checkout tests
`);

function fail(message) {
  console.error(`create-zcash-app: ${message}`);
  process.exit(1);
}
