/**
 * Recognising AI agent work across accounts, commit trailers, commit authors,
 * pull request descriptions and issue disclosures.
 *
 * Agents act either through their own account (`agent`) or through a person's
 * account with a trailer, commit author, signature or label (`assisted`).
 * Routine dependency and CI bots are recognised separately so they are not
 * counted as coding agents.
 */

export const ORIGINS = ['agent', 'assisted', 'human'] as const;
/** agent: an agent's account; assisted: a person with an agent; human: neither. */
export type Origin = (typeof ORIGINS)[number];

/** Login tokens that mark an account as automation or an AI agent. */
export const AGENT_WORDS = [
  'agent',
  'bot',
  'automation',
  'copilot',
  'claude',
  'devin',
  'codex',
  'cursor',
  'sweep',
  'jules',
  'gemini',
  'antigravity',
];

/** Labels that mark an issue as filed by an AI agent. */
export const AGENT_ISSUE_LABEL =
  /^(?:ai[- ]?)?agent(?:[- ](?:filed|opened|created|authored|issue))?$/i;

/** Agent names, as they appear in trailers, commit authors and signatures. */
export const AGENT_NAMES = [
  'Claude',
  'Copilot',
  'Cursor',
  'Codex',
  'Devin',
  'Jules',
  'Gemini',
  'Antigravity',
  'Aider',
  'Sweep',
  'Amazon Q',
  'Kiro',
  'Windsurf',
  'Cline',
  'Roo Code',
  'Amp',
  'OpenHands',
];

/** Routine automation that is not an AI agent writing code. */
export const ROUTINE_BOT =
  /^(dependabot|renovate|github-actions|pre-commit-ci|mergify|allcontributors)/i;

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const AGENT_NAME_PATTERNS: [RegExp, string][] = AGENT_NAMES.map((name) => [
  new RegExp(`\\b${escapeRegex(name)}\\b`, 'i'),
  name,
]);

function loginTokens(login: string): string[] {
  return login
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** Whether a GitHub account login/type belongs to automation or an AI agent. */
export function isAgent(
  login: string | null | undefined,
  type: string | null | undefined,
  extra: string[] = []
): boolean {
  const raw = (login ?? '').trim();
  if (!raw) return false;
  if (type === 'Bot') return true;
  const lower = raw.toLowerCase();
  if (extra.some((l) => l.toLowerCase() === lower)) return true;
  const tokens = loginTokens(raw);
  return AGENT_WORDS.some((word) => tokens.includes(word));
}

function findAgentName(text: string): string | null {
  for (const [pattern, name] of AGENT_NAME_PATTERNS) {
    if (pattern.test(text)) return name;
  }
  return null;
}

const TRAILER =
  /^(?:co-authored-by|assisted-by|generated-by|ai-assisted-by):\s*(.+)$/gim;

/** The agent named in a commit or PR message's attribution trailers, if any. */
export function agentInTrailers(message: string): string | null {
  for (const match of message.matchAll(TRAILER)) {
    const value = match[1].trim();
    if (ROUTINE_BOT.test(value)) continue;
    const named = findAgentName(value);
    if (named) return named;
    const lower = value.toLowerCase();
    const tokens = loginTokens(value);
    if (
      lower.includes('[bot]') ||
      AGENT_WORDS.some((w) => w !== 'bot' && tokens.includes(w))
    ) {
      return 'an agent';
    }
  }
  return null;
}

export interface CommitAuthor {
  name?: string | null;
  email?: string | null;
}

const AGENT_AUTHOR_EMAILS: [RegExp, string][] = [
  [/@anthropic\.com$/i, 'Claude'],
  [/copilot@users\.noreply\.github\.com$/i, 'Copilot'],
  [/devin-ai-integration/i, 'Devin'],
  [/(?:@cursor\.com$|^cursoragent@)/i, 'Cursor'],
];

const AGENT_AUTHOR_NAMES: [RegExp, string][] = [
  [/^claude(?:\s+(?:code|opus|sonnet|haiku|bot)\b.*)?$/i, 'Claude'],
  [/^(?:github\s+)?copilot(?:\b.*)?$/i, 'Copilot'],
  [/^antigravity\b.*\bgemini\b/i, 'Gemini'],
  [/^gemini(?:\s+(?:cli|code\s+assist|bot)\b.*)?$/i, 'Gemini'],
  [/^antigravity(?:\b.*)?$/i, 'Antigravity'],
  [/^cursor(?:\s+(?:agent|bot)\b.*)?$/i, 'Cursor'],
  [/^(?:openai\s+)?codex(?:\b.*)?$/i, 'Codex'],
  [/^devin(?:\s+(?:ai|bot)\b.*)?$/i, 'Devin'],
  [/^jules(?:\s+(?:bot)\b.*)?$/i, 'Jules'],
  [
    /^(?:aider|sweep|amazon\s+q|kiro|windsurf|cline|roo\s+code|openhands)\b/i,
    '',
  ],
];

/**
 * The agent named by a git commit author (name/email), if any.
 * Matches known agent emails, `[bot]` identities and structured agent names
 * without misclassifying people whose given name matches an agent (e.g. "Claude Shannon").
 */
export function agentInCommitAuthor(
  author: CommitAuthor | null | undefined
): string | null {
  if (!author) return null;
  const name = (author.name ?? '').trim();
  const email = (author.email ?? '').trim();
  if (!name && !email) return null;
  if (ROUTINE_BOT.test(name) || ROUTINE_BOT.test(email)) return null;

  for (const [pattern, agent] of AGENT_AUTHOR_EMAILS) {
    if (pattern.test(email)) return agent;
  }
  if (`${name} ${email}`.toLowerCase().includes('[bot]')) {
    return findAgentName(`${name} ${email}`) ?? 'an agent';
  }
  for (const [pattern, agent] of AGENT_AUTHOR_NAMES) {
    if (pattern.test(name)) {
      return agent || findAgentName(name) || 'an agent';
    }
  }
  return null;
}

const AGENT_NAME_GROUP = AGENT_NAMES.map(escapeRegex).join('|');
const NAMED_SIGNATURE = new RegExp(
  `(?<![a-z0-9])(?:generated|created|written|authored|assisted|raised|opened|filed)\\s+(?:with|by)\\s+(?:an?\\s+(?:ai\\s+)?(?:coding\\s+)?agent\\s*\\(\\s*)?[*_\\[]*(?<![a-z0-9])(${AGENT_NAME_GROUP})(?![a-z0-9])`,
  'i'
);
const GENERIC_AGENT_SIGNATURE =
  /(?<![a-z0-9])(?:generated|created|written|authored|assisted|raised|opened|filed)\s+(?:with|by)\s+an?\s+(?:ai\s+)?(?:coding\s+)?agent(?![a-z0-9])/i;
const AGENT_METADATA = /^(?:ai[- ]?)?agent:\s*(.+)$/im;

/** The agent named in a pull request or issue body signature/disclosure, if any. */
export function agentInSignature(body: string): string | null {
  const fromTrailer = agentInTrailers(body);
  if (fromTrailer) return fromTrailer;

  const named = NAMED_SIGNATURE.exec(body);
  if (named) {
    return (
      AGENT_NAMES.find((n) => n.toLowerCase() === named[1].toLowerCase()) ??
      named[1]
    );
  }

  const meta = AGENT_METADATA.exec(body);
  if (meta) {
    const value = meta[1].trim();
    if (value && !/^(none|no|false|human|n\/a)$/i.test(value)) {
      return findAgentName(value) ?? 'an agent';
    }
  }

  if (GENERIC_AGENT_SIGNATURE.test(body)) return 'an agent';
  return null;
}

const KNOWN_ACCOUNTS: [RegExp, string][] = [
  [/copilot/i, 'Copilot'],
  [/claude/i, 'Claude'],
  [/devin/i, 'Devin'],
  [/codex|openai/i, 'Codex'],
  [/cursor/i, 'Cursor'],
  [/gemini/i, 'Gemini'],
  [/antigravity/i, 'Antigravity'],
  [/jules|google/i, 'Jules'],
];

/** Who wrote a pull request or closing change. */
export function classifyOrigin(
  author: string | null,
  authorType: string | null,
  body: string,
  commitMessages: string[],
  agentLogins: string[] = [],
  commitAuthors: (CommitAuthor | null | undefined)[] = []
): { origin: Origin; agent: string | null; routine: boolean } {
  const login = author ?? '';
  if (ROUTINE_BOT.test(login))
    return { origin: 'agent', agent: null, routine: true };
  if (isAgent(login, authorType, agentLogins)) {
    const known = KNOWN_ACCOUNTS.find(([pattern]) => pattern.test(login));
    return { origin: 'agent', agent: known ? known[1] : login, routine: false };
  }
  const named =
    commitMessages.map(agentInTrailers).find((n) => n !== null) ??
    commitAuthors.map(agentInCommitAuthor).find((n) => n !== null) ??
    agentInSignature(body);
  return named
    ? { origin: 'assisted', agent: named, routine: false }
    : { origin: 'human', agent: null, routine: false };
}
