"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyFailureV2 = classifyFailureV2;
const PATTERNS = [
    { regex: /SyntaxError|Unexpected token|parse error|invalid syntax/i, type: "syntax", root: "code_error", hint: "Use LSP quick-fix. Check brackets, quotes, indentation." },
    { regex: /Type .* is not assignable|Cannot find name|TS\d{4}|mypy|type mismatch/i, type: "type", root: "code_error", hint: "Run lsp_diagnostics. Fix imports, adjust interfaces, cast types." },
    { regex: /FAIL|✕|AssertionError|Expected .* but received|pytest|jest/i, type: "test", root: "test_assertion", hint: "Check mocks, async/await, test isolation. Rerun with debug flags." },
    { regex: /RuntimeError|TypeError: .* is not a function|Cannot read properties|panic|segfault|undefined is not/i, type: "runtime", root: "code_error", hint: "Add null checks, verify API shapes, simplify chains, early returns." },
    { regex: /CONFLICT|merge conflict|<<<<<<<|>>>>>>>|both modified/i, type: "merge", root: "merge_conflict", hint: "Semantic merge. Keep non-overlapping. Request agent review if complex." },
    { regex: /npm ERR!|ModuleNotFoundError|cannot find module|dependency|peer dep|yarn error|pip install/i, type: "dependency", root: "dep_mismatch", hint: "Reinstall deps, check lockfile, verify node/python version, clear cache." },
    { regex: /insufficient_quota|rate_limit|429|context_length_exceeded|timeout|billing/i, type: "quota", root: "rate_limit", hint: "Switch to fast/mini model. Reduce context. Split task. Backoff retry." },
    { regex: /lsp_|diagnostics|rename failed|ast-grep|language server/i, type: "lsp", root: "tool_failure", hint: "Reload LSP workspace. Verify paths. Fallback to grep/native tools." },
    { regex: /flaky|intermittent|sometimes fails|race condition|timeout in test/i, type: "flaky_test", root: "test_assertion", hint: "Add retries, increase timeouts, mock external calls, isolate state." }
];
function classifyFailureV2(errorOutput, exitCode, lspOutput) {
    const snippet = errorOutput.slice(0, 600);
    const matches = [];
    for (const p of PATTERNS) {
        const count = (snippet.match(p.regex) || []).length;
        if (count > 0)
            matches.push({ type: p.type, root: p.root, hint: p.hint, score: count * (p.type === "flaky_test" ? 1.5 : 1) });
    }
    // LSP diagnostic parsing
    const lspDiagnostics = [];
    if (lspOutput) {
        const lspRegex = /([^:]+):(\d+):(\d+):\s*(.*)/g;
        let m;
        while ((m = lspRegex.exec(lspOutput)) !== null) {
            lspDiagnostics.push({ file: m[1], line: parseInt(m[2], 10), message: m[4] });
        }
        if (lspDiagnostics.length > 0) {
            matches.push({ type: "type", root: "code_error", hint: "Apply LSP quick-fixes.", score: lspDiagnostics.length * 2 });
        }
    }
    // Flaky detection heuristic
    const isFlaky = /flaky|intermittent|sometimes|race|timeout.*test/i.test(snippet) || (exitCode === 1 && /test|spec|jest|pytest/i.test(snippet) && Math.random() < 0.3);
    matches.sort((a, b) => b.score - a.score);
    const primary = matches[0] || { type: "unknown", root: "unknown", hint: "Unrecognized failure. Reduce scope, add logging, request review.", score: 0 };
    const confidence = Math.min(1, primary.score / 5);
    return {
        types: [...new Set(matches.map(m => m.type))],
        primary_type: primary.type,
        root_cause: primary.root,
        confidence,
        is_flaky: isFlaky,
        hint: primary.hint,
        error_snippet: snippet,
        lsp_diagnostics: lspDiagnostics
    };
}
//# sourceMappingURL=failure-classifier-v2.js.map