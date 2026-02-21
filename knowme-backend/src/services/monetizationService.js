import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';

const SOURCE_TYPES = ['AD_IMPRESSION', 'SHORT_AD_IMPRESSION', 'VIDEO_AD_IMPRESSION'];

function toMoney(amount) {
  return Number(Number(amount || 0).toFixed(2));
}

export async function getOrCreateMonetizationConfig() {
  const existing = await prisma.monetizationConfig.findFirst({
    orderBy: { updatedAt: 'desc' },
  });

  if (existing) return existing;

  return prisma.monetizationConfig.create({
    data: {
      creatorSharePct: Number(env.CREATOR_SHARE_PERCENT || 40),
    },
  });
}

export async function updateMonetizationConfig({ creatorSharePct, minimumPayoutUsd, updatedById }) {
  const current = await getOrCreateMonetizationConfig();

  return prisma.monetizationConfig.update({
    where: { id: current.id },
    data: {
      creatorSharePct: Number(creatorSharePct),
      minimumPayoutUsd: minimumPayoutUsd != null ? Number(minimumPayoutUsd) : current.minimumPayoutUsd,
      updatedById,
    },
  });
}

export async function getCreatorDashboard(creatorId, days = 30) {
  const rangeDays = Math.max(1, Math.min(Number(days) || 30, 365));
  const from = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);

  const [rows, grouped, shortCount, videoCount, adCount, config] = await Promise.all([
    prisma.revenueLedger.findMany({
      where: { ownerUserId: creatorId, createdAt: { gte: from } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    prisma.revenueLedger.groupBy({
      by: ['sourceType'],
      where: { ownerUserId: creatorId, createdAt: { gte: from } },
      _sum: { grossRevenueUsd: true, creatorShareUsd: true, platformShareUsd: true },
      orderBy: { sourceType: 'asc' },
    }),
    prisma.shortVideo.count({ where: { ownerId: creatorId } }),
    prisma.video.count({ where: { ownerId: creatorId } }),
    prisma.adImpression.count({ where: { shortVideo: { ownerId: creatorId }, shownAt: { gte: from } } }),
    getOrCreateMonetizationConfig(),
  ]);

  const totals = rows.reduce(
    (acc, row) => {
      acc.grossRevenueUsd += Number(row.grossRevenueUsd || 0);
      acc.creatorShareUsd += Number(row.creatorShareUsd || 0);
      acc.platformShareUsd += Number(row.platformShareUsd || 0);
      return acc;
    },
    { grossRevenueUsd: 0, creatorShareUsd: 0, platformShareUsd: 0 },
  );

  const breakdown = grouped.map((item) => ({
    sourceType: item.sourceType,
    grossRevenueUsd: toMoney(item._sum.grossRevenueUsd),
    creatorShareUsd: toMoney(item._sum.creatorShareUsd),
    platformShareUsd: toMoney(item._sum.platformShareUsd),
  }));

  const byDayMap = new Map();
  rows.forEach((row) => {
    const day = row.createdAt.toISOString().slice(0, 10);
    const current = byDayMap.get(day) || { day, creatorShareUsd: 0, grossRevenueUsd: 0 };
    current.creatorShareUsd += Number(row.creatorShareUsd || 0);
    current.grossRevenueUsd += Number(row.grossRevenueUsd || 0);
    byDayMap.set(day, current);
  });

  const timeline = [...byDayMap.values()]
    .map((item) => ({
      day: item.day,
      creatorShareUsd: toMoney(item.creatorShareUsd),
      grossRevenueUsd: toMoney(item.grossRevenueUsd),
    }))
    .sort((a, b) => (a.day > b.day ? 1 : -1));

  return {
    rangeDays,
    monetization: {
      creatorSharePct: Number(config.creatorSharePct),
      minimumPayoutUsd: Number(config.minimumPayoutUsd),
      payoutReady: toMoney(totals.creatorShareUsd) >= Number(config.minimumPayoutUsd),
    },
    stats: {
      videos: videoCount,
      shorts: shortCount,
      adImpressions: adCount,
      supportedSources: SOURCE_TYPES,
    },
    totals: {
      grossRevenueUsd: toMoney(totals.grossRevenueUsd),
      creatorShareUsd: toMoney(totals.creatorShareUsd),
      platformShareUsd: toMoney(totals.platformShareUsd),
    },
    breakdown,
    timeline,
    recentTransactions: rows,
  };
}
