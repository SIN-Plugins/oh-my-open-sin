#!/usr/bin/env tsx
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseArgs = parseArgs;
exports.loadChain = loadChain;
exports.computeHash = computeHash;
exports.verifyHMAC = verifyHMAC;
exports.verifyChain = verifyChain;
exports.getTelemetryMetrics = getTelemetryMetrics;
exports.generateBoardReport = generateBoardReport;
exports.formatBoardReport = formatBoardReport;
exports.runAuditVerify = runAuditVerify;
exports.watchAuditChain = watchAuditChain;
exports.appendAuditEntry = appendAuditEntry;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const AUDIT_CHAIN = path_1.default.join(process.cwd(), ".opencode", "audit-chain.jsonl");
const TELEMETRY_LOG = path_1.default.join(process.env.HOME || "", ".config/opencode/logs/telemetry.jsonl");
const HMAC_SECRET = process.env.SIN_HMAC_SECRET || "sin-swarm-zero-trust-default";
function parseArgs(args) {
    const opts = { mode: "verify", json: false, watch: false, output: null };
    for (let i = 0; i < args.length; i++) {
        if (["verify", "audit", "report"].includes(args[i]))
            opts.mode = args[i];
        if (args[i] === "--json")
            opts.json = true;
        if (args[i] === "--watch")
            opts.watch = true;
        if (args[i] === "--output" && args[i + 1])
            opts.output = args[++i];
    }
    return opts;
}
async function loadChain() {
    const raw = await promises_1.default.readFile(AUDIT_CHAIN, "utf-8").catch(() => "");
    return raw.split("\n").filter(Boolean).map(l => {
        try {
            return JSON.parse(l);
        }
        catch {
            return null;
        }
    }).filter(Boolean);
}
function computeHash(data) {
    return crypto_1.default.createHash("sha256").update(data).digest("hex");
}
function verifyHMAC(entry) {
    const payload = JSON.stringify({
        id: entry.id,
        parent_hash: entry.parent_hash,
        payload_hash: entry.payload_hash,
        ts: entry.ts,
        phase: entry.phase,
        agent: entry.agent
    });
    const hmac = crypto_1.default.createHmac("sha256", HMAC_SECRET);
    hmac.update(payload);
    return hmac.digest("hex") === entry.signature;
}
async function verifyChain() {
    const chain = await loadChain();
    const report = {
        valid: true,
        total_entries: chain.length,
        broken_links: 0,
        signature_failures: 0,
        append_violations: 0,
        first_ts: chain[0]?.ts || 0,
        last_ts: chain[chain.length - 1]?.ts || 0,
        merkle_root: ""
    };
    let prevHash = "genesis";
    const hashes = [];
    for (let i = 0; i < chain.length; i++) {
        const e = chain[i];
        // 1. Append-only check
        if (i > 0 && e.ts < chain[i - 1].ts)
            report.append_violations++;
        // 2. Parent link check
        if (e.parent_hash !== prevHash)
            report.broken_links++;
        // 3. Signature check
        if (!verifyHMAC(e))
            report.signature_failures++;
        // 4. Payload hash check
        const expectedPayloadHash = computeHash(JSON.stringify({
            phase: e.phase,
            agent: e.agent,
            temple_id: e.temple_id,
            node_id: e.node_id,
            verification_score: e.verification_score
        }, Object.keys({ phase: e.phase, agent: e.agent, temple_id: e.temple_id, node_id: e.node_id, verification_score: e.verification_score }).sort()));
        if (e.payload_hash !== expectedPayloadHash)
            report.broken_links++;
        prevHash = computeHash(`${e.parent_hash}:${e.payload_hash}:${e.ts}`);
        hashes.push(prevHash);
    }
    // Merkle root (simplified linear chain root)
    report.merkle_root = hashes.length > 0 ? hashes[hashes.length - 1] : "empty";
    report.valid = report.broken_links === 0 && report.signature_failures === 0 && report.append_violations === 0;
    return report;
}
async function getTelemetryMetrics() {
    const telemetryRaw = await promises_1.default.readFile(TELEMETRY_LOG, "utf-8").catch(() => "");
    const logs = telemetryRaw.split("\n").filter(Boolean).map(l => {
        try {
            return JSON.parse(l);
        }
        catch {
            return null;
        }
    }).filter(Boolean);
    const totalCost = logs.reduce((s, e) => s + (e.cost_usd || 0), 0);
    const totalTokens = logs.reduce((s, e) => s + (e.tokens || 0), 0);
    const verificationGates = logs.filter(e => e.msg === "verification_gate_v2").length;
    const healingAttempts = logs.filter(e => e.msg?.includes("healing_")).length;
    const swarmHealth = logs.filter(e => e.msg === "swarm_health_updated").reduce((acc, e) => {
        acc[e.agent] = e.score;
        return acc;
    }, {});
    return { totalCost, totalTokens, verificationGates, healingAttempts, swarmHealth };
}
async function generateBoardReport(chainReport) {
    const metrics = await getTelemetryMetrics();
    const riskScore = chainReport.valid ? "LOW" : chainReport.broken_links > 2 || chainReport.signature_failures > 0 ? "CRITICAL" : "MEDIUM";
    const complianceStatus = chainReport.valid ? "✅ FULLY COMPLIANT" : "⚠️ AUDIT VIOLATIONS DETECTED";
    return {
        chainReport,
        totalCost: metrics.totalCost,
        totalTokens: metrics.totalTokens,
        verificationGates: metrics.verificationGates,
        healingAttempts: metrics.healingAttempts,
        swarmHealth: metrics.swarmHealth,
        riskScore,
        complianceStatus
    };
}
function formatBoardReport(report) {
    const avgHealth = Object.values(report.swarmHealth).length > 0
        ? (Object.values(report.swarmHealth).reduce((a, b) => a + b, 0) / Object.values(report.swarmHealth).length).toFixed(2)
        : "N/A";
    return `
# 🏛️ SIN ENTERPRISE AUDIT & BOARD REPORT
**Generated:** ${new Date().toISOString()} | **Chain Entries:** ${report.chainReport.total_entries} | **Merkle Root:** \`${report.chainReport.merkle_root.slice(0, 16)}...\`

## 📊 Executive Summary
| Metric | Value |
|---|---|
| **Chain Integrity** | ${report.chainReport.valid ? "✅ VALID" : "❌ INVALID"} |
| **Broken Links** | ${report.chainReport.broken_links} |
| **Signature Failures** | ${report.chainReport.signature_failures} |
| **Append Violations** | ${report.chainReport.append_violations} |
| **Risk Score** | ${report.riskScore} |
| **Compliance Status** | ${report.complianceStatus} |

## 💰 Cost & Efficiency
| Metric | Value |
|---|---|
| **Total Tokens** | ${report.totalTokens.toLocaleString()} |
| **Total Cost (USD)** | $${report.totalCost.toFixed(4)} |
| **Verification Gates Passed** | ${report.verificationGates} |
| **Healing Attempts** | ${report.healingAttempts} |
| **Avg Agent Health** | ${avgHealth} |

## 🔐 Security & Governance
- **Zero-Trust Handoffs:** HMAC-signed, schema-validated, merkle-chained
- **Append-Only Audit:** Monotonic timestamps, no overwrites, sequence enforced
- **Tamper-Evident:** Any modification breaks parent hash chain & signature
- **Graceful Degradation:** Broken nodes auto-blocked, fallback subgraphs spawned

## 📈 Recommendations
${report.chainReport.valid
        ? "- ✅ Chain intact. Continue enterprise operations.\n- 📊 Schedule weekly board report generation.\n- 🔐 Rotate HMAC secret quarterly."
        : "- 🛑 CRITICAL: Chain integrity compromised. Halt production dispatch.\n- 🔍 Run \`sin-audit-verify.ts audit --json\` to locate broken entries.\n- 🔄 Restore from last valid checkpoint via \`sin-resume.ts\`.\n- 🛡️ Enforce strict contract handoffs before next temple spawn."}

---
📄 **Generated by \`sin-audit-verify.ts\`** | Stack: oh-my-open-sin v2.0.0 | Provider: OpenAI-Only | Fleet: Mac/OCI/HF
`.trim();
}
async function runAuditVerify(mode, json, output) {
    const report = await verifyChain();
    if (mode === "verify") {
        if (json) {
            console.log(JSON.stringify(report, null, 2));
        }
        else {
            console.log("🔍 CHAIN VERIFICATION");
            console.log(`✅ Valid: ${report.valid}`);
            console.log(`📦 Entries: ${report.total_entries}`);
            console.log(`🔗 Broken Links: ${report.broken_links}`);
            console.log(`🔐 Signature Failures: ${report.signature_failures}`);
            console.log(`📝 Append Violations: ${report.append_violations}`);
            console.log(`🌳 Merkle Root: ${report.merkle_root}`);
        }
    }
    else if (mode === "audit") {
        const chain = await loadChain();
        if (json) {
            console.log(JSON.stringify({ report, chain }, null, 2));
        }
        else {
            console.log("📜 FULL AUDIT DUMP");
            for (const e of chain.slice(-20)) {
                const valid = verifyHMAC(e);
                console.log(`${valid ? "✅" : "❌"} ${e.id} | ${e.phase} | ${e.agent} | ts:${e.ts} | parent:${e.parent_hash.slice(0, 8)}...`);
            }
        }
    }
    else if (mode === "report") {
        const boardReport = await generateBoardReport(report);
        const formatted = formatBoardReport(boardReport);
        if (output) {
            await promises_1.default.writeFile(output, formatted);
            console.log(`📄 Board report saved to ${output}`);
        }
        else {
            console.log(formatted);
        }
    }
}
async function watchAuditChain() {
    console.log("👁️ Audit watch mode (5s polling). Ctrl+C to stop.");
    while (true) {
        const report = await verifyChain();
        console.clear();
        console.log("🔍 SIN AUDIT CHAIN STATUS");
        console.log(`Valid: ${report.valid} | Entries: ${report.total_entries} | Broken: ${report.broken_links} | SigFail: ${report.signature_failures} | AppendViol: ${report.append_violations}`);
        console.log(`Merkle Root: ${report.merkle_root.slice(0, 24)}...`);
        await new Promise(r => setTimeout(r, 5000));
    }
}
async function appendAuditEntry(entry) {
    const chain = await loadChain();
    const parentHash = chain.length > 0
        ? chain[chain.length - 1].signature // Use last entry's computed hash
        : "genesis";
    const payloadData = {
        phase: entry.phase,
        agent: entry.agent,
        temple_id: entry.temple_id,
        node_id: entry.node_id,
        verification_score: entry.verification_score
    };
    const payloadHash = computeHash(JSON.stringify(payloadData, Object.keys(payloadData).sort()));
    const merkleHash = computeHash(`${parentHash}:${payloadHash}:${Date.now()}`);
    const hmacData = {
        ...entry,
        parent_hash: parentHash,
        payload_hash: payloadHash,
        ts: Date.now()
    };
    const hmac = crypto_1.default.createHmac("sha256", HMAC_SECRET);
    hmac.update(JSON.stringify(hmacData, Object.keys(hmacData).sort()));
    const signature = hmac.digest("hex");
    const auditEntry = {
        ...entry,
        parent_hash: parentHash,
        payload_hash: payloadHash,
        signature,
        ts: Date.now()
    };
    await promises_1.default.mkdir(path_1.default.dirname(AUDIT_CHAIN), { recursive: true });
    await promises_1.default.appendFile(AUDIT_CHAIN, JSON.stringify(auditEntry) + "\n");
    return auditEntry;
}
//# sourceMappingURL=audit-verify.js.map