#!/usr/bin/env tsx
import { type VerificationReportV2 } from "../utils/verification-gate-v2";
export declare function sinVerifyDebug(sessionId?: string, testCmd?: string, projectType?: string): Promise<VerificationReportV2 | null>;
export declare class SinVerifyDebug {
    run(sessionId: string, testCmd?: string, projectType?: string): Promise<VerificationReportV2 | null>;
}
//# sourceMappingURL=sin-verify-debug.d.ts.map