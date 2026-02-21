import { prisma } from '../config/prisma.js';

const BANNED_TERMS = ['adult', 'sex', 'xxx', 'casino', 'bet', 'porno', 'onlyfans'];

export function validateAdPayload({ name = '', mediaUrl = '', clickUrl = '' }) {
  const haystack = `${name} ${mediaUrl} ${clickUrl}`.toLowerCase();
  const blocked = BANNED_TERMS.find((term) => haystack.includes(term));
  if (blocked) {
    return { ok: false, message: `Contenido publicitario no permitido (${blocked})` };
  }
  return { ok: true };
}

export function normalizeInterval(intervalMin = 15) {
  return Number(intervalMin) >= 30 ? 30 : 15;
}

export function shouldInsertAd({ lastAdAt, now = new Date(), intervalMin = 15 }) {
  if (!lastAdAt) return true;
  const elapsedMin = (now.getTime() - new Date(lastAdAt).getTime()) / 60000;
  return elapsedMin >= intervalMin;
}

export async function getEligibleAdForPlacement({ userId, placement }) {
  const activeAd = await prisma.advertisement.findFirst({
    where: {
      isActive: true,
      contentRating: 'GENERAL',
      placement: { in: [placement, 'UNIVERSAL'] },
    },
    orderBy: { createdAt: 'asc' },
  });

  if (!activeAd) return null;

  const latestImpression = await prisma.adImpression.findFirst({
    where: { userId, ad: { placement: { in: [placement, 'UNIVERSAL'] } } },
    orderBy: { shownAt: 'desc' },
  });

  const intervalMin = normalizeInterval(activeAd.intervalMin);
  if (!shouldInsertAd({ lastAdAt: latestImpression?.shownAt, intervalMin })) return null;

  return {
    ...activeAd,
    durationSec: 60,
    intervalMin,
  };
}
