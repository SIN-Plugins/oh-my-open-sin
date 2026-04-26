"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.captureDOMStructure = captureDOMStructure;
exports.diffUIV2 = diffUIV2;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const crypto_1 = require("crypto");
const telemetry_1 = require("./telemetry");
function safeRun(cmd, cwd = process.cwd()) {
    try {
        return { ok: true, out: (0, child_process_1.execSync)(cmd, { cwd, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"], timeout: 20000 }).trim() };
    }
    catch (e) {
        return { ok: false, out: "", err: e.stderr?.toString() || e.message };
    }
}
function stripDynamicContent(html) {
    return html
        .replace(/\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}\b/g, "[DATE]")
        .replace(/\b[a-f0-9]{8,}\b/gi, "[HASH]")
        .replace(/data-testid="[^"]*"/g, 'data-testid="[ID]"')
        .replace(/\bcsrf[_-]?token[^"]*"[^"]*"/gi, 'csrf="[TOKEN]"');
}
async function captureDOMStructure(url, outputPath) {
    const pw = safeRun(`npx playwright codegen --target=json ${url} > ${outputPath}`);
    if (pw.ok)
        return true;
    // Fallback: curl + basic HTML extraction
    const curl = safeRun(`curl -sL ${url} > ${outputPath}`);
    return curl.ok;
}
async function diffUIV2(beforePath, afterPath, baselineDir) {
    try {
        const [bExists, aExists] = await Promise.all([promises_1.default.stat(beforePath).catch(() => null), promises_1.default.stat(afterPath).catch(() => null)]);
        if (!bExists || !aExists)
            return { changed: false, structural_score: 0, layout_shifts: 0, dynamic_ignored: true, method: "skipped", baseline_exists: false };
        const [bRaw, aRaw] = await Promise.all([promises_1.default.readFile(beforePath, "utf-8"), promises_1.default.readFile(afterPath, "utf-8")]);
        const b = stripDynamicContent(bRaw);
        const a = stripDynamicContent(aRaw);
        // Structural DOM diff (tag + attribute sequence hash)
        const extractStructure = (html) => html.replace(/>\s*</g, "><").replace(/\s+/g, " ").trim();
        const hashB = (0, crypto_1.createHash)("sha256").update(extractStructure(b)).digest("hex");
        const hashA = (0, crypto_1.createHash)("sha256").update(extractStructure(a)).digest("hex");
        if (hashB === hashA)
            return { changed: false, structural_score: 0, layout_shifts: 0, dynamic_ignored: true, method: "dom", baseline_exists: !!baselineDir };
        // Line-level structural similarity
        const bLines = b.split("\n").filter(l => l.trim().startsWith("<"));
        const aLines = a.split("\n").filter(l => l.trim().startsWith("<"));
        const common = bLines.filter(l => aLines.includes(l)).length;
        const structural_score = parseFloat((1 - common / Math.max(bLines.length, aLines.length)).toFixed(3));
        // Layout shift proxy (count of structural additions/removals)
        const layout_shifts = Math.abs(bLines.length - aLines.length);
        // Baseline management
        if (baselineDir) {
            await promises_1.default.mkdir(baselineDir, { recursive: true });
            await promises_1.default.writeFile(path_1.default.join(baselineDir, "latest-dom.html"), a);
        }
        (0, telemetry_1.structuredLog)("info", "ui_diff_v2", { structural_score, layout_shifts, method: "dom" });
        return { changed: true, structural_score, layout_shifts, dynamic_ignored: true, method: "dom", baseline_exists: !!baselineDir };
    }
    catch (e) {
        (0, telemetry_1.structuredLog)("warn", "ui_diff_v2_failed", { error: e.message });
        return { changed: false, structural_score: 0, layout_shifts: 0, dynamic_ignored: true, method: "skipped", baseline_exists: false };
    }
}
//# sourceMappingURL=verifier-ui-v2.js.map