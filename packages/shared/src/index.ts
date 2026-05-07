export type ReactionKind = 'up' | 'down';

export interface Reaction {
  kind: ReactionKind;
}

export interface Sample {
  /** Unix timestamp in milliseconds */
  t: number;
  /** Rolling mean of reactions in [-1, +1]; 0 when no reactions in window */
  value: number;
}

export const EVENTS = {
  reaction: 'reaction',
  sample: 'sample',
  history: 'history',
} as const;

export interface ServerToClientEvents {
  [EVENTS.sample]: (s: Sample) => void;
  [EVENTS.history]: (samples: Sample[]) => void;
}

export interface ClientToServerEvents {
  [EVENTS.reaction]: (r: Reaction) => void;
}
