import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { computeRevenueSplit } from '../services/revenueService.js';
import { getOrCreateMonetizationConfig } from '../services/monetizationService.js';
import { normalizeInterval, validateAdPayload } from '../services/adService.js';

export async function createAd(req, res) {
  const {
    name,
    mediaUrl,
    clickUrl,
    intervalMin = 15,
    placement = 'UNIVERSAL',
  } = req.body;
  if (!name || !mediaUrl) return res.status(400).json({ message: 'name y mediaUrl son requeridos' });
  const validation = validateAdPayload({ name, mediaUrl, clickUrl });
  if (!validation.ok) return res.status(400).json({ message: validation.message });

  const ad = await prisma.advertisement.create({
    data: {
      name,
      mediaUrl,
      clickUrl,
      durationSec: 60,
      intervalMin: normalizeInterval(intervalMin),
      placement,
      contentRating: 'GENERAL',
    },
  });

  return res.status(201).json(ad);
}

export async function trackAdImpression(req, res) {
  const { adId, shortVideoId, watchMs = 0, grossRevenueUsd = 0.02 } = req.body;
  const userId = req.user?.userId || null;

  const ad = await prisma.advertisement.findUnique({ where: { id: adId } });
  if (!ad) return res.status(404).json({ message: 'Ad no encontrado' });

  const short = shortVideoId ? await prisma.shortVideo.findUnique({ where: { id: shortVideoId } }) : null;

  const impression = await prisma.adImpression.create({
    data: { adId, shortVideoId, userId, watchMs: Number(watchMs) },
  });

  if (short) {
    const config = await getOrCreateMonetizationConfig();
    const split = computeRevenueSplit(grossRevenueUsd, Number(config.creatorSharePct));
    await prisma.revenueLedger.create({
      data: {
        sourceType: 'AD_IMPRESSION',
        sourceId: impression.id,
        grossRevenueUsd: split.grossRevenueUsd,
        creatorSharePct: split.creatorSharePct,
        creatorShareUsd: split.creatorShareUsd,
        platformShareUsd: split.platformShareUsd,
        ownerUserId: short.ownerId,
        shortVideoId,
        adId,
      },
    });
  }

  return res.status(201).json(impression);
}

export async function getRevenueSummary(req, res) {
  const ownerUserId = req.params.userId;

  const rows = await prisma.revenueLedger.findMany({
    where: { ownerUserId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const totals = rows.reduce((acc, row) => {
    acc.gross += Number(row.grossRevenueUsd);
    acc.creator += Number(row.creatorShareUsd);
    acc.platform += Number(row.platformShareUsd);
    return acc;
  }, { gross: 0, creator: 0, platform: 0 });

  return res.json({
    ownerUserId,
    creatorSharePct: rows[0] ? Number(rows[0].creatorSharePct) : Number(env.CREATOR_SHARE_PERCENT),
    totals,
    rows,
  });
}
