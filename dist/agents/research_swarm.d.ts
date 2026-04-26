/**
 * Research Swarm Agents
 * Spezialisiert auf Informationssammlung, Analyse und Wissenssynthese
 */
import { SubAgent } from '../core/SubAgent';
import { SubAgentResult, TaskContext } from '../types/index';
export declare class Athena extends SubAgent {
    constructor();
    execute(context: TaskContext, input: unknown): Promise<SubAgentResult>;
    private identifyPatterns;
    private developStrategy;
}
export declare class Argus extends SubAgent {
    constructor();
    execute(context: TaskContext, input: unknown): Promise<SubAgentResult>;
    private detectAnomalies;
    private assessThreats;
}
export declare class Daedalus extends SubAgent {
    constructor();
    execute(context: TaskContext, input: unknown): Promise<SubAgentResult>;
    private designArchitecture;
    private proposeInnovations;
}
export declare class Hermes extends SubAgent {
    constructor();
    execute(context: TaskContext, input: unknown): Promise<SubAgentResult>;
    private prepareMessages;
    private deliverMessages;
}
export declare const ResearchSwarm: (typeof Athena | typeof Argus | typeof Daedalus | typeof Hermes)[];
//# sourceMappingURL=research_swarm.d.ts.map