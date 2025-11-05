# SwiftTaste 文檔索引

**最後更新：** 2025-11-05

---

## 📁 文檔結構

```
docs/
├── README.md                    (本文檔)
├── CLAUDE.md                    (Claude Code 指引)
├── DOCUMENTATION-SUMMARY.md     (文檔總覽)
│
├── architecture/                (系統架構與資料庫)
│   ├── SYSTEM-ARCHITECTURE.md
│   ├── ALGORITHM-SPECIFICATION.md
│   ├── THREE-TIER-ARCHITECTURE-FINAL.md
│   ├── FEATURES-AND-ARCHITECTURE.md
│   └── DATABASE-SCHEMA.md
│
├── logic/                       (推薦邏輯與流程)
│   ├── RECOMMENDATION-LOGIC-DOCUMENTATION.md
│   ├── FUN-QUESTION-SCORING-LOGIC.md
│   └── BUDDIES-FLOW-DOCUMENTATION.md
│
├── design/                      (設計規範)
│   ├── COLOR-GUIDE.md
│   ├── IMAGE-UPLOAD-FEATURES.md
│   └── SECURITY.md
│
├── migration-2025-11-05/        (資料庫遷移專案)
│   ├── DATABASE-OPTIMIZATION-INDEX.md
│   ├── DATABASE-AUDIT-REPORT.md
│   ├── DATA-LIFECYCLE-MANAGEMENT.md
│   ├── IMPLEMENTATION-GUIDE.md
│   ├── OPTIMIZATION-SUMMARY.md
│   ├── DATABASE-SCHEMA-UPDATE-GUIDE.md
│   └── READY-TO-IMPLEMENT.md
│
└── implementation-guides/       (過往實施指南)
    ├── buddies-interaction-integration-guide.md
    ├── complete-data-tracking-implementation-guide.md
    ├── unified-data-architecture-design.md
    └── enable-realtime-guide.md
```

---

## 🎯 快速導航

### 新手入門

**了解系統架構：**
1. [`architecture/SYSTEM-ARCHITECTURE.md`](./architecture/SYSTEM-ARCHITECTURE.md) - 系統整體架構
2. [`architecture/FEATURES-AND-ARCHITECTURE.md`](./architecture/FEATURES-AND-ARCHITECTURE.md) - 功能與架構概覽
3. [`architecture/DATABASE-SCHEMA.md`](./architecture/DATABASE-SCHEMA.md) - 資料庫結構

**了解推薦邏輯：**
1. [`logic/RECOMMENDATION-LOGIC-DOCUMENTATION.md`](./logic/RECOMMENDATION-LOGIC-DOCUMENTATION.md) - 推薦演算法
2. [`architecture/ALGORITHM-SPECIFICATION.md`](./architecture/ALGORITHM-SPECIFICATION.md) - 演算法規格

---

### 開發者

**設計規範：**
- [`design/COLOR-GUIDE.md`](./design/COLOR-GUIDE.md) - 顏色使用指南
- [`design/SECURITY.md`](./design/SECURITY.md) - 安全規範
- [`design/IMAGE-UPLOAD-FEATURES.md`](./design/IMAGE-UPLOAD-FEATURES.md) - 圖片上傳功能

**邏輯實作：**
- [`logic/RECOMMENDATION-LOGIC-DOCUMENTATION.md`](./logic/RECOMMENDATION-LOGIC-DOCUMENTATION.md)
- [`logic/FUN-QUESTION-SCORING-LOGIC.md`](./logic/FUN-QUESTION-SCORING-LOGIC.md)
- [`logic/BUDDIES-FLOW-DOCUMENTATION.md`](./logic/BUDDIES-FLOW-DOCUMENTATION.md)

---

### 🚀 執行資料庫遷移

**本次遷移（2025-11-05）：**

👉 **從這裡開始：** [`migration-2025-11-05/READY-TO-IMPLEMENT.md`](./migration-2025-11-05/READY-TO-IMPLEMENT.md)

**或者查看完整指南：**
- [`migration-2025-11-05/IMPLEMENTATION-GUIDE.md`](./migration-2025-11-05/IMPLEMENTATION-GUIDE.md) - 詳細實施步驟
- [`migration-2025-11-05/DATABASE-OPTIMIZATION-INDEX.md`](./migration-2025-11-05/DATABASE-OPTIMIZATION-INDEX.md) - 遷移文檔索引

---

## 📚 分類說明

### 📐 architecture/ - 系統架構與資料庫

包含系統整體架構、演算法規格、資料庫結構等核心設計文檔。

**重要文檔：**
- `SYSTEM-ARCHITECTURE.md` - 系統整體架構設計
- `ALGORITHM-SPECIFICATION.md` - 推薦演算法的論文級規格文檔
- `DATABASE-SCHEMA.md` - 完整資料庫結構定義
- `THREE-TIER-ARCHITECTURE-FINAL.md` - 三層架構最終設計
- `FEATURES-AND-ARCHITECTURE.md` - 功能與架構完整說明

---

### 🧠 logic/ - 推薦邏輯與流程

包含推薦系統的核心邏輯、評分機制、使用者流程等文檔。

**重要文檔：**
- `RECOMMENDATION-LOGIC-DOCUMENTATION.md` - 推薦演算法完整說明
- `FUN-QUESTION-SCORING-LOGIC.md` - 趣味問題評分邏輯
- `BUDDIES-FLOW-DOCUMENTATION.md` - Buddies 模式流程說明

---

### 🎨 design/ - 設計規範

包含 UI 設計、安全性、功能設計等規範文檔。

**重要文檔：**
- `COLOR-GUIDE.md` - 顏色配置與使用規範
- `SECURITY.md` - 安全性設計與規範
- `IMAGE-UPLOAD-FEATURES.md` - 圖片上傳功能設計

---

### 🔄 migration-2025-11-05/ - 資料庫遷移專案

**本次遷移的完整文檔與實施指南。**

**核心目標：**
- 每日自動清理已完成的房間（24小時後）
- 完整數據歸檔系統
- 19 種事件類型記錄
- 數據匯出功能
- 空間節省 ~85%

**文檔列表：**
- `READY-TO-IMPLEMENT.md` ⭐ **快速開始**
- `IMPLEMENTATION-GUIDE.md` - 詳細實施步驟
- `DATABASE-OPTIMIZATION-INDEX.md` - 遷移文檔索引
- `DATABASE-AUDIT-REPORT.md` - 完整審查報告
- `DATA-LIFECYCLE-MANAGEMENT.md` - 設計方案說明
- `OPTIMIZATION-SUMMARY.md` - 優化成果總結
- `DATABASE-SCHEMA-UPDATE-GUIDE.md` - Schema 更新指南

**預估時間：** 2-3 小時完成

---

### 📝 implementation-guides/ - 過往實施指南

包含過去完成的各種功能實施指南，供參考使用。

**文檔列表：**
- `buddies-interaction-integration-guide.md`
- `complete-data-tracking-implementation-guide.md`
- `unified-data-architecture-design.md`
- `enable-realtime-guide.md`

---

## 🔍 按主題查找

### 資料庫相關
- **Schema 定義**: [`architecture/DATABASE-SCHEMA.md`](./architecture/DATABASE-SCHEMA.md)
- **三層架構**: [`architecture/THREE-TIER-ARCHITECTURE-FINAL.md`](./architecture/THREE-TIER-ARCHITECTURE-FINAL.md)
- **遷移指南**: [`migration-2025-11-05/IMPLEMENTATION-GUIDE.md`](./migration-2025-11-05/IMPLEMENTATION-GUIDE.md)

### 推薦系統
- **核心演算法**: [`logic/RECOMMENDATION-LOGIC-DOCUMENTATION.md`](./logic/RECOMMENDATION-LOGIC-DOCUMENTATION.md)
- **演算法規格**: [`architecture/ALGORITHM-SPECIFICATION.md`](./architecture/ALGORITHM-SPECIFICATION.md)
- **評分邏輯**: [`logic/FUN-QUESTION-SCORING-LOGIC.md`](./logic/FUN-QUESTION-SCORING-LOGIC.md)

### Buddies 模式
- **流程說明**: [`logic/BUDDIES-FLOW-DOCUMENTATION.md`](./logic/BUDDIES-FLOW-DOCUMENTATION.md)
- **互動整合**: [`implementation-guides/buddies-interaction-integration-guide.md`](./implementation-guides/buddies-interaction-integration-guide.md)

### 設計與規範
- **顏色指南**: [`design/COLOR-GUIDE.md`](./design/COLOR-GUIDE.md)
- **安全規範**: [`design/SECURITY.md`](./design/SECURITY.md)
- **圖片功能**: [`design/IMAGE-UPLOAD-FEATURES.md`](./design/IMAGE-UPLOAD-FEATURES.md)

---

## 💡 建議閱讀順序

### 對於新加入的開發者

1. **第一天：了解系統**
   - [`architecture/FEATURES-AND-ARCHITECTURE.md`](./architecture/FEATURES-AND-ARCHITECTURE.md)
   - [`architecture/SYSTEM-ARCHITECTURE.md`](./architecture/SYSTEM-ARCHITECTURE.md)
   - [`architecture/DATABASE-SCHEMA.md`](./architecture/DATABASE-SCHEMA.md)

2. **第二天：理解核心邏輯**
   - [`logic/RECOMMENDATION-LOGIC-DOCUMENTATION.md`](./logic/RECOMMENDATION-LOGIC-DOCUMENTATION.md)
   - [`logic/BUDDIES-FLOW-DOCUMENTATION.md`](./logic/BUDDIES-FLOW-DOCUMENTATION.md)

3. **第三天：設計規範**
   - [`design/COLOR-GUIDE.md`](./design/COLOR-GUIDE.md)
   - [`design/SECURITY.md`](./design/SECURITY.md)

### 對於需要執行遷移的人員

1. **了解背景**: [`migration-2025-11-05/DATABASE-AUDIT-REPORT.md`](./migration-2025-11-05/DATABASE-AUDIT-REPORT.md)
2. **理解方案**: [`migration-2025-11-05/DATA-LIFECYCLE-MANAGEMENT.md`](./migration-2025-11-05/DATA-LIFECYCLE-MANAGEMENT.md)
3. **開始實施**: [`migration-2025-11-05/IMPLEMENTATION-GUIDE.md`](./migration-2025-11-05/IMPLEMENTATION-GUIDE.md)

---

## 📞 文檔維護

**維護者：** Claude Code (Linus Mode)
**最後重組：** 2025-11-05
**文檔版本：** v2.0 (分類重組版)

**變更歷史：**
- 2025-11-05: 將所有文檔按主題分類到子資料夾
- 2025-11-05: 新增本次資料庫遷移相關文檔
- 2025-10-31: 建立初始文檔結構

---

**快速開始資料庫遷移：**
👉 [`migration-2025-11-05/READY-TO-IMPLEMENT.md`](./migration-2025-11-05/READY-TO-IMPLEMENT.md)
