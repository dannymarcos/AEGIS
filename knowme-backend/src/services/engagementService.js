export function calculateEngagementScore({ watchedMs = 0, durationSec = 1, likeCount = 0, commentCount = 0, viewCount = 1 }) {
  const safeDurationMs = Math.max(durationSec * 1000, 1);
  const completionRate = Math.min(watchedMs / safeDurationMs, 1.5);
  const interactions = likeCount * 2 + commentCount * 3;
  const normalizedInteraction = interactions / Math.max(viewCount, 1);

  return Number((completionRate * 70 + normalizedInteraction * 30).toFixed(4));
}
