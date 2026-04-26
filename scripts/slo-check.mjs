#!/usr/bin/env node
/**
 * @file slo-check.mjs
 * @description CLI tool to evaluate SLOs against OpenTelemetry/Prometheus metrics from the enterprise swarm.
 * @usage node scripts/slo-check.mjs --config slo-config.json [--metrics-url http://localhost:9464/metrics] [--strict] [--json] [--webhook <url>]
 * @license MIT
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// CLI Parser
// ─────────────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = { config: null, metricsUrl: 'http://localhost:9464/metrics', strict: false, json: false, webhook: null, help: false };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--config': opts.config = args[++i]; break;
      case '--metrics-url': opts.metricsUrl = args[++i]; break;
      case '--strict': opts.strict = true; break;
      case '--json': opts.json = true; break;
      case '--webhook': opts.webhook = args[++i]; break;
      case '--help': case '-h': opts.help = true; break;
      default: throw new Error(`Unknown flag: ${args[i]}`);
    }
  }
  return opts;
}

function printHelp() {
  console.log(`
📊 SLO Enforcement Checker for oh-my-open-sin
Usage: node scripts/slo-check.mjs [options]

Options:
  --config <path>        SLO definition JSON (required)
  --metrics-url <url>    Prometheus metrics endpoint (default: http://localhost:9464/metrics)
  --strict               Exit 1 on any SLO breach
  --json                 Output machine-readable JSON
  --webhook <url>        POST breach report to webhook
  -h, --help             Show this help
  `);
}

// ─────────────────────────────────────────────────────────────────────────────
// Prometheus Text Parser (Lightweight & Targeted)
// ─────────────────────────────────────────────────────────────────────────────
async function fetchMetrics(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch metrics: ${res.status} ${res.statusText}`);
  const text = await res.text();
  const metrics = {};
  for (const line of text.split('\n')) {
    if (line.startsWith('#') || !line.trim()) continue;
    const [nameLabels, value] = line.split(/\s+/);
    const [name, labelsStr] = nameLabels.split('{');
    const labels = labelsStr ? Object.fromEntries(labelsStr.replace('}', '').split(',').map(l => l.split('='))) : {};
    const key = labels.agent ? `${name}|${labels.agent}` : name;
    metrics[key] = parseFloat(value);
  }
  return metrics;
}

// ─────────────────────────────────────────────────────────────────────────────
// SLO Evaluation Engine
// ─────────────────────────────────────────────────────────────────────────────
function evaluateSLOs(config, metrics) {
  const report = { timestamp: new Date().toISOString(), overall: 'PASS', breaches: [], checks: [] };
  for (const slo of config.slos) {
    const metricKey = slo.agent ? `${slo.metric}|${slo.agent}` : slo.metric;
    const current = metrics[metricKey] ?? null;
    const passed = current !== null && current <= slo.threshold;
    report.checks.push({ name: slo.name, metric: slo.metric, agent: slo.agent || null, threshold: slo.threshold, current, passed });
    if (!passed) {
      report.breaches.push({ name: slo.name, current, threshold: slo.threshold });
      report.overall = 'FAIL';
    }
  }
  return report;
}

// ─────────────────────────────────────────────────────────────────────────────
// Webhook & Alerting
// ─────────────────────────────────────────────────────────────────────────────
async function triggerWebhook(url, report) {
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'slo_breach', report })
    });
  } catch (err) {
    console.warn(`⚠️ Webhook failed: ${err.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI Entry
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) { printHelp(); process.exit(0); }
  if (!opts.config) {
    console.error('❌ Missing required flag: --config');
    process.exit(1);
  }

  try {
    const [configRaw, metrics] = await Promise.all([
      readFile(resolve(opts.config), 'utf8'),
      fetchMetrics(opts.metricsUrl)
    ]);
    const config = JSON.parse(configRaw);
    const report = evaluateSLOs(config, metrics);

    const output = opts.json ? JSON.stringify(report, null, 2) : `
📊 SLO Evaluation Report:
   Overall: ${report.overall}
   Time:    ${report.timestamp}
   Checks:  ${report.checks.map(c => `${c.passed ? '✅' : '❌'} ${c.name}: ${c.current ?? 'N/A'} / ${c.threshold}`).join('\n          ')}
   ${report.breaches.length ? `\n🚨 Breaches:\n   ${report.breaches.map(b => `${b.name}: ${b.current} > ${b.threshold}`).join('\n   ')}` : ''}`;
    console.log(output);

    if (report.overall === 'FAIL' && opts.webhook) await triggerWebhook(opts.webhook, report);
    if (report.overall === 'FAIL' && opts.strict) process.exit(1);
    process.exit(report.overall === 'PASS' ? 0 : 1);
  } catch (err) {
    const msg = opts.json ? JSON.stringify({ error: err.message }, null, 2) : `❌ SLO check failed: ${err.message}`;
    console.error(msg);
    process.exit(1);
  }
}

main();
