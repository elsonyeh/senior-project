# 🔴 啟用 Supabase Realtime 指南

## 方式一：透過 Supabase Dashboard（推薦）⭐

### 步驟 1：進入 Database Settings

1. 登入 [Supabase Dashboard](https://app.supabase.com/)
2. 選擇你的專案
3. 點擊左側選單的 **Database**
4. 點擊上方的 **Publications** 標籤

### 步驟 2：編輯 supabase_realtime Publication

1. 找到 `supabase_realtime` publication
2. 點擊 **Edit**（或右側的三個點 → Edit）

### 步驟 3：新增表格

在 Tables 列表中，勾選以下表格：

**新增的表格：**
- [ ] `buddies_interactions`
- [ ] `swifttaste_interactions`

**確認已有的表格（應該已經勾選）：**
- [x] `buddies_rooms`
- [x] `buddies_members`
- [x] `buddies_questions`
- [x] `buddies_answers`
- [x] `buddies_recommendations`
- [x] `buddies_votes`
- [x] `buddies_restaurant_votes`
- [x] `buddies_final_results`

### 步驟 4：儲存變更

點擊 **Save** 按鈕。

---

## 方式二：透過 SQL（快速）⚡

### 在 SQL Editor 中執行

```sql
-- 將新表加入 Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE buddies_interactions;
ALTER PUBLICATION supabase_realtime ADD TABLE swifttaste_interactions;

-- 驗證是否成功
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
AND tablename IN ('buddies_interactions', 'swifttaste_interactions');

-- 應該返回 2 行結果
```

---

## 驗證 Realtime 是否啟用

### SQL 驗證

```sql
-- 檢查所有 Realtime 表格
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- 檢查特定表格
SELECT tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
AND tablename LIKE '%interactions%';
```

### 前端測試

```javascript
// 測試 buddies_interactions Realtime
const channel = supabase
  .channel('test-buddies-interactions')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'buddies_interactions'
    },
    (payload) => {
      console.log('Buddies Interaction Change:', payload);
    }
  )
  .subscribe();

// 測試 swifttaste_interactions Realtime
const channel2 = supabase
  .channel('test-swifttaste-interactions')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'swifttaste_interactions'
    },
    (payload) => {
      console.log('SwiftTaste Interaction Change:', payload);
    }
  )
  .subscribe();

// 測試插入數據
await supabase.from('buddies_interactions').insert({
  room_id: 'test-room',
  user_id: 'test-user',
  restaurant_id: 'test-restaurant',
  action_type: 'view'
});

// 應該在 console 看到 'Buddies Interaction Change:' 訊息
```

---

## 方式三：使用遷移腳本

在 `buddies-schema-simplification-phase1.sql` 中已經包含了註釋的 SQL：

```sql
-- ==========================================
-- 第六步：啟用 Realtime
-- ==========================================

-- 將新表加入 Realtime 訂閱
-- 注意：這需要在 Supabase Dashboard 執行或使用 API
-- ALTER PUBLICATION supabase_realtime ADD TABLE buddies_interactions;
```

**取消註釋並執行：**

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE buddies_interactions;
ALTER PUBLICATION supabase_realtime ADD TABLE swifttaste_interactions;
```

---

## 常見問題

### Q1: 執行 SQL 時出現錯誤

**錯誤：** `relation "buddies_interactions" is already a member of publication "supabase_realtime"`

**解決方案：**
表格已經在 publication 中，無需再次添加。

```sql
-- 先移除再添加
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS buddies_interactions;
ALTER PUBLICATION supabase_realtime ADD TABLE buddies_interactions;
```

### Q2: Realtime 不工作

**檢查清單：**

1. ✅ 表格已加入 publication
   ```sql
   SELECT tablename FROM pg_publication_tables
   WHERE pubname = 'supabase_realtime'
   AND tablename = 'buddies_interactions';
   ```

2. ✅ RLS 政策正確
   ```sql
   SELECT tablename, policyname FROM pg_policies
   WHERE tablename = 'buddies_interactions';
   ```

3. ✅ 前端訂閱正確
   ```javascript
   // 檢查訂閱狀態
   console.log(channel.state); // 應該是 'subscribed'
   ```

4. ✅ Supabase URL 和 Key 正確
   ```javascript
   console.log(supabase.supabaseUrl);
   console.log(supabase.supabaseKey);
   ```

### Q3: 如何測試 Realtime 是否正常？

**快速測試腳本：**

```javascript
// 在瀏覽器 Console 執行
const testRealtime = async () => {
  console.log('🔴 開始測試 Realtime...');

  // 訂閱變更
  const channel = supabase
    .channel('realtime-test')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'buddies_interactions' },
      (payload) => {
        console.log('✅ Realtime 收到變更:', payload);
      }
    )
    .subscribe((status) => {
      console.log('📡 訂閱狀態:', status);
    });

  // 等待訂閱成功
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 插入測試數據
  console.log('📝 插入測試數據...');
  const { data, error } = await supabase
    .from('buddies_interactions')
    .insert({
      room_id: 'test-room-' + Date.now(),
      user_id: 'test-user',
      restaurant_id: 'test-restaurant',
      action_type: 'view'
    });

  if (error) {
    console.error('❌ 插入失敗:', error);
  } else {
    console.log('✅ 插入成功，等待 Realtime 通知...');
  }

  // 等待 5 秒觀察結果
  await new Promise(resolve => setTimeout(resolve, 5000));

  // 取消訂閱
  await channel.unsubscribe();
  console.log('🔴 測試結束');
};

// 執行測試
testRealtime();
```

**預期輸出：**
```
🔴 開始測試 Realtime...
📡 訂閱狀態: SUBSCRIBED
📝 插入測試數據...
✅ 插入成功，等待 Realtime 通知...
✅ Realtime 收到變更: { ... }
🔴 測試結束
```

---

## 完整啟用腳本（推薦使用）

創建一個新的 SQL 文件或直接在 SQL Editor 執行：

```sql
-- ==========================================
-- 啟用所有新表的 Realtime
-- ==========================================

-- 方式 1: 逐一添加（推薦，更清楚）
DO $$
BEGIN
  -- 添加 buddies_interactions
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE buddies_interactions;
    RAISE NOTICE '✅ buddies_interactions 已加入 Realtime';
  EXCEPTION
    WHEN duplicate_object THEN
      RAISE NOTICE '⚠️  buddies_interactions 已經在 Realtime 中';
  END;

  -- 添加 swifttaste_interactions
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE swifttaste_interactions;
    RAISE NOTICE '✅ swifttaste_interactions 已加入 Realtime';
  EXCEPTION
    WHEN duplicate_object THEN
      RAISE NOTICE '⚠️  swifttaste_interactions 已經在 Realtime 中';
  END;
END $$;

-- 驗證結果
SELECT tablename, schemaname
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
AND tablename IN ('buddies_interactions', 'swifttaste_interactions')
ORDER BY tablename;

-- 應該返回 2 行結果
```

---

## 快速參考

| 方式 | 優點 | 缺點 |
|-----|------|------|
| **Dashboard** | ✅ 視覺化操作<br>✅ 不會出錯 | ❌ 需要手動點擊 |
| **SQL** | ✅ 快速<br>✅ 可重複執行 | ⚠️ 需要檢查語法 |
| **遷移腳本** | ✅ 版本控制<br>✅ 可追蹤 | ⚠️ 需要更新腳本 |

**建議：** 使用 **SQL 方式**（方式二），執行完整啟用腳本。

---

## 執行順序

1. ✅ 執行資料庫遷移（創建表格）
2. ✅ **啟用 Realtime**（本文檔）← 你在這裡
3. ⏳ 更新前端代碼
4. ⏳ 測試驗證

---

**準備好了嗎？複製上方的「完整啟用腳本」到 SQL Editor 執行！** 🚀
