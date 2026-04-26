export interface TelemetryEvent {
    level: "info" | "warn" | "error";
    msg: string;
    [key: string]: any;
}
export declare function structuredLog(level: "info" | "warn" | "error", msg: string, data?: Record<string, any>): Promise<void>;
//# sourceMappingURL=telemetry.d.ts.map