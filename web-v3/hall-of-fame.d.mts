export const RANKS: ReadonlyArray<{ name: string; xp: number }>;
export function rankOf(value: unknown): { index: number; name: string; next: string | null; nextXp: number | null; progress: number; division: string };
