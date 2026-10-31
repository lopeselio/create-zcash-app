import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const bin = new URL('../bin/create-zcash-app.js', import.meta.url).pathname;
const scaffold = (...args) => spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8', cwd: mkdtempSync(join(tmpdir(), 'cza-')) });

test('scaffolds the template with the app name filled in', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'cza-'));
  const out = execFileSync(process.execPath, [bin, 'My Shop', '--no-install'], { cwd, encoding: 'utf8' });
  const app = join(cwd, 'My Shop');
  assert.match(out, /Created my-shop/);
  assert.equal(JSON.parse(readFileSync(join(app, 'package.json'), 'utf8')).name, 'my-shop');
  assert.match(readFileSync(join(app, 'README.md'), 'utf8'), /^# my-shop/);
  for (const file of ['.gitignore', 'app/page.tsx', 'app/invoice/[id]/page.tsx', 'lib/wallet.ts', 'lib/invoices.ts', 'test/checkout.test.ts']) {
    assert.ok(existsSync(join(app, file)), file);
  }
  assert.ok(!existsSync(join(app, 'gitignore')));
  assert.match(out, /ths run -- npm run dev/);
});

test('refuses a non-empty directory', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'cza-'));
  mkdirSync(join(cwd, 'taken'));
  writeFileSync(join(cwd, 'taken', 'file'), 'x');
  const result = spawnSync(process.execPath, [bin, 'taken', '--no-install'], { cwd, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /not empty/);
});

test('rejects unknown options and prints help', () => {
  assert.equal(scaffold('--nope').status, 1);
  const help = scaffold('--help');
  assert.equal(help.status, 0);
  assert.match(help.stdout, /Usage: create-zcash-app/);
});

test('picks the package manager from the flags', () => {
  const result = scaffold('app', '--no-install', '--use-pnpm');
  assert.match(result.stdout, /pnpm install/);
  assert.match(result.stdout, /ths run -- pnpm dev/);
});
