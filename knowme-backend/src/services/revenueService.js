export function computeRevenueSplit(grossRevenueUsd, creatorSharePct) {
  const gross = Number(grossRevenueUsd || 0);
  const sharePct = Number(creatorSharePct || 40);
  const creator = Number(((gross * sharePct) / 100).toFixed(2));
  const platform = Number((gross - creator).toFixed(2));

  return {
    grossRevenueUsd: gross,
    creatorSharePct: sharePct,
    creatorShareUsd: creator,
    platformShareUsd: platform,
  };
}
