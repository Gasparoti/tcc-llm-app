import assert from "node:assert/strict";
import test from "node:test";
import { generateAndRefine } from "../lib/provider";

test("gera resposta e revisões sem expor configuração ao cliente", async () => {
  const originalKey = process.env.LLM_API_KEY;
  const originalModel = process.env.LLM_MODEL;
  const originalBaseUrl = process.env.LLM_BASE_URL;
  const originalFetch = globalThis.fetch;
  process.env.LLM_API_KEY = "test-key";
  process.env.LLM_MODEL = "test-model";
  process.env.LLM_BASE_URL = "https://provider.example/v1";
  const requests: Array<{ url: string; body: { messages: unknown[] } }> = [];
  let callCount = 0;
  globalThis.fetch = async (input, init) => {
    requests.push({
      url: String(input),
      body: JSON.parse(String(init?.body)) as { messages: unknown[] },
    });
    callCount += 1;
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: callCount === 1 ? "Resposta inicial." : "Resposta revisada." } }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  try {
    const result = await generateAndRefine("Explique o tema.", 1);
    assert.equal(result.answer, "Resposta revisada.");
    assert.deepEqual(result.versions, ["Resposta inicial.", "Resposta revisada."]);
    assert.equal(result.model, "test-model");
    assert.equal(requests.length, 2);
    assert.equal(requests[0].url, "https://provider.example/v1/chat/completions");
    assert.equal(requests[0].body.messages.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.LLM_API_KEY;
    else process.env.LLM_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.LLM_MODEL;
    else process.env.LLM_MODEL = originalModel;
    if (originalBaseUrl === undefined) delete process.env.LLM_BASE_URL;
    else process.env.LLM_BASE_URL = originalBaseUrl;
  }
});

test("rejeita quantidade de revisões fora do intervalo permitido", async () => {
  await assert.rejects(() => generateAndRefine("prompt", -1), {
    message: "O número de revisões deve ser 0, 1 ou 2.",
  });
});

test("informa quando o provedor não está configurado", async () => {
  const originalKey = process.env.LLM_API_KEY;
  const originalModel = process.env.LLM_MODEL;
  delete process.env.LLM_API_KEY;
  delete process.env.LLM_MODEL;

  try {
    await assert.rejects(() => generateAndRefine("prompt", 0), {
      message: /LLM_MODEL/,
    });
  } finally {
    if (originalKey === undefined) delete process.env.LLM_API_KEY;
    else process.env.LLM_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.LLM_MODEL;
    else process.env.LLM_MODEL = originalModel;
  }
});
