import fs from "fs/promises";
import path from "path";

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

const EXT_LANG_MAP: Record<string, string> = {
  ".ts": "typescript", ".tsx": "typescript", ".js": "javascript", ".jsx": "javascript",
  ".py": "python", ".rs": "rust", ".go": "go", ".java": "java", ".kt": "kotlin",
  ".sql": "sql", ".prisma": "prisma", ".graphql": "graphql", ".json": "json", ".yaml": "yaml", ".yml": "yaml"
};

const FRAMEWORK_PATTERNS: Record<string, RegExp[]> = {
  "react": [/from ['"]react['"]/, /import.*React/, /jsx/, /tsx/],
  "nextjs": [/from ['"]next['"]/, /next\/config/, /app\/layout/],
  "vue": [/from ['"]vue['"]/, /<template>/, /defineComponent/],
  "svelte": [/\.svelte$/, /<script lang="ts">/],
  "express": [/from ['"]express['"]/, /app\.listen/, /router\./],
  "fastify": [/from ['"]fastify['"]/],
  "django": [/from django/, /settings\.py/, /urls\.py/],
  "flask": [/from flask/, /app\.route/],
  "prisma": [/from ['"]@prisma\/client['"]/, /prisma\./],
  "typeorm": [/from ['"]typeorm['"]/, /@Entity/],
  "tailwind": [/tailwind/, /className=".*flex/, /@apply/]
};

const LAYER_PATTERNS: Record<string, RegExp[]> = {
  "frontend": [/\.tsx?$/, /\.jsx?$/, /\.vue$/, /\.svelte$/, /components\//, /pages\//, /ui\//, /styles\//],
  "backend": [/controllers\//, /routes\//, /api\//, /server\./, /app\./, /middleware\//],
  "database": [/\.sql$/, /prisma\//, /migrations\//, /models\//, /schema\./, /repository\./],
  "test": [/\.test\./, /\.spec\./, /__tests__\//, /cypress\//, /playwright\//],
  "config": [/\.json$/, /\.yaml$/, /\.yml$/, /\.toml$/, /\.env/, /tsconfig/, /webpack/, /vite/, /next\.config/]
};

export async function scanPaths(targetPaths: string[]): Promise<CodeMetrics> {
  let totalLines = 0, imports = 0, fileCount = 0;
  const frameworks = new Set<string>();
  const layers = new Set<string>();
  let hasUI = false, hasDB = false, hasTests = false;
  const langCounts: Record<string, number> = {};

  const filesToScan: string[] = [];
  for (const p of targetPaths) {
    try {
      const stat = await fs.stat(p);
      if (stat.isDirectory()) {
        filesToScan.push(...await readDirRecursive(p, 3, 40));
      } else {
        filesToScan.push(p);
      }
    } catch {}
  }

  for (const filePath of filesToScan) {
    try {
      const ext = path.extname(filePath).toLowerCase();
      const lang = EXT_LANG_MAP[ext] || "unknown";
      langCounts[lang] = (langCounts[lang] || 0) + 1;
      fileCount++;

      for (const [layer, patterns] of Object.entries(LAYER_PATTERNS)) {
        if (patterns.some(p => p.test(filePath))) layers.add(layer);
      }

      const content = await fs.readFile(filePath, "utf-8");
      const lines = content.split("\n");
      totalLines += lines.length;
      const preview = lines.slice(0, 150).join("\n");

      const importMatches = preview.match(/^(import |from |require\()/gm);
      imports += importMatches?.length || 0;

      for (const [fw, patterns] of Object.entries(FRAMEWORK_PATTERNS)) {
        if (patterns.some(p => p.test(preview))) frameworks.add(fw);
      }

      if (/jsx|tsx|vue|svelte|html|css|tailwind|component|render/i.test(preview)) hasUI = true;
      if (/prisma|sql|db|database|query|repository|entity|model/i.test(preview)) hasDB = true;
      if (/test|spec|describe|it\(|expect|playwright|cypress/i.test(preview)) hasTests = true;
    } catch {}
  }

  const primaryLang = Object.entries(langCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "unknown";
  const complexity = totalLines > 5000 || imports > 100 ? "high" : totalLines > 1500 || imports > 40 ? "medium" : "low";
  const layerPriority = ["frontend", "backend", "database", "test", "config", "unknown"];
  const primaryLayer = layerPriority.find(l => layers.has(l)) || "unknown";

  return {
    language: primaryLang,
    framework: Array.from(frameworks),
    complexity,
    layer: primaryLayer as any,
    fileCount,
    totalLines,
    imports,
    hasTests,
    hasUI,
    hasDB
  };
}

async function readDirRecursive(dir: string, maxDepth: number, maxFiles: number): Promise<string[]> {
  const files: string[] = [];
  async function walk(current: string, depth: number) {
    if (depth > maxDepth || files.length >= maxFiles) return;
    try {
      const entries = await fs.readdir(current, { withFileTypes: true });
      for (const e of entries) {
        if (files.length >= maxFiles) break;
        const full = path.join(current, e.name);
        if (e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules" && e.name !== ".git") {
          await walk(full, depth + 1);
        } else if (e.isFile()) {
          files.push(full);
        }
      }
    } catch {}
  }
  await walk(dir, 0);
  return files;
}
