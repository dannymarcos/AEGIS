let redisClient = null;

export async function getCacheClient(redisUrl) {
  if (!redisUrl) return null;
  if (redisClient) return redisClient;

  try {
    const { createClient } = await import('redis');
    redisClient = createClient({ url: redisUrl });
    redisClient.on('error', (err) => {
      console.error('Redis error:', err.message);
    });
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
    return redisClient;
  } catch (error) {
    console.warn('Redis not available, continuing without cache:', error.message);
    return null;
  }
}
