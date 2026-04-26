"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubAgent = void 0;
/**
 * Base class for all SubAgents in the oh-my-open-sin framework
 * Provides non-blocking, session-aware execution
 */
class SubAgent {
    config;
    isActive = false;
    currentTaskId;
    constructor(config) {
        this.config = config;
    }
    getName() {
        return this.config.name;
    }
    getDescription() {
        return this.config.description;
    }
    getCapabilities() {
        return this.config.capabilities;
    }
    /**
     * Check if the agent is currently busy
     */
    isBusy() {
        return this.isActive;
    }
    /**
     * Get current task ID if any
     */
    getCurrentTaskId() {
        return this.currentTaskId;
    }
    /**
     * Internal method to track task execution
     */
    async trackExecution(taskId, fn) {
        this.isActive = true;
        this.currentTaskId = taskId;
        try {
            const result = await fn();
            return result;
        }
        finally {
            this.isActive = false;
            this.currentTaskId = undefined;
        }
    }
    /**
     * Validate input before execution
     */
    validateInput(input) {
        return input !== null && input !== undefined;
    }
    /**
     * Create a success result
     */
    success(data, metadata) {
        return {
            success: true,
            data,
            metadata,
        };
    }
    /**
     * Create an error result
     */
    error(message, metadata) {
        return {
            success: false,
            error: message,
            metadata,
        };
    }
}
exports.SubAgent = SubAgent;
//# sourceMappingURL=SubAgent.js.map