"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signMessage = signMessage;
exports.verifyMessage = verifyMessage;
exports.sanitizePayload = sanitizePayload;
exports.logSwarmInteraction = logSwarmInteraction;
const crypto_1 = __importDefault(require("crypto"));
const telemetry_1 = require("./telemetry");
const HMAC_SECRET = process.env.SIN_HMAC_SECRET || "sin-swarm-zero-trust-default";
const INJECTION_PATTERNS = [
    /ignore previous instructions/gi,
    /system prompt override/gi,
    /<\|.*?\|>/g,
    /act as.*administrator/gi,
    /bypass.*policy/gi
];
function signMessage(msg) {
    const payloadStr = JSON.stringify(msg.payload, Object.keys(msg.payload).sort());
    const hmac = crypto_1.default.createHmac("sha256", HMAC_SECRET);
    hmac.update(`${msg.from}:${msg.to}:${msg.type}:${payloadStr}:${msg.ts}`);
    return { ...msg, signature: hmac.digest("hex") };
}
function verifyMessage(msg) {
    const expected = signMessage({ from: msg.from, to: msg.to, type: msg.type, payload: msg.payload, ts: msg.ts });
    return crypto_1.default.timingSafeEqual(Buffer.from(msg.signature), Buffer.from(expected.signature));
}
function sanitizePayload(payload) {
    const sanitized = {};
    for (const [k, v] of Object.entries(payload)) {
        if (typeof v === "string") {
            let clean = v;
            for (const p of INJECTION_PATTERNS)
                clean = clean.replace(p, "");
            sanitized[k] = clean.trim();
        }
        else {
            sanitized[k] = v;
        }
    }
    return sanitized;
}
function logSwarmInteraction(msg, verified) {
    (0, telemetry_1.structuredLog)(verified ? "info" : "warn", "swarm_message", {
        from: msg.from,
        to: msg.to,
        type: msg.type,
        verified,
        payload_keys: Object.keys(msg.payload),
        ts: new Date(msg.ts).toISOString()
    });
}
//# sourceMappingURL=swarm-messaging.js.map