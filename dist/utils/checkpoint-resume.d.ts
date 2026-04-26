export interface ResumePayload {
    restored: boolean;
    session_id: string;
    phase: string;
    injected_context: string;
    metadata: Record<string, any>;
    warnings: string[];
}
export declare function prepareResume(sessionId: string): Promise<ResumePayload>;
//# sourceMappingURL=checkpoint-resume.d.ts.map