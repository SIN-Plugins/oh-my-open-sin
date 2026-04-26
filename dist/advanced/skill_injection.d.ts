/**
 * Dynamic Skill Injection & Lazy MCP Loader
 *
 * Ermöglicht das dynamische Laden von Skills/MCP-Servern zur Laufzeit
 * ohne Neustart des Systems. Unterstützt Lazy-Loading und Caching.
 */
import { EventEmitter } from 'events';
export interface MCPServerConfig {
    name: string;
    command: string;
    args?: string[];
    env?: Record<string, string>;
    capabilities: string[];
}
export interface SkillDefinition {
    id: string;
    name: string;
    description: string;
    mcpServers?: string[];
    tools: string[];
    dependencies?: string[];
}
export interface LoadedSkill {
    definition: SkillDefinition;
    loadedAt: Date;
    active: boolean;
    mcpConnections: Map<string, any>;
}
export declare class DynamicSkillInjector extends EventEmitter {
    private skills;
    private mcpServers;
    private loadingQueue;
    private cache;
    /**
     * Registriert einen MCP-Server im System
     */
    registerMCPServer(config: MCPServerConfig): void;
    /**
     * Registriert eine Skill-Definition
     */
    registerSkill(definition: SkillDefinition): void;
    /**
     * Lädt eine Skill dynamisch (Lazy Loading)
     */
    loadSkill(skillId: string): Promise<LoadedSkill>;
    /**
     * Trennt Verbindung zu einer Skill
     */
    unloadSkill(skillId: string): Promise<void>;
    /**
     * Verbindet zu einem MCP-Server (simuliert - echte Implementierung würde MCP-Protocol sprechen)
     */
    private connectToMCPServer;
    /**
     * Ruft ein Tool aus einer geladenen Skill auf
     */
    callTool(skillId: string, toolName: string, args: any): Promise<any>;
    /**
     * Listet alle verfügbaren Skills
     */
    listSkills(): Array<{
        id: string;
        name: string;
        active: boolean;
    }>;
    /**
     * Bereinigt den Cache
     */
    clearCache(): void;
    /**
     * Entfernt alte Cache-Einträge (> 5 Minuten)
     */
    pruneCache(): void;
}
export declare const skillInjector: DynamicSkillInjector;
//# sourceMappingURL=skill_injection.d.ts.map