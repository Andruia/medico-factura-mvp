import { MemoryCache } from "./memory-cache"
import type { CacheStats } from "./types"

interface CacheConfig {
  l1Enabled: boolean
  defaultTTL: number
  maxL1Size: number
}

export class CacheManager {
  private l1Cache: MemoryCache
  private config: CacheConfig

  constructor(config: CacheConfig) {
    this.config = config
    this.l1Cache = new MemoryCache()
  }

  async set<T>(key: string, data: T, ttl?: number, tags: string[] = []): Promise<void> {
    const actualTTL = ttl || this.config.defaultTTL

    try {
      if (this.config.l1Enabled) {
        this.l1Cache.set(key, data, actualTTL * 1000, tags)
      }
    } catch (error) {
      console.error("Cache write error:", error)
      throw error
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      if (this.config.l1Enabled) {
        const l1Result = this.l1Cache.get<T>(key)
        if (l1Result !== null) {
          return l1Result
        }
      }

      return null
    } catch (error) {
      console.error("Cache read error:", error)
      return null
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      if (this.config.l1Enabled) {
        return this.l1Cache.delete(key)
      }
      return false
    } catch (error) {
      console.error("Cache delete error:", error)
      return false
    }
  }

  async invalidateByTag(tag: string): Promise<number> {
    try {
      if (this.config.l1Enabled) {
        return this.l1Cache.invalidateByTag(tag)
      }
      return 0
    } catch (error) {
      console.error("Cache invalidation error:", error)
      return 0
    }
  }

  async getStats(): Promise<CacheStats> {
    const l1Stats = this.l1Cache.getStats()

    return {
      l1: l1Stats,
      metrics: {
        hitRate: l1Stats.hitRate,
        errorRate: 0,
        totalOperations: l1Stats.hitCount + l1Stats.missCount,
      },
      overall: {
        hitRate: l1Stats.hitRate,
        totalOperations: l1Stats.hitCount + l1Stats.missCount,
        errorRate: 0,
      },
    }
  }

  clear(): void {
    this.l1Cache.clear()
  }
}

// Instancia global del cache
export const cacheManager = new CacheManager({
  l1Enabled: true,
  defaultTTL: 300,
  maxL1Size: 1000,
})
