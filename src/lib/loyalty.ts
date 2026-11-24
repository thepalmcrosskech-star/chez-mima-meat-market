export const POINTS_PER_BLOCK = 50;
export const DH_PER_BLOCK = 10;

/** Points earned for an order: 1 point per full 10 DH of articles paid. */
export const pointsEarned = (articlesPaid: number) => Math.max(0, Math.floor(articlesPaid / 10));

/** Largest usable amount of points (blocks of 50) that keeps the articles total positive. */
export const usablePoints = (balance: number, articlesAfterPromo: number) => {
  let blocks = Math.floor(Math.max(0, balance) / POINTS_PER_BLOCK);
  while (blocks > 0 && blocks * DH_PER_BLOCK >= articlesAfterPromo) blocks--;
  return blocks * POINTS_PER_BLOCK;
};

export const pointsValue = (points: number) => (points / POINTS_PER_BLOCK) * DH_PER_BLOCK;
