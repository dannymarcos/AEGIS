import { prisma } from '../config/prisma.js';
import { computeRevenueSplit } from '../services/revenueService.js';
import {
  getCreatorDashboard,
  getOrCreateMonetizationConfig,
  updateMonetizationConfig,
} from '../services/monetizationService.js';

export async function getMonetizationConfig(_req, res) {
  const config = await getOrCreateMonetizationConfig();
  return res.json(config);
}

export async function updateCreatorShareConfig(req, res) {
  const { creatorSharePct, minimumPayoutUsd } = req.body;
  const share = Number(creatorSharePct);
  if (!Number.isFinite(share) || share <= 0 || share >= 100) {
    return res.status(400).json({ message: 'creatorSharePct debe ser un número entre 0 y 100' });
  }

  const config = await updateMonetizationConfig({
    creatorSharePct: share,
    minimumPayoutUsd,
    updatedById: req.user.userId,
  });

  return res.json(config);
}

export async function getMyCreatorDashboard(req, res) {
  const days = Number(req.query.days || 30);
  const data = await getCreatorDashboard(req.user.userId, days);
  return res.json(data);
}

export async function getCreatorDashboardById(req, res) {
  const days = Number(req.query.days || 30);
  const data = await getCreatorDashboard(req.params.userId, days);
  return res.json(data);
}

export async function registerRevenueEvent(req, res) {
  const { sourceType, sourceId, grossRevenueUsd, ownerUserId, videoId, shortVideoId, adId } = req.body;
  if (!sourceType || !sourceId || !ownerUserId) {
    return res.status(400).json({ message: 'sourceType, sourceId y ownerUserId son requeridos' });
  }

  const config = await getOrCreateMonetizationConfig();
  const split = computeRevenueSplit(grossRevenueUsd, Number(config.creatorSharePct));

  const row = await prisma.revenueLedger.create({
    data: {
      sourceType,
      sourceId,
      grossRevenueUsd: split.grossRevenueUsd,
      creatorSharePct: split.creatorSharePct,
      creatorShareUsd: split.creatorShareUsd,
      platformShareUsd: split.platformShareUsd,
      ownerUserId,
      videoId,
      shortVideoId,
      adId,
    },
  });

  return res.status(201).json(row);
}
