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

export class ContextAwareRouter {
  private agentCapabilities: Map<string, Set<string>> = new Map();
  private typeCache: Map<string, ts.Program> = new Map();

  /**
   * Registriert einen Agenten mit seinen Fähigkeiten
   */
  registerAgent(agentId: string, capabilities: string[]): void {
    this.agentCapabilities.set(agentId, new Set(capabilities));
  }

  /**
   * Analysiert Code und erstellt Routing-Kontext
   */
  analyzeCode(filePath: string, code: string): RoutingContext {
    const sourceFile = ts.createSourceFile(
      filePath,
      code,
      ts.ScriptTarget.Latest,
      true
    );

    const symbols: SymbolInfo[] = [];
    const dependencies: string[] = [];
    let complexity = 0;

    // Besuche AST-Nodes
    const visit = (node: ts.Node) => {
      // Extrahiere Symbole
      if (ts.isIdentifier(node) && node.parent) {
        const kind = this.getScriptElementKind(node);
        if (kind) {
          symbols.push({
            name: node.getText(),
            kind,
            start: node.getStart(),
            end: node.getEnd()
          });
        }
      }

      // Zähle Komplexität
      if (
        ts.isIfStatement(node) ||
        ts.isSwitchStatement(node) ||
        ts.isForStatement(node) ||
        ts.isWhileStatement(node) ||
        ts.isTryStatement(node)
      ) {
        complexity++;
      }

      // Extrahiere Imports als Dependencies
      if (ts.isImportDeclaration(node) && node.moduleSpecifier) {
        const modulePath = node.moduleSpecifier.getText().replace(/['"]/g, '');
        dependencies.push(modulePath);
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    return {
      filePath,
      code,
      taskType: this.detectTaskType(sourceFile),
      complexity,
      dependencies,
      symbols
    };
  }

  /**
   * Erkennt den Task-Typ basierend auf AST-Analyse
   */
  private detectTaskType(sourceFile: ts.SourceFile): string {
    let hasTests = false;
    let hasUI = false;
    let hasAPI = false;
    let hasDatabase = false;

    const visit = (node: ts.Node) => {
      const text = node.getText();

      if (text.includes('describe') || text.includes('it(') || text.includes('test(')) {
        hasTests = true;
      }
      if (text.includes('React') || text.includes('JSX') || text.includes('<div')) {
        hasUI = true;
      }
      if (text.includes('fetch') || text.includes('axios') || text.includes('api')) {
        hasAPI = true;
      }
      if (text.includes('database') || text.includes('sql') || text.includes('mongo')) {
        hasDatabase = true;
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    if (hasTests) return 'testing';
    if (hasUI) return 'ui-development';
    if (hasAPI) return 'api-development';
    if (hasDatabase) return 'database-operation';
    
    return 'general-development';
  }

  /**
   * Bestimmt Script-Element-Kind für ein Node
   */
  private getScriptElementKind(node: ts.Node): ts.ScriptElementKind | null {
    if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
      return ts.ScriptElementKind.functionElement;
    }
    if (ts.isClassDeclaration(node)) {
      return ts.ScriptElementKind.classElement;
    }
    if (ts.isInterfaceDeclaration(node)) {
      return ts.ScriptElementKind.interfaceElement;
    }
    if (ts.isVariableDeclaration(node)) {
      return ts.ScriptElementKind.variableElement;
    }
    if (ts.isEnumDeclaration(node)) {
      return ts.ScriptElementKind.enumElement;
    }
    if (ts.isTypeAliasDeclaration(node)) {
      return ts.ScriptElementKind.typeElement;
    }
    return null;
  }

  /**
   * Routet einen Task zum besten Agenten basierend auf Kontext
   */
  routeTask(context: RoutingContext): RoutingDecision {
    const scores: Map<string, number> = new Map();
    const reasons: Map<string, string[]> = new Map();

    for (const [agentId, capabilities] of this.agentCapabilities.entries()) {
      let score = 0;
      const reasonList: string[] = [];

      // Match Task-Typ mit Capabilities
      if (capabilities.has(context.taskType)) {
        score += 30;
        reasonList.push(`Spezialisiert auf ${context.taskType}`);
      }

      // Berücksichtige Komplexität
      if (context.complexity > 10 && capabilities.has('complex-refactoring')) {
        score += 20;
        reasonList.push('Kann komplexe Refactorings handhaben');
      } else if (context.complexity <= 5 && capabilities.has('quick-fixes')) {
        score += 15;
        reasonList.push('Optimiert für schnelle Fixes');
      }

      // Check Dependencies
      const matchingDeps = context.dependencies.filter(dep => 
        capabilities.has(this.mapDependencyToCapability(dep))
      );
      if (matchingDeps.length > 0) {
        score += matchingDeps.length * 10;
        reasonList.push(`Unterstützt Dependencies: ${matchingDeps.join(', ')}`);
      }

      // Check Symbols
      const relevantSymbols = context.symbols.filter(s => 
        capabilities.has(this.mapSymbolToCapability(s.kind))
      );
      if (relevantSymbols.length > 0) {
        score += Math.min(relevantSymbols.length * 5, 25);
        reasonList.push(`Verarbeitet ${relevantSymbols.length} relevante Symbole`);
      }

      scores.set(agentId, score);
      reasons.set(agentId, reasonList);
    }

    // Finde besten Agenten
    let bestAgent = '';
    let bestScore = -1;
    
    for (const [agentId, score] of scores.entries()) {
      if (score > bestScore) {
        bestScore = score;
        bestAgent = agentId;
      }
    }

    // Erstelle Liste alternativer Agenten
    const alternatives: string[] = [];
    for (const [agentId, score] of scores.entries()) {
      if (agentId !== bestAgent && score > 0) {
        alternatives.push(agentId);
      }
    }
    alternatives.sort((a, b) => (scores.get(b) || 0) - (scores.get(a) || 0));

    const confidence = Math.min(bestScore / 100, 1.0);
    const reason = reasons.get(bestAgent)?.join('; ') || 'Keine spezifischen Gründe';

    return {
      agentId: bestAgent,
      confidence,
      reason,
      alternativeAgents: alternatives.slice(0, 3)
    };
  }

  /**
   * Mapped Dependency-Pfad zu Capability
   */
  private mapDependencyToCapability(dep: string): string {
    if (dep.includes('react')) return 'ui-development';
    if (dep.includes('express')) return 'api-development';
    if (dep.includes('mongoose') || dep.includes('typeorm')) return 'database-operation';
    if (dep.includes('jest') || dep.includes('mocha')) return 'testing';
    return 'general-development';
  }

  /**
   * Mapped Symbol-Kind zu Capability
   */
  private mapSymbolToCapability(kind: ts.ScriptElementKind): string {
    switch (kind) {
      case ts.ScriptElementKind.functionElement:
        return 'function-analysis';
      case ts.ScriptElementKind.classElement:
        return 'class-analysis';
      case ts.ScriptElementKind.interfaceElement:
        return 'type-analysis';
      default:
        return 'general-development';
    }
  }

  /**
   * Bereinigt den Type-Cache
   */
  clearCache(): void {
    this.typeCache.clear();
  }
}

// Singleton Instance
export const contextRouter = new ContextAwareRouter();

// Beispiel-Agenten registrieren
contextRouter.registerAgent('sin_delegate', ['general-development', 'quick-fixes']);
contextRouter.registerAgent('atlas', ['complex-refactoring', 'function-analysis', 'class-analysis']);
contextRouter.registerAgent('iris', ['ui-development', 'function-analysis']);
contextRouter.registerAgent('hades', ['debugging', 'complex-refactoring', 'function-analysis']);
contextRouter.registerAgent('hephaestus', ['testing', 'quality-assurance']);
