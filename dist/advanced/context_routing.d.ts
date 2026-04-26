/**
 * Context-Aware Routing mit AST-Heuristics
 *
 * Analysiert Code-Kontext mittels AST und routet Tasks an die passenden Agenten.
 * Verwendet statische Code-Analyse für intelligente Entscheidungsfindung.
 */
import * as ts from 'typescript';
export interface RoutingContext {
    filePath: string;
    code: string;
    taskType: string;
    complexity: number;
    dependencies: string[];
    symbols: SymbolInfo[];
}
export interface SymbolInfo {
    name: string;
    kind: ts.ScriptElementKind;
    start: number;
    end: number;
    documentation?: string;
}
export interface RoutingDecision {
    agentId: string;
    confidence: number;
    reason: string;
    alternativeAgents: string[];
}
export declare class ContextAwareRouter {
    private agentCapabilities;
    private typeCache;
    /**
     * Registriert einen Agenten mit seinen Fähigkeiten
     */
    registerAgent(agentId: string, capabilities: string[]): void;
    /**
     * Analysiert Code und erstellt Routing-Kontext
     */
    analyzeCode(filePath: string, code: string): RoutingContext;
    /**
     * Erkennt den Task-Typ basierend auf AST-Analyse
     */
    private detectTaskType;
    /**
     * Bestimmt Script-Element-Kind für ein Node
     */
    private getScriptElementKind;
    /**
     * Routet einen Task zum besten Agenten basierend auf Kontext
     */
    routeTask(context: RoutingContext): RoutingDecision;
    /**
     * Mapped Dependency-Pfad zu Capability
     */
    private mapDependencyToCapability;
    /**
     * Mapped Symbol-Kind zu Capability
     */
    private mapSymbolToCapability;
    /**
     * Bereinigt den Type-Cache
     */
    clearCache(): void;
}
export declare const contextRouter: ContextAwareRouter;
//# sourceMappingURL=context_routing.d.ts.map