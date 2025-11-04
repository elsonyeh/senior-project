/**
 * 資料庫結構匯出腳本
 *
 * 功能：
 * 1. 連接 Supabase 資料庫
 * 2. 讀取所有資料表結構
 * 3. 生成包含用途說明的 Markdown 文件
 *
 * 使用方式：
 * node scripts/export-database-schema.js
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 載入環境變數
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 環境變數未設置：VITE_SUPABASE_URL 或 VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 資料表用途說明（手動維護）
const tableDescriptions = {
  // 核心資料表
  'restaurants': {
    purpose: '餐廳基本資料',
    description: '儲存所有餐廳的基本資訊，包括名稱、地址、座標、標籤、價格區間、辣度等。是系統的核心資料表，所有推薦邏輯都基於此表。',
    features: [
      'SwiftTaste 模式推薦來源',
      'Buddies 模式推薦來源',
      'Map 模式顯示資料',
      '支援地理空間查詢（經緯度）',
      '標籤系統（tags 陣列）用於趣味問題匹配'
    ]
  },
  'restaurant_images': {
    purpose: '餐廳圖片管理',
    description: '儲存餐廳的多張圖片，支援主圖和附加圖片。圖片實際存儲在 Supabase Storage，此表記錄圖片 URL 和元數據。',
    features: [
      '一對多關聯（一間餐廳多張圖片）',
      'is_primary 標記主圖',
      '支援圖片順序排列',
      '與 Supabase Storage 整合'
    ]
  },
  'restaurant_reviews': {
    purpose: '餐廳評論系統',
    description: 'TasteBuddies 自有評論系統，使用者可對餐廳撰寫評論和評分。與 Google 評論整合顯示綜合評分。',
    features: [
      '5星評分系統',
      '文字評論',
      '用戶認證（需登入）',
      '與 Google 評論整合計算綜合評分',
      '評論時間記錄'
    ]
  },

  // 用戶系統
  'user_profiles': {
    purpose: '用戶個人檔案',
    description: '擴展 Supabase Auth 的用戶資訊，儲存頭像、名稱、簡介等個人化資料。與 auth.users 一對一關聯。',
    features: [
      '個人資料編輯',
      '頭像上傳',
      '用戶統計（收藏數、評論數）',
      '與 Supabase Auth 整合'
    ]
  },
  'user_favorite_lists': {
    purpose: '收藏清單管理',
    description: '多清單收藏系統，每個用戶可創建多個收藏清單，每個清單有獨立顏色標記。預設「我的最愛」清單不可刪除。',
    features: [
      '最多 6 個清單（1 個預設 + 5 個自訂）',
      '9 種顏色標記',
      '智能顏色分配',
      '清單內餐廳計數',
      'Map 模式視覺化顯示'
    ]
  },
  'favorite_list_places': {
    purpose: '清單內餐廳關聯',
    description: '多對多關聯表，連接收藏清單和餐廳。支援為每個餐廳添加私人備註。',
    features: [
      '多對多關聯（清單 ↔ 餐廳）',
      '私人備註功能',
      '加入時間記錄',
      '支援快速查詢清單內容'
    ]
  },

  // SwiftTaste 模式
  'swifttaste_history': {
    purpose: 'SwiftTaste 歷史記錄',
    description: '記錄用戶每次使用 SwiftTaste 模式的問答答案和推薦結果。用於歷史查詢和未來個人化推薦優化。',
    features: [
      '問答答案記錄（JSONB）',
      '推薦結果記錄（JSONB）',
      '時間序列分析',
      '用戶偏好學習（未來擴展）'
    ]
  },
  'selection_history': {
    purpose: '餐廳選擇歷史',
    description: '記錄用戶與餐廳的互動行為（查看、收藏、導航等），用於熱門度計算和推薦優化。',
    features: [
      '互動行為追蹤',
      '熱門度計算數據來源',
      '用戶行為分析',
      '推薦系統優化依據'
    ]
  },

  // Buddies 模式 - 實時互動層（JSONB）
  'buddies_rooms': {
    purpose: 'Buddies 房間管理',
    description: 'Buddies 群組決策房間，儲存房間狀態、成員資訊、投票數據等。使用 JSONB 格式實現高效能實時互動。',
    features: [
      '房間生命週期管理',
      '成員列表（JSONB）',
      '投票統計（JSONB）',
      '房間碼/QR Code 邀請',
      '房主權重機制（2倍投票權）',
      'Socket.IO 即時同步'
    ]
  },
  'buddies_members': {
    purpose: 'Buddies 成員管理',
    description: '記錄 Buddies 房間的所有成員資訊，包括用戶ID、加入時間、在線狀態等。與 buddies_rooms 一對多關聯。',
    features: [
      '成員列表管理',
      '加入時間記錄',
      '在線狀態追蹤',
      '與房間關聯'
    ]
  },
  'buddies_votes': {
    purpose: 'Buddies 投票記錄',
    description: '記錄每個成員對每個問題的投票答案，用於計算群體共識和生成推薦。支援房主 2 倍權重。',
    features: [
      '投票答案記錄',
      '房主權重支援',
      '投票時間追蹤',
      '群體共識計算'
    ]
  },
  'buddies_questions': {
    purpose: 'Buddies 問題庫',
    description: '群組決策使用的問題集，與 SwiftTaste 共用基本邏輯但針對多人場景優化。',
    features: [
      '基本問題（人數、預算、餐期、辣度）',
      '趣味問題（選答）',
      '問題順序管理',
      '與 funQuestionTagsMap 整合'
    ]
  },

  // Buddies 模式 - 事件記錄層
  'buddies_events': {
    purpose: 'Buddies 事件記錄',
    description: '記錄所有 Buddies 房間的事件流（創建、加入、投票、離開等），用於審計、統計和問題追蹤。',
    features: [
      '完整事件流記錄',
      '時間序列分析',
      '用戶行為追蹤',
      '問題調試與審計'
    ]
  },

  // 問題系統
  'fun_questions': {
    purpose: '趣味問題管理',
    description: 'SwiftTaste 和 Buddies 模式使用的趣味問題庫，用於捕捉用戶隱性偏好。',
    features: [
      '問題文本管理',
      '選項定義',
      '標籤映射配置',
      '問題啟用/停用',
      '顯示順序控制'
    ]
  },
  'fun_question_tags': {
    purpose: '趣味問題標籤映射',
    description: '連接趣味問題選項與餐廳標籤，實現偏好匹配邏輯。一個選項可對應多個標籤。',
    features: [
      '選項 → 標籤映射',
      '支援一對多關聯',
      '標籤權重（未來擴展）',
      '動態標籤管理'
    ]
  }
};

// 欄位用途說明（常見欄位）
const commonFieldDescriptions = {
  'id': 'UUID 主鍵，自動生成',
  'created_at': '記錄創建時間，自動設置為當前時間',
  'updated_at': '記錄更新時間，自動更新',
  'user_id': '用戶 ID，關聯到 auth.users',
  'restaurant_id': '餐廳 ID，關聯到 restaurants 表',
  'is_active': '記錄是否啟用',
  'is_deleted': '軟刪除標記',
  'name': '名稱',
  'description': '描述或說明',
  'notes': '備註',
  'order': '排序順序',
  'count': '計數'
};

// 特殊欄位說明
const specialFieldDescriptions = {
  'restaurants': {
    'suggested_people': '建議人數："1"（單人）、"~"（多人）、"1~"（兩者皆可）',
    'price_range': '價格區間：1（平價）、2（中價）、3（高價）',
    'tags': '標籤陣列（text[]），用於趣味問題匹配',
    'is_spicy': '辣度標記："true"（辣）、"false"（不辣）、"both"（兩者皆有）',
    'latitude': '緯度，用於地理空間查詢',
    'longitude': '經度，用於地理空間查詢',
    'rating': 'Google 評分（0-5）',
    'review_count': 'Google 評論數'
  },
  'user_favorite_lists': {
    'color': '清單顏色（HEX 格式，如 #EF4444）',
    'is_default': '是否為預設「我的最愛」清單',
    'places_count': '清單內餐廳數量'
  },
  'buddies_rooms': {
    'room_code': '6位數房間碼，用於好友加入',
    'host_id': '房主 ID，擁有 2 倍投票權',
    'status': '房間狀態：waiting、answering、recommending、completed',
    'members_data': 'JSONB 格式成員列表',
    'votes_data': 'JSONB 格式投票統計',
    'current_question_index': '當前問題索引',
    'expires_at': '房間過期時間（24小時）'
  },
  'restaurant_reviews': {
    'rating': '用戶評分（1-5 星）',
    'review_text': '評論內容',
    'is_verified': '是否為驗證用戶（未來擴展）'
  }
};

// 已知的表列表（手動維護）
const knownTables = [
  // 核心資料表
  'restaurants',
  'restaurant_images',
  'restaurant_reviews',
  // 用戶系統
  'user_profiles',
  'user_favorite_lists',
  'favorite_list_places',
  // SwiftTaste 模式
  'swifttaste_history',
  'selection_history',
  // Buddies 模式
  'buddies_rooms',
  'buddies_members',
  'buddies_votes',
  'buddies_questions',
  'buddies_events',
  // 問題系統
  'fun_questions',
  'fun_question_tags'
];

/**
 * 讀取單個表的結構
 */
async function getTableSchema(tableName) {
  try {
    // 使用 head: true 只查詢 metadata，不獲取實際數據
    const { count, error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    // 如果沒有錯誤，表示表存在
    if (!error) {
      return {
        exists: true,
        rowCount: count || 0
      };
    }

    // 檢查錯誤訊息，如果是找不到表，則返回不存在
    if (error.message.includes('Could not find') ||
        error.message.includes('does not exist')) {
      return {
        exists: false,
        error: error.message
      };
    }

    // 其他錯誤（可能是權限問題），也認為表不存在
    console.warn(`⚠️  無法讀取表 ${tableName}: ${error.message}`);
    return {
      exists: false,
      error: error.message
    };

  } catch (error) {
    return {
      exists: false,
      error: error.message
    };
  }
}

/**
 * 手動定義表結構（基於已知的資料庫設計）
 */
function getManualTableSchema() {
  const manualSchema = {
    'restaurants': {
      columns: [
        { column_name: 'id', data_type: 'text', is_nullable: 'NO' },
        { column_name: 'name', data_type: 'text', is_nullable: 'NO' },
        { column_name: 'address', data_type: 'text', is_nullable: 'YES' },
        { column_name: 'latitude', data_type: 'numeric', is_nullable: 'YES' },
        { column_name: 'longitude', data_type: 'numeric', is_nullable: 'YES' },
        { column_name: 'category', data_type: 'text', is_nullable: 'YES' },
        { column_name: 'price_range', data_type: 'integer', is_nullable: 'YES' },
        { column_name: 'suggested_people', data_type: 'text', is_nullable: 'YES' },
        { column_name: 'tags', data_type: 'text[]', is_nullable: 'YES' },
        { column_name: 'is_spicy', data_type: 'text', is_nullable: 'YES' },
        { column_name: 'rating', data_type: 'numeric', is_nullable: 'YES' },
        { column_name: 'review_count', data_type: 'integer', is_nullable: 'YES' },
        { column_name: 'created_at', data_type: 'timestamptz', is_nullable: 'YES' }
      ]
    },
    'restaurant_images': {
      columns: [
        { column_name: 'id', data_type: 'uuid', is_nullable: 'NO' },
        { column_name: 'restaurant_id', data_type: 'text', is_nullable: 'NO' },
        { column_name: 'image_url', data_type: 'text', is_nullable: 'NO' },
        { column_name: 'is_primary', data_type: 'boolean', is_nullable: 'YES' },
        { column_name: 'order', data_type: 'integer', is_nullable: 'YES' },
        { column_name: 'created_at', data_type: 'timestamptz', is_nullable: 'YES' }
      ]
    },
    'restaurant_reviews': {
      columns: [
        { column_name: 'id', data_type: 'uuid', is_nullable: 'NO' },
        { column_name: 'restaurant_id', data_type: 'text', is_nullable: 'NO' },
        { column_name: 'user_id', data_type: 'uuid', is_nullable: 'NO' },
        { column_name: 'rating', data_type: 'integer', is_nullable: 'NO' },
        { column_name: 'review_text', data_type: 'text', is_nullable: 'YES' },
        { column_name: 'created_at', data_type: 'timestamptz', is_nullable: 'YES' }
      ]
    },
    'user_profiles': {
      columns: [
        { column_name: 'id', data_type: 'uuid', is_nullable: 'NO' },
        { column_name: 'user_id', data_type: 'uuid', is_nullable: 'NO' },
        { column_name: 'username', data_type: 'text', is_nullable: 'YES' },
        { column_name: 'avatar_url', data_type: 'text', is_nullable: 'YES' },
        { column_name: 'bio', data_type: 'text', is_nullable: 'YES' },
        { column_name: 'created_at', data_type: 'timestamptz', is_nullable: 'YES' },
        { column_name: 'updated_at', data_type: 'timestamptz', is_nullable: 'YES' }
      ]
    },
    'user_favorite_lists': {
      columns: [
        { column_name: 'id', data_type: 'uuid', is_nullable: 'NO' },
        { column_name: 'user_id', data_type: 'uuid', is_nullable: 'NO' },
        { column_name: 'name', data_type: 'varchar(50)', is_nullable: 'NO' },
        { column_name: 'color', data_type: 'varchar(7)', is_nullable: 'YES' },
        { column_name: 'is_default', data_type: 'boolean', is_nullable: 'YES' },
        { column_name: 'places_count', data_type: 'integer', is_nullable: 'YES' },
        { column_name: 'created_at', data_type: 'timestamptz', is_nullable: 'YES' }
      ]
    },
    'favorite_list_places': {
      columns: [
        { column_name: 'id', data_type: 'uuid', is_nullable: 'NO' },
        { column_name: 'list_id', data_type: 'uuid', is_nullable: 'NO' },
        { column_name: 'restaurant_id', data_type: 'text', is_nullable: 'NO' },
        { column_name: 'notes', data_type: 'text', is_nullable: 'YES' },
        { column_name: 'added_at', data_type: 'timestamptz', is_nullable: 'YES' }
      ]
    },
    'swifttaste_history': {
      columns: [
        { column_name: 'id', data_type: 'uuid', is_nullable: 'NO' },
        { column_name: 'user_id', data_type: 'uuid', is_nullable: 'NO' },
        { column_name: 'answers', data_type: 'jsonb', is_nullable: 'YES' },
        { column_name: 'recommendations', data_type: 'jsonb', is_nullable: 'YES' },
        { column_name: 'created_at', data_type: 'timestamptz', is_nullable: 'YES' }
      ]
    },
    'selection_history': {
      columns: [
        { column_name: 'id', data_type: 'uuid', is_nullable: 'NO' },
        { column_name: 'user_id', data_type: 'uuid', is_nullable: 'YES' },
        { column_name: 'restaurant_id', data_type: 'text', is_nullable: 'NO' },
        { column_name: 'action_type', data_type: 'text', is_nullable: 'NO' },
        { column_name: 'created_at', data_type: 'timestamptz', is_nullable: 'YES' }
      ]
    },
    'buddies_rooms': {
      columns: [
        { column_name: 'id', data_type: 'uuid', is_nullable: 'NO' },
        { column_name: 'room_code', data_type: 'varchar(6)', is_nullable: 'NO' },
        { column_name: 'host_id', data_type: 'uuid', is_nullable: 'NO' },
        { column_name: 'status', data_type: 'text', is_nullable: 'YES' },
        { column_name: 'members_data', data_type: 'jsonb', is_nullable: 'YES' },
        { column_name: 'votes_data', data_type: 'jsonb', is_nullable: 'YES' },
        { column_name: 'current_question_index', data_type: 'integer', is_nullable: 'YES' },
        { column_name: 'created_at', data_type: 'timestamptz', is_nullable: 'YES' },
        { column_name: 'expires_at', data_type: 'timestamptz', is_nullable: 'YES' }
      ]
    },
    'buddies_members': {
      columns: [
        { column_name: 'id', data_type: 'uuid', is_nullable: 'NO' },
        { column_name: 'room_id', data_type: 'uuid', is_nullable: 'NO' },
        { column_name: 'user_id', data_type: 'uuid', is_nullable: 'NO' },
        { column_name: 'username', data_type: 'text', is_nullable: 'YES' },
        { column_name: 'is_host', data_type: 'boolean', is_nullable: 'YES' },
        { column_name: 'joined_at', data_type: 'timestamptz', is_nullable: 'YES' }
      ]
    },
    'buddies_votes': {
      columns: [
        { column_name: 'id', data_type: 'uuid', is_nullable: 'NO' },
        { column_name: 'room_id', data_type: 'uuid', is_nullable: 'NO' },
        { column_name: 'user_id', data_type: 'uuid', is_nullable: 'NO' },
        { column_name: 'question_index', data_type: 'integer', is_nullable: 'NO' },
        { column_name: 'answer', data_type: 'text', is_nullable: 'YES' },
        { column_name: 'created_at', data_type: 'timestamptz', is_nullable: 'YES' }
      ]
    },
    'buddies_questions': {
      columns: [
        { column_name: 'id', data_type: 'uuid', is_nullable: 'NO' },
        { column_name: 'question_text', data_type: 'text', is_nullable: 'NO' },
        { column_name: 'question_type', data_type: 'text', is_nullable: 'NO' },
        { column_name: 'options', data_type: 'jsonb', is_nullable: 'YES' },
        { column_name: 'order', data_type: 'integer', is_nullable: 'YES' },
        { column_name: 'is_active', data_type: 'boolean', is_nullable: 'YES' }
      ]
    },
    'buddies_events': {
      columns: [
        { column_name: 'id', data_type: 'uuid', is_nullable: 'NO' },
        { column_name: 'room_id', data_type: 'uuid', is_nullable: 'NO' },
        { column_name: 'event_type', data_type: 'text', is_nullable: 'NO' },
        { column_name: 'user_id', data_type: 'uuid', is_nullable: 'YES' },
        { column_name: 'event_data', data_type: 'jsonb', is_nullable: 'YES' },
        { column_name: 'created_at', data_type: 'timestamptz', is_nullable: 'YES' }
      ]
    },
    'fun_questions': {
      columns: [
        { column_name: 'id', data_type: 'uuid', is_nullable: 'NO' },
        { column_name: 'question_text', data_type: 'text', is_nullable: 'NO' },
        { column_name: 'options', data_type: 'jsonb', is_nullable: 'YES' },
        { column_name: 'order', data_type: 'integer', is_nullable: 'YES' },
        { column_name: 'is_active', data_type: 'boolean', is_nullable: 'YES' }
      ]
    },
    'fun_question_tags': {
      columns: [
        { column_name: 'id', data_type: 'uuid', is_nullable: 'NO' },
        { column_name: 'question_id', data_type: 'uuid', is_nullable: 'NO' },
        { column_name: 'option_value', data_type: 'text', is_nullable: 'NO' },
        { column_name: 'tags', data_type: 'text[]', is_nullable: 'YES' }
      ]
    }
  };

  return manualSchema;
}

/**
 * 讀取資料庫中所有表的結構
 */
async function getDatabaseSchema() {
  try {
    console.log('🔍 正在讀取資料庫結構...\n');

    // 使用手動定義的結構
    const manualSchema = getManualTableSchema();

    console.log(`✅ 找到 ${knownTables.length} 個資料表\n`);

    // 驗證表是否存在
    const schemaData = {};

    for (const tableName of knownTables) {
      console.log(`📊 處理表：${tableName}`);

      const tableInfo = await getTableSchema(tableName);

      if (tableInfo && tableInfo.exists) {
        schemaData[tableName] = {
          columns: manualSchema[tableName]?.columns || [],
          description: tableDescriptions[tableName] || {
            purpose: '未分類資料表',
            description: '尚無詳細說明',
            features: []
          },
          rowCount: tableInfo.rowCount
        };
      } else {
        console.warn(`⚠️  表 ${tableName} 不存在或無法訪問`);
      }
    }

    console.log('\n✅ 資料庫結構讀取完成\n');
    return schemaData;

  } catch (error) {
    console.error('❌ 讀取資料庫結構失敗:', error);
    throw error;
  }
}

/**
 * 生成 Markdown 文件
 */
function generateMarkdown(schemaData) {
  const timestamp = new Date().toISOString().split('T')[0];

  let markdown = `# 📊 SwiftTaste 資料庫結構文件

**生成日期**：${timestamp}
**資料庫類型**：PostgreSQL (Supabase)
**表數量**：${Object.keys(schemaData).length}

---

## 📋 目錄

`;

  // 生成目錄
  const categories = {
    '核心資料表': ['restaurants', 'restaurant_images', 'restaurant_reviews'],
    '用戶系統': ['user_profiles', 'user_favorite_lists', 'favorite_list_places'],
    'SwiftTaste 模式': ['swifttaste_history', 'selection_history'],
    'Buddies 模式（實時層）': ['buddies_rooms', 'buddies_members', 'buddies_votes', 'buddies_questions'],
    'Buddies 模式（記錄層）': ['buddies_events'],
    '問題系統': ['fun_questions', 'fun_question_tags'],
    '其他表': []
  };

  // 將未分類的表加入「其他表」
  const categorizedTables = new Set();
  Object.values(categories).flat().forEach(t => categorizedTables.add(t));

  Object.keys(schemaData).forEach(tableName => {
    if (!categorizedTables.has(tableName)) {
      categories['其他表'].push(tableName);
    }
  });

  // 生成目錄鏈接
  Object.entries(categories).forEach(([category, tables]) => {
    if (tables.length > 0) {
      markdown += `- [${category}](#${category.replace(/\s+/g, '-').toLowerCase()})\n`;
      tables.forEach(table => {
        if (schemaData[table]) {
          markdown += `  - [${table}](#${table})\n`;
        }
      });
    }
  });

  markdown += '\n---\n\n';

  // 生成每個分類的詳細內容
  Object.entries(categories).forEach(([category, tables]) => {
    if (tables.length === 0) return;

    markdown += `## ${category}\n\n`;

    tables.forEach(tableName => {
      const tableData = schemaData[tableName];
      if (!tableData) return;

      const desc = tableData.description;

      markdown += `### ${tableName}\n\n`;
      markdown += `**用途**：${desc.purpose}\n\n`;
      markdown += `**說明**：${desc.description}\n\n`;

      if (desc.features && desc.features.length > 0) {
        markdown += `**核心功能**：\n`;
        desc.features.forEach(feature => {
          markdown += `- ${feature}\n`;
        });
        markdown += '\n';
      }

      // 欄位表格
      markdown += `**欄位結構**：\n\n`;
      markdown += `| 欄位名稱 | 資料類型 | 可空 | 說明 |\n`;
      markdown += `|---------|---------|------|------|\n`;

      tableData.columns.forEach(col => {
        const fieldDesc =
          specialFieldDescriptions[tableName]?.[col.column_name] ||
          commonFieldDescriptions[col.column_name] ||
          '-';

        const nullable = col.is_nullable === 'YES' ? '✓' : '✗';

        markdown += `| \`${col.column_name}\` | ${col.data_type} | ${nullable} | ${fieldDesc} |\n`;
      });

      markdown += '\n';

      // 關聯關係
      markdown += `**關聯關係**：\n`;

      if (tableName.includes('_')) {
        markdown += `- 此表為關聯表，連接多個實體\n`;
      }

      if (col => col.column_name.endsWith('_id')) {
        const relatedFields = tableData.columns
          .filter(col => col.column_name.endsWith('_id'))
          .map(col => `\`${col.column_name}\``);

        if (relatedFields.length > 0) {
          markdown += `- 外鍵：${relatedFields.join(', ')}\n`;
        }
      }

      markdown += '\n---\n\n';
    });
  });

  // 附錄：資料庫設計原則
  markdown += `## 附錄：資料庫設計原則

### 三層架構設計

SwiftTaste 採用**三層資料庫架構**，優化不同場景的性能需求：

#### 1. 實時互動層（JSONB）
- **表**：\`buddies_rooms\`
- **特點**：使用 JSONB 格式存儲動態數據
- **優勢**：
  - 高效能讀寫（減少 JOIN 操作）
  - 靈活的數據結構
  - 支援 Socket.IO 即時同步
- **適用場景**：Buddies 模式群組協作

#### 2. 事件記錄層（Relational）
- **表**：\`buddies_events\`, \`selection_history\`, \`swifttaste_history\`
- **特點**：關聯式結構，完整記錄事件流
- **優勢**：
  - 數據完整性
  - 時間序列分析
  - 審計追蹤
- **適用場景**：歷史查詢、統計分析

#### 3. 分析倉儲層（Views）
- **實現**：未來透過 Views 或 Materialized Views
- **用途**：
  - 複雜統計查詢
  - 報表生成
  - 數據挖掘

### 命名規範

- **表名**：小寫 + 底線分隔（\`snake_case\`）
- **主鍵**：統一使用 \`id\` (UUID)
- **外鍵**：\`{table}_id\` 格式
- **時間戳**：\`created_at\`, \`updated_at\`
- **布林值**：\`is_\` 或 \`has_\` 前綴

### 性能優化

1. **索引策略**：
   - 主鍵自動索引
   - 外鍵添加索引
   - 常用查詢欄位添加索引

2. **JSONB 優化**：
   - 使用 JSONB 而非 JSON（支援索引）
   - GIN 索引加速查詢

3. **分頁查詢**：
   - 使用 \`LIMIT\` 和 \`OFFSET\`
   - 避免 \`SELECT *\`

### Row Level Security (RLS)

所有用戶相關表都啟用 RLS 政策：

- **用戶數據隔離**：用戶只能訪問自己的數據
- **公開數據**：餐廳、評論等公開可讀
- **管理員權限**：特殊政策允許管理操作

詳見：\`SECURITY.md\`

---

**文件生成工具**：\`scripts/export-database-schema.js\`
**維護建議**：資料庫結構變更時重新運行此腳本更新文件

`;

  return markdown;
}

/**
 * 主函數
 */
async function main() {
  try {
    console.log('🚀 SwiftTaste 資料庫結構匯出工具\n');
    console.log('================================\n');

    // 讀取資料庫結構
    const schemaData = await getDatabaseSchema();

    // 生成 Markdown
    console.log('📝 生成 Markdown 文件...\n');
    const markdown = generateMarkdown(schemaData);

    // 寫入文件
    const outputPath = path.join(__dirname, '..', 'docs', 'DATABASE-SCHEMA.md');
    fs.writeFileSync(outputPath, markdown, 'utf-8');

    console.log(`✅ 資料庫結構文件已生成：${outputPath}\n`);
    console.log('================================\n');
    console.log('📊 統計資訊：');
    console.log(`   - 資料表數量：${Object.keys(schemaData).length}`);
    console.log(`   - 文件大小：${(markdown.length / 1024).toFixed(2)} KB`);
    console.log(`   - 生成時間：${new Date().toLocaleString('zh-TW')}\n`);

  } catch (error) {
    console.error('❌ 執行失敗:', error);
    process.exit(1);
  }
}

// 執行主函數
main();
