"use strict";
/**
 * Dynamic Skill Injection & Lazy MCP Loader
 *
 * Ermöglicht das dynamische Laden von Skills/MCP-Servern zur Laufzeit
 * ohne Neustart des Systems. Unterstützt Lazy-Loading und Caching.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.skillInjector = exports.DynamicSkillInjector = void 0;
const events_1 = require("events");
class DynamicSkillInjector extends events_1.EventEmitter {
    skills = new Map();
    mcpServers = new Map();
    loadingQueue = [];
    cache = new Map();
    /**
     * Registriert einen MCP-Server im System
     */
    registerMCPServer(config) {
        if (this.mcpServers.has(config.name)) {
            throw new Error(`MCP Server '${config.name}' bereits registriert`);
        }
        this.mcpServers.set(config.name, config);
        this.emit('mcp-server-registered', config);
    }
    /**
     * Registriert eine Skill-Definition
     */
    registerSkill(definition) {
        if (this.skills.has(definition.id)) {
            throw new Error(`Skill '${definition.id}' bereits registriert`);
        }
        const loadedSkill = {
            definition,
            loadedAt: new Date(),
            active: false,
            mcpConnections: new Map()
        };
        this.skills.set(definition.id, loadedSkill);
        this.emit('skill-registered', definition);
    }
    /**
     * Lädt eine Skill dynamisch (Lazy Loading)
     */
    async loadSkill(skillId) {
        const skill = this.skills.get(skillId);
        if (!skill) {
            throw new Error(`Skill '${skillId}' nicht gefunden`);
        }
        if (skill.active) {
            return skill; // Bereits geladen
        }
        if (this.loadingQueue.includes(skillId)) {
            // Warte auf laufenden Ladevorgang
            return new Promise((resolve, reject) => {
                const checkLoaded = () => {
                    const updated = this.skills.get(skillId);
                    if (updated?.active) {
                        resolve(updated);
                    }
                    else if (!this.loadingQueue.includes(skillId)) {
                        reject(new Error('Skill loading failed'));
                    }
                    else {
                        setTimeout(checkLoaded, 100);
                    }
                };
                checkLoaded();
            });
        }
        this.loadingQueue.push(skillId);
        try {
            // Lade abhängige Skills zuerst
            if (skill.definition.dependencies) {
                for (const depId of skill.definition.dependencies) {
                    await this.loadSkill(depId);
                }
            }
            // Verbinde mit MCP-Servern
            if (skill.definition.mcpServers) {
                for (const serverName of skill.definition.mcpServers) {
                    const config = this.mcpServers.get(serverName);
                    if (!config) {
                        throw new Error(`MCP Server '${serverName}' nicht gefunden`);
                    }
                    const connection = await this.connectToMCPServer(config);
                    skill.mcpConnections.set(serverName, connection);
                }
            }
            skill.active = true;
            this.emit('skill-loaded', skill);
            return skill;
        }
        finally {
            this.loadingQueue = this.loadingQueue.filter(id => id !== skillId);
        }
    }
    /**
     * Trennt Verbindung zu einer Skill
     */
    async unloadSkill(skillId) {
        const skill = this.skills.get(skillId);
        if (!skill || !skill.active) {
            return;
        }
        // Trenne MCP-Verbindungen
        for (const [serverName, connection] of skill.mcpConnections.entries()) {
            if (connection.close) {
                await connection.close();
            }
            this.emit('mcp-disconnected', { skillId, serverName });
        }
        skill.mcpConnections.clear();
        skill.active = false;
        this.emit('skill-unloaded', skillId);
    }
    /**
     * Verbindet zu einem MCP-Server (simuliert - echte Implementierung würde MCP-Protocol sprechen)
     */
    async connectToMCPServer(config) {
        // Simulierte Verbindung - in echter Implementierung würde hier MCP-Protocol gesprochen
        const connection = {
            serverName: config.name,
            connected: true,
            capabilities: config.capabilities,
            callTool: async (toolName, args) => {
                console.log(`[MCP ${config.name}] Calling tool: ${toolName}`, args);
                return { success: true, result: `Executed ${toolName}` };
            },
            close: async () => {
                connection.connected = false;
                console.log(`[MCP ${config.name}] Connection closed`);
            }
        };
        this.emit('mcp-connected', { serverName: config.name, capabilities: config.capabilities });
        return connection;
    }
    /**
     * Ruft ein Tool aus einer geladenen Skill auf
     */
    async callTool(skillId, toolName, args) {
        const skill = await this.loadSkill(skillId);
        if (!skill.definition.tools.includes(toolName)) {
            throw new Error(`Tool '${toolName}' nicht verfügbar in Skill '${skillId}'`);
        }
        // Versuche Cache
        const cacheKey = `${skillId}:${toolName}:${JSON.stringify(args)}`;
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < 60000) { // 1 Minute Cache
                return cached.result;
            }
        }
        // Rufe Tool über MCP-Server auf
        let result;
        for (const [serverName, connection] of skill.mcpConnections.entries()) {
            try {
                const res = await connection.callTool(toolName, args);
                if (res.success) {
                    result = res.result;
                    break;
                }
            }
            catch (error) {
                console.error(`[MCP ${serverName}] Tool call failed:`, error);
            }
        }
        if (!result) {
            throw new Error(`Tool '${toolName}' konnte nicht ausgeführt werden`);
        }
        // Cache Ergebnis
        this.cache.set(cacheKey, { result, timestamp: Date.now() });
        return result;
    }
    /**
     * Listet alle verfügbaren Skills
     */
    listSkills() {
        return Array.from(this.skills.values()).map(s => ({
            id: s.definition.id,
            name: s.definition.name,
            active: s.active
        }));
    }
    /**
     * Bereinigt den Cache
     */
    clearCache() {
        const oldSize = this.cache.size;
        this.cache.clear();
        this.emit('cache-cleared', { oldSize });
    }
    /**
     * Entfernt alte Cache-Einträge (> 5 Minuten)
     */
    pruneCache() {
        const now = Date.now();
        const maxAge = 5 * 60 * 1000; // 5 Minuten
        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp > maxAge) {
                this.cache.delete(key);
            }
        }
    }
}
exports.DynamicSkillInjector = DynamicSkillInjector;
// Singleton Instance
exports.skillInjector = new DynamicSkillInjector();
// Auto-prune Cache alle 10 Minuten
setInterval(() => exports.skillInjector.pruneCache(), 10 * 60 * 1000);
//# sourceMappingURL=skill_injection.js.map