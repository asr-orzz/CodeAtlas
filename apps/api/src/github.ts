import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { runAnalysis } from "./analyze.js";
import { config } from "./config.js";
import { HttpError } from "./http.js";
import type { ProjectRecord, ProjectStore } from "./store.js";

export interface ParsedRepo {
  owner: string;
  repo: string;
  slug: string;
  webUrl: string;
  cloneUrl: string;
}

const OWNER_REPO = /^[\w.-]+\/[\w.-]+$/;

/**
 * Parse a GitHub reference into a safe clone URL. Accepts "owner/repo" shorthand
 * or an https://github.com/owner/repo URL. Restricted to github.com to avoid
 * cloning from arbitrary/internal hosts (SSRF protection).
 */
export function parseRepoUrl(input: string): ParsedRepo {
  const trimmed = input.trim();
  let owner: string | undefined;
  let repo: string | undefined;

  if (OWNER_REPO.test(trimmed)) {
    [owner, repo] = trimmed.split("/");
  } else {
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      throw new HttpError(400, `Invalid GitHub URL or owner/repo: ${input}`);
    }
    const host = url.hostname.replace(/^www\./, "");
    if (host !== "github.com") {
      throw new HttpError(400, "Only github.com repositories are supported.");
    }
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length < 2) {
      throw new HttpError(400, `URL must point to a repository: ${input}`);
    }
    [owner, repo] = segments;
  }

  if (!owner || !repo) {
    throw new HttpError(400, `Could not parse a repository from: ${input}`);
  }
  repo = repo.replace(/\.git$/, "");
  const slug = `${owner}/${repo}`;
  return {
    owner,
    repo,
    slug,
    webUrl: `https://github.com/${slug}`,
    cloneUrl: `https://github.com/${slug}.git`,
  };
}

export interface CloneResult {
  dir: string;
  commit?: string;
  branch?: string;
  /** Remove the cloned working copy. */
  cleanup: () => void;
}

export interface CloneOptions {
  branch?: string;
  timeoutMs?: number;
}

export type Cloner = (parsed: ParsedRepo, options: CloneOptions) => CloneResult;

function safeRemove(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // best effort
  }
}

/**
 * Clone a repository shallowly. The clone never runs repository code — we only
 * parse files afterwards. Credential prompts are disabled so private repos fail
 * fast instead of hanging.
 */
export const gitClone: Cloner = (parsed, options) => {
  const base = path.join(config.dataDir, "repos");
  fs.mkdirSync(base, { recursive: true });
  const dir = fs.mkdtempSync(path.join(base, "repo-"));

  const args = ["clone", "--depth", "1", "--single-branch"];
  if (options.branch) args.push("--branch", options.branch);
  args.push(parsed.cloneUrl, dir);

  try {
    execFileSync("git", args, {
      stdio: "pipe",
      timeout: options.timeoutMs ?? 120_000,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_ASKPASS: "" },
    });
  } catch (err) {
    safeRemove(dir);
    const detail = err instanceof Error ? err.message : String(err);
    throw new HttpError(400, `Failed to clone ${parsed.cloneUrl}: ${detail}`);
  }

  let commit: string | undefined;
  try {
    commit = execFileSync("git", ["-C", dir, "rev-parse", "HEAD"], {
      stdio: "pipe",
    })
      .toString()
      .trim();
  } catch {
    // Non-fatal: analysis still works without a commit SHA.
  }

  return {
    dir,
    commit,
    branch: options.branch,
    cleanup: () => safeRemove(dir),
  };
};

export interface GitHubImportInput {
  url: string;
  branch?: string;
  name?: string;
}

/**
 * Clone a GitHub repository, analyze it, store the result, and always clean up
 * the working copy afterwards.
 */
export async function importFromGitHub(
  store: ProjectStore,
  userId: string,
  input: GitHubImportInput,
  cloner: Cloner = gitClone,
): Promise<ProjectRecord> {
  const parsed = parseRepoUrl(input.url);
  const clone = cloner(parsed, { branch: input.branch });
  try {
    const { ir, report } = runAnalysis(clone.dir, {
      repository: parsed.slug,
      owner: parsed.owner,
      branch: clone.branch,
      commit: clone.commit,
      rootPath: clone.dir,
    });
    return await store.create(userId, {
      name: input.name?.trim() || parsed.repo,
      source: parsed.webUrl,
      ir,
      report,
    });
  } finally {
    clone.cleanup();
  }
}
