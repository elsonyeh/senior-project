// simpleCache.js - 輕量級快取系統，適用於150間餐廳規模

class SimpleCache {
  constructor(maxSize = 50, defaultTTL = 5 * 60 * 1000) { // 預設5分鐘TTL
    this.cache = new Map();
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
  }

  /**
   * 生成快取鍵
   * @param {Array} answers - 用戶答案
   * @param {Object} options - 選項（排除餐廳資料）
   * @returns {string} 快取鍵
   */
  generateKey(answers, options = {}) {
    const cleanOptions = { ...options };
    delete cleanOptions.restaurants; // 移除餐廳資料避免鍵過大

    return JSON.stringify({
      answers: answers.sort(), // 排序確保一致性
      options: cleanOptions
    });
  }

  /**
   * 獲取快取項目
   * @param {string} key - 快取鍵
   * @returns {any|null} 快取值或null
   */
  get(key) {
    const item = this.cache.get(key);

    if (!item) return null;

    // 檢查是否過期
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    // 更新訪問時間（LRU）
    item.lastAccessed = Date.now();

    console.log(`Cache hit for key: ${key.substring(0, 50)}...`);
    return item.value;
  }

  /**
   * 設置快取項目
   * @param {string} key - 快取鍵
   * @param {any} value - 快取值
   * @param {number} ttl - 存活時間（毫秒）
   */
  set(key, value, ttl = this.defaultTTL) {
    // 如果快取已滿，移除最舊的項目
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    const now = Date.now();
    this.cache.set(key, {
      value,
      expiry: now + ttl,
      lastAccessed: now,
      created: now
    });

    console.log(`Cache set for key: ${key.substring(0, 50)}...`);
  }

  /**
   * 移除最舊的快取項目（LRU）
   */
  evictOldest() {
    let oldestKey = null;
    let oldestTime = Date.now();

    for (const [key, item] of this.cache.entries()) {
      if (item.lastAccessed < oldestTime) {
        oldestTime = item.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      console.log(`Evicted oldest cache entry: ${oldestKey.substring(0, 50)}...`);
    }
  }

  /**
   * 清除過期項目
   */
  cleanup() {
    const now = Date.now();
    let removedCount = 0;

    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      console.log(`Cleaned up ${removedCount} expired cache entries`);
    }
  }

  /**
   * 獲取快取統計
   */
  getStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;

    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        expiredEntries++;
      } else {
        validEntries++;
      }
    }

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      validEntries,
      expiredEntries,
      hitRate: this.hitCount / (this.hitCount + this.missCount) || 0
    };
  }

  /**
   * 清空快取
   */
  clear() {
    this.cache.clear();
    console.log('Cache cleared');
  }
}

// 單例實例
const recommendationCache = new SimpleCache(30, 3 * 60 * 1000); // 30個項目，3分鐘TTL

// 定期清理過期項目
setInterval(() => {
  recommendationCache.cleanup();
}, 60 * 1000); // 每分鐘清理一次

export { SimpleCache, recommendationCache };