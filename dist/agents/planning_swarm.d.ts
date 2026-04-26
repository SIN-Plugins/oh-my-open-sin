/**
 * Planning Swarm Agents
 * Spezialisiert auf Aufgabenplanung, Ressourcenallokation und Entscheidungsfindung
 */
import { SubAgent } from '../core/SubAgent';
import { SubAgentResult, TaskContext } from '../types/index';
export declare class Prometheus extends SubAgent {
    constructor();
    execute(context: TaskContext, input: unknown): Promise<SubAgentResult>;
    private createForecast;
    private assessRisks;
    private planScenarios;
}
export declare class Metis extends SubAgent {
    constructor();
    execute(context: TaskContext, input: unknown): Promise<SubAgentResult>;
    private developStrategy;
    private defineTactics;
}
export declare class Themis extends SubAgent {
    constructor();
    execute(context: TaskContext, input: unknown): Promise<SubAgentResult>;
    private checkCompliance;
    private assessFairness;
}
export declare class Apollo extends SubAgent {
    constructor();
    execute(context: TaskContext, input: unknown): Promise<SubAgentResult>;
    private clarifyTask;
    private focusExecution;
}
export declare const PlanningSwarm: (typeof Prometheus | typeof Metis | typeof Themis | typeof Apollo)[];
//# sourceMappingURL=planning_swarm.d.ts.map