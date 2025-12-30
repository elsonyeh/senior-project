# SwiftTaste 資料庫定期清理指南

## 概述
本文檔說明 SwiftTaste 系統中需要定期清理的資料項目，以維持資料庫效能和資料品質。

---

## 📋 清理項目清單

### 1. 未完成的選擇會話 (user_selection_history)

**問題描述**：
- 用戶中途離開導致大量未完成的會話記錄（`completed_at` 為 null）
- 這些記錄不會顯示在用戶介面，但會占用資料庫空間

**清理頻率**：每週一次

**清理條件**：
```sql
DELETE FROM user_selection_history
WHERE completed_at IS NULL
  AND started_at < NOW() - INTERVAL '7 days';
```

**注意事項**：
- 保留最近 7 天的未完成記錄，以防用戶回來繼續
- 執行前先備份

---

### 2. 過期的 Buddies 房間 (buddies_rooms)

**問題描述**：
- 房間創建後如果沒有使用，會一直存在
- 舊的房間資料可能包含過期的推薦和投票記錄

**清理頻率**：每日一次

**清理條件**：
```sql
-- 刪除超過 24 小時且未完成投票的房間
DELETE FROM buddies_rooms
WHERE created_at < NOW() - INTERVAL '24 hours'
  AND status != 'completed';

-- 刪除超過 30 天的已完成房間
DELETE FROM buddies_rooms
WHERE created_at < NOW() - INTERVAL '30 days'
  AND status = 'completed';
```

**注意事項**：
- 先刪除關聯的 room_members、room_votes、room_recommendations
- 使用 CASCADE 刪除或手動清理關聯表

---

### 3. 孤立的房間成員記錄 (room_members)

**問題描述**：
- 房間被刪除後可能遺留成員記錄
- 用戶帳號被刪除後可能遺留成員記錄

**清理頻率**：每週一次

**清理條件**：
```sql
DELETE FROM room_members
WHERE room_id NOT IN (SELECT id FROM buddies_rooms);
```

---

### 4. 舊的互動記錄 (swifttaste_interactions)

**問題描述**：
- 每次滑動、收藏、最終選擇都會產生互動記錄
- 長時間累積會有大量資料

**清理頻率**：每月一次

**建議策略**：
- 保留最近 90 天的詳細記錄用於分析
- 90 天以前的記錄可以匯總後刪除

```sql
-- 匯總舊記錄（可選）
INSERT INTO interaction_summary (user_id, month, total_swipes, total_likes, total_sessions)
SELECT
  user_id,
  DATE_TRUNC('month', created_at) as month,
  COUNT(*) FILTER (WHERE interaction_type = 'swipe') as total_swipes,
  COUNT(*) FILTER (WHERE interaction_type = 'like') as total_likes,
  COUNT(DISTINCT session_id) as total_sessions
FROM swifttaste_interactions
WHERE created_at < NOW() - INTERVAL '90 days'
GROUP BY user_id, DATE_TRUNC('month', created_at);

-- 刪除舊記錄
DELETE FROM swifttaste_interactions
WHERE created_at < NOW() - INTERVAL '90 days';
```

---

### 5. 未使用的餐廳圖片 (restaurant_images)

**問題描述**：
- 餐廳更新時可能產生未使用的圖片記錄
- Supabase Storage 中的圖片可能也需要清理

**清理頻率**：每月一次

**清理步驟**：
1. 識別孤立的圖片記錄
```sql
SELECT ri.id, ri.image_url
FROM restaurant_images ri
LEFT JOIN restaurants r ON ri.restaurant_id = r.id
WHERE r.id IS NULL;
```

2. 手動確認後刪除
3. 清理 Supabase Storage 中對應的檔案

---

### 6. 過期的 localStorage 資料

**問題描述**：
- 前端 localStorage 可能累積過期資料
- savedRestaurants、dislikedRestaurants 等

**清理方式**：
- 前端定期檢查並清理（建議在用戶登入時）
- 檢查時間戳，刪除超過 30 天的本地資料

```javascript
// 在用戶登入時執行
const cleanupLocalStorage = () => {
  const keys = ['savedRestaurants', 'dislikedRestaurants', 'swifttaste_session_id'];
  keys.forEach(key => {
    const data = localStorage.getItem(key);
    if (data) {
      try {
        const parsed = JSON.parse(data);
        if (parsed.timestamp &&
            Date.now() - parsed.timestamp > 30 * 24 * 60 * 60 * 1000) {
          localStorage.removeItem(key);
        }
      } catch (e) {
        // 如果是舊格式沒有 timestamp，也清除
        localStorage.removeItem(key);
      }
    }
  });
};
```

---

## 🔄 自動化清理建議

### 使用 Supabase Cron Jobs

在 Supabase Dashboard > Database > Cron Jobs 中設置定期任務：

```sql
-- 每日凌晨 2:00 清理過期房間
SELECT cron.schedule(
  'cleanup-expired-rooms',
  '0 2 * * *',
  $$
  DELETE FROM buddies_rooms
  WHERE created_at < NOW() - INTERVAL '24 hours'
    AND status != 'completed';
  $$
);

-- 每週日凌晨 3:00 清理未完成會話
SELECT cron.schedule(
  'cleanup-incomplete-sessions',
  '0 3 * * 0',
  $$
  DELETE FROM user_selection_history
  WHERE completed_at IS NULL
    AND started_at < NOW() - INTERVAL '7 days';
  $$
);

-- 每月 1 號凌晨 4:00 清理舊互動記錄
SELECT cron.schedule(
  'cleanup-old-interactions',
  '0 4 1 * *',
  $$
  DELETE FROM swifttaste_interactions
  WHERE created_at < NOW() - INTERVAL '90 days';
  $$
);
```

---

## ⚠️ 注意事項

1. **備份優先**：執行任何大規模刪除前務必備份資料
2. **測試環境**：先在測試環境驗證清理腳本
3. **監控影響**：清理後監控系統效能和使用者回報
4. **保留政策**：根據法規要求調整資料保留時間
5. **通知用戶**：如果清理會影響用戶可見資料，需提前通知

---

## 📊 清理效果監控

建議追蹤以下指標：
- 資料庫大小變化
- 查詢效能變化
- 清理的記錄數量
- 用戶回報的問題

可在 Supabase Dashboard 中查看：
- Database > Disk Usage
- Database > Query Performance

---

## 🔧 故障排除

### 清理失敗
- 檢查外鍵約束
- 確認權限設定
- 查看錯誤日誌

### 誤刪資料
- 從備份恢復
- 檢查 Supabase Point-in-Time Recovery
- 聯繫資料庫管理員

---

**最後更新**：2025-12-21
**維護者**：SwiftTaste 開發團隊
