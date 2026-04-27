"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASTScanner = void 0;
exports.scanPaths = scanPaths;
const ts = __importStar(require("typescript"));
/**
 * ASTScanner - Statische Code-Analyse mit TypeScript AST
 */
class ASTScanner {
    /**
     * Analysiert Code und extrahiert Symbole
     */
    scanCode(code, filePath = 'unknown.ts') {
        const sourceFile = ts.createSourceFile(filePath, code, ts.ScriptTarget.Latest, true);
        const symbols = [];
        const dependencies = [];
        let complexity = 0;
        const visit = (node) => {
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
            if (ts.isIfStatement(node) ||
                ts.isSwitchStatement(node) ||
                ts.isForStatement(node) ||
                ts.isWhileStatement(node) ||
                ts.isTryStatement(node)) {
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
    detectTaskType(sourceFile) {
        let hasTests = false;
        let hasUI = false;
        let hasAPI = false;
        let hasDatabase = false;
        const visit = (node) => {
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
        if (hasTests)
            return 'testing';
        if (hasUI)
            return 'ui-development';
        if (hasAPI)
            return 'api-development';
        if (hasDatabase)
            return 'database-operation';
        return 'general-development';
    }
    /**
     * Bestimmt Script-Element-Kind für ein Node
     */
    getScriptElementKind(node) {
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
exports.ASTScanner = ASTScanner;
// Legacy function exports for backward compatibility
const EXT_LANG_MAP = {
    ".ts": "typescript", ".tsx": "typescript", ".js": "javascript", ".jsx": "javascript",
    ".py": "python", ".rs": "rust", ".go": "go", ".java": "java", ".kt": "kotlin",
    ".sql": "sql", ".prisma": "prisma", ".graphql": "graphql", ".json": "json", ".yaml": "yaml", ".yml": "yaml"
};
async function scanPaths(targetPaths) {
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
//# sourceMappingURL=ast-scanner.js.map