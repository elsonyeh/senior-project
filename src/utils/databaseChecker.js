// 資料庫結構檢查工具
import { supabase } from '../services/supabaseService.js';

export class DatabaseChecker {

  // 檢查表格是否存在
  async checkTableExists(tableName) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);

      return { exists: !error, error: error?.message };
    } catch (err) {
      return { exists: false, error: err.message };
    }
  }

  // 檢查表格欄位
  async checkTableColumns(tableName) {
    try {
      // 嘗試插入一個測試記錄來檢查欄位
      const testData = {
        session_id: 'test_check_columns',
        mode: 'test',
        source_type: 'test'
      };

      const { error } = await supabase
        .from(tableName)
        .insert(testData)
        .select();

      if (error) {
        return {
          hasOptimizedSchema: false,
          error: error.message,
          missingColumns: this.extractMissingColumns(error.message)
        };
      }

      // 如果插入成功，立即刪除測試記錄
      await supabase
        .from(tableName)
        .delete()
        .eq('session_id', 'test_check_columns');

      return { hasOptimizedSchema: true, error: null };
    } catch (err) {
      return {
        hasOptimizedSchema: false,
        error: err.message,
        missingColumns: this.extractMissingColumns(err.message)
      };
    }
  }

  // 從錯誤訊息中提取缺失的欄位
  extractMissingColumns(errorMessage) {
    const columnMatch = errorMessage.match(/'([^']+)' column/);
    return columnMatch ? [columnMatch[1]] : [];
  }

  // 獲取現有資料
  async getExistingData(tableName) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(5);

      return { data: data || [], error: error?.message };
    } catch (err) {
      return { data: [], error: err.message };
    }
  }

  // 完整檢查
  async performFullCheck() {
    console.log('🔍 開始檢查資料庫結構...');

    const results = {
      userSelectionHistory: await this.checkTableExists('user_selection_history'),
      userProfiles: await this.checkTableExists('user_profiles'),
      buddiesRooms: await this.checkTableExists('buddies_rooms'),
      buddiesRecommendations: await this.checkTableExists('buddies_recommendations')
    };

    // 如果 user_selection_history 存在，檢查是否有新的欄位
    if (results.userSelectionHistory.exists) {
      console.log('✅ user_selection_history 表格存在');

      const columnCheck = await this.checkTableColumns('user_selection_history');
      results.userSelectionHistory.hasOptimizedSchema = columnCheck.hasOptimizedSchema;
      results.userSelectionHistory.schemaError = columnCheck.error;
      results.userSelectionHistory.missingColumns = columnCheck.missingColumns;

      if (!columnCheck.hasOptimizedSchema) {
        console.log('⚠️ user_selection_history 表格需要更新 schema');
        console.log('缺失欄位:', columnCheck.missingColumns);
      } else {
        console.log('✅ user_selection_history 表格 schema 已是最新');
      }

      // 獲取現有資料
      const existingData = await this.getExistingData('user_selection_history');
      results.userSelectionHistory.existingData = existingData.data;
      results.userSelectionHistory.dataCount = existingData.data.length;
    } else {
      console.log('❌ user_selection_history 表格不存在');
    }

    // 檢查其他表格
    for (const [tableName, result] of Object.entries(results)) {
      if (tableName !== 'userSelectionHistory') {
        if (result.exists) {
          console.log(`✅ ${tableName} 表格存在`);
        } else {
          console.log(`❌ ${tableName} 表格不存在`);
        }
      }
    }

    return results;
  }

  // 生成 schema 建議
  generateSchemaRecommendation(checkResults) {
    const recommendations = [];

    if (!checkResults.userSelectionHistory.exists) {
      recommendations.push({
        type: 'CREATE_TABLE',
        message: '需要創建 user_selection_history 表格',
        action: '執行 selection-history-schema-optimized.sql'
      });
    } else if (!checkResults.userSelectionHistory.hasOptimizedSchema) {
      recommendations.push({
        type: 'UPDATE_SCHEMA',
        message: '需要更新 user_selection_history 表格結構',
        action: '執行 schema 更新腳本',
        missingColumns: checkResults.userSelectionHistory.missingColumns
      });
    }

    if (!checkResults.userProfiles.exists) {
      recommendations.push({
        type: 'INFO',
        message: 'user_profiles 表格不存在，將使用替代方案統計用戶'
      });
    }

    return recommendations;
  }
}

// 創建實例並導出
export const databaseChecker = new DatabaseChecker();

// 在瀏覽器控制台中可用的檢查函數
window.checkDatabase = async () => {
  const checker = new DatabaseChecker();
  const results = await checker.performFullCheck();
  const recommendations = checker.generateSchemaRecommendation(results);

  console.log('\n📊 檢查結果:', results);
  console.log('\n💡 建議:', recommendations);

  return { results, recommendations };
};

export default databaseChecker;