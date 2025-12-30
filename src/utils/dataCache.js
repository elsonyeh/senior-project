/**
 * 数据缓存工具
 * 用于减少 Supabase egress 流量
 */

class DataCache {
  constructor(cacheDuration = 5 * 60 * 1000) {  // 默认 5 分钟
    this.cache = new Map();
    this.cacheDuration = cacheDuration;
  }

  /**
   * 存储数据到缓存
   * @param {string} key - 缓存键
   * @param {*} data - 要缓存的数据
   */
  set(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
    console.log(`💾 缓存已保存: ${key}`);
  }

  /**
   * 从缓存获取数据
   * @param {string} key - 缓存键
   * @returns {*} 缓存的数据，如果过期或不存在则返回 null
   */
  get(key) {
    const cached = this.cache.get(key);
    if (!cached) {
      console.log(`❌ 缓存未命中: ${key}`);
      return null;
    }

    const isExpired = Date.now() - cached.timestamp > this.cacheDuration;
    if (isExpired) {
      this.cache.delete(key);
      console.log(`⏰ 缓存已过期: ${key}`);
      return null;
    }

    console.log(`✅ 缓存命中: ${key}`);
    return cached.data;
  }

  /**
   * 清除指定键的缓存
   * @param {string} key - 缓存键
   */
  delete(key) {
    this.cache.delete(key);
    console.log(`🗑️  缓存已删除: ${key}`);
  }

  /**
   * 清除所有缓存
   */
  clear() {
    this.cache.clear();
    console.log(`🧹 所有缓存已清除`);
  }

  /**
   * 获取缓存统计信息
   */
  getStats() {
    const now = Date.now();
    let validCount = 0;
    let expiredCount = 0;

    this.cache.forEach((value) => {
      const isExpired = now - value.timestamp > this.cacheDuration;
      if (isExpired) {
        expiredCount++;
      } else {
        validCount++;
      }
    });

    return {
      total: this.cache.size,
      valid: validCount,
      expired: expiredCount
    };
  }
}

// 创建单例实例
export const restaurantCache = new DataCache(5 * 60 * 1000);  // 5分钟
export const userDataCache = new DataCache(3 * 60 * 1000);    // 3分钟

// 默认导出
export default DataCache;
