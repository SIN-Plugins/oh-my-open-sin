export interface UIDiffResultV2 {
    changed: boolean;
    structural_score: number;
    layout_shifts: number;
    dynamic_ignored: boolean;
    method: "dom" | "pixel" | "hash" | "skipped";
    baseline_exists: boolean;
}
export declare function captureDOMStructure(url: string, outputPath: string): Promise<boolean>;
export declare function diffUIV2(beforePath: string, afterPath: string, baselineDir?: string): Promise<UIDiffResultV2>;
//# sourceMappingURL=verifier-ui-v2.d.ts.map