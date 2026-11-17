/**
 * The forecast model of the two issue queues, run on the GSSK kernel
 * (src/vendor/gssk). Each queue is an Odum-style network:
 *
 *   filing (source) ──arrive──▶ open (storage) ──agents──▶ byAgents (storage)
 *                                              └─humans──▶ byHumans (storage)
 *
 * `arrive` is linear in a source of value 1, so its rate constant is new
 * issues per day. `agents` and `humans` are linear in the open backlog, so
 * their rate constants are the share of open issues each resolves per day.
 */
import type { GSSKModule } from '../vendor/gssk/gssk.d.ts';

export const QUEUES = ['public', 'agents'] as const;
export type QueueName = (typeof QUEUES)[number];
/** Values held per queue, in this order. */
export const NODES = ['open', 'byAgents', 'byHumans'] as const;
/** Rate constants per queue: new issues filed by people (or by anyone,
 * when filers are not told apart), new issues filed by agents, and the
 * shares of the open backlog agents and humans resolve per day. */
export const EDGES = ['arrive', 'arriveAgents', 'agents', 'humans'] as const;

/** Starting totals for one queue. */
export interface QueueStart {
  open: number;
  byAgents: number;
  byHumans: number;
}

/** What the forecast needs from a kernel; tests may supply their own. */
export interface Simulator {
  /** Back to the starting totals. */
  reset(): void;
  /** Sets a rate constant. */
  setRate(queue: string, edge: (typeof EDGES)[number], k: number): void;
  /** Advances the model by whole days. */
  step(days: number): void;
  /** The current value of a node. */
  value(queue: string, node: (typeof NODES)[number]): number;
  /** Frees the kernel's memory. */
  dispose(): void;
}

/** Steps per day: RK4 at a quarter of a day. */
const STEPS_PER_DAY = 4;

/** The model as GSSK JSON (schema 4). */
export function modelJson(
  start: Record<string, QueueStart>,
  names: readonly string[] = QUEUES
): string {
  const nodes = [];
  const edges = [];
  for (const queue of names) {
    const s = start[queue];
    nodes.push(
      { id: `${queue}.filing`, type: 'source', value: 1 },
      { id: `${queue}.agentFiling`, type: 'source', value: 1 },
      { id: `${queue}.open`, type: 'storage', value: s.open },
      { id: `${queue}.byAgents`, type: 'storage', value: s.byAgents },
      { id: `${queue}.byHumans`, type: 'storage', value: s.byHumans }
    );
    const edge = (id: string, origin: string, target: string) => ({
      id: `${queue}.${id}`,
      origin: `${queue}.${origin}`,
      target: `${queue}.${target}`,
      logic: 'linear',
      params: { k: 0 },
    });
    edges.push(
      edge('arrive', 'filing', 'open'),
      edge('arriveAgents', 'agentFiling', 'open'),
      edge('agents', 'open', 'byAgents'),
      edge('humans', 'open', 'byHumans')
    );
  }
  return JSON.stringify({
    metadata: {
      schema_version: 4,
      name: 'Issue queues',
      description:
        'Public GitHub issues and the agents’ own queue: issues arrive, ' +
        'and agents and humans resolve a share of the open backlog each day.',
      kernel_version: '6.0.2',
    },
    nodes,
    edges,
    config: {
      t_start: 0,
      t_end: 100000,
      dt: 1 / STEPS_PER_DAY,
      method: 'rk4',
    },
  });
}

/** A Simulator over a loaded GSSK module. */
export function gsskSimulator(
  gssk: GSSKModule,
  start: Record<string, QueueStart>,
  names: readonly string[] = QUEUES
): Simulator {
  const withString = <T>(text: string, use: (ptr: number) => T): T => {
    const size = gssk.lengthBytesUTF8(text) + 1;
    const ptr = gssk._malloc(size);
    try {
      gssk.stringToUTF8(text, ptr, size);
      return use(ptr);
    } finally {
      gssk._free(ptr);
    }
  };

  const out = gssk._malloc(4);
  const status = withString(modelJson(start, names), (ptr) =>
    gssk._GSSK_Init(ptr, out)
  );
  const kernel = gssk.HEAPU32[out >> 2];
  gssk._free(out);
  if (status !== 0 || !kernel) {
    const reason = kernel
      ? gssk.UTF8ToString(gssk._GSSK_GetErrorDescription(kernel))
      : `status ${status}`;
    throw new Error(`GSSK could not load the forecast model: ${reason}`);
  }

  const nodeIndex = new Map<string, number>();
  const edgeIndex = new Map<string, number>();
  for (const queue of names) {
    for (const node of NODES) {
      const id = `${queue}.${node}`;
      nodeIndex.set(
        id,
        withString(id, (ptr) => gssk._GSSK_FindNodeIdx(kernel, ptr))
      );
    }
    for (const edge of EDGES) {
      const id = `${queue}.${edge}`;
      edgeIndex.set(
        id,
        withString(id, (ptr) => gssk._GSSK_FindEdgeIdx(kernel, ptr))
      );
    }
  }
  const dt = 1 / STEPS_PER_DAY;

  return {
    reset: () => gssk._GSSK_Reset(kernel),
    setRate: (queue, edge, k) =>
      gssk._GSSK_SetEdgeK(kernel, edgeIndex.get(`${queue}.${edge}`)!, k),
    step: (days) => {
      for (let i = 0; i < days * STEPS_PER_DAY; i++) {
        gssk._GSSK_Step(kernel, dt);
      }
    },
    value: (queue, node) => {
      const state = gssk._GSSK_GetState(kernel) >> 3;
      return gssk.HEAPF64[state + nodeIndex.get(`${queue}.${node}`)!];
    },
    dispose: () => gssk._GSSK_Free(kernel),
  };
}

let kernel: Promise<GSSKModule> | null = null;

/** The vendored kernel (about 180 KB), loaded once. */
function loadKernel(): Promise<GSSKModule> {
  kernel ??= import('../vendor/gssk/gssk.js').then(({ default: createGSSK }) =>
    createGSSK({ print: () => {}, printErr: () => {} })
  );
  return kernel;
}

/** A Simulator for the given queues, on the shared kernel. */
export async function loadSimulator(
  start: Record<string, QueueStart>,
  names: readonly string[] = QUEUES
): Promise<Simulator> {
  return gsskSimulator(await loadKernel(), start, names);
}
