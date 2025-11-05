# 📊 SwiftTaste 數據生命週期管理方案

**文件版本**: v1.0
**制定日期**: 2025-11-05
**目的**: 在保持系統高效能的同時，完整保留數據供後續分析使用

---

## 問題背景

### 當前架構問題

```text
【設計】三層資料庫架構（DATABASE-SCHEMA.md 附錄）
├─ 實時層：buddies_rooms (JSONB)      ✅ 已實施
├─ 事件層：buddies_events              ❌ 未實施（表存在但無數據）
└─ 分析層：Views/Materialized Views   ❌ 未實施

【現況】所有數據在 buddies_rooms 主表
├─ votes (JSONB) - 投票數據
├─ recommendations (JSONB) - 推薦結果
├─ member_answers (JSONB) - 答題記錄
└─ final_restaurant_data - 最終選擇

【問題】
❌ 主表會無限增長（每個房間 ~10-50KB）
❌ 刪除過期房間 = 失去所有分析數據
❌ 查詢效能隨時間下降
```

### 數據保留需求

**必須保留的分析數據：**
1. **使用統計**
   - 每日/每週房間創建數
   - 完成率（completed vs. abandoned）
   - 平均參與人數
   - 決策時間分布

2. **決策行為**
   - 群體答題偏好（預算、餐期、辣度分布）
   - 投票模式（一致性 vs. 分歧）
   - 房主影響力分析

3. **餐廳數據**
   - 推薦頻率排行
   - 投票率（被推薦後獲得投票的比例）
   - 最終選中率
   - 跨時段熱門度變化

4. **用戶行為**
   - 個人偏好學習（未來功能）
   - 互動頻率分析
   - 群組決策參與度

---

## 解決方案架構

### Linus 準則

> "Bad programmers worry about the code. Good programmers worry about data structures."

**核心原則：**
1. ✅ 利用現有結構，不重新發明輪子
2. ✅ 熱數據（主表）輕量化，冷數據（事件表）永久化
3. ✅ 零破壞性，向後兼容
4. ✅ 最簡實現，拒絕過度設計

---

## 方案一：快速實施（推薦立即採用）

### 核心設計：房間完成快照 + 定期清理

```text
【數據流】
CREATE buddies_rooms
  ↓
UPDATE (votes, answers, recommendations) - 實時互動
  ↓
COMPLETE - 房間狀態變為 'completed'
  ↓
📸 記錄完整快照到 buddies_archive
  ↓
[7天後] 清理 buddies_rooms
  ↓
✅ 分析時查詢 buddies_archive（保留所有歷史）
```

### 實施步驟

#### 1. 創建歸檔表（完整快照）

```sql
-- 歸檔表：保留完成房間的完整數據
CREATE TABLE buddies_rooms_archive (
  id uuid PRIMARY KEY,
  room_code varchar(6),
  host_id uuid,
  status text,

  -- 核心數據快照
  members_data jsonb,          -- 成員列表
  member_answers jsonb,        -- 所有答題記錄
  recommendations jsonb,       -- 推薦結果
  votes jsonb,                 -- 投票統計
  final_restaurant_id text,    -- 最終選擇
  final_restaurant_data jsonb, -- 完整餐廳數據

  -- 統計數據（預計算，加速查詢）
  member_count integer,        -- 參與人數
  total_votes integer,         -- 總投票數
  decision_time_seconds integer, -- 決策耗時

  -- 時間戳
  created_at timestamptz,
  completed_at timestamptz,
  archived_at timestamptz DEFAULT now()
);

-- 索引：加速常見分析查詢
CREATE INDEX idx_archive_completed_at ON buddies_rooms_archive(completed_at);
CREATE INDEX idx_archive_final_restaurant ON buddies_rooms_archive(final_restaurant_id);
CREATE INDEX idx_archive_member_count ON buddies_rooms_archive(member_count);
```

#### 2. 自動歸檔觸發器（可選）

**選項 A：應用層處理（推薦）**

在房間完成時，調用歸檔函數：

```javascript
// src/services/supabaseService.js - 新增 archiveService
const archiveService = {
  /**
   * 歸檔完成的房間
   */
  async archiveCompletedRoom(roomId) {
    // 1. 獲取完整房間數據
    const { data: room } = await supabase
      .from('buddies_rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    if (!room || room.status !== 'completed') {
      throw new Error('房間不存在或未完成');
    }

    // 2. 計算統計數據
    const memberCount = room.members_data?.length || 0;
    const totalVotes = Object.values(room.votes || {})
      .reduce((sum, v) => sum + v.count, 0);
    const decisionTimeSeconds = room.completed_at && room.created_at
      ? Math.floor((new Date(room.completed_at) - new Date(room.created_at)) / 1000)
      : null;

    // 3. 插入歸檔表
    const { error } = await supabase
      .from('buddies_rooms_archive')
      .insert({
        ...room,
        member_count: memberCount,
        total_votes: totalVotes,
        decision_time_seconds: decisionTimeSeconds,
        archived_at: new Date().toISOString()
      });

    if (error) throw error;

    console.log(`✅ 房間 ${roomId} 已歸檔`);
  }
};
```

**整合到房間完成流程：**

```javascript
// src/components/BuddiesRoom.jsx - 修改 completeBuddiesSession()
async completeBuddiesSession(finalRestaurant) {
  // ...現有邏輯...

  // 🆕 新增：自動歸檔已完成的房間
  try {
    await archiveService.archiveCompletedRoom(roomId);
  } catch (error) {
    console.error('歸檔失敗（不影響主流程）:', error);
  }
}
```

**選項 B：資料庫觸發器（自動化）**

```sql
-- 當房間狀態變為 'completed' 時自動歸檔
CREATE OR REPLACE FUNCTION archive_completed_room()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    INSERT INTO buddies_rooms_archive (
      id, room_code, host_id, status,
      members_data, member_answers, recommendations, votes,
      final_restaurant_id, final_restaurant_data,
      member_count, total_votes, decision_time_seconds,
      created_at, completed_at
    ) VALUES (
      NEW.id, NEW.room_code, NEW.host_id, NEW.status,
      NEW.members_data, NEW.member_answers, NEW.recommendations, NEW.votes,
      NEW.final_restaurant_id, NEW.final_restaurant_data,
      jsonb_array_length(COALESCE(NEW.members_data, '[]'::jsonb)),
      (SELECT SUM((value->>'count')::int) FROM jsonb_each(COALESCE(NEW.votes, '{}'::jsonb))),
      EXTRACT(EPOCH FROM (NEW.completed_at - NEW.created_at))::integer,
      NEW.created_at, NEW.completed_at
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_archive_completed_room
AFTER UPDATE ON buddies_rooms
FOR EACH ROW
EXECUTE FUNCTION archive_completed_room();
```

#### 3. 定期清理過期房間

**使用 Supabase pg_cron 擴展**

```sql
-- 啟用 pg_cron 擴展
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 每天凌晨 3:00 清理 7 天前完成的房間
SELECT cron.schedule(
  'cleanup-old-buddies-rooms',
  '0 3 * * *',  -- 每天 03:00
  $$
    -- 只刪除已歸檔的房間（雙重保險）
    DELETE FROM buddies_rooms
    WHERE status = 'completed'
      AND completed_at < now() - interval '7 days'
      AND id IN (SELECT id FROM buddies_rooms_archive);
  $$
);

-- 清理超過 30 天的未完成房間（防止垃圾累積）
SELECT cron.schedule(
  'cleanup-abandoned-rooms',
  '0 4 * * *',  -- 每天 04:00
  $$
    DELETE FROM buddies_rooms
    WHERE status != 'completed'
      AND created_at < now() - interval '30 days';
  $$
);
```

**查看清理任務狀態：**

```sql
-- 查看已排程的任務
SELECT * FROM cron.job;

-- 查看執行歷史
SELECT * FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 10;

-- 取消任務
SELECT cron.unschedule('cleanup-old-buddies-rooms');
```

---

### 分析查詢範例

有了 `buddies_rooms_archive` 後，常見分析查詢：

```sql
-- 1. 每日房間創建/完成統計
SELECT
  DATE(created_at) as date,
  COUNT(*) as total_rooms,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_rooms,
  ROUND(AVG(member_count), 2) as avg_members,
  ROUND(AVG(decision_time_seconds) / 60.0, 1) as avg_decision_minutes
FROM buddies_rooms_archive
WHERE created_at >= now() - interval '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- 2. 最受歡迎的餐廳（最終選擇排行）
SELECT
  final_restaurant_data->>'name' as restaurant_name,
  final_restaurant_id,
  COUNT(*) as times_chosen,
  ROUND(AVG(member_count), 1) as avg_group_size
FROM buddies_rooms_archive
WHERE final_restaurant_id IS NOT NULL
GROUP BY final_restaurant_id, final_restaurant_data->>'name'
ORDER BY times_chosen DESC
LIMIT 20;

-- 3. 投票一致性分析
SELECT
  CASE
    WHEN total_votes = member_count THEN '完全一致'
    WHEN total_votes::float / member_count > 0.7 THEN '高度一致'
    WHEN total_votes::float / member_count > 0.4 THEN '中度分歧'
    ELSE '嚴重分歧'
  END as consensus_level,
  COUNT(*) as room_count,
  ROUND(AVG(decision_time_seconds) / 60.0, 1) as avg_decision_minutes
FROM buddies_rooms_archive
WHERE member_count > 1
GROUP BY consensus_level
ORDER BY room_count DESC;

-- 4. 用餐偏好趨勢（從答題記錄分析）
SELECT
  member_answers->'price'->>'answer' as price_preference,
  member_answers->'mealType'->>'answer' as meal_type,
  COUNT(*) as room_count
FROM buddies_rooms_archive,
  jsonb_array_elements(member_answers) as member_answers
WHERE member_answers IS NOT NULL
GROUP BY price_preference, meal_type
ORDER BY room_count DESC
LIMIT 10;
```

---

## 方案二：完整事件驅動架構（長期目標）

### 設計：實施 buddies_events 事件流

如果未來需要更精細的行為追蹤（如即時答題過程、投票變化軌跡），實施完整事件記錄：

```sql
-- buddies_events 表已存在，補充實施邏輯

-- 事件類型定義
CREATE TYPE buddies_event_type AS ENUM (
  'room_created',        -- 房間創建
  'member_joined',       -- 成員加入
  'member_left',         -- 成員離開
  'question_answered',   -- 答題
  'recommendations_generated', -- 生成推薦
  'vote_cast',           -- 投票
  'vote_changed',        -- 修改投票
  'room_completed',      -- 房間完成（含最終快照）
  'room_abandoned'       -- 房間放棄
);

-- 在關鍵操作插入事件
-- 範例：投票事件
INSERT INTO buddies_events (
  room_id,
  event_type,
  user_id,
  event_data,
  created_at
) VALUES (
  'ROOM123',
  'vote_cast',
  'user-uuid',
  jsonb_build_object(
    'restaurant_id', 'rest-123',
    'restaurant_name', '某餐廳',
    'is_host', false
  ),
  now()
);
```

**優點：**
- 完整審計追蹤
- 可重放決策過程
- 支援更複雜的行為分析

**缺點：**
- 需要修改多處代碼
- 寫入量增加（每個操作都記錄）
- 實施成本較高

**建議：** 先實施方案一，當分析需求確認後再升級到方案二。

---

## 實施時間表

| 階段 | 任務 | 工作量 | 優先級 |
|------|------|--------|--------|
| **階段 1** | 創建 buddies_rooms_archive 表 | 30 分鐘 | 🔴 高 |
| **階段 1** | 實施應用層歸檔函數 | 1 小時 | 🔴 高 |
| **階段 1** | 整合到房間完成流程 | 30 分鐘 | 🔴 高 |
| **階段 1** | 設置 pg_cron 清理任務 | 30 分鐘 | 🟡 中 |
| **階段 1** | 測試歸檔與清理流程 | 1 小時 | 🔴 高 |
| **階段 2** | 編寫分析查詢儀表板 | 4 小時 | 🟢 低 |
| **階段 3** | 實施完整事件流（如需要） | 8 小時 | 🟢 低 |

**總計（階段 1）：** ~3.5 小時即可完成基礎數據生命週期管理

---

## 風險與注意事項

### 向後兼容性 ✅

- 歸檔邏輯不影響現有功能
- 清理任務只刪除已歸檔的數據
- 失敗時不中斷主流程

### 存儲空間預估

**假設：**
- 平均每個房間快照 ~20KB
- 每日完成 100 個房間

**年度存儲：**
- 100 rooms/day × 365 days × 20KB ≈ **730 MB/年**
- Supabase 免費層：8GB 數據庫空間
- **可支撐 ~10 年歷史數據**

### 性能影響

- ✅ 歸檔操作在房間完成後異步執行，不阻塞用戶
- ✅ 清理任務在凌晨低峰時段運行
- ✅ 主表查詢效能提升（數據量保持穩定）

---

## 監控與維護

### 健康檢查腳本

```javascript
// scripts/check-archive-health.js
async function checkArchiveHealth() {
  // 1. 檢查歸檔覆蓋率
  const { data: completedRooms } = await supabase
    .from('buddies_rooms')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'completed')
    .lt('completed_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));

  const { data: archivedRooms } = await supabase
    .from('buddies_rooms_archive')
    .select('id', { count: 'exact', head: true });

  console.log('📊 歸檔健康狀況：');
  console.log(`  - 已歸檔房間：${archivedRooms.length}`);
  console.log(`  - 待清理房間（>7天）：${completedRooms.length}`);

  // 2. 檢查 pg_cron 任務狀態
  const { data: cronJobs } = await supabase.rpc('get_cron_jobs');
  console.log(`  - 定期任務：${cronJobs.filter(j => j.active).length} 個啟用`);
}
```

### 警報觸發條件

- ⚠️ 超過 1000 個已完成房間未清理（清理任務失敗）
- ⚠️ 歸檔表寫入失敗率 > 5%
- ⚠️ 主表大小超過 100MB（可能需要手動介入）

---

## 附錄：Linus 式設計原則檢驗

### ✅ 好品味（Good Taste）

- 沒有特殊情況：歸檔邏輯統一，無邊界條件
- 數據結構清晰：主表 = 熱數據，歸檔表 = 冷數據

### ✅ 向後兼容（Never Break Userspace）

- 現有功能零影響
- 歸檔失敗不阻斷用戶流程
- 可隨時回滾（停用 cron 任務即可）

### ✅ 實用主義（Pragmatism）

- 解決真實問題（數據累積）
- 使用現成工具（pg_cron, JSONB）
- 避免過度設計（快照 > 完整事件流）

### ✅ 簡潔性（Simplicity）

- 核心邏輯：複製 → 刪除
- 無需複雜協調
- 3.5 小時即可實施

---

**制定者**: Claude Code (Linus Mode)
**審核狀態**: 待用戶確認
**下一步**: 選擇實施階段，創建 SQL 遷移檔案

