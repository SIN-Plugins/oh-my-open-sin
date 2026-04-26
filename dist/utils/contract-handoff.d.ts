export interface ContractPayload {
    from: string;
    to: string;
    phase: string;
    artifact: Record<string, any>;
    verification_score?: number;
    signature: string;
    ts: number;
}
export declare function signContract(payload: Omit<ContractPayload, "signature">): ContractPayload;
export declare function verifyContract(payload: ContractPayload): boolean;
export declare function enforceContractSchema(artifact: any, requiredKeys: string[]): boolean;
export declare function logContractHandoff(payload: ContractPayload, valid: boolean): void;
//# sourceMappingURL=contract-handoff.d.ts.map