type ChatMessage = {
  role: "system" | "user";
  content: string;
};

type ChatCompletionPayload = {
  choices?: Array<{ message?: { content?: unknown } }>;
  error?: { message?: string };
};

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

async function requestCompletion(messages: ChatMessage[]): Promise<string> {
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL;
  const baseUrl = process.env.LLM_BASE_URL ?? "https://api.openai.com/v1";
  const timeoutValue = Number(process.env.LLM_TIMEOUT_MS ?? 45_000);
  const timeoutMs =
    Number.isFinite(timeoutValue) && timeoutValue > 0 ? timeoutValue : 45_000;

  if (!apiKey || !model) {
    throw new ProviderError(
      "Configure LLM_API_KEY e LLM_MODEL no arquivo .env.local para habilitar o modelo.",
      503,
    );
  }

  let endpoint: URL;
  try {
    endpoint = new URL(`${baseUrl.replace(/\/+$/, "")}/chat/completions`);
  } catch {
    throw new ProviderError("LLM_BASE_URL não contém uma URL válida.", 500);
  }
  if (endpoint.protocol !== "https:" && endpoint.protocol !== "http:") {
    throw new ProviderError("LLM_BASE_URL deve usar HTTP ou HTTPS.", 500);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
        max_tokens: 1200,
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    let payload: ChatCompletionPayload;
    try {
      payload = (await response.json()) as ChatCompletionPayload;
    } catch {
      throw new ProviderError("O provedor retornou uma resposta inválida.", 502);
    }

    if (!response.ok) {
      throw new ProviderError(
        payload.error?.message || "O provedor não conseguiu gerar uma resposta.",
        502,
      );
    }

    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new ProviderError("O provedor retornou uma resposta vazia.", 502);
    }
    return content.trim();
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    if (controller.signal.aborted) {
      throw new ProviderError("O tempo limite do provedor foi excedido.", 504);
    }
    throw new ProviderError("Não foi possível conectar ao provedor configurado.", 502);
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateAndRefine(
  prompt: string,
  rounds: number,
): Promise<{ answer: string; versions: string[]; model: string }> {
  if (!Number.isInteger(rounds) || rounds < 0 || rounds > 2) {
    throw new ProviderError("O número de revisões deve ser 0, 1 ou 2.", 400);
  }
  const model = process.env.LLM_MODEL;
  if (!model) {
    throw new ProviderError(
      "Configure LLM_MODEL no arquivo .env.local para habilitar o modelo.",
      503,
    );
  }

  const versions: string[] = [];
  let answer = await requestCompletion([
    {
      role: "system",
      content:
        "Você é um assistente educacional. Responda em português, diferencie fatos de interpretações, não invente fontes e declare claramente quando não puder confirmar algo.",
    },
    { role: "user", content: prompt },
  ]);
  versions.push(answer);

  for (let iteration = 0; iteration < rounds; iteration += 1) {
    answer = await requestCompletion([
      {
        role: "system",
        content:
          "Revise a resposta anterior em português. Corrija problemas que possam ser corrigidos com as informações disponíveis, preserve as informações corretas e não invente fatos, citações ou fontes. Declare incertezas. Entregue somente a resposta revisada.",
      },
      {
        role: "user",
        content: `Instrução original:\n${prompt}\n\nResposta a revisar:\n${answer}\n\nRevise a resposta. Se não houver evidência suficiente para confirmar algo, sinalize isso em vez de adivinhar.`,
      },
    ]);
    versions.push(answer);
  }

  return { answer, versions, model };
}
