# Supabase Egress 优化方案

## 🚨 问题分析

### 当前状况
- **Egress**: 5.408 GB / 5 GB **(108%)** ❌ 已超限
- **Cached Egress**: 0.163 GB / 5 GB **(3%)** ⚠️ 缓存率极低
- **Monthly Active Users**: 3 MAU (非常少的用户却产生了大量流量)

### 主要原因

#### 1. **无分页的全量数据查询** 🔴 严重
**位置**: `src/services/restaurantService.js:15-69`

```javascript
async getRestaurants(filters = {}) {
  let query = supabase
    .from('restaurants')
    .select(`
      *,
      restaurant_images(
        image_url,
        alt_text,
        is_primary,
        display_order
      )
    `)
    .eq('is_active', true)
    .order('created_at', { ascending: false });
}
```

**问题**:
- 每次调用返回**所有活跃餐厅**（无分页）
- 同时加载**所有餐厅的所有图片**
- `select('*')` 返回所有字段，包括不需要的数据
- 这个函数在多个页面被调用：
  - SwiftTaste.jsx (首页加载)
  - MapPage.jsx (地图页面)
  - RestaurantManager.jsx (管理页面)
  - SwipeOnboarding.jsx (引导页面)

**流量估算**:
假设有 100 个餐厅，每个餐厅平均 2 张图片：
- 每个餐厅数据: ~2KB
- 每张图片 URL + metadata: ~0.5KB
- 单次查询: 100 × (2KB + 2 × 0.5KB) = **300KB**
- 如果用户刷新页面 10 次: **3MB**
- 如果 100 个用户: **300MB**

#### 2. **收藏清单的过度查询** 🟡 中等
**位置**: `src/services/userDataService.js:6-65`

```javascript
async getFavoriteLists(userId, userEmail = null) {
  const { data } = await supabase
    .from('user_favorite_lists')
    .select(`
      id, name, description, color, is_public, is_default,
      is_deletable, places_count, created_at, updated_at,
      favorite_list_places (
        id, restaurant_id, notes, added_at,
        restaurants (
          id, name, address, rating, latitude, longitude,
          category,
          restaurant_images (
            image_url, is_primary, display_order
          )
        )
      )
    `)
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });
}
```

**问题**:
- 深度嵌套查询：lists → places → restaurants → images
- 每次登录都会调用（SwiftTaste.jsx:91, BuddiesResultPage.jsx:32, MapPage.jsx:246）
- 如果用户有 50 个收藏餐厅，每个有 2 张图片 = 100 张图片 URL

#### 3. **缺少 CDN 缓存** 🟠 重要
- Cached Egress 只有 3%，说明大部分请求都是直接从数据库查询
- 没有设置适当的 cache-control headers
- 图片 URL 每次都重新获取

#### 4. **图片未使用缩略图** 🟠 重要
- 所有图片都是完整 URL，没有使用 Supabase 的图片转换功能
- 前端可能加载了完整大小的图片

---

## 🎯 优化方案

### 优先级 1: 立即实施（减少 80% 流量）

#### 1.1 添加分页到餐厅查询

**修改**: `src/services/restaurantService.js`

```javascript
async getRestaurants(filters = {}) {
  const {
    category,
    priceRange,
    minRating,
    limit = 20,      // 默认只返回 20 个
    offset = 0,      // 分页偏移量
    includeImages = true  // 是否包含图片
  } = filters;

  let query = supabase
    .from('restaurants')
    .select(`
      id,
      name,
      address,
      category,
      price_range,
      rating,
      latitude,
      longitude,
      tags,
      suggested_people,
      is_spicy
      ${includeImages ? `, restaurant_images!inner(image_url, is_primary, display_order)` : ''}
    `)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);  // 分页

  // 应用筛选...

  return processedData;
}
```

**减少流量**: 从 300KB → 60KB (80% 减少)

#### 1.2 优化收藏清单查询

**修改**: `src/services/userDataService.js`

```javascript
async getFavoriteLists(userId, userEmail = null, options = {}) {
  const { includeRestaurants = false } = options;

  // 基础查询 - 只获取清单信息
  let selectQuery = `
    id, name, description, color, is_public, is_default,
    is_deletable, places_count, created_at, updated_at
  `;

  // 只在需要时加载餐厅详情
  if (includeRestaurants) {
    selectQuery += `,
      favorite_list_places (
        id, restaurant_id, notes,
        restaurants (
          id, name, address, rating, category
        )
      )
    `;
  }

  const { data } = await supabase
    .from('user_favorite_lists')
    .select(selectQuery)
    .eq('user_id', userId)
    .order('is_default', { ascending: false });

  return { success: true, lists: data || [] };
}
```

**用法修改**:
```javascript
// SwiftTaste.jsx - 只需要清单ID
const listsResult = await userDataService.getFavoriteLists(
  userResult.user.id,
  userResult.user.email,
  { includeRestaurants: false }  // 不加载餐厅详情
);
```

**减少流量**: 从 100KB → 5KB (95% 减少)

#### 1.3 实施本地缓存策略

**新文件**: `src/utils/dataCache.js`

```javascript
class DataCache {
  constructor() {
    this.cache = new Map();
    this.cacheDuration = 5 * 60 * 1000; // 5分钟
  }

  set(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  get(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const isExpired = Date.now() - cached.timestamp > this.cacheDuration;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  clear() {
    this.cache.clear();
  }
}

export const restaurantCache = new DataCache();
```

**修改餐厅服务使用缓存**:
```javascript
import { restaurantCache } from '../utils/dataCache.js';

async getRestaurants(filters = {}) {
  const cacheKey = JSON.stringify(filters);
  const cached = restaurantCache.get(cacheKey);

  if (cached) {
    console.log('✅ 使用缓存数据');
    return cached;
  }

  // 原有查询逻辑...
  const data = await query;

  restaurantCache.set(cacheKey, data);
  return data;
}
```

**减少流量**: 减少 70-90% 重复查询

---

### 优先级 2: 短期实施（额外减少 10-15% 流量）

#### 2.1 启用 Supabase CDN 缓存

**在 Supabase Dashboard 设置**:
1. 进入 Project Settings → API
2. 确保启用了 PostgREST caching
3. 设置 Cache-Control headers:

```sql
-- 在 Supabase SQL Editor 执行
ALTER TABLE restaurants
  SET (
    fillfactor = 90,
    autovacuum_vacuum_scale_factor = 0.05
  );

-- 为静态数据启用缓存提示
COMMENT ON TABLE restaurants IS 'cache=300'; -- 5分钟缓存
```

#### 2.2 使用图片转换 API

**修改图片 URL 生成**:
```javascript
function getOptimizedImageUrl(originalUrl, options = {}) {
  const { width = 400, quality = 80 } = options;

  // Supabase Storage 支持图片转换
  if (originalUrl.includes('supabase.co/storage')) {
    return `${originalUrl}?width=${width}&quality=${quality}`;
  }

  return originalUrl;
}

// 使用
const thumbnailUrl = getOptimizedImageUrl(restaurant.primaryImage?.image_url, {
  width: 400,
  quality: 80
});
```

---

### 优先级 3: 长期优化（额外减少 5-10% 流量）

#### 3.1 实施 Service Worker 缓存

**新文件**: `public/sw.js`

```javascript
const CACHE_NAME = 'swifttaste-v1';
const API_CACHE_DURATION = 5 * 60 * 1000; // 5分钟

self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('supabase.co')) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request).then((response) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, response.clone());
            return response;
          });
        });
      })
    );
  }
});
```

#### 3.2 数据库视图优化

```sql
-- 创建优化的餐厅视图
CREATE OR REPLACE VIEW restaurants_with_primary_image AS
SELECT
  r.*,
  ri.image_url as primary_image_url
FROM restaurants r
LEFT JOIN LATERAL (
  SELECT image_url
  FROM restaurant_images
  WHERE restaurant_id = r.id
    AND is_primary = true
  LIMIT 1
) ri ON true
WHERE r.is_active = true;
```

---

## 📈 预期效果

### 实施优先级 1 后:
- **当前 Egress**: 5.4 GB/月
- **优化后 Egress**: ~0.8-1.2 GB/月
- **减少**: 77-85%
- **Cached Egress**: 从 3% 提升到 50-60%

### 实施全部优化后:
- **预计 Egress**: ~0.5-0.8 GB/月
- **减少**: 85-90%
- **免费计划**: 完全足够

---

## 🚀 实施步骤

### Week 1: 紧急修复
1. ✅ 为 `getRestaurants` 添加分页（limit: 20）
2. ✅ 优化 `getFavoriteLists` 查询
3. ✅ 实施基础缓存策略

### Week 2: 性能优化
4. 启用 Supabase CDN 缓存
5. 使用图片转换 API
6. 添加本地存储缓存

### Week 3: 长期优化
7. 实施 Service Worker
8. 创建数据库视图
9. 监控和调整

---

## 📊 监控指标

添加监控代码:

```javascript
// src/utils/egressMonitor.js
class EgressMonitor {
  constructor() {
    this.queryCount = 0;
    this.cacheHits = 0;
  }

  logQuery(bytes) {
    this.queryCount++;
    console.log(`📊 Query #${this.queryCount}: ${(bytes / 1024).toFixed(2)} KB`);
  }

  logCacheHit() {
    this.cacheHits++;
    console.log(`✅ Cache hit! Total: ${this.cacheHits}`);
  }

  getStats() {
    return {
      queries: this.queryCount,
      cacheHits: this.cacheHits,
      cacheRate: ((this.cacheHits / this.queryCount) * 100).toFixed(2) + '%'
    };
  }
}

export const egressMonitor = new EgressMonitor();
```

---

## ⚠️ 注意事项

1. **缓存失效**: 当餐厅数据更新时，需要清除相关缓存
2. **分页 UX**: 需要添加"加载更多"或无限滚动
3. **向后兼容**: 保留原有 API，添加新参数

---

## 🔍 进一步调查

运行这个查询来分析哪些表占用最多流量:

```sql
-- 在 Supabase SQL Editor 执行
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;
```

这将显示哪些表最大，帮助你了解数据分布。
