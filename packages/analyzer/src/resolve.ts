import path from "node:path";

/** Normalize an absolute path to a project-relative POSIX-style path. */
export function toRelativePosix(rootPath: string, absPath: string): string {
  const rel = path.relative(rootPath, absPath);
  return rel.split(path.sep).join("/");
}

const CANDIDATE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mts",
  ".cts",
  ".mjs",
  ".cjs",
];

/**
 * Deterministically resolve a *relative* import specifier to a file that exists
 * in the analyzed project. We do this ourselves (rather than relying on the TS
 * language service) so results are stable and independent of tsconfig quirks.
 *
 * @param fromAbsPath   absolute path of the importing file
 * @param specifier     the import specifier text (e.g. "./UserService")
 * @param fileSet       set of absolute paths that exist in the project
 * @returns the resolved absolute path, or undefined if it points outside the project
 */
export function resolveRelativeImport(
  fromAbsPath: string,
  specifier: string,
  fileSet: ReadonlySet<string>,
): string | undefined {
  if (!specifier.startsWith(".")) return undefined;

  const base = path.resolve(path.dirname(fromAbsPath), specifier);

  // Exact file (specifier already includes an extension).
  if (fileSet.has(base)) return base;

  // base + extension
  for (const ext of CANDIDATE_EXTENSIONS) {
    const candidate = base + ext;
    if (fileSet.has(candidate)) return candidate;
  }

  // base/index.*
  for (const ext of CANDIDATE_EXTENSIONS) {
    const candidate = path.join(base, "index" + ext);
    if (fileSet.has(candidate)) return candidate;
  }

  // A ".js" specifier that actually maps to a ".ts" source (ESM + TS pattern).
  const parsed = path.parse(base);
  if (parsed.ext === ".js" || parsed.ext === ".mjs" || parsed.ext === ".cjs") {
    const withoutExt = path.join(parsed.dir, parsed.name);
    for (const ext of [".ts", ".tsx", ".mts", ".cts"]) {
      const candidate = withoutExt + ext;
      if (fileSet.has(candidate)) return candidate;
    }
  }

  return undefined;
}
