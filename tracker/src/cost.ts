/**
 * The cost inputs: what an agent costs per resolved issue, a person's hourly
 * rate and hours per issue, and a monthly budget for people and another for
 * agents, all in the currency the user chooses.
 */

export interface CostInputs {
  currency: string;
  agent_per_issue: number;
  human_hourly_rate: number;
  human_hours_per_issue: number;
  /** What people's time may cost a month. */
  monthly_human_budget: number | null;
  /** What agents' API and CI spend may cost a month. */
  monthly_agentic_budget: number | null;
}

/**
 * Reads the cost inputs, or `null` for the cost until a price is set: costs
 * are never guessed. `monthly-budget`, the single budget of earlier
 * versions, still counts as the human budget for now, with a warning.
 */
export function costInputs(env: (name: string) => string): {
  cost: CostInputs | null;
  warnings: string[];
} {
  const read = (name: string) => {
    const text = env(name);
    const n = Number(text);
    return text !== '' && Number.isFinite(n) && n >= 0 ? n : null;
  };
  const warnings: string[] = [];
  const legacy = read('SRE_MONTHLY_BUDGET');
  if (legacy !== null) {
    warnings.push(
      'monthly-budget is deprecated and will be removed: rename it monthly-human-budget, and set monthly-agentic-budget for what agents may spend.'
    );
  }
  const agentPerIssue = read('SRE_AGENT_COST_PER_ISSUE');
  const humanHourly = read('SRE_HUMAN_HOURLY_RATE');
  if (agentPerIssue === null && humanHourly === null) {
    return { cost: null, warnings };
  }
  return {
    cost: {
      currency: env('SRE_CURRENCY') || 'USD',
      agent_per_issue: agentPerIssue ?? 0,
      human_hourly_rate: humanHourly ?? 0,
      human_hours_per_issue: read('SRE_HUMAN_HOURS_PER_ISSUE') ?? 2,
      monthly_human_budget: read('SRE_MONTHLY_HUMAN_BUDGET') ?? legacy,
      monthly_agentic_budget: read('SRE_MONTHLY_AGENTIC_BUDGET'),
    },
    warnings,
  };
}
