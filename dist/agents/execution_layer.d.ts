/**
 * Execution Layer Agents
 * Spezialisiert auf Ausführung, Implementierung und operative Aufgaben
 */
import { SubAgent } from '../core/SubAgent';
import { SubAgentResult, TaskContext } from '../types/index';
export declare class Atlas extends SubAgent {
    constructor();
    execute(context: TaskContext, input: unknown): Promise<SubAgentResult>;
    private assessWorkload;
    private distributeLoad;
    private executeHeavyTask;
}
export declare class Iris extends SubAgent {
    constructor();
    execute(context: TaskContext, input: unknown): Promise<SubAgentResult>;
    private analyzeVisuals;
    private checkAccessibility;
}
export declare class Hades extends SubAgent {
    constructor();
    execute(context: TaskContext, input: unknown): Promise<SubAgentResult>;
    private exploreDepths;
    private findRootCause;
    private proposeSolution;
}
export declare class Janus extends SubAgent {
    constructor();
    execute(context: TaskContext, input: unknown): Promise<SubAgentResult>;
    private processIncoming;
    private processOutgoing;
    private manageTransition;
}
export declare class Asclepius extends SubAgent {
    constructor();
    execute(context: TaskContext, input: unknown): Promise<SubAgentResult>;
    private diagnoseIssues;
    private applyTreatment;
    private monitorRecovery;
}
export declare const ExecutionLayer: (typeof Atlas | typeof Iris | typeof Hades | typeof Janus | typeof Asclepius)[];
//# sourceMappingURL=execution_layer.d.ts.map