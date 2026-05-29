import type { CacheEntry } from "./types"

export class MemoryCache {
  private cache: Map<string, CacheEntry<any>> = new Map()
  private timers: Map<string, NodeJS.Timeout> = new Map()
  private maxSize = 1000
  private hitCount = 0
  private missCount = 0

  set<T>(key: string, data: T, ttl = 300000, tags: string[] = []): void {
    // Limpiar timer existente
    const existingTimer = this.timers.get(key)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // Verificar límite de tamaño
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU()
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: new Date(),
      ttl,
      version: Date.now(),
      tags,
    }

    this.cache.set(key, entry)

    // Programar expiración
    const timer = setTimeout(() => {
      this.delete(key)
    }, ttl)

    this.timers.set(key, timer)
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)

    if (!entry) {
      this.missCount++
      return null
    }

    // Verificar si expiró
    const now = Date.now()
    const entryTime = entry.timestamp.getTime()

    if (now - entryTime > entry.ttl) {
      this.delete(key)
      this.missCount++
      return null
    }

    this.hitCount++
    return entry.data as T
  }

  delete(key: string): boolean {
    const timer = this.timers.get(key)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(key)
    }

    return this.cache.delete(key)
  }

  invalidateByTag(tag: string): number {
    let invalidated = 0

    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags.includes(tag)) {
        this.delete(key)
        invalidated++
      }
    }

    return invalidated
  }

  private evictLRU(): void {
    let oldestKey = ""
    let oldestTime = Date.now()

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp.getTime() < oldestTime) {
        oldestTime = entry.timestamp.getTime()
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.delete(oldestKey)
    }
  }

  getStats() {
    const total = this.hitCount + this.missCount
    return {
      size: this.cache.size,
      hitRate: total > 0 ? (this.hitCount / total) * 100 : 0,
      hitCount: this.hitCount,
      missCount: this.missCount,
    }
  }

  clear(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer)
    }

    this.cache.clear()
    this.timers.clear()
    this.hitCount = 0
    this.missCount = 0
  }
}
