"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeState = serializeState;
exports.deserializeState = deserializeState;
const crypto_1 = require("crypto");
function sortKeys(obj) {
    if (obj === null || typeof obj !== "object")
        return obj;
    if (Array.isArray(obj))
        return obj.map(sortKeys);
    return Object.keys(obj).sort().reduce((acc, key) => {
        acc[key] = sortKeys(obj[key]);
        return acc;
    }, {});
}
function serializeState(state) {
    const sorted = sortKeys(state);
    const json = JSON.stringify(sorted, null, 2);
    const checksum = (0, crypto_1.createHash)("sha256").update(json).digest("hex");
    return JSON.stringify({ ...sorted, checksum }, null, 2);
}
function deserializeState(raw) {
    const parsed = JSON.parse(raw);
    const { checksum, ...rest } = parsed;
    const expected = (0, crypto_1.createHash)("sha256").update(JSON.stringify(sortKeys(rest), null, 2)).digest("hex");
    if (checksum !== expected)
        throw new Error(`❌ Checkpoint corrupted: checksum mismatch`);
    return parsed;
}
//# sourceMappingURL=checkpoint-state.js.map