/**
 * 清理未使用的資料庫表
 *
 * 日期: 2025-11-05
 * 目的: 移除從未被使用的表，保持資料庫清潔
 *
 * 參考: docs/DATABASE-AUDIT-REPORT.md
 *
 * 刪除的表:
 * - buddies_votes: 投票改用 buddies_rooms.votes (JSONB)
 * - buddies_questions: 問題改用 buddies_rooms.questions (JSONB) 或靜態問題集
 *
 * 風險評估: 零風險（這些表從未在程式碼中使用）
 */

-- ============================================================================
-- 1. 檢查表是否存在（安全檢查）
-- ============================================================================

DO $$
BEGIN
  -- 檢查 buddies_votes 表
  IF EXISTS (SELECT FROM information_schema.tables
             WHERE table_schema = 'public'
             AND table_name = 'buddies_votes') THEN
    RAISE NOTICE '✓ 發現 buddies_votes 表，準備刪除';
  ELSE
    RAISE NOTICE '✗ buddies_votes 表不存在，跳過';
  END IF;

  -- 檢查 buddies_questions 表
  IF EXISTS (SELECT FROM information_schema.tables
             WHERE table_schema = 'public'
             AND table_name = 'buddies_questions') THEN
    RAISE NOTICE '✓ 發現 buddies_questions 表，準備刪除';
  ELSE
    RAISE NOTICE '✗ buddies_questions 表不存在，跳過';
  END IF;
END $$;

-- ============================================================================
-- 2. 刪除未使用的表
-- ============================================================================

-- 刪除 buddies_votes 表（如果存在）
DROP TABLE IF EXISTS buddies_votes CASCADE;

COMMENT ON SCHEMA public IS 'buddies_votes table removed on 2025-11-05: voting data now stored in buddies_rooms.votes (JSONB)';

-- 刪除 buddies_questions 表（如果存在）
DROP TABLE IF EXISTS buddies_questions CASCADE;

COMMENT ON SCHEMA public IS 'buddies_questions table removed on 2025-11-05: questions now stored in buddies_rooms.questions (JSONB) or static config';

-- ============================================================================
-- 3. 驗證刪除結果
-- ============================================================================

DO $$
DECLARE
  votes_exists BOOLEAN;
  questions_exists BOOLEAN;
BEGIN
  votes_exists := EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'buddies_votes'
  );

  questions_exists := EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'buddies_questions'
  );

  IF NOT votes_exists AND NOT questions_exists THEN
    RAISE NOTICE '✅ 清理完成：所有未使用的表已成功刪除';
  ELSE
    IF votes_exists THEN
      RAISE WARNING '⚠️ buddies_votes 表仍然存在';
    END IF;
    IF questions_exists THEN
      RAISE WARNING '⚠️ buddies_questions 表仍然存在';
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 回滾腳本（如需恢復表結構，僅用於緊急情況）
-- ============================================================================

-- 注意：這些表從未使用過，回滾僅用於保留原始結構定義

/*
-- 回滾：重新創建 buddies_votes
CREATE TABLE IF NOT EXISTS buddies_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES buddies_rooms(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  question_index integer NOT NULL,
  answer text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_buddies_votes_room ON buddies_votes(room_id);
CREATE INDEX idx_buddies_votes_user ON buddies_votes(user_id);

-- 回滾：重新創建 buddies_questions
CREATE TABLE IF NOT EXISTS buddies_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_text text NOT NULL,
  question_type text NOT NULL,
  options jsonb,
  "order" integer,
  is_active boolean DEFAULT true
);

CREATE INDEX idx_buddies_questions_active ON buddies_questions(is_active);
CREATE INDEX idx_buddies_questions_order ON buddies_questions("order");
*/
