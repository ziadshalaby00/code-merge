import { randomUUID } from 'crypto';

/**
 * Generates a new stable identifier for a MergeItem.
 * Uses Node's crypto.randomUUID (v4 UUID) — collision-safe.
 */
export const newId = (): string => randomUUID();