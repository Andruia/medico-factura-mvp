export interface CacheEntry<T> {
  data: T
  timestamp: Date
  ttl: number
  version: number
  tags: string[]
}

export interface CacheStats {
  l1: {
    size: number
    hitRate: number
    hitCount: number
    missCount: number
  }
  l2?: {
    memory: any
    keyspace: any
  }
  metrics: {
    hitRate: number
    errorRate: number
    totalOperations: number
  }
  overall: {
    hitRate: number
    totalOperations: number
    errorRate: number
  }
}

export interface OperationMetric {
  type: string
  key: string
  result: string
  timestamp: number
  metadata?: any
}
