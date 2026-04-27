import * as ts from 'typescript';

export interface CodeMetrics {
  language: string;
  framework: string[];
  complexity: "low" | "medium" | "high";
  layer: "frontend" | "backend" | "database" | "config" | "test" | "unknown";
  fileCount: number;
  totalLines: number;
  imports: number;
  hasUI: boolean;
  hasDB: boolean;
  hasTests: boolean;
}

export interface SymbolInfo {
  name: string;
  kind: string;
  start: number;
  end: number;
  documentation?: string;
}

/**
 * ASTScanner - Statische Code-Analyse mit TypeScript AST
 */
export class ASTScanner {
  
  /**
   * Analysiert Code und extrahiert Symbole
   */
  scanCode(code: string, filePath: string = 'unknown.ts'): {
    symbols: SymbolInfo[];
    complexity: number;
    dependencies: string[];
    taskType: string;
  } {
    const sourceFile = ts.createSourceFile(
      filePath,
      code,
      ts.ScriptTarget.Latest,
      true
    );

    const symbols: SymbolInfo[] = [];
    const dependencies: string[] = [];
    let complexity = 0;

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
      symbols,
      complexity,
      dependencies,
      taskType: this.detectTaskType(sourceFile)
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
  private getScriptElementKind(node: ts.Node): string | null {
    if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
      return 'function';
    }
    if (ts.isClassDeclaration(node)) {
      return 'class';
    }
    if (ts.isInterfaceDeclaration(node)) {
      return 'interface';
    }
    if (ts.isVariableDeclaration(node)) {
      return 'variable';
    }
    if (ts.isEnumDeclaration(node)) {
      return 'enum';
    }
    if (ts.isTypeAliasDeclaration(node)) {
      return 'type';
    }
    return null;
  }
}

// Legacy function exports for backward compatibility
const EXT_LANG_MAP: Record<string, string> = {
  ".ts": "typescript", ".tsx": "typescript", ".js": "javascript", ".jsx": "javascript",
  ".py": "python", ".rs": "rust", ".go": "go", ".java": "java", ".kt": "kotlin",
  ".sql": "sql", ".prisma": "prisma", ".graphql": "graphql", ".json": "json", ".yaml": "yaml", ".yml": "yaml"
};

export async function scanPaths(targetPaths: string[]): Promise<CodeMetrics> {
  // Placeholder implementation
  return {
    language: "typescript",
    framework: [],
    complexity: "low",
    layer: "unknown",
    fileCount: 0,
    totalLines: 0,
    imports: 0,
    hasUI: false,
    hasDB: false,
    hasTests: false
  };
}
