# 📋 SwiftTaste 數據生命週期管理實施指南

**版本**: v1.0
**日期**: 2025-11-05
**預估時間**: 2-3 小時（分階段執行）

---

## 執行摘要

本次優化實施完整的數據生命週期管理系統，包括：

✅ **已完成（無需手動操作）：**
1. 資料庫完整審查報告（`docs/DATABASE-AUDIT-REPORT.md`）
2. 4個 SQL 遷移檔案（準備就緒）
3. 2個核心服務（archiveService, buddiesEventService）
4. 數據管理文檔（DATA-LIFECYCLE-MANAGEMENT.md）

⏳ **需要執行（按順序）：**
1. 執行 SQL 遷移（30 分鐘）
2. 整合服務到現有代碼（60 分鐘）
3. 測試與驗證（30 分鐘）
4. 更新文檔（20 分鐘）

---

## 階段 1：執行 SQL 遷移（必須在 Supabase Dashboard 執行）

### 步驟 1.1：清理未使用的表

**檔案**: `database/migrations/2025-11-05-cleanup-unused-tables.sql`

**操作：**
1. 登入 Supabase Dashboard
2. 進入 SQL Editor
3. 複製貼上整個 SQL 檔案
4. 點擊 Run 執行

**預期結果：**
```
✅ 清理完成：所有未使用的表已成功刪除
```

**刪除的表：**
- `buddies_votes` （投票改用 JSONB）
- `buddies_questions` （問題改用 JSONB）

**風險評估：** 零風險（這些表從未使用）

---

### 步驟 1.2：創建歸檔表

**檔案**: `database/migrations/2025-11-05-create-buddies-archive.sql`

**操作：**
1. 在 SQL Editor 執行完整檔案
2. 觀察輸出訊息

**預期結果：**
```
✅ 歸檔系統創建成功
  ✓ buddies_rooms_archive 表已創建
  ✓ 自動歸檔觸發器已啟用
  ✓ 8 個索引已創建
  ✓ 2 個輔助函數已創建
  ✓ RLS 政策已設置
```

**新增內容：**
- `buddies_rooms_archive` 表（歸檔完成房間）
- `archive_completed_buddies_room()` 觸發器函數
- `manual_archive_completed_rooms()` 手動歸檔函數
- `get_archive_stats()` 統計函數

---

### 步驟 1.3：實施事件流系統

**檔案**: `database/migrations/2025-11-05-implement-buddies-events.sql`

**操作：**
1. 在 SQL Editor 執行完整檔案

**預期結果：**
```
✅ Buddies 事件系統創建成功
  ✓ buddies_events 表已創建
  ✓ 3 個觸發器已啟用
  ✓ 6+ 個輔助函數已創建
  ✓ 2 個分析視圖已創建
  ✓ 7 個索引已創建
  ✓ RLS 政策已設置（不可變日誌）
```

**新增內容：**
- `buddies_events` 表（完整實施）
- 自動事件記錄觸發器（房間創建、狀態變化、成員加入）
- `log_buddies_event()` 函數
- `buddies_room_timeline` 視圖
- `buddies_event_stats` 視圖
- `analyze_user_buddies_behavior()` 函數

---

### 步驟 1.4：設置自動清理系統

**檔案**: `database/migrations/2025-11-05-setup-auto-cleanup.sql`

**前置條件：** 必須先啟用 `pg_cron` 擴展

**操作：**
1. 在 Supabase Dashboard → Database → Extensions
2. 搜尋 `pg_cron` 並啟用
3. 回到 SQL Editor 執行遷移檔案

**預期結果：**
```
✅ 自動清理系統創建成功
✓ pg_cron 擴展：已啟用
✓ 定期任務：2 個已排程
  - daily-buddies-cleanup: 每天 03:00
  - weekly-cleanup-logs-cleanup: 每週一 04:00
✓ 清理函數：4 個已創建
✓ cleanup_logs 表：已創建
✓ 監控視圖：2 個已創建
```

**新增內容：**
- `cleanup_logs` 表（清理歷史記錄）
- `cleanup_completed_rooms()` - 清理24小時前的完成房間
- `cleanup_abandoned_rooms()` - 清理30天前的未完成房間
- `cleanup_old_events()` - 歸檔1年前的事件
- `run_daily_cleanup()` - 每日綜合清理
- `cleanup_health_status` 視圖
- `cleanup_history_stats` 視圖

**清理策略：**
- 完成的房間：**24小時後清理**（已歸檔）
- 未完成的房間：30天後清理（防止垃圾累積）
- 事件記錄：保留1年後歸檔

---

## 階段 2：整合服務到現有代碼

### 步驟 2.1：整合事件記錄到 Buddies 操作

需要修改的檔案：`src/components/BuddiesRoom.jsx`

**2.1.1 匯入服務**

在檔案頂部添加：

```javascript
import buddiesEventService from '../services/buddiesEventService.js';
import archiveService from '../services/archiveService.js';
```

**2.1.2 記錄房間開始事件**

找到 `handleStartQuestions()` 函數，在房間狀態更新後添加：

```javascript
async handleStartQuestions() {
  // ...現有邏輯...

  // 更新房間狀態為 'questions'
  await roomService.updateRoomStatus(roomId, 'questions');

  // 🆕 記錄房間開始事件
  await buddiesEventService.logRoomStarted(
    roomId,
    currentUser.id,
    questions.length
  );

  // ...其餘邏輯...
}
```

**2.1.3 記錄所有成員完成答題事件**

在檢測到所有成員完成時：

```javascript
// 檢查是否所有成員都完成答題
if (allMembersCompleted) {
  // 🆕 記錄事件
  await buddiesEventService.logAllMembersCompleted(
    roomId,
    members.length,
    questions.length
  );

  // 生成推薦...
}
```

**2.1.4 記錄推薦生成事件**

在 `generateBuddiesRecommendations()` 完成後：

```javascript
const recommendations = await generateBuddiesRecommendations(...);

// 🆕 記錄事件
await buddiesEventService.logRecommendationsGenerated(
  roomId,
  recommendations.length,
  'enhanced'
);
```

**2.1.5 記錄房間完成與歸檔**

修改 `completeBuddiesSession()` 函數：

```javascript
async completeBuddiesSession(finalRestaurant) {
  try {
    // ...現有邏輯：更新房間狀態為 'completed'...

    // 🆕 記錄房間完成事件
    await buddiesEventService.logRoomCompleted(
      roomId,
      finalRestaurant.id,
      finalRestaurant,
      members.length,
      totalVotes
    );

    // 🆕 自動歸檔房間
    const archiveResult = await archiveService.archiveCompletedRoom(roomId);

    if (archiveResult.success) {
      console.log('✅ 房間已自動歸檔');

      // 記錄歸檔事件
      await buddiesEventService.logRoomArchived(roomId, 'app_service');
    } else {
      console.warn('⚠️ 歸檔失敗（不影響主流程）:', archiveResult.message);
    }

    // ...其餘邏輯...
  } catch (error) {
    console.error('完成 session 失敗:', error);

    // 🆕 記錄錯誤事件
    await buddiesEventService.logError(
      roomId,
      currentUser?.id,
      'session_completion_error',
      error.message,
      error.stack
    );
  }
}
```

---

### 步驟 2.2：整合投票事件記錄

需要修改的檔案：`src/components/BuddiesRecommendation.jsx`

**2.2.1 匯入服務**

```javascript
import buddiesEventService from '../services/buddiesEventService.js';
```

**2.2.2 記錄投票事件**

找到投票處理函數，添加事件記錄：

```javascript
const handleVote = async (restaurantId, restaurantName) => {
  try {
    // ...現有投票邏輯...

    await voteService.voteForRestaurant(roomId, restaurantId, currentUser.id);

    // 🆕 記錄投票事件
    await buddiesEventService.logVoteCast(
      roomId,
      currentUser.id,
      restaurantId,
      restaurantName
    );

  } catch (error) {
    console.error('投票失敗:', error);
  }
};
```

**2.2.3 記錄最終選擇事件**

在最終確認餐廳時：

```javascript
const handleFinalSelection = async (restaurant) => {
  try {
    // ...現有邏輯...

    // 🆕 記錄最終選擇事件
    await buddiesEventService.logFinalSelectionMade(
      roomId,
      currentUser.id,
      restaurant.id,
      restaurant.name,
      restaurant.votes || 0
    );

  } catch (error) {
    console.error('最終選擇失敗:', error);
  }
};
```

---

### 步驟 2.3：整合成員事件記錄

需要修改的檔案：`src/services/supabaseService.js`

**2.3.1 匯入服務**

```javascript
import buddiesEventService from './buddiesEventService.js';
```

**2.3.2 記錄成員加入事件**

在 `memberService.addMember()` 函數中：

```javascript
async addMember(roomId, userId, username, isHost = false) {
  // ...現有邏輯...

  const { data, error } = await supabase
    .from('buddies_members')
    .insert({ ... })
    .select()
    .single();

  if (!error && data) {
    // 🆕 記錄成員加入事件
    await buddiesEventService.logMemberJoined(
      roomId,
      userId,
      username,
      isHost
    );
  }

  return { data, error };
}
```

**2.3.3 記錄成員離開事件**

在 `memberService.removeMember()` 函數中：

```javascript
async removeMember(roomId, userId, username) {
  // ...現有邏輯...

  const { error } = await supabase
    .from('buddies_members')
    .delete()
    .match({ room_id: roomId, user_id: userId });

  if (!error) {
    // 🆕 記錄成員離開事件
    await buddiesEventService.logMemberLeft(
      roomId,
      userId,
      username,
      'voluntary'
    );
  }

  return { error };
}
```

---

## 階段 3：測試與驗證

### 步驟 3.1：驗證資料庫遷移

在 Supabase SQL Editor 執行：

```sql
-- 1. 檢查歸檔表
SELECT * FROM buddies_rooms_archive LIMIT 5;

-- 2. 檢查事件表
SELECT * FROM buddies_events LIMIT 10;

-- 3. 檢查清理日誌
SELECT * FROM cleanup_logs ORDER BY created_at DESC LIMIT 5;

-- 4. 查看歸檔統計
SELECT * FROM get_archive_stats();

-- 5. 查看清理健康狀況
SELECT * FROM cleanup_health_status;

-- 6. 查看 pg_cron 任務
SELECT * FROM cron.job;
```

---

### 步驟 3.2：測試事件記錄

**手動測試流程：**

1. **創建測試房間**
   - 打開應用，創建 Buddies 房間
   - 檢查資料庫：`SELECT * FROM buddies_events WHERE event_type = 'room_created' ORDER BY created_at DESC LIMIT 1;`
   - 預期：應該看到一筆 `room_created` 事件

2. **成員加入測試**
   - 另一個用戶加入房間
   - 檢查：`SELECT * FROM buddies_events WHERE event_type = 'member_joined' AND room_id = 'YOUR_ROOM_ID';`
   - 預期：每個成員加入都有記錄

3. **答題測試**
   - 開始答題，所有成員完成
   - 檢查：`SELECT * FROM buddies_events WHERE room_id = 'YOUR_ROOM_ID' AND event_type IN ('room_started', 'question_answered', 'all_members_completed');`
   - 預期：看到完整的答題事件流

4. **投票測試**
   - 對餐廳進行投票
   - 檢查：`SELECT * FROM buddies_events WHERE event_type = 'vote_cast' AND room_id = 'YOUR_ROOM_ID';`
   - 預期：每次投票都有記錄

5. **房間完成測試**
   - 做出最終選擇，完成房間
   - 檢查歸檔：`SELECT * FROM buddies_rooms_archive WHERE id = 'YOUR_ROOM_ID';`
   - 檢查事件：`SELECT * FROM buddies_events WHERE event_type IN ('room_completed', 'room_archived') AND room_id = 'YOUR_ROOM_ID';`
   - 預期：房間已歸檔，事件已記錄

---

### 步驟 3.3：測試自動清理

**方法 A：手動觸發立即清理**

```sql
-- 執行立即清理
SELECT manual_cleanup_now();

-- 查看結果
SELECT * FROM cleanup_logs ORDER BY created_at DESC LIMIT 1;
```

**方法 B：修改房間完成時間測試**

```sql
-- 1. 創建一個測試房間並完成
-- 2. 手動修改完成時間為 25 小時前
UPDATE buddies_rooms
SET completed_at = now() - interval '25 hours'
WHERE room_code = 'YOUR_TEST_ROOM_CODE';

-- 3. 觸發清理
SELECT cleanup_completed_rooms();

-- 4. 驗證房間已刪除
SELECT * FROM buddies_rooms WHERE room_code = 'YOUR_TEST_ROOM_CODE';
-- 預期：找不到（已清理）

-- 5. 驗證歸檔存在
SELECT * FROM buddies_rooms_archive WHERE room_code = 'YOUR_TEST_ROOM_CODE';
-- 預期：仍然存在（已歸檔）
```

---

### 步驟 3.4：監控清理任務執行

```sql
-- 查看 pg_cron 執行歷史
SELECT
  jobid,
  runid,
  job_pid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 10;
```

---

## 階段 4：數據匯出功能（防止 Supabase 空間不足）

### 步驟 4.1：創建匯出腳本

**檔案**: `scripts/export-archive-data.js`

```javascript
/**
 * 匯出歸檔數據到本地檔案
 *
 * 用途：防止 Supabase 存儲空間不足
 * 執行：node scripts/export-archive-data.js
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function exportArchiveData() {
  try {
    console.log('🚀 開始匯出歸檔數據...');

    // 1. 匯出 buddies_rooms_archive
    const { data: archives, error: archiveError } = await supabase
      .from('buddies_rooms_archive')
      .select('*')
      .order('archived_at', { ascending: true });

    if (archiveError) throw archiveError;

    // 2. 匯出 buddies_events
    const { data: events, error: eventsError } = await supabase
      .from('buddies_events')
      .select('*')
      .order('created_at', { ascending: true });

    if (eventsError) throw eventsError;

    // 3. 生成檔名
    const timestamp = new Date().toISOString().split('T')[0];
    const archiveFile = `exports/buddies_rooms_archive_${timestamp}.json`;
    const eventsFile = `exports/buddies_events_${timestamp}.json`;

    // 4. 確保 exports 目錄存在
    await fs.mkdir('exports', { recursive: true });

    // 5. 寫入檔案
    await fs.writeFile(archiveFile, JSON.stringify(archives, null, 2));
    await fs.writeFile(eventsFile, JSON.stringify(events, null, 2));

    console.log('✅ 匯出完成！');
    console.log(`  📁 ${archiveFile} (${archives.length} records)`);
    console.log(`  📁 ${eventsFile} (${events.length} records)`);

    // 6. 生成 CSV（可選）
    const archiveCsv = convertToCSV(archives);
    const archiveCsvFile = `exports/buddies_rooms_archive_${timestamp}.csv`;
    await fs.writeFile(archiveCsvFile, archiveCsv);

    console.log(`  📁 ${archiveCsvFile}`);

  } catch (error) {
    console.error('❌ 匯出失敗:', error);
    process.exit(1);
  }
}

function convertToCSV(data) {
  if (!data || data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const rows = data.map(row =>
    headers.map(header => {
      const value = row[header];
      if (value === null) return '';
      if (typeof value === 'object') return JSON.stringify(value);
      return value;
    }).join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

exportArchiveData();
```

**使用方式：**

```bash
# 定期匯出（例如每月一次）
node scripts/export-archive-data.js

# 可以設置 cron job 自動執行
# 0 0 1 * * node /path/to/scripts/export-archive-data.js
```

---

## 階段 5：更新文檔

### 步驟 5.1：更新 DATABASE-SCHEMA.md

需要修改的內容：

1. **移除未使用的表**：
   - 刪除 `buddies_votes` 章節
   - 刪除 `buddies_questions` 章節

2. **修正表名錯誤**：
   - 將 `swifttaste_history` 和 `selection_history` 合併為 `user_selection_history`

3. **新增歸檔表**：
   - 新增 `buddies_rooms_archive` 章節
   - 說明用途：「歸檔已完成的房間，保留完整數據供分析」

4. **更新 buddies_events 章節**：
   - 修改為「已實施」
   - 列出支援的事件類型
   - 說明自動觸發器

5. **新增清理系統章節**：
   - 說明自動清理機制
   - 列出清理策略
   - 提供監控方法

---

### 步驟 5.2：更新 CLAUDE.md

在 **Database Operations** 章節添加：

```markdown
**數據生命週期管理：**
- `SELECT * FROM cleanup_health_status;` - 查看清理系統健康狀況
- `SELECT manual_cleanup_now();` - 手動觸發立即清理
- `SELECT * FROM get_archive_stats();` - 查看歸檔統計
- `node scripts/export-archive-data.js` - 匯出歸檔數據到本地
```

---

### 步驟 5.3：更新 README.md

在 **Features** 章節添加：

```markdown
**數據生命週期管理** ⭐ NEW
- 自動歸檔已完成的 Buddies 房間
- 每日自動清理過期數據（24小時）
- 完整事件流記錄供審計分析
- 數據匯出功能防止空間不足
```

---

## 監控與維護

### 日常監控查詢

```sql
-- 1. 檢查待清理數據
SELECT * FROM cleanup_health_status;

-- 2. 查看最近的清理歷史
SELECT * FROM cleanup_history_stats
WHERE cleanup_date >= CURRENT_DATE - interval '7 days';

-- 3. 查看歸檔統計
SELECT * FROM get_archive_stats();

-- 4. 檢查 pg_cron 任務狀態
SELECT jobname, schedule, active, jobid
FROM cron.job;

-- 5. 查看最近的清理執行
SELECT *
FROM cron.job_run_details
WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname LIKE '%cleanup%')
ORDER BY start_time DESC
LIMIT 10;
```

---

### 警報條件

設置以下監控警報：

1. **待清理房間過多**（> 100個超過72小時）
   ```sql
   SELECT COUNT(*) FROM buddies_rooms
   WHERE status = 'completed'
     AND completed_at < now() - interval '72 hours';
   ```

2. **清理任務連續失敗**（> 3天）
   ```sql
   SELECT COUNT(*) FROM cleanup_logs
   WHERE status = 'failed'
     AND created_at >= now() - interval '3 days';
   ```

3. **資料庫大小接近限制**（> 7GB，免費層8GB）
   ```sql
   SELECT pg_size_pretty(pg_database_size('postgres'));
   ```

---

## 問題排查

### 問題 1：清理任務未執行

**檢查：**
```sql
SELECT * FROM cron.job WHERE jobname = 'daily-buddies-cleanup';
```

**解決方案：**
```sql
-- 重新排程
SELECT cron.unschedule('daily-buddies-cleanup');
SELECT cron.schedule('daily-buddies-cleanup', '0 3 * * *', $$SELECT run_daily_cleanup();$$);
```

---

### 問題 2：歸檔失敗

**檢查：**
```sql
SELECT * FROM cleanup_logs
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT 5;
```

**手動歸檔：**
```sql
SELECT manual_archive_completed_rooms(24);
```

---

### 問題 3：事件未記錄

**檢查：**
1. 確認 `buddies_events` 表存在
2. 確認觸發器已啟用
3. 檢查應用層事件記錄代碼

**驗證觸發器：**
```sql
SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_name LIKE '%event%';
```

---

## 完整實施檢查清單

### ✅ 資料庫遷移
- [ ] 執行 `2025-11-05-cleanup-unused-tables.sql`
- [ ] 執行 `2025-11-05-create-buddies-archive.sql`
- [ ] 執行 `2025-11-05-implement-buddies-events.sql`
- [ ] 啟用 `pg_cron` 擴展
- [ ] 執行 `2025-11-05-setup-auto-cleanup.sql`

### ✅ 代碼整合
- [ ] 整合事件記錄到 BuddiesRoom.jsx
- [ ] 整合投票事件到 BuddiesRecommendation.jsx
- [ ] 整合成員事件到 supabaseService.js
- [ ] 整合歸檔到房間完成流程

### ✅ 測試驗證
- [ ] 創建測試房間
- [ ] 驗證事件記錄
- [ ] 測試自動歸檔
- [ ] 測試手動清理
- [ ] 檢查 pg_cron 任務

### ✅ 數據匯出
- [ ] 創建 export-archive-data.js 腳本
- [ ] 測試匯出功能
- [ ] 設置定期匯出計劃

### ✅ 文檔更新
- [ ] 更新 DATABASE-SCHEMA.md
- [ ] 更新 CLAUDE.md
- [ ] 更新 README.md
- [ ] 完成實施記錄

---

## 後續優化建議

1. **建立分析儀表板**（優先級：中）
   - 使用 Metabase 或 Grafana 視覺化數據
   - 監控房間完成率、用戶參與度等

2. **統一互動記錄表**（優先級：低）
   - 合併 swifttaste_interactions, buddies_interactions, user_selection_history
   - 簡化查詢邏輯

3. **實施完整 CRUD for fun_questions**（優先級：低）
   - Admin 面板新增問題管理功能
   - 支援動態新增/編輯趣味問題

---

**實施完成後，請執行完整的煙霧測試，確保所有功能正常運作！**
