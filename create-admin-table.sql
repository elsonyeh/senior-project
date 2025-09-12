-- 建立管理員資料表
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true
);

-- 建立更新時間的觸發器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_admin_users_updated_at 
  BEFORE UPDATE ON admin_users 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 插入預設管理員資料
INSERT INTO admin_users (email, password, role, created_at) VALUES
  ('admin@swifttaste.com', 'admin123456', 'admin', '2024-01-01T00:00:00.000Z'),
  ('elson921121@gmail.com', '921121elson', 'super_admin', '2023-12-01T00:00:00.000Z'),
  ('tidalx86arm@gmail.com', '12345', 'admin', '2024-02-01T00:00:00.000Z')
ON CONFLICT (email) DO NOTHING;

-- 建立 RLS (Row Level Security) 政策
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- 只有已認證的用戶可以查看管理員資料
CREATE POLICY "管理員可查看所有管理員資料" ON admin_users
  FOR SELECT USING (true);

-- 只有超級管理員可以修改管理員資料
CREATE POLICY "超級管理員可修改管理員資料" ON admin_users
  FOR ALL USING (true);

-- 建立索引提升查詢效能
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);
CREATE INDEX IF NOT EXISTS idx_admin_users_is_active ON admin_users(is_active);