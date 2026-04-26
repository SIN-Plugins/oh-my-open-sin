#!/usr/bin/env node
/**
 * @file verify-sigstore.mjs
 * @description CLI tool to verify Sigstore keyless/key-based signatures for agent outputs, commits & artifacts.
 * @usage node scripts/verify-sigstore.mjs --bundle result.sigstore.json --payload result.json [--cert-identity <email>] [--cert-oidc-issuer <url>] [--strict] [--json]
 * @license MIT
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sigstore } from 'sigstore';

// ─────────────────────────────────────────────────────────────────────────────
// CLI Parser (Native, Zero-Dep)
// ─────────────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = { bundle: null, payload: null, certIdentity: null, certOidcIssuer: null, strict: false, json: false, help: false };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--bundle': opts.bundle = args[++i]; break;
      case '--payload': opts.payload = args[++i]; break;
      case '--cert-identity': opts.certIdentity = args[++i]; break;
      case '--cert-oidc-issuer': opts.certOidcIssuer = args[++i]; break;
      case '--strict': opts.strict = true; break;
      case '--json': opts.json = true; break;
      case '--help': case '-h': opts.help = true; break;
      default: throw new Error(`Unknown flag: ${args[i]}`);
    }
  }
  return opts;
}

function printHelp() {
  console.log(`
🔐 Sigstore Provenance Verifier for oh-my-open-sin
Usage: node scripts/verify-sigstore.mjs [options]

Options:
  --bundle <path>          Sigstore bundle JSON (required)
  --payload <path>         Original payload file to verify (required)
  --cert-identity <email>  Expected certificate SAN (keyless)
  --cert-oidc-issuer <url> Expected OIDC issuer (keyless)
  --strict                 Exit 1 on any verification warning
  --json                   Output machine-readable JSON
  -h, --help               Show this help
  `);
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Verification Logic
// ─────────────────────────────────────────────────────────────────────────────
async function verify(opts) {
  const [bundleRaw, payloadRaw] = await Promise.all([
    readFile(resolve(opts.bundle), 'utf8'),
    readFile(resolve(opts.payload), 'utf8')
  ]);

  const bundle = JSON.parse(bundleRaw);
  const payload = Buffer.from(payloadRaw);

  const verifyOpts = {
    ctLogThreshold: 1,
    rekorLogThreshold: 1,
    ...(opts.certIdentity && { certificateIdentity: opts.certIdentity }),
    ...(opts.certOidcIssuer && { certificateIssuer: opts.certOidcIssuer })
  };

  const result = await sigstore.verify(bundle, payload, verifyOpts);
  return {
    verified: result.verified,
    certificate: result.certificate?.subjectAlternativeName || null,
    issuer: result.certificate?.extensions?.find(e => e.oid === '1.3.6.1.4.1.57264.1.1')?.value || null,
    rekorLogId: result.tlogEntries?.[0]?.logId || null,
    timestamp: new Date().toISOString()
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI Entry
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) { printHelp(); process.exit(0); }
  if (!opts.bundle || !opts.payload) {
    console.error('❌ Missing required flags: --bundle and --payload');
    process.exit(1);
  }

  try {
    const res = await verify(opts);
    const output = opts.json ? JSON.stringify(res, null, 2) : `
✅ Verification Result:
   Verified: ${res.verified}
   Identity: ${res.certificate || 'N/A'}
   Issuer:   ${res.issuer || 'N/A'}
   Rekor ID: ${res.rekorLogId || 'N/A'}
   Time:     ${res.timestamp}`;
    console.log(output);

    if (!res.verified && opts.strict) process.exit(1);
    process.exit(res.verified ? 0 : 1);
  } catch (err) {
    const msg = opts.json ? JSON.stringify({ error: err.message }, null, 2) : `❌ Verification failed: ${err.message}`;
    console.error(msg);
    process.exit(1);
  }
}

main();
