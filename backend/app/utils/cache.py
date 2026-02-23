import os
import logging
from fastapi_cache import FastAPICache
from fastapi_cache.backends.redis import RedisBackend
from fastapi_cache.backends.inmemory import InMemoryBackend
from fastapi_cache.decorator import cache
from redis import asyncio as aioredis

logger = logging.getLogger(__name__)

async def init_redis_cache():
    try:
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        fastapi_redis = aioredis.from_url(redis_url, encoding="utf8", decode_responses=True)
        FastAPICache.init(RedisBackend(fastapi_redis), prefix="fastapi-cache")
        # Store for manual invalidation
        FastAPICache.redis = fastapi_redis
        logger.info("✅ Redis cache initialized")
    except Exception as e:
        logger.warning(f"⚠️ Redis init failed, falling back to in-memory: {e}")
        FastAPICache.init(InMemoryBackend(), prefix="fastapi-cache")

async def invalidate_analytics_cache():
    """Invalidates all cached analytics responses using SCAN."""
    try:
        if hasattr(FastAPICache, 'redis') and FastAPICache.redis:
            # Our keys are prefixed with fastapi-cache, and our version is v2
            # so the match pattern is fastapi-cache:v2:analytics:*
            cursor = 0
            while True:
                cursor, keys = await FastAPICache.redis.scan(cursor, match="fastapi-cache:v2:analytics:*", count=100)
                if keys:
                    await FastAPICache.redis.delete(*keys)
                if cursor == 0:
                    break
            logger.info("🧹 Analytics v2 cache invalidated")
    except Exception as e:
        logger.error(f"Failed to invalidate cache: {e}")
