import type {
  AiAnswer,
  AuthResponse,
  Board,
  BoardSummary,
  DiagramKind,
  DiagramModel,
  GraphView,
  GraphViewKind,
  ImportResult,
  ProjectDetail,
  ProjectSummary,
  Smell,
  User,
} from "../types";

const BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:4000";

const TOKEN_KEY = "codeatlas_token";

let authToken: string | null =
  typeof localStorage !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;

/** Called when the server rejects our token, so the app can log out. */
let onUnauthorized: (() => void) | null = null;

export function setToken(token: string | null): void {
  authToken = token;
  if (typeof localStorage === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getToken(): string | null {
  return authToken;
}

export function setUnauthorizedHandler(fn: (() => void) | null): void {
  onUnauthorized = fn;
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  try {
    response = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  } catch {
    throw new Error(
      `Cannot reach the API at ${BASE_URL}. Is it running? (npm run api)`,
    );
  }
  if (response.status === 401) {
    setToken(null);
    onUnauthorized?.();
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

  // --- Auth ---
  register: (email: string, password: string, name?: string) =>
    http<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    }),

  login: (email: string, password: string) =>
    http<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  me: () => http<{ user: User }>("/api/auth/me"),

  // --- Projects ---
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

  listBoards: (projectId: string) =>
    http<{ boards: BoardSummary[] }>(`/api/projects/${projectId}/boards`),

  createBoard: (projectId: string, name?: string, seedKind?: DiagramKind) =>
    http<Board>(`/api/projects/${projectId}/boards`, {
      method: "POST",
      body: JSON.stringify({ name, seedKind }),
    }),

  getBoard: (boardId: string) => http<Board>(`/api/boards/${boardId}`),

  saveBoard: (
    boardId: string,
    content: { name?: string; nodes: Board["nodes"]; edges: Board["edges"] },
  ) =>
    http<Board>(`/api/boards/${boardId}`, {
      method: "PUT",
      body: JSON.stringify(content),
    }),

  deleteBoard: (boardId: string) =>
    http<void>(`/api/boards/${boardId}`, { method: "DELETE" }),

  aiExplain: (projectId: string) =>
    http<{ text: string }>(`/api/projects/${projectId}/ai/explain`),

  aiSmells: (projectId: string) =>
    http<{ smells: Smell[] }>(`/api/projects/${projectId}/ai/smells`),

  aiAsk: (projectId: string, question: string) =>
    http<AiAnswer>(`/api/projects/${projectId}/ai/ask`, {
      method: "POST",
      body: JSON.stringify({ question }),
    }),
};
