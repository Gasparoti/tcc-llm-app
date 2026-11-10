import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateMetrics,
  extractClaims,
} from "../lib/analysis";

test("extrai afirmações com estado inicial pendente", () => {
  const claims = extractClaims(
    "A água evapora com o calor do Sol. Portanto, o vapor sobe para a atmosfera.",
  );

  assert.equal(claims.length, 2);
  assert.equal(claims[0].truth, "pending");
  assert.equal(claims[0].scope, "unchecked");
  assert.equal(claims[1].type, "inferential");
});

test("limita extração a cem afirmações", () => {
  const response = Array.from(
    { length: 105 },
    (_, index) => `Esta é uma afirmação de teste número ${index}.`,
  ).join(" ");

  assert.equal(extractClaims(response).length, 100);
});

test("calcula indicadores somente a partir das marcações humanas", () => {
  const claims = extractClaims(
    "A Terra orbita o Sol. A Lua orbita a Terra. Alguns dados não foram verificados. Uma frase permanece pendente.",
  ).map((claim, index) => ({
    ...claim,
    truth: (["correct", "incorrect", "unverifiable", "pending"] as const)[index],
    scope: (["relevant", "relevant", "out_of_scope", "unchecked"] as const)[index],
  }));
  const metrics = calculateMetrics(
    "uma duas três quatro cinco seis sete oito nove dez",
    claims,
  );

  assert.equal(metrics.factualAccuracy, 0.5);
  assert.equal(metrics.hallucinationRate, 0.5);
  assert.equal(metrics.scopeAdherence, 2 / 3);
  assert.equal(metrics.unconfirmedClaims, 2);
  assert.equal(metrics.unconfirmedPerThousandTokens, 200);
});

test("não calcula proporções sem itens avaliados", () => {
  const metrics = calculateMetrics("", []);
  assert.equal(metrics.factualAccuracy, null);
  assert.equal(metrics.hallucinationRate, null);
  assert.equal(metrics.scopeAdherence, null);
  assert.equal(metrics.unconfirmedPerThousandTokens, 0);
});
