/**
 * A pluggable LLM provider. The rest of the AI package treats this as an opaque
 * text-completion function, so a real provider (OpenAI, Anthropic, a local
 * model, …) can be dropped in without touching the assistant logic.
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

/**
 * Factory hook for wiring a real provider from the environment. Returns
 * `undefined` by default so the app works offline with the deterministic
 * engine. Replace/extend this to plug in an actual LLM SDK.
 */
export function createProviderFromEnv(
  env: Record<string, string | undefined> = {},
): AiProvider | undefined {
  // Intentionally no network calls in the MVP. A real implementation would,
  // for example, read env.OPENAI_API_KEY here and return a provider that calls
  // the LLM inside complete().
  void env;
  return undefined;
}
