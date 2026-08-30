import fs from "node:fs";
import path from "node:path";
import type { Language } from "./types.js";

const DEFAULT_EXTENSIONS: Language[] = ["ts", "tsx", "js", "jsx"];

const DEFAULT_IGNORE_DIRS = [
  "node_modules",
  ".git",
  "dist",
  "build",
  "out",
  "coverage",
  ".next",
  ".turbo",
  ".cache",
  ".vercel",
];

const EXT_TO_LANGUAGE: Record<string, Language> = {
  ".ts": "ts",
  ".tsx": "tsx",
  ".js": "js",
  ".jsx": "jsx",
  ".mjs": "js",
  ".cjs": "js",
};

export function languageForFile(absPath: string): Language | undefined {
  return EXT_TO_LANGUAGE[path.extname(absPath).toLowerCase()];
}

export interface CollectOptions {
  extensions?: Language[];
  ignoreDirs?: string[];
  maxFiles?: number;
}

/**
 * Recursively collect source files under `rootPath`, honoring ignore
 * directories and an optional file cap. `.d.ts` declaration files are skipped.
 * Returns absolute paths sorted for deterministic output.
 */
export function collectSourceFiles(
  rootPath: string,
  options: CollectOptions = {},
): { files: string[]; truncated: boolean } {
  const extensions = new Set(options.extensions ?? DEFAULT_EXTENSIONS);
  const ignore = new Set(options.ignoreDirs ?? DEFAULT_IGNORE_DIRS);
  const maxFiles = options.maxFiles ?? 5000;

  const results: string[] = [];
  let truncated = false;

  const walk = (dir: string): void => {
    if (results.length >= maxFiles) {
      truncated = true;
      return;
    }
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (ignore.has(entry.name) || entry.name.startsWith(".")) continue;
        walk(full);
      } else if (entry.isFile()) {
        if (results.length >= maxFiles) {
          truncated = true;
          return;
        }
        if (entry.name.endsWith(".d.ts")) continue;
        const lang = languageForFile(full);
        if (lang && extensions.has(lang)) results.push(full);
      }
    }
  };

  walk(rootPath);
  results.sort();
  return { files: results, truncated };
}
