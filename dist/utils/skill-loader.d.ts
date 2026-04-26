/**
 * Enhanced Skill Loader v2
 * Production-grade skill discovery, dependency resolution, MCP lifecycle management
 */
import { type SkillManifest } from "./skill-schema.js";
export declare function discoverSkills(forceRefresh?: boolean): Promise<SkillManifest[]>;
export declare function matchSkills(description: string, agent: string, allSkills: SkillManifest[]): SkillManifest[];
export declare function resolveDependencies(skills: SkillManifest[], allSkills: SkillManifest[]): Promise<SkillManifest[]>;
export declare function startSkillMCPs(sessionId: string, skills: SkillManifest[]): Promise<void>;
export declare function stopSkillMCPs(sessionId: string): Promise<void>;
export declare function getSkillPromptInjection(sessionId: string): string;
export declare function getSkillPermissions(sessionId: string): Record<string, any>;
export declare function getSkillHealth(sessionId: string): Record<string, boolean>;
//# sourceMappingURL=skill-loader.d.ts.map