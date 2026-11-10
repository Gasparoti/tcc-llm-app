export type FrameworkId = "TAG" | "CLEAR" | "RACE";

export type PromptField = {
  id: string;
  label: string;
  required: boolean;
  placeholder: string;
};

type PromptFramework = {
  id: FrameworkId;
  name: string;
  expansion: string;
  description: string;
  fields: PromptField[];
};

export const FRAMEWORKS: Record<FrameworkId, PromptFramework> = {
  TAG: {
    id: "TAG",
    name: "Direto ao ponto",
    expansion: "Task · Action · Goal",
    description: "Para pedidos diretos e objetivos.",
    fields: [
      { id: "task", label: "Tarefa", required: true, placeholder: "O que deve ser feito?" },
      { id: "action", label: "Ação esperada", required: true, placeholder: "Como a resposta deve ser construída?" },
      { id: "goal", label: "Objetivo", required: true, placeholder: "Qual é a finalidade da resposta?" },
    ],
  },
  CLEAR: {
    id: "CLEAR",
    name: "Análise cuidadosa",
    expansion: "Concise · Logical · Explicit · Adaptive · Reflective",
    description: "Para comparação, avaliação e análise.",
    fields: [
      { id: "concise", label: "Concisão", required: true, placeholder: "Qual extensão ou nível de detalhe?" },
      { id: "logical", label: "Lógica", required: true, placeholder: "Como organizar o raciocínio?" },
      { id: "explicit", label: "Critérios explícitos", required: true, placeholder: "Quais critérios devem ser considerados?" },
      { id: "adaptive", label: "Adaptação", required: true, placeholder: "Para quem a resposta será adaptada?" },
      { id: "reflective", label: "Reflexão", required: true, placeholder: "Quais limites ou ressalvas devem ser apontados?" },
    ],
  },
  RACE: {
    id: "RACE",
    name: "Papel e contexto",
    expansion: "Role · Action · Context · Expectation",
    description: "Para solicitações com público ou papel específico.",
    fields: [
      { id: "role", label: "Papel", required: true, placeholder: "Que papel o assistente deve assumir?" },
      { id: "action", label: "Ação", required: true, placeholder: "O que deve ser feito?" },
      { id: "context", label: "Contexto", required: true, placeholder: "Que contexto é importante?" },
      { id: "expectation", label: "Expectativa", required: true, placeholder: "Como deve ser a resposta?" },
    ],
  },
};

export function recommendFramework(intent: string): {
  framework: FrameworkId;
  reason: string;
} {
  const text = intent.toLocaleLowerCase("pt-BR");
  const hasAudienceOrRole =
    /\b(professores?|estudantes?|alunos?|crianças?|iniciantes?|especialistas?|tutores?|papel|público|turma|faixa etária)\b/.test(text);
  const hasAnalysis =
    /\b(compare|comparar|analis[ae]|avalie|avaliação|argument|causas|consequências|critérios|evidências|pesquisa|crítica)\b/.test(text);

  if (hasAudienceOrRole) {
    return {
      framework: "RACE",
      reason: "A intenção menciona um público ou papel específico.",
    };
  }
  if (hasAnalysis) {
    return {
      framework: "CLEAR",
      reason: "A intenção sugere comparação, análise ou avaliação.",
    };
  }
  return {
    framework: "TAG",
    reason: "A intenção parece ser um pedido direto e objetivo.",
  };
}

export function composePrompt(
  frameworkId: FrameworkId,
  values: Record<string, string>,
  evidence: string,
  intent: string,
): string {
  const framework = FRAMEWORKS[frameworkId];
  const sections = [
    `Intenção original:\n${intent.trim()}`,
    ...framework.fields.map(
      (field) => `${field.label}:\n${values[field.id]?.trim() ?? ""}`,
    ),
    `Evidências ou fontes fornecidas:\n${
      evidence.trim() || "Nenhuma fonte foi fornecida."
    }`,
    [
      "Critérios de resposta:",
      "- Separe fatos verificáveis de interpretações.",
      "- Não invente dados, citações ou fontes.",
      "- Quando não houver evidência suficiente, declare a incerteza.",
      "- Indique o que o usuário deve verificar em fontes primárias.",
    ].join("\n"),
  ];

  return sections.join("\n\n");
}
