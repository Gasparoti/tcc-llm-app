import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "../app/api/execute/route";

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("rejeita solicitação sem prompt", async () => {
  const response = await POST(jsonRequest({ prompt: " " }));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "O prompt é obrigatório." });
});

test("rejeita valores inválidos para número de revisões", async () => {
  const response = await POST(jsonRequest({ prompt: "Explique isto", rounds: 3 }));
  assert.equal(response.status, 400);
});

test("rejeita prompt acima do limite", async () => {
  const response = await POST(
    jsonRequest({ prompt: "a".repeat(20_001), rounds: 0 }),
  );
  assert.equal(response.status, 413);
});
