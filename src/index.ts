/**
 * oh-my-open-sin
 * Native OpenCode SubAgent Framework
 * 
 * Replacing broken plugins with session-aware, non-blocking subagents
 */

import { AgentOrchestrator } from './core/AgentOrchestrator.js';
import { SinDelegate } from './agents/sin_delegate.js';
import { SinSwarm } from './agents/sin_swarm.js';
import { SinMonitor } from './agents/sin_monitor.js';

// Core exports
export { SubAgent } from './core/SubAgent.js';
export { AgentOrchestrator } from './core/AgentOrchestrator.js';

// Built-in agents
export { SinDelegate } from './agents/sin_delegate.js';
export { SinSwarm } from './agents/sin_swarm.js';
export { SinMonitor } from './agents/sin_monitor.js';

// Git utilities
export { GitOrchestrator } from './git/GitOrchestrator.js';

// Health server
export { HealthServer } from './health/HealthServer.js';

// Types
export * from './types/index.js';

/**
 * Create a pre-configured orchestrator with all built-in agents
 */
export function createDefaultOrchestrator() {
  const orchestrator = new AgentOrchestrator();
  
  // Register built-in agents
  orchestrator.register(new SinDelegate());
  orchestrator.register(new SinSwarm());
  orchestrator.register(new SinMonitor());
  
  return orchestrator;
}

/**
 * Framework version
 */
export const VERSION = '1.0.0';

/**
 * Framework name
 */
export const FRAMEWORK_NAME = 'oh-my-open-sin';
