/** Returns a rounded integer percentage, or null when total is 0. */
export function scorePct(score, total) {
  if (!total || total === 0) return null;
  return Math.round((score / total) * 100);
}

/** A result passes when its rounded percentage is at least 50%. */
export function isPassingScore(score, total) {
  const percentage = scorePct(score, total);
  return percentage !== null && percentage >= 50;
}
