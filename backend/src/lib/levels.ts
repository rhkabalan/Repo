/** Level curve: level n needs 100 * (n-1)^2 total XP (L1 at 0, L2 at 100, L3 at 400...). */
export const levelForXp = (xp: number) => Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1;
