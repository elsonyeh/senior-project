# 🎨 SwiftTaste 顏色設計指南

本文檔定義了 SwiftTaste 應用的完整顏色系統，確保 UI 設計的一致性和可維護性。

## 目錄
- [核心調色板](#核心調色板)
- [功能色系](#功能色系)
- [中性灰階](#中性灰階)
- [漸層系統](#漸層系統)
- [使用場景](#使用場景)
- [深色模式](#深色模式)
- [實作建議](#實作建議)

---

## 核心調色板

### 主色系 (Primary)

**橙紅色** - 應用主色調，用於主要 CTA 和強調元素

```css
--primary: #ff6b35;           /* 主色 */
--primary-light: #ff8356;     /* 淺色變體 - hover 狀態 */
--primary-dark: #e55a2b;      /* 深色變體 - active 狀態 */
--primary-pale: #fff5f2;      /* 極淺背景 */
```

**使用場景：**
- 主要 CTA 按鈕 (送出、確認、保存)
- 導航欄活動狀態
- 收藏心形圖標
- 表單輸入焦點狀態
- 加入清單按鈕

### 次要色系 (Secondary)

**紫色漸層** - 用於次要操作和裝飾元素

```css
--secondary: #667eea;         /* 次要色主體 */
--secondary-dark: #764ba2;    /* 漸層深色端點 */
--secondary-light: #8b9aef;   /* 淺色變體 */
--secondary-pale: rgba(102, 126, 234, 0.08); /* 半透明背景 */
```

**使用場景：**
- 備選推薦按鈕
- 列表選擇標記
- 裝飾性漸層元素
- InfoWindow 邊框和文字
- 次要操作按鈕

---

## 功能色系

### 成功 (Success)

```css
--success: #22c55e;           /* 綠色主體 */
--success-light: #4ade80;     /* 淺綠 */
--success-dark: #16a34a;      /* 深綠 */
--success-bg: rgba(34, 197, 94, 0.05);  /* 背景色 */
--success-border: rgba(34, 197, 94, 0.2); /* 邊框色 */
```

**使用場景：**
- 操作成功 Toast 提示
- 確認按鈕
- 投票進度條 (贊成側)
- Google Maps 高評分圖標 (#4CAF50)

### 警告 (Warning)

```css
--warning: #f59e0b;           /* 琥珀色 */
--warning-light: #fbbf24;     /* 淺琥珀 */
--warning-dark: #d97706;      /* 深琥珀 */
--warning-bg: rgba(245, 158, 11, 0.05); /* 背景色 */
```

**使用場景：**
- 警告訊息
- 待定狀態
- 星級評分 (#ffc107)

### 錯誤 (Error)

```css
--error: #ef4444;             /* 紅色 */
--error-light: #f87171;       /* 淺紅 */
--error-dark: #dc2626;        /* 深紅 */
--error-bg: rgba(239, 68, 68, 0.05); /* 背景色 */
--error-border: rgba(239, 68, 68, 0.3); /* 邊框色 */
```

**使用場景：**
- 刪除按鈕
- 錯誤訊息 Toast
- 表單驗證錯誤
- 投票進度條 (反對側 #FF6B6B)

### 資訊 (Info)

```css
--info: #2196f3;              /* 藍色 */
--info-light: #60a5fa;        /* 淺藍 */
--info-dark: #1976d2;         /* 深藍 */
--info-bg: rgba(33, 150, 243, 0.1); /* 背景色 */
```

**使用場景：**
- 資訊提示 Toast
- 導航元素
- 編輯按鈕 (#3b82f6)

---

## 中性灰階

### 淺色模式灰階

```css
/* 文字色 */
--gray-900: #1a1a1a;          /* 主標題 */
--gray-800: #2d3748;          /* 次要文字 */
--gray-700: #4a5568;          /* 說明文字 */
--gray-600: #718096;          /* 輔助文字 */
--gray-500: #a0aec0;          /* 禁用文字 */

/* 背景與邊框 */
--gray-400: #cbd5e0;          /* 邊框 */
--gray-300: #e2e8f0;          /* 分隔線 */
--gray-200: #edf2f7;          /* 卡片背景 */
--gray-100: #f7fafc;          /* 淺背景 */
--gray-50: #fafbfc;           /* 頁面背景 */
```

### 深色模式灰階

```css
/* 深色模式文字 */
--dark-text-primary: #f7fafc;    /* 主文字 */
--dark-text-secondary: #e2e8f0;  /* 次要文字 */
--dark-text-tertiary: #a0aec0;   /* 輔助文字 */

/* 深色模式背景 */
--dark-bg-primary: #1a202c;      /* 主背景 */
--dark-bg-secondary: #2d3748;    /* 卡片背景 */
--dark-bg-tertiary: #4a5568;     /* 浮層背景 */

/* 深色模式邊框 */
--dark-border: rgba(255, 255, 255, 0.1);
--dark-border-strong: rgba(255, 255, 255, 0.2);
```

---

## 漸層系統

### 主要漸層 (Primary Gradients)

```css
/* 橙紅漸層 - 主要 CTA */
background: linear-gradient(135deg, #ff6b35 0%, #e55a2b 100%);

/* 橙色漸層 - 次要操作 */
background: linear-gradient(135deg, #FF9F68 0%, #FF6B6B 100%);

/* 珊瑚漸層 - 裝飾 */
background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
```

### 次要漸層 (Secondary Gradients)

```css
/* 紫色漸層 - 備選操作 */
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
background: linear-gradient(180deg, #667eea 0%, #764ba2 100%); /* 垂直版 */

/* 藍色漸層 - 資訊/導航 */
background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
```

### 功能色漸層

```css
/* 成功漸層 */
background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);

/* 警告漸層 */
background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);

/* 錯誤漸層 */
background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);

/* 資訊漸層 */
background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%);
```

### 投票系統漸層

```css
/* 贊成側（藍色） */
background: linear-gradient(90deg, #4A90E2 0%, #357ABD 100%);

/* 反對側（紅色） */
background: linear-gradient(90deg, #FF6B6B 0%, #FF5252 100%);
```

---

## 使用場景

### 按鈕系統

#### 主要按鈕 (Primary Button)
```css
.btn-primary {
  background: linear-gradient(135deg, #ff6b35 0%, #e55a2b 100%);
  color: #ffffff;
  border: none;
}

.btn-primary:hover {
  background: linear-gradient(135deg, #ff8356 0%, #ff6b35 100%);
  box-shadow: 0 4px 12px rgba(255, 107, 53, 0.3);
}

.btn-primary:active {
  background: linear-gradient(135deg, #e55a2b 0%, #d04e23 100%);
  transform: scale(0.98);
}
```

#### 次要按鈕 (Secondary Button)
```css
.btn-secondary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #ffffff;
}
```

#### 危險按鈕 (Danger Button)
```css
.btn-danger {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: #ffffff;
}
```

#### 幽靈按鈕 (Ghost Button)
```css
.btn-ghost {
  background: transparent;
  color: #ff6b35;
  border: 2px solid #ff6b35;
}
```

### 卡片系統

```css
/* 標準卡片 */
.card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

/* 強調卡片 */
.card-emphasis {
  background: linear-gradient(135deg, rgba(255, 107, 53, 0.02) 0%, rgba(255, 107, 53, 0.05) 100%);
  border: 1px solid rgba(255, 107, 53, 0.2);
}

/* 選中卡片 */
.card-selected {
  background: linear-gradient(135deg, #eff6ff 0%, #ffffff 100%);
  border: 2px solid #3b82f6;
}
```

### 表單元素

```css
/* 輸入框焦點狀態 */
input:focus,
textarea:focus {
  border-color: #ff6b35;
  outline: none;
  box-shadow: 0 0 0 3px rgba(255, 107, 53, 0.1);
}

/* 錯誤狀態 */
input.error {
  border-color: #ef4444;
  background: #fef2f2;
}

input.error:focus {
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}
```

### 導航系統

```css
/* 底部導航 - 未激活 */
.nav-item {
  color: #777;
  background: transparent;
}

/* 底部導航 - 激活 */
.nav-item.active {
  color: #ffffff;
  background: linear-gradient(135deg, #FF6B6B 0%, #FF9F68 100%);
  box-shadow: 0 2px 10px rgba(255, 107, 107, 0.25);
}
```

### Toast 訊息

```css
/* 成功 Toast */
.toast-success {
  background: linear-gradient(135deg, #4CAF50, #45a049);
  color: #ffffff;
}

/* 錯誤 Toast */
.toast-error {
  background: linear-gradient(135deg, #f44336, #d32f2f);
  color: #ffffff;
}

/* 警告 Toast */
.toast-warning {
  background: linear-gradient(135deg, #ff9800, #f57c00);
  color: #ffffff;
}

/* 資訊 Toast */
.toast-info {
  background: linear-gradient(135deg, #2196f3, #1976d2);
  color: #ffffff;
}
```

---

## 深色模式

### 啟用深色模式

```css
@media (prefers-color-scheme: dark) {
  /* 主背景 */
  body {
    background: linear-gradient(135deg, #1a202c 0%, #2d3748 100%);
    color: #f7fafc;
  }

  /* 卡片 */
  .card {
    background: #2d3748;
    border-color: rgba(255, 255, 255, 0.1);
  }

  /* 文字 */
  h1, h2, h3, h4, h5, h6 {
    color: #f7fafc;
  }

  p, span {
    color: #e2e8f0;
  }

  /* 輸入框 */
  input, textarea {
    background: #1a202c;
    border-color: rgba(255, 255, 255, 0.2);
    color: #f7fafc;
  }

  /* 保持主題色不變 */
  .btn-primary {
    background: linear-gradient(135deg, #ff6b35 0%, #e55a2b 100%);
  }
}
```

### 深色模式最佳實踐

1. **保持品牌色一致性**：主色 (#ff6b35) 在深色模式下保持不變
2. **降低對比度**：使用 #f7fafc 而非純白 (#ffffff) 作為文字色
3. **調整陰影**：使用更柔和的陰影或去除陰影
4. **邊框半透明**：使用 rgba(255, 255, 255, 0.1-0.2) 而非固定顏色

---

## 實作建議

### 使用 CSS 變數

建議在 `src/index.css` 或專門的 `colors.css` 中定義 CSS 變數：

```css
:root {
  /* 主色系 */
  --primary: #ff6b35;
  --primary-light: #ff8356;
  --primary-dark: #e55a2b;
  --primary-pale: #fff5f2;

  /* 次要色系 */
  --secondary: #667eea;
  --secondary-dark: #764ba2;
  --secondary-light: #8b9aef;
  --secondary-pale: rgba(102, 126, 234, 0.08);

  /* 功能色 */
  --success: #22c55e;
  --warning: #f59e0b;
  --error: #ef4444;
  --info: #2196f3;

  /* 中性色 */
  --gray-900: #1a1a1a;
  --gray-800: #2d3748;
  --gray-700: #4a5568;
  --gray-600: #718096;
  --gray-500: #a0aec0;
  --gray-400: #cbd5e0;
  --gray-300: #e2e8f0;
  --gray-200: #edf2f7;
  --gray-100: #f7fafc;
  --gray-50: #fafbfc;

  /* 深色模式 */
  --dark-bg-primary: #1a202c;
  --dark-bg-secondary: #2d3748;
  --dark-text-primary: #f7fafc;
  --dark-border: rgba(255, 255, 255, 0.1);
}

/* 深色模式覆寫 */
@media (prefers-color-scheme: dark) {
  :root {
    --text-primary: var(--dark-text-primary);
    --bg-primary: var(--dark-bg-primary);
    --bg-secondary: var(--dark-bg-secondary);
    --border: var(--dark-border);
  }
}
```

### 使用範例

```css
/* 替換前 */
.button {
  background: #ff6b35;
  color: #ffffff;
}

/* 替換後 */
.button {
  background: var(--primary);
  color: #ffffff;
}

.button:hover {
  background: var(--primary-light);
}
```

### 顏色命名約定

1. **語義化命名**：使用 `primary`、`success` 而非 `orange`、`green`
2. **層級命名**：使用 `-light`、`-dark` 表示變體
3. **功能命名**：使用 `-bg`、`-text`、`-border` 表示用途
4. **透明度命名**：使用 `-pale`、`-alpha-10` 表示半透明版本

### 漸層使用指南

```css
/* 建議：定義漸層為可重用的變數 */
:root {
  --gradient-primary: linear-gradient(135deg, #ff6b35 0%, #e55a2b 100%);
  --gradient-secondary: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --gradient-success: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
  --gradient-error: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
}

/* 使用 */
.button-primary {
  background: var(--gradient-primary);
}
```

---

## 無障礙考量 (Accessibility)

### 對比度要求

確保文字和背景的對比度符合 WCAG AA 標準（至少 4.5:1）：

```css
/* ✅ 良好對比度 */
.text-primary-on-white {
  color: #2d3748;        /* 對比度 > 10:1 */
  background: #ffffff;
}

/* ✅ 主色在白色背景上 */
.button-primary {
  background: #ff6b35;   /* 對比度約 3.3:1 - 適合大文字/按鈕 */
  color: #ffffff;
}

/* ❌ 避免低對比度 */
.text-light-gray-on-white {
  color: #cbd5e0;        /* 對比度過低 */
  background: #ffffff;
}
```

### 焦點指示器

```css
/* 確保清晰的焦點狀態 */
button:focus,
input:focus {
  outline: 3px solid rgba(255, 107, 53, 0.5);
  outline-offset: 2px;
}
```

---

## 收藏清單顏色配置

### 清單標記顏色系統

SwiftTaste 使用9種精心挑選的顏色來標記不同的收藏清單，確保視覺區分性和美觀度。

```javascript
// 顏色配置 (FavoriteLists.jsx)
const colors = [
  "#ef4444", // 紅色 - 「我的最愛」專用（固定）
  "#14b8a6", // 青綠色 (Teal) - 優雅的藍綠過渡色
  "#3b82f6", // 藍色 - 清新明亮
  "#8b5cf6", // 紫色 - 神秘優雅
  "#f59e0b", // 琥珀色 - 溫暖活力
  "#ec4899", // 粉紅色 - 柔和浪漫
  "#06b6d4", // 青色 (Cyan) - 冷靜專業
  "#a855f7", // 亮紫色 - 明亮活潑
  "#f97316", // 橙色 - 熱情奔放
];
```

### 顏色分配邏輯

1. **「我的最愛」清單**
   - 固定使用紅色 (`#ef4444`)
   - 無法更改，代表特殊身份
   - 永遠排序在清單列表最前面

2. **其他自訂清單**
   - 創建時從**未使用的顏色**中隨機選擇
   - 避免重複，確保視覺區分
   - 最多支援5個清單（含我的最愛）

3. **顏色回收機制**
   - 當9種顏色全部使用完畢時
   - 允許從全部顏色池中重新隨機選擇
   - 實務上因清單數量限制（5個）不太會觸發

### 顏色選用原則

**為什麼移除綠色？**
- 原有的綠色 (`#22c55e`) 和萊姆綠 (`#84cc16`) 過於鮮豔
- 在地圖標記上與「我的最愛」紅色對比度過高
- 容易造成視覺疲勞

**新顏色的優勢：**
- `#14b8a6` (青綠色) - 更柔和，與地圖底色和諧
- `#a855f7` (亮紫色) - 與深紫色形成層次，增加選擇豐富度

### 視覺範例

```css
/* 清單顏色點 */
.fav-list-color-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: var(--list-color); /* 動態顏色 */
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.8);
}

/* 選中狀態 */
.fav-list-item.selected {
  background: linear-gradient(135deg, #eff6ff 0%, #ffffff 100%);
  border: 2px solid #3b82f6;
}
```

---

## 組件顏色速查表

| 組件 | 主色 | 輔助色 | 狀態色 |
|------|------|--------|--------|
| **BottomNav** | #FF6B6B → #FF9F68 | #777 (非活動) | - |
| **ProfileHeader** | #ff6b35 → #f7931e | #22c55e (保存) | - |
| **Toast** | - | - | 成功/錯誤/警告/資訊 |
| **AuthModal** | #ff6b35 | #4285F4 (Google) | #dc2626 (錯誤) |
| **RecommendationResult** | #ff6b6b (標題) | #6874E8 / #ff976b | - |
| **BuddiesVote** | #4A90E2 → #357ABD | #FF6B6B → #FF5252 | - |
| **MapView** | #667eea | #ffc107 (星星) | #ff6b35 (收藏) |
| **FavoriteLists** | 9種標記顏色 (見上方) | #3b82f6 (選中) | #ef4444 (刪除) |
| **RestaurantReviews** | #667eea (邊框) | #ef4444 (刪除) | #ffd700 (星星) |

---

## 維護指南

### 新增顏色時

1. **檢查現有色彩**：確認是否已有類似顏色
2. **語義化命名**：使用描述用途的名稱
3. **定義變體**：提供 light、dark 變體
4. **測試對比度**：確保符合無障礙標準
5. **更新文檔**：在本指南中記錄新顏色

### 重構顏色時

1. **建立 CSS 變數**：逐步將 hardcoded 顏色替換為變數
2. **保持向後兼容**：確保不破壞現有樣式
3. **統一變體**：減少顏色變體數量（如橙色系從 5 個減至 2-3 個）
4. **測試深色模式**：確保深色模式正常工作

---

## 參考資源

- [WCAG 對比度檢查器](https://webaim.org/resources/contrastchecker/)
- [Coolors 調色板生成器](https://coolors.co/)
- [Adobe Color Wheel](https://color.adobe.com/create/color-wheel)
- [Material Design Color Tool](https://material.io/resources/color/)

---

**最後更新**：2025-10-27
**維護者**：SwiftTaste 開發團隊
