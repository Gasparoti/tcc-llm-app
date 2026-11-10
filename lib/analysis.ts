export type TruthStatus = "pending" | "correct" | "incorrect" | "unverifiable";
export type ScopeStatus = "unchecked" | "relevant" | "out_of_scope";
export type ClaimType = "factual" | "inferential" | "attribution" | "format";

export type Claim = {
  id: string;
  text: string;
  type: ClaimType;
  truth: TruthStatus;
  scope: ScopeStatus;
};

export type Metrics = {
  factualAccuracy: number | null;
  hallucinationRate: number | null;
  scopeAdherence: number | null;
  unconfirmedPerThousandTokens: number;
  correctClaims: number;
  incorrectClaims: number;
  unconfirmedClaims: number;
};

function classifyClaim(text: string): ClaimType {
  if (/\b(segundo|conforme|de acordo com|afirma|relata)\b/i.test(text)) {
    return "attribution";
  }
  if (/\b(portanto|assim|isso sugere|provavelmente|pode indicar)\b/i.test(text)) {
    return "inferential";
  }
  if (/^(?:[-*•]|\d+[.)])\s/.test(text)) {
    return "format";
  }
  return "factual";
}

export function extractClaims(response: string): Claim[] {
  const candidates = response
    .split(/\r?\n/)
    .flatMap((line) => line.match(/[^.!?]+[.!?]?/g) ?? [])
    .map((text) => text.trim())
    .filter((text) => text.length > 12)
    .slice(0, 100);

  return candidates.map((text, index) => ({
    id: `claim-${index + 1}`,
    text,
    type: classifyClaim(text),
    truth: "pending",
    scope: "unchecked",
  }));
}

export function calculateMetrics(response: string, claims: Claim[]): Metrics {
  const correctClaims = claims.filter((claim) => claim.truth === "correct").length;
  const incorrectClaims = claims.filter((claim) => claim.truth === "incorrect").length;
  const unconfirmedClaims = claims.filter(
    (claim) => claim.truth === "pending" || claim.truth === "unverifiable",
  ).length;
  const verifiedClaims = correctClaims + incorrectClaims;
  const assessedSegments = claims.filter(
    (claim) => claim.scope !== "unchecked",
  ).length;
  const relevantSegments = claims.filter(
    (claim) => claim.scope === "relevant",
  ).length;
  const estimatedTokens = response.trim()
    ? response.trim().split(/\s+/).length
    : 0;

  return {
    factualAccuracy: verifiedClaims > 0 ? correctClaims / verifiedClaims : null,
    hallucinationRate: verifiedClaims > 0 ? incorrectClaims / verifiedClaims : null,
    scopeAdherence:
      assessedSegments > 0 ? relevantSegments / assessedSegments : null,
    unconfirmedPerThousandTokens:
      estimatedTokens > 0 ? (unconfirmedClaims / estimatedTokens) * 1000 : 0,
    correctClaims,
    incorrectClaims,
    unconfirmedClaims,
  };
}
