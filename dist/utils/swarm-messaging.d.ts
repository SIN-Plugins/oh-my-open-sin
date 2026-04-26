export interface SwarmMessage {
    from: string;
    to: string;
    type: "handoff" | "critique" | "request" | "response" | "alert";
    payload: Record<string, any>;
    signature: string;
    ts: number;
}
export declare function signMessage(msg: Omit<SwarmMessage, "signature">): SwarmMessage;
export declare function verifyMessage(msg: SwarmMessage): boolean;
export declare function sanitizePayload(payload: Record<string, any>): Record<string, any>;
export declare function logSwarmInteraction(msg: SwarmMessage, verified: boolean): void;
//# sourceMappingURL=swarm-messaging.d.ts.map