# Buddies 模式流程文檔

## 概述
Buddies 模式是多人協作選餐廳的功能，允許房主創建房間並邀請朋友一起參與餐廳選擇過程。

## 完整流程

### 1. 房主創建房間

#### 步驟：
1. 用戶進入 Buddies 頁面
2. 輸入名稱
3. 點擊「建立新房間」按鈕

#### 系統處理：
```javascript
// 1. 調用 roomService.createRoom(userName)
// 2. 創建房間記錄，初始狀態為 'waiting'
// 3. 房主自動成為第一個成員
// 4. 設置本地狀態：
setRoomId(response.roomId);
setIsHost(true);
setJoined(true);
setPhase("waiting");

// 5. 載入成員列表
// 6. 確認房間狀態
// 7. 更新 URL 但不重新導航
```

#### 結果：
- 直接進入等待頁面
- 顯示房號和 QR 碼
- 房主名稱出現在成員列表中（標記為「主持人」）
- 顯示「開始答題」按鈕
- 顯示複製房號和分享連結按鈕

### 2. 其他用戶加入房間

#### 步驟：
1. 用戶進入 Buddies 頁面
2. 輸入名稱和房號
3. 點擊「加入房間」按鈕

   或者：
   - 掃描 QR 碼
   - 點擊分享連結

#### 系統處理：
```javascript
// 1. 調用 memberService.joinRoom()
// 2. 檢查房間是否存在且可加入
// 3. 添加用戶為房間成員
// 4. 載入現有問題集和推薦（如果有）
// 5. 獲取房間當前狀態
const roomStatusResult = await roomService.getRoomStatus(roomId);

// 6. 根據房間實際狀態設置 phase
if (currentStatus === 'questions') {
    setPhase('questions');
} else if (currentStatus === 'recommend') {
    setPhase('recommend');
} else if (currentStatus === 'completed') {
    setPhase('completed');
} else {
    setPhase('waiting'); // 默認狀態
}
```

#### 結果：
- 根據房間當前狀態進入對應頁面
- 如果房間在等待階段：進入等待頁面，看到房號和成員列表
- 如果房間已開始答題：直接進入答題環節
- 如果房間在推薦階段：進入餐廳推薦頁面
- 用戶名稱出現在所有成員的成員列表中

### 3. 房間等待階段

#### 特徵：
- **房間狀態**：`'waiting'`
- **頁面狀態**：`phase: 'waiting'`
- **顯示內容**：
  - 房號和 QR 碼
  - 複製房號按鈕
  - 分享連結按鈕
  - 目前成員列表
  - 房主顯示「開始答題」按鈕
  - 非房主顯示「等待主持人開始答題...」

#### 實時同步：
- 成員加入時，所有人的成員列表會即時更新
- 房主標識會正確顯示
- 當前用戶會標記為「（你）」

### 4. 開始答題

#### 觸發條件：
- **僅限房主**可以點擊「開始答題」按鈕
- 房間必須至少有 1 個成員

#### 系統處理：
```javascript
// 1. 生成問題集（基本問題 + 隨機趣味問題）
const buddiesBasicQuestions = [
    { question: "今天是一個人還是有朋友？", options: ["單人", "多人"] },
    { question: "想吃奢華點還是平價？", options: ["奢華美食", "平價美食"] },
    { question: "想吃正餐還是想喝飲料？", options: ["吃", "喝"] },
    { question: "吃一點還是吃飽？", options: ["吃一點", "吃飽"] },
    { question: "想吃辣的還是不辣？", options: ["辣", "不辣"] }
];

// 2. 隨機選擇 3 個趣味問題
const randomFun = allQuestions.sort(() => 0.5 - Math.random()).slice(0, 3);

// 3. 保存問題集到資料庫
await questionService.saveQuestions(roomId, combinedQuestions);

// 4. 更新房間狀態
await roomService.updateRoomStatus(roomId, 'questions');
```

#### 結果：
- 房間狀態變為 `'questions'`
- **所有成員**自動進入答題環節（透過房間狀態監聽器）
- 顯示問題滑動介面

### 5. 答題階段

#### 特徵：
- **房間狀態**：`'questions'`
- **頁面狀態**：`phase: 'questions'`
- **問題結構**：5 個基本問題 + 3 個趣味問題

#### 答題流程：
1. 每個成員獨立回答所有問題
2. 答案自動提交到資料庫
3. 系統檢查是否所有成員都已完成答題

#### 完成答題：
```javascript
// 當成員完成答題後
const result = await questionService.submitAnswers(roomId, userId, answers);

// 檢查是否所有成員都已提交答案
const allAnswers = await questionService.getAllAnswers(roomId);
const memberCount = members.length;

if (allAnswers.data.length >= memberCount) {
    // 所有人完成答題，進入下一階段
    setPhase("completed");
}
```

### 6. 推薦階段

#### 觸發條件：
- 所有成員完成答題
- 系統生成餐廳推薦

#### 特徵：
- **房間狀態**：`'recommend'`
- **頁面狀態**：`phase: 'recommend'`
- **功能**：
  - 餐廳滑動選擇
  - 投票機制
  - 實時顯示其他成員的選擇

### 7. 結果階段

#### 特徵：
- **房間狀態**：`'completed'`
- **頁面狀態**：`phase: 'completed'`
- **顯示內容**：
  - 最終選定的餐廳
  - 投票統計
  - 返回選項

## 關鍵技術實現

### 房間狀態管理
```javascript
// 房間狀態層級
'waiting' → 'questions' → 'recommend' → 'completed'

// 狀態監聽器
const cleanup = roomService.listenRoomStatus(roomId, (status) => {
    if (status === 'waiting') {
        setPhase('waiting');
    } else if (status === 'questions') {
        setPhase('questions');
    } else if (status === 'recommend') {
        setPhase('recommend');
    } else if (status === 'completed') {
        setPhase('completed');
    }
});
```

### 成員同步
```javascript
// 成員列表監聽器
const cleanup = memberService.listenRoomMembers(roomId, (membersObj) => {
    const membersList = Object.values(membersObj).map(member => ({
        id: member.id,
        name: member.name,
        isHost: member.isHost,
        uid: member.id
    }));
    setMembers(membersList);
});
```

### 問題集同步
```javascript
// 問題集監聽器
const cleanup = questionService.listenQuestions(roomId, (questions) => {
    setQuestions(questions);
    // 只載入數據，不改變 phase（由房間狀態監聽器控制）
});
```

## 重要修復記錄

### 問題：創建房間後自動跳出
**原因**：使用 `navigate()` 導致頁面重新載入
**解決方案**：
```javascript
// 修改前
navigate(`/buddies?roomId=${response.roomId}`, { replace: true });

// 修改後
window.history.replaceState({}, '', `/buddies?roomId=${response.roomId}`);
```

### 問題：未點擊開始按鈕就自動進入答題
**原因**：加入房間時直接設置 `setPhase('questions')`
**解決方案**：
```javascript
// 修改前：直接設置 phase
if (existingQuestions.length > 0) {
    setQuestions(existingQuestions);
    setPhase('questions'); // 錯誤的做法
}

// 修改後：只載入數據，讓房間狀態監聽器決定 phase
if (existingQuestions.length > 0) {
    setQuestions(existingQuestions);
    // 不設置 phase，由房間狀態監聽器控制
}

// 並且添加獲取真實房間狀態
const roomStatusResult = await roomService.getRoomStatus(roomId);
if (roomStatusResult.success) {
    // 根據實際狀態設置 phase
    setPhase(roomStatusResult.status);
}
```

### 問題：房間狀態監聽器不完整
**原因**：缺少對 'waiting' 狀態的處理
**解決方案**：
```javascript
// 添加完整的狀態處理
if (status === 'waiting') {
    setPhase('waiting');
} else if (status === 'questions') {
    setPhase('questions');
} else if (status === 'recommend') {
    setPhase('recommend');
} else if (status === 'completed') {
    setPhase('completed');
}
```

## 資料庫結構

### buddies_rooms 表
```sql
- id: 房間ID (主鍵)
- host_id: 房主用戶ID
- host_name: 房主名稱
- status: 房間狀態 ('waiting', 'questions', 'recommend', 'completed')
- created_at: 創建時間
- last_updated: 最後更新時間
```

### buddies_members 表
```sql
- room_id: 房間ID (外鍵)
- user_id: 用戶ID
- user_name: 用戶名稱
- is_host: 是否為房主
- joined_at: 加入時間
```

### buddies_questions 表
```sql
- room_id: 房間ID (主鍵)
- questions: 問題集 JSON
- created_at: 創建時間
```

### buddies_answers 表
```sql
- room_id: 房間ID
- user_id: 用戶ID
- answers: 答案 JSON
- question_texts: 問題文本 JSON
- question_sources: 問題來源 JSON
- submitted_at: 提交時間
```

## 用戶體驗要點

1. **狀態同步**：所有成員的介面會即時同步
2. **房主權限**：只有房主能控制流程進度
3. **斷線重連**：用戶重新進入房間會根據當前狀態顯示正確頁面
4. **錯誤處理**：房間不存在或已關閉時顯示適當錯誤訊息
5. **視覺回饋**：清楚標示房主身份和當前用戶
6. **分享功能**：支援 QR 碼掃描和連結分享

## 調試日誌

系統在關鍵節點會輸出詳細日誌：
- 房間創建和加入
- 狀態變化
- 成員列表更新
- 問題集載入
- 答題完成檢查

這些日誌有助於問題排查和流程驗證。