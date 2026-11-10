import assert from "node:assert/strict";
import test from "node:test";
import {
  composePrompt,
  recommendFramework,
} from "../lib/frameworks";

test("recomenda RACE quando a intenção indica um público", () => {
  assert.equal(
    recommendFramework("Explique fotossíntese para estudantes iniciantes.")
      .framework,
    "RACE",
  );
});

test("recomenda CLEAR para solicitações de análise", () => {
  assert.equal(
    recommendFramework("Compare causas e consequências da urbanização.")
      .framework,
    "CLEAR",
  );
});

test("recomenda TAG para solicitações diretas", () => {
  assert.equal(
    recommendFramework("Explique o ciclo da água de forma simples.").framework,
    "TAG",
  );
});

test("compõe prompt com campos, evidências e critérios de resposta", () => {
  const prompt = composePrompt(
    "TAG",
    { task: "  Explique o ciclo. ", action: "Use etapas.", goal: "Ensinar." },
    " Fonte escolar ",
    " Intenção original ",
  );

  assert.match(prompt, /Intenção original:\nIntenção original/);
  assert.match(prompt, /Tarefa:\nExplique o ciclo\./);
  assert.match(prompt, /Evidências ou fontes fornecidas:\nFonte escolar/);
  assert.match(prompt, /Não invente dados, citações ou fontes\./);
});

test("informa quando nenhuma evidência foi fornecida", () => {
  const prompt = composePrompt(
    "RACE",
    { role: "Tutor", action: "Explique", context: "Ciências", expectation: "Simples" },
    "  ",
    "Fotossíntese",
  );
  assert.match(prompt, /Nenhuma fonte foi fornecida\./);
});
