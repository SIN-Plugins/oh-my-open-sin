/**
 * SIN Sigstore Integration - Cryptographic Provenance
 * Signierte Outputs, Commits und Artifacts mit Sigstore/cosign
 *
 * Features:
 * - Keyless Signing (Sigstore Fulcio)
 * - Transparency Log (Rekor)
 * - Identity Verification
 * - SBOM Signing
 */
import { EventEmitter } from 'events';
export interface SignOptions {
    artifactId: string;
    artifactType: 'code' | 'commit' | 'config' | 'sbom' | 'audit';
    content: Buffer | string;
    identity?: {
        issuer: string;
        subject: string;
    };
    metadata?: Record<string, any>;
}
export interface SignatureResult {
    signature: string;
    certificate?: string;
    rekorEntryId?: string;
    transparencyLogId?: string;
    timestamp: number;
    verified: boolean;
}
export interface VerificationResult {
    valid: boolean;
    signer?: {
        issuer: string;
        subject: string;
    };
    timestamp?: number;
    rekorVerified?: boolean;
    reason?: string;
}
export interface SignedArtifact {
    id: string;
    type: string;
    digest: string;
    signature: SignatureResult;
    metadata: Record<string, any>;
}
export declare class SigstoreSigner extends EventEmitter {
    private signedArtifacts;
    private signCount;
    private verifyCount;
    constructor();
    sign(options: SignOptions): Promise<SignatureResult>;
    verify(artifactId: string, signature: string): Promise<VerificationResult>;
    signCommit(commitHash: string, author: string, email: string): Promise<SignatureResult>;
    signSBOM(sbomContent: string, packageName: string, version: string): Promise<SignatureResult>;
    signAuditLog(logEntry: string, sessionId: string): Promise<SignatureResult>;
    getSignedArtifact(artifactId: string): SignedArtifact | undefined;
    getAllSignedArtifacts(): SignedArtifact[];
    getStats(): {
        signed: number;
        verified: number;
        artifacts: number;
    };
    exportProvenanceBundle(artifactId: string): string | null;
    private simulateKeylessSigning;
}
export declare function getSigstoreSigner(): SigstoreSigner;
export default SigstoreSigner;
//# sourceMappingURL=SigstoreSigner.d.ts.map