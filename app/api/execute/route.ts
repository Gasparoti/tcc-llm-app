import { NextResponse } from "next/server";
import { generateAndRefine, ProviderError } from "@/lib/provider";

export const dynamic = "force-dynamic";

const MAX_PROMPT_LENGTH = 20_000;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "O corpo da solicitação deve ser JSON válido." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "O corpo da solicitação deve ser um objeto JSON." }, { status: 400 });
  }

  const { prompt, rounds = 0 } = body as {
    prompt?: unknown;
    rounds?: unknown;
  };

  if (typeof prompt !== "string" || !prompt.trim()) {
    return NextResponse.json({ error: "O prompt é obrigatório." }, { status: 400 });
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return NextResponse.json(
      { error: `O prompt deve ter no máximo ${MAX_PROMPT_LENGTH} caracteres.` },
      { status: 413 },
    );
  }
  if (!Number.isInteger(rounds) || (rounds as number) < 0 || (rounds as number) > 2) {
    return NextResponse.json(
      { error: "O número de revisões deve ser 0, 1 ou 2." },
      { status: 400 },
    );
  }

  try {
    const result = await generateAndRefine(prompt.trim(), rounds as number);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof ProviderError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Erro inesperado ao executar o prompt:", error);
    return NextResponse.json(
      { error: "Ocorreu um erro interno ao executar o prompt." },
      { status: 500 },
    );
  }
}
