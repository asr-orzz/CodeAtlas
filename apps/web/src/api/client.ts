import type {
  DiagramKind,
  DiagramModel,
  GraphView,
  GraphViewKind,
  ImportResult,
  ProjectDetail,
  ProjectSummary,
} from "../types";

const BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:4000";

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
  } catch {
    throw new Error(
      `Cannot reach the API at ${BASE_URL}. Is it running? (npm run api)`,
    );
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  baseUrl: BASE_URL,

  listProjects: () => http<{ projects: ProjectSummary[] }>("/api/projects"),

  analyzePath: (path: string, name?: string) =>
    http<ImportResult>("/api/analyze", {
      method: "POST",
      body: JSON.stringify({ path, name }),
    }),

  analyzeGithub: (url: string, branch?: string, name?: string) =>
    http<ImportResult>("/api/analyze/github", {
      method: "POST",
      body: JSON.stringify({ url, branch, name }),
    }),

  getProject: (id: string) => http<ProjectDetail>(`/api/projects/${id}`),

  getDiagram: (id: string, kind: DiagramKind, entryId?: string) => {
    const query = entryId ? `?entryId=${encodeURIComponent(entryId)}` : "";
    return http<DiagramModel>(`/api/projects/${id}/diagram/${kind}${query}`);
  },

  getGraph: (id: string, view: GraphViewKind) =>
    http<GraphView>(`/api/projects/${id}/graph/${view}`),

  deleteProject: (id: string) =>
    http<void>(`/api/projects/${id}`, { method: "DELETE" }),
};
