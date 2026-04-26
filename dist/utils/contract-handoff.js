"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signContract = signContract;
exports.verifyContract = verifyContract;
exports.enforceContractSchema = enforceContractSchema;
exports.logContractHandoff = logContractHandoff;
const crypto_1 = __importDefault(require("crypto"));
const telemetry_1 = require("./telemetry");
const HMAC_SECRET = process.env.SIN_HMAC_SECRET || "sin-swarm-zero-trust-default";
function signContract(payload) {
    const sorted = JSON.stringify(payload.artifact, Object.keys(payload.artifact).sort());
    const hmac = crypto_1.default.createHmac("sha256", HMAC_SECRET);
    hmac.update(`${payload.from}:${payload.to}:${payload.phase}:${sorted}:${payload.ts}`);
    return { ...payload, signature: hmac.digest("hex") };
}
function verifyContract(payload) {
    const expected = signContract({ from: payload.from, to: payload.to, phase: payload.phase, artifact: payload.artifact, verification_score: payload.verification_score, ts: payload.ts });
    return crypto_1.default.timingSafeEqual(Buffer.from(payload.signature), Buffer.from(expected.signature));
}
function enforceContractSchema(artifact, requiredKeys) {
    if (typeof artifact !== "object" || artifact === null)
        return false;
    return requiredKeys.every(k => k in artifact);
}
function logContractHandoff(payload, valid) {
    (0, telemetry_1.structuredLog)(valid ? "info" : "warn", "contract_handoff", {
        from: payload.from, to: payload.to, phase: payload.phase, valid, score: payload.verification_score, ts: new Date(payload.ts).toISOString()
    });
}
//# sourceMappingURL=contract-handoff.js.map