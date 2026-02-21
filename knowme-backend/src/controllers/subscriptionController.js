import { prisma } from '../config/prisma.js';

export async function toggleSubscription(req, res) {
  const channelId = req.params.channelId;
  const subscriberId = req.user.userId;

  if (channelId === subscriberId) {
    return res.status(400).json({ message: 'No puedes suscribirte a tu propio canal' });
  }

  const existing = await prisma.subscription.findUnique({
    where: { subscriberId_channelId: { subscriberId, channelId } },
  });

  if (existing) {
    await prisma.subscription.delete({ where: { id: existing.id } });
    return res.json({ subscribed: false });
  }

  await prisma.subscription.create({ data: { subscriberId, channelId } });
  return res.json({ subscribed: true });
}
