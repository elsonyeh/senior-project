-- ==========================================
-- 建立 Buddies 模式的資料庫 Schema
-- ==========================================
-- 此腳本建立 Buddies 群組推薦模式所需的所有表
-- 執行方式：在 Supabase Dashboard 的 SQL Editor 中執行

-- 1. 建立 buddies_rooms 表（房間）
CREATE TABLE IF NOT EXISTS public.buddies_rooms (
  id TEXT PRIMARY KEY,
  host_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. 建立 buddies_members 表（房間成員）
CREATE TABLE IF NOT EXISTS public.buddies_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT NOT NULL REFERENCES public.buddies_rooms(id) ON DELETE CASCADE,
  user_id TEXT,
  name TEXT NOT NULL,
  is_host BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

-- 3. 建立 buddies_questions 表（問題集）
CREATE TABLE IF NOT EXISTS public.buddies_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT NOT NULL REFERENCES public.buddies_rooms(id) ON DELETE CASCADE,
  questions JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. 建立 buddies_answers 表（答案）
CREATE TABLE IF NOT EXISTS public.buddies_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT NOT NULL REFERENCES public.buddies_rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  answers JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

-- 5. 建立 buddies_recommendations 表（推薦結果）
CREATE TABLE IF NOT EXISTS public.buddies_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT NOT NULL REFERENCES public.buddies_rooms(id) ON DELETE CASCADE,
  recommendations JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. 建立 buddies_votes 表（問題投票，已廢棄但保留相容性）
CREATE TABLE IF NOT EXISTS public.buddies_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT NOT NULL REFERENCES public.buddies_rooms(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  option TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. 建立 buddies_restaurant_votes 表（餐廳投票）
CREATE TABLE IF NOT EXISTS public.buddies_restaurant_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT NOT NULL REFERENCES public.buddies_rooms(id) ON DELETE CASCADE,
  restaurant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(room_id, restaurant_id, user_id)
);

-- 8. 建立 buddies_final_results 表（最終結果）
CREATE TABLE IF NOT EXISTS public.buddies_final_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT NOT NULL REFERENCES public.buddies_rooms(id) ON DELETE CASCADE,
  restaurant_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================
-- 建立索引以提升查詢效能
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_buddies_rooms_status ON public.buddies_rooms(status);
CREATE INDEX IF NOT EXISTS idx_buddies_members_room_id ON public.buddies_members(room_id);
CREATE INDEX IF NOT EXISTS idx_buddies_questions_room_id ON public.buddies_questions(room_id);
CREATE INDEX IF NOT EXISTS idx_buddies_answers_room_id ON public.buddies_answers(room_id);
CREATE INDEX IF NOT EXISTS idx_buddies_recommendations_room_id ON public.buddies_recommendations(room_id);
CREATE INDEX IF NOT EXISTS idx_buddies_votes_room_id ON public.buddies_votes(room_id);
CREATE INDEX IF NOT EXISTS idx_buddies_restaurant_votes_room_id ON public.buddies_restaurant_votes(room_id);
CREATE INDEX IF NOT EXISTS idx_buddies_final_results_room_id ON public.buddies_final_results(room_id);

-- ==========================================
-- 啟用 Row Level Security (RLS)
-- ==========================================

ALTER TABLE public.buddies_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buddies_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buddies_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buddies_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buddies_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buddies_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buddies_restaurant_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buddies_final_results ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 建立 RLS 政策（允許所有人讀寫，適用於 Buddies 模式的匿名房間）
-- ==========================================

-- buddies_rooms 政策
CREATE POLICY "Allow all access to buddies_rooms" ON public.buddies_rooms FOR ALL TO public USING (true) WITH CHECK (true);

-- buddies_members 政策
CREATE POLICY "Allow all access to buddies_members" ON public.buddies_members FOR ALL TO public USING (true) WITH CHECK (true);

-- buddies_questions 政策
CREATE POLICY "Allow all access to buddies_questions" ON public.buddies_questions FOR ALL TO public USING (true) WITH CHECK (true);

-- buddies_answers 政策
CREATE POLICY "Allow all access to buddies_answers" ON public.buddies_answers FOR ALL TO public USING (true) WITH CHECK (true);

-- buddies_recommendations 政策
CREATE POLICY "Allow all access to buddies_recommendations" ON public.buddies_recommendations FOR ALL TO public USING (true) WITH CHECK (true);

-- buddies_votes 政策
CREATE POLICY "Allow all access to buddies_votes" ON public.buddies_votes FOR ALL TO public USING (true) WITH CHECK (true);

-- buddies_restaurant_votes 政策
CREATE POLICY "Allow all access to buddies_restaurant_votes" ON public.buddies_restaurant_votes FOR ALL TO public USING (true) WITH CHECK (true);

-- buddies_final_results 政策
CREATE POLICY "Allow all access to buddies_final_results" ON public.buddies_final_results FOR ALL TO public USING (true) WITH CHECK (true);

-- ==========================================
-- 驗證建立結果
-- ==========================================

SELECT
  t.tablename,
  t.rowsecurity as rls_enabled,
  COUNT(p.policyname) as policy_count
FROM
  pg_tables t
LEFT JOIN
  pg_policies p ON p.schemaname = t.schemaname AND p.tablename = t.tablename
WHERE
  t.schemaname = 'public'
  AND t.tablename LIKE 'buddies_%'
GROUP BY
  t.tablename, t.rowsecurity
ORDER BY
  t.tablename;
