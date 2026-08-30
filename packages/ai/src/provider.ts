/**
 * A pluggable LLM provider. The rest of the AI package treats this as an opaque
 * text-completion function, so a real provider (xAI Grok, OpenAI, OpenRouter, a
 * local model, …) can be dropped in without touching the assistant logic.
 *
 * When no provider is configured the assistant falls back to fully
 * deterministic, fact-based answers computed from the Architecture IR.
 */
export interface AiProvider {
  /** Human-readable provider name, surfaced in responses for transparency. */
  readonly name: string;
  complete(input: CompletionRequest): Promise<string>;
}

export interface CompletionRequest {
  /** High-level instruction describing the assistant's role. */
  system?: string;
  /** The user question plus any grounding context. */
  prompt: string;
}

export interface OpenAiCompatibleOptions {
  apiKey: string;
  /** Base URL, e.g. https://openrouter.ai/api/v1 or https://api.x.ai/v1 */
  baseUrl: string;
  model: string;
  /** Request timeout in ms. */
  timeoutMs?: number;
  /** Optional attribution headers (OpenRouter recommends these). */
  referer?: string;
  title?: string;
}

/**
 * A provider for any OpenAI-compatible `/chat/completions` endpoint. This covers
 * xAI (Grok) directly, OpenRouter (including free Grok models), OpenAI, and
 * most self-hosted gateways — they all speak the same wire format.
 */
export class OpenAiCompatibleProvider implements AiProvider {
  readonly name: string;

  constructor(private readonly opts: OpenAiCompatibleOptions) {
    this.name = `${hostOf(opts.baseUrl)}:${opts.model}`;
  }

  async complete({ system, prompt }: CompletionRequest): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.opts.timeoutMs ?? 30_000,
    );
    try {
      const messages = [
        ...(system ? [{ role: "system", content: system }] : []),
        { role: "user", content: prompt },
      ];
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.opts.apiKey}`,
      };
      if (this.opts.referer) headers["HTTP-Referer"] = this.opts.referer;
      if (this.opts.title) headers["X-Title"] = this.opts.title;

      const res = await fetch(`${trimSlash(this.opts.baseUrl)}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: this.opts.model,
          messages,
          temperature: 0.2,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`LLM request failed (${res.status}): ${detail.slice(0, 300)}`);
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content?.trim();
      if (!content) throw new Error("LLM returned an empty response.");
      return content;
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * Build a provider from environment variables. Returns `undefined` when no API
 * key is present, so the app works offline with the deterministic engine.
 *
 * Supported env (first key found wins):
 *   - OPENROUTER_API_KEY  → https://openrouter.ai/api/v1, model x-ai/grok-4-fast:free
 *   - XAI_API_KEY / GROK_API_KEY → https://api.x.ai/v1, model grok-4-fast
 *   - AI_API_KEY          → generic; pair with AI_BASE_URL and AI_MODEL
 * Any of AI_BASE_URL / AI_MODEL override the defaults above.
 */
export function createProviderFromEnv(
  env: Record<string, string | undefined> = {},
): AiProvider | undefined {
  const openRouterKey = env.OPENROUTER_API_KEY;
  const xaiKey = env.XAI_API_KEY ?? env.GROK_API_KEY;
  const apiKey = env.AI_API_KEY ?? openRouterKey ?? xaiKey;
  if (!apiKey) return undefined;

  let baseUrl: string;
  let model: string;
  if (env.AI_BASE_URL || (!openRouterKey && xaiKey)) {
    // Explicit base URL, or an xAI key with no OpenRouter key → talk to xAI.
    baseUrl = env.AI_BASE_URL ?? "https://api.x.ai/v1";
    model = env.AI_MODEL ?? "grok-4-fast";
  } else {
    // Default: OpenRouter with a free Grok model.
    baseUrl = "https://openrouter.ai/api/v1";
    model = env.AI_MODEL ?? "x-ai/grok-4-fast:free";
  }

  return new OpenAiCompatibleProvider({
    apiKey,
    baseUrl,
    model,
    referer: env.AI_REFERER ?? "http://localhost",
    title: "CodeAtlas",
  });
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "llm";
  }
}
