"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  calculateMetrics,
  Claim,
  extractClaims,
  ScopeStatus,
  TruthStatus,
} from "@/lib/analysis";
import {
  composePrompt,
  FRAMEWORKS,
  FrameworkId,
  recommendFramework,
} from "@/lib/frameworks";

type Interaction = {
  createdAt: string;
  framework: FrameworkId;
  prompt: string;
  answer: string;
};

type ExecuteResponse = {
  answer?: string;
  versions?: string[];
  model?: string;
  error?: string;
};

const STORAGE_KEY = "clareza-lab-history-v1";
const TRUTH_LABELS: Record<TruthStatus, string> = {
  pending: "Pendente",
  correct: "Confirmada",
  incorrect: "Incorreta",
  unverifiable: "Não verificável",
};
const SCOPE_LABELS: Record<ScopeStatus, string> = {
  unchecked: "Não avaliada",
  relevant: "Relevante",
  out_of_scope: "Fora do escopo",
};
const TYPE_LABELS = {
  factual: "Factual",
  inferential: "Inferencial",
  attribution: "Atribuição",
  format: "Formato",
};

function isInteraction(value: unknown): value is Interaction {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<Interaction>;
  return (
    typeof item.createdAt === "string" &&
    (item.framework === "TAG" ||
      item.framework === "CLEAR" ||
      item.framework === "RACE") &&
    typeof item.prompt === "string" &&
    typeof item.answer === "string"
  );
}

function maskPersonalData(text: string): string {
  return text
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[e-mail ocultado]")
    .replace(/(?<!\w)(?:\+?\d[\d\s().-]{7,}\d)(?!\w)/g, "[telefone ocultado]");
}

function formatPercent(value: number | null): string {
  return value === null ? "—" : `${(value * 100).toFixed(1)}%`;
}

export default function Home() {
  const [intent, setIntent] = useState("");
  const [framework, setFramework] = useState<FrameworkId>("TAG");
  const [values, setValues] = useState<Record<string, string>>({});
  const [evidence, setEvidence] = useState("");
  const [prompt, setPrompt] = useState("");
  const [rounds, setRounds] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState("");
  const [versions, setVersions] = useState<string[]>([]);
  const [model, setModel] = useState("");
  const [claims, setClaims] = useState<Claim[]>([]);
  const [historyEnabled, setHistoryEnabled] = useState(false);
  const [history, setHistory] = useState<Interaction[]>([]);
  const [historyMessage, setHistoryMessage] = useState("");
  const recommendation = useMemo(() => recommendFramework(intent), [intent]);
  const metrics = useMemo(() => calculateMetrics(answer, claims), [answer, claims]);
  const selectedFramework = FRAMEWORKS[framework];

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) setHistory(parsed.filter(isInteraction));
      }
    } catch {
      setHistoryMessage("Não foi possível ler o histórico local deste navegador.");
    }
  }, []);

  function chooseFramework(next: FrameworkId) {
    setFramework(next);
    setValues({});
    setPrompt("");
  }

  function buildPrompt() {
    if (!intent.trim()) {
      setError("Descreva a intenção antes de gerar o prompt.");
      return;
    }
    const missing = selectedFramework.fields.find(
      (field) => field.required && !values[field.id]?.trim(),
    );
    if (missing) {
      setError(`Preencha o campo “${missing.label}” para continuar.`);
      return;
    }
    setError("");
    setPrompt(composePrompt(framework, values, evidence, intent));
  }

  async function submitPrompt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!prompt.trim()) {
      setError("Gere ou escreva o prompt final antes de consultar o modelo.");
      return;
    }

    setLoading(true);
    setError("");
    setAnswer("");
    setVersions([]);
    setClaims([]);
    try {
      const response = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, rounds }),
      });
      const result = (await response.json()) as ExecuteResponse;
      if (!response.ok) {
        setError(result.error ?? "Não foi possível consultar o modelo.");
        return;
      }
      if (!result.answer || !Array.isArray(result.versions)) {
        setError("A aplicação recebeu uma resposta incompleta do servidor.");
        return;
      }

      setAnswer(result.answer);
      setVersions(result.versions);
      setModel(result.model ?? "");
      setClaims(extractClaims(result.answer));
      if (historyEnabled) {
        const entry: Interaction = {
          createdAt: new Date().toISOString(),
          framework,
          prompt,
          answer: result.answer,
        };
        const nextHistory = [entry, ...history].slice(0, 50);
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextHistory));
          setHistory(nextHistory);
          setHistoryMessage("Interação salva neste navegador.");
        } catch {
          setHistoryMessage("Não foi possível salvar o histórico local.");
        }
      }
    } catch {
      setError(
        "Não foi possível falar com a aplicação. Verifique sua conexão e tente novamente.",
      );
    } finally {
      setLoading(false);
    }
  }

  function updateClaim(
    id: string,
    key: "truth" | "scope",
    value: TruthStatus | ScopeStatus,
  ) {
    setClaims((current) =>
      current.map((claim) =>
        claim.id === id ? { ...claim, [key]: value } : claim,
      ),
    );
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setHistoryMessage("Prompt copiado.");
    } catch {
      setHistoryMessage("Não foi possível copiar o prompt neste navegador.");
    }
  }

  function exportHistory() {
    const sanitized = history.map((entry) => ({
      ...entry,
      prompt: maskPersonalData(entry.prompt),
      answer: maskPersonalData(entry.answer),
    }));
    const blob = new Blob([JSON.stringify(sanitized, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "clareza-lab-historico.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  function toggleHistory(enabled: boolean) {
    setHistoryEnabled(enabled);
    if (!enabled) {
      setHistoryMessage("O salvamento local está desativado.");
      return;
    }
    setHistoryMessage(
      "O histórico fica apenas neste navegador. Revise dados pessoais antes de exportar.",
    );
  }

  return (
    <main className="shell">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="Clareza Lab início">
          <span className="brand-mark">C/</span>
          <span>CLAREZA <span className="brand-light">/ LAB</span></span>
        </Link>
        <span className="header-note">LABORATÓRIO DE PROMPTS EDUCACIONAIS</span>
      </header>

      <section className="intro">
        <p className="eyebrow">ESTRUTURE · CONSULTE · REVISE</p>
        <h1>Respostas melhores começam com boas perguntas.</h1>
        <p className="intro-copy">
          Organize seu prompt, consulte um modelo e revise cada afirmação com
          olhar crítico. A análise apoia a revisão humana; não verifica fatos
          automaticamente.
        </p>
      </section>

      <div className="workspace">
        <section className="panel builder-panel" aria-labelledby="builder-title">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">01 / CONSTRUÇÃO</p>
              <h2 id="builder-title">Prepare seu prompt</h2>
            </div>
            <span className="step-number">01</span>
          </div>

          <label className="field-label" htmlFor="intent">
            O que você quer descobrir ou produzir?
          </label>
          <textarea
            id="intent"
            value={intent}
            onChange={(event) => {
              setIntent(event.target.value);
              setPrompt("");
            }}
            placeholder="Ex.: Explique o ciclo da água de forma simples."
            rows={3}
          />

          <aside className="recommendation">
            <div>
              <span className="eyebrow">SUGESTÃO LOCAL</span>
              <strong>{recommendation.framework}</strong>
              <span>{recommendation.reason}</span>
            </div>
            <button
              className="text-button"
              type="button"
              onClick={() => chooseFramework(recommendation.framework)}
            >
              Usar sugestão
            </button>
          </aside>

          <fieldset className="framework-picker">
            <legend>Escolha uma estrutura</legend>
            <div className="framework-options">
              {(Object.keys(FRAMEWORKS) as FrameworkId[]).map((id) => (
                <button
                  type="button"
                  key={id}
                  className={`framework-option ${framework === id ? "selected" : ""}`}
                  aria-pressed={framework === id}
                  onClick={() => chooseFramework(id)}
                >
                  <strong>{id}</strong>
                  <span>{FRAMEWORKS[id].name}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="framework-description">
            <span className="framework-expansion">{selectedFramework.expansion}</span>
            <span>{selectedFramework.description}</span>
          </div>

          <div className="field-stack">
            {selectedFramework.fields.map((field) => (
              <div key={field.id}>
                <label className="field-label" htmlFor={field.id}>
                  {field.label} {field.required && <span aria-hidden="true">*</span>}
                </label>
                <textarea
                  id={field.id}
                  value={values[field.id] ?? ""}
                  onChange={(event) => {
                    setValues((current) => ({
                      ...current,
                      [field.id]: event.target.value,
                    }));
                    setPrompt("");
                  }}
                  placeholder={field.placeholder}
                  rows={2}
                  required={field.required}
                />
              </div>
            ))}
          </div>

          <label className="field-label" htmlFor="evidence">
            Evidências ou fontes <span className="optional">(opcional)</span>
          </label>
          <textarea
            id="evidence"
            value={evidence}
            onChange={(event) => {
              setEvidence(event.target.value);
              setPrompt("");
            }}
            placeholder="Cole referências ou trechos que devem ser considerados."
            rows={3}
          />
          <button className="button button-primary full-button" type="button" onClick={buildPrompt}>
            Gerar prompt estruturado <span aria-hidden="true">↗</span>
          </button>

          {prompt && (
            <div className="prompt-editor">
              <div className="subheading-row">
                <label className="field-label" htmlFor="final-prompt">Prompt final · editável</label>
                <button type="button" className="text-button" onClick={copyPrompt}>Copiar</button>
              </div>
              <textarea
                id="final-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                rows={11}
              />
            </div>
          )}
        </section>

        <section className="panel review-panel" aria-labelledby="review-title">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">02 / REVISÃO HUMANA</p>
              <h2 id="review-title">Examine a resposta</h2>
            </div>
            <span className="step-number">02</span>
          </div>

          <form onSubmit={submitPrompt}>
            <label className="field-label" htmlFor="rounds">Revisões adicionais</label>
            <div className="run-controls">
              <select
                id="rounds"
                value={rounds}
                onChange={(event) => setRounds(Number(event.target.value))}
              >
                <option value={0}>Nenhuma revisão</option>
                <option value={1}>1 revisão</option>
                <option value={2}>2 revisões</option>
              </select>
              <button className="button button-dark" type="submit" disabled={loading}>
                {loading ? "Consultando…" : "Consultar modelo"}
                {!loading && <span aria-hidden="true"> ↗</span>}
              </button>
            </div>
          </form>

          {error && <p className="notice notice-error" role="alert">{error}</p>}

          {answer ? (
            <>
              <div className="answer-card">
                <div className="subheading-row">
                  <span className="eyebrow">RESPOSTA DO MODELO</span>
                  {model && <span className="model-badge">{model}</span>}
                </div>
                {versions.length > 1 && (
                  <div className="version-list" aria-label="Versões da resposta">
                    {versions.map((version, index) => (
                      <button
                        type="button"
                        key={`${index}-${version.slice(0, 12)}`}
                        className={`version-button ${answer === version ? "selected" : ""}`}
                        onClick={() => {
                          setAnswer(version);
                          setClaims(extractClaims(version));
                        }}
                      >
                        {index === 0 ? "Original" : `Revisão ${index}`}
                      </button>
                    ))}
                  </div>
                )}
                <p className="answer-text">{answer}</p>
              </div>

              <div className="metrics-grid" aria-label="Indicadores da revisão">
                <Metric label="Confirmadas" value={formatPercent(metrics.factualAccuracy)} />
                <Metric label="Incorretas" value={formatPercent(metrics.hallucinationRate)} />
                <Metric label="Aderência" value={formatPercent(metrics.scopeAdherence)} />
                <Metric
                  label="Pendentes / mil palavras"
                  value={metrics.unconfirmedPerThousandTokens.toFixed(1)}
                />
              </div>
              <p className="metric-note">
                Indicadores baseados nas suas marcações. Não representam checagem factual automática.
              </p>

              <div className="claims-heading">
                <div>
                  <p className="eyebrow">AFIRMAÇÕES CANDIDATAS</p>
                  <h3>{claims.length} trechos para revisar</h3>
                </div>
                <span className="claim-count">{metrics.unconfirmedClaims} pendentes</span>
              </div>
              {claims.length === 0 ? (
                <p className="empty-state">Não foram encontrados trechos longos o bastante para revisão.</p>
              ) : (
                <ol className="claims-list">
                  {claims.map((claim) => (
                    <li className="claim-card" key={claim.id}>
                      <p>{claim.text}</p>
                      <div className="claim-meta">
                        <span className={`type-tag type-${claim.type}`}>{TYPE_LABELS[claim.type]}</span>
                        <label>
                          <span className="sr-only">Estado factual</span>
                          <select
                            value={claim.truth}
                            onChange={(event) => updateClaim(claim.id, "truth", event.target.value as TruthStatus)}
                          >
                            {Object.entries(TRUTH_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span className="sr-only">Aderência ao escopo</span>
                          <select
                            value={claim.scope}
                            onChange={(event) => updateClaim(claim.id, "scope", event.target.value as ScopeStatus)}
                          >
                            {Object.entries(SCOPE_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </>
          ) : (
            <div className="empty-review">
              <span className="empty-icon" aria-hidden="true">↳</span>
              <h3>Sua revisão começa aqui</h3>
              <p>Estruture um prompt e consulte o modelo. As afirmações serão separadas para revisão manual.</p>
              <p className="small-note">Você precisa configurar as credenciais do provedor no servidor.</p>
            </div>
          )}
        </section>
      </div>

      <section className="history-panel">
        <div className="history-copy">
          <p className="eyebrow">PRIVACIDADE PRIMEIRO</p>
          <h2>Histórico neste navegador</h2>
          <p>Opcional. Os dados ficam no armazenamento local deste navegador e não são enviados para um banco de dados da aplicação.</p>
          {historyMessage && <span className="history-message" role="status">{historyMessage}</span>}
        </div>
        <div className="history-actions">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={historyEnabled}
              onChange={(event) => toggleHistory(event.target.checked)}
            />
            <span>Salvar novas interações</span>
          </label>
          <span className="history-count">{history.length} salvas</span>
          <button className="button button-outline" type="button" onClick={exportHistory} disabled={!history.length}>
            Exportar JSON
          </button>
        </div>
      </section>

      <footer className="site-footer">
        <span>CLAREZA / LAB · PROTÓTIPO EDUCACIONAL</span>
        <span>Revise fontes primárias. “Não verificável” não significa “falso”.</span>
      </footer>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
