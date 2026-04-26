/**
 * Validation Superlayer Agents
 * Spezialisiert auf Validierung, Qualitätssicherung und Fehlererkennung
 */
import { SubAgent } from '../core/SubAgent';
import { SubAgentResult, TaskContext } from '../types/index';
export declare class Zeus extends SubAgent {
    constructor();
    execute(context: TaskContext, input: unknown): Promise<SubAgentResult>;
    private performValidation;
    private makeDecision;
}
export declare class Aegis extends SubAgent {
    constructor();
    execute(context: TaskContext, input: unknown): Promise<SubAgentResult>;
    private scanSecurity;
    private detectVulnerabilities;
}
export declare class Hephaestus extends SubAgent {
    constructor();
    execute(context: TaskContext, input: unknown): Promise<SubAgentResult>;
    private assessQuality;
    private proposeRefinements;
}
export declare class Chronos extends SubAgent {
    constructor();
    execute(context: TaskContext, input: unknown): Promise<SubAgentResult>;
    private measurePerformance;
}
export declare class Nemesis extends SubAgent {
    constructor();
    execute(context: TaskContext, input: unknown): Promise<SubAgentResult>;
    private findWeaknesses;
    private generateCounterArguments;
    private performStressTest;
}
export declare const ValidationSuperlayer: (typeof Zeus | typeof Aegis | typeof Hephaestus | typeof Chronos | typeof Nemesis)[];
//# sourceMappingURL=validation_layer.d.ts.map