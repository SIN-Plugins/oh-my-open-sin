export type IntentCategory = "architecture" | "security" | "refactor" | "research" | "frontend" | "backend" | "database" | "devops" | "testing" | "quick_fix" | "unknown";
export declare function classifyIntent(description: string): {
    category: IntentCategory;
    score: number;
    matched_terms: string[];
};
//# sourceMappingURL=intent-classifier.d.ts.map