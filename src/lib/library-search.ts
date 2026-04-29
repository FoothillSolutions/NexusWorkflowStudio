export type LibrarySearchField = string | number | null | undefined;

interface SearchIndex {
  fields: string[];
  text: string;
  compactText: string;
  tokens: string[];
  acronym: string;
}

const DIACRITICS_PATTERN = /[\u0300-\u036f]/g;
const CAMEL_BOUNDARY_PATTERN = /([a-z0-9])([A-Z])/g;
const ACRONYM_BOUNDARY_PATTERN = /([A-Z]+)([A-Z][a-z])/g;
const NON_WORD_PATTERN = /[^a-z0-9]+/g;
const WHITESPACE_PATTERN = /\s+/g;
const STOP_WORDS = new Set(["a", "an", "and", "for", "of", "or", "the", "to"]);

/**
 * Normalize user-entered and library text into a search-friendly form.
 * Handles case, accents, camelCase/PascalCase, kebab-case, snake_case, and punctuation.
 */
export function normalizeLibrarySearchText(value: LibrarySearchField): string {
  if (value === null || value === undefined) return "";

  return String(value)
    .normalize("NFKD")
    .replace(DIACRITICS_PATTERN, "")
    .replace(ACRONYM_BOUNDARY_PATTERN, "$1 $2")
    .replace(CAMEL_BOUNDARY_PATTERN, "$1 $2")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(NON_WORD_PATTERN, " ")
    .trim()
    .replace(WHITESPACE_PATTERN, " ");
}

function tokenize(value: string): string[] {
  if (!value) return [];
  return value.split(" ").filter(Boolean);
}

function uniqueValues(values: string[]): string[] {
  return [...new Set(values)];
}

function buildSearchIndex(fields: LibrarySearchField[]): SearchIndex {
  const normalizedFields = fields
    .map(normalizeLibrarySearchText)
    .filter((field) => field.length > 0);
  const tokens = uniqueValues(normalizedFields.flatMap(tokenize));
  const text = normalizedFields.join(" ");
  const acronym = tokens
    .filter((token) => !STOP_WORDS.has(token))
    .map((token) => token[0])
    .join("");

  return {
    fields: normalizedFields,
    text,
    compactText: text.replaceAll(" ", ""),
    tokens,
    acronym,
  };
}

function isWordStartMatch(text: string, term: string): boolean {
  return text === term || text.startsWith(`${term} `) || text.includes(` ${term}`);
}

function scoreAcronymMatch(term: string, acronym: string): number | null {
  if (term.length < 2 || !acronym) return null;
  if (acronym === term) return 135;
  if (acronym.startsWith(term)) return 125;
  if (acronym.includes(term)) return 95;
  return null;
}

function isSubsequence(pattern: string, candidate: string): boolean {
  let patternIndex = 0;

  for (const char of candidate) {
    if (char === pattern[patternIndex]) patternIndex += 1;
    if (patternIndex === pattern.length) return true;
  }

  return false;
}

function scoreSubsequenceMatch(term: string, candidate: string): number | null {
  if (term.length < 3 || candidate.length < term.length) return null;
  if (!candidate.startsWith(term[0])) return null;
  if (!isSubsequence(term, candidate)) return null;

  const coverage = term.length / candidate.length;
  if (coverage < 0.42) return null;

  return 52 + Math.round(coverage * 28);
}

function maxEditDistance(term: string): number {
  if (term.length < 4) return 0;
  if (term.length <= 5) return 1;
  if (term.length <= 10) return 2;
  return 3;
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const distances = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1));

  for (let i = 0; i <= a.length; i += 1) distances[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) distances[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      distances[i][j] = Math.min(
        distances[i][j - 1] + 1,
        distances[i - 1][j] + 1,
        distances[i - 1][j - 1] + substitutionCost,
      );

      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        distances[i][j] = Math.min(distances[i][j], distances[i - 2][j - 2] + 1);
      }
    }
  }

  return distances[a.length][b.length];
}

function scoreFuzzyMatch(term: string, tokens: string[]): number | null {
  const allowedDistance = maxEditDistance(term);
  if (allowedDistance === 0) return null;

  let bestScore: number | null = null;

  for (const token of tokens) {
    if (Math.abs(token.length - term.length) > allowedDistance) continue;

    const distance = editDistance(term, token);
    if (distance > allowedDistance) continue;

    const score = 74 - distance * 12;
    bestScore = Math.max(bestScore ?? 0, score);
  }

  return bestScore;
}

function scoreTerm(term: string, index: SearchIndex): number | null {
  let bestScore: number | null = null;

  if (index.tokens.includes(term)) bestScore = Math.max(bestScore ?? 0, 150);
  if (isWordStartMatch(index.text, term)) bestScore = Math.max(bestScore ?? 0, 135);
  if (term.length >= 2 && index.text.includes(term)) bestScore = Math.max(bestScore ?? 0, 95);
  if (term.length >= 3 && index.compactText.includes(term)) bestScore = Math.max(bestScore ?? 0, 88);

  for (const token of index.tokens) {
    if (token.startsWith(term)) bestScore = Math.max(bestScore ?? 0, 120);
    if (term.length >= 2 && token.includes(term)) bestScore = Math.max(bestScore ?? 0, 90);

    const subsequenceScore = scoreSubsequenceMatch(term, token);
    if (subsequenceScore !== null) bestScore = Math.max(bestScore ?? 0, subsequenceScore);
  }

  const acronymScore = scoreAcronymMatch(term, index.acronym);
  if (acronymScore !== null) bestScore = Math.max(bestScore ?? 0, acronymScore);

  const fuzzyScore = scoreFuzzyMatch(term, index.tokens);
  if (fuzzyScore !== null) bestScore = Math.max(bestScore ?? 0, fuzzyScore);

  return bestScore;
}

/**
 * Returns a relevance score for a query against a list of searchable fields.
 * `null` means no match. Higher scores are more relevant.
 */
export function getLibrarySearchScore(query: string, fields: LibrarySearchField[]): number | null {
  const normalizedQuery = normalizeLibrarySearchText(query);
  if (!normalizedQuery) return 0;

  const queryTokens = tokenize(normalizedQuery);
  const index = buildSearchIndex(fields);
  if (!index.text) return null;

  const phrasePosition = index.text.indexOf(normalizedQuery);
  let score = phrasePosition >= 0 ? 300 - Math.min(phrasePosition, 200) : 0;

  if (index.fields.includes(normalizedQuery)) {
    score += 80;
  } else if (index.fields.some((field) => field.startsWith(`${normalizedQuery} `))) {
    score += 40;
  }

  for (const term of queryTokens) {
    const termScore = scoreTerm(term, index);
    if (termScore === null) return null;
    score += termScore;
  }

  return score;
}

/** Filter and rank library-like collections while preserving original order for equal scores. */
export function rankLibrarySearchResults<T>(
  items: T[],
  query: string,
  getFields: (item: T) => LibrarySearchField[],
): T[] {
  if (!normalizeLibrarySearchText(query)) return items;

  return items
    .map((item, index) => ({
      item,
      index,
      score: getLibrarySearchScore(query, getFields(item)),
    }))
    .filter((entry): entry is { item: T; index: number; score: number } => entry.score !== null)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.item);
}

/** Extract searchable primitive values from nested workflow/node payloads. */
export function collectSearchableStrings(value: unknown, maxDepth = 4): string[] {
  const results: string[] = [];
  const seen = new Set<object>();

  function visit(current: unknown, depth: number): void {
    if (current === null || current === undefined || depth > maxDepth) return;

    if (typeof current === "string" || typeof current === "number") {
      results.push(String(current));
      return;
    }

    if (typeof current !== "object") return;
    if (seen.has(current)) return;
    seen.add(current);

    if (Array.isArray(current)) {
      for (const item of current) visit(item, depth + 1);
      return;
    }

    for (const nestedValue of Object.values(current as Record<string, unknown>)) {
      visit(nestedValue, depth + 1);
    }
  }

  visit(value, 0);
  return uniqueValues(results);
}
