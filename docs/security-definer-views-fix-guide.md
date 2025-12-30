# SECURITY DEFINER Views 安全性修復指南

## 🚨 问题说明

Supabase Database Linter 检测到多个 views 使用了 `SECURITY DEFINER` 属性，这会带来严重的安全风险。

### 什么是 SECURITY DEFINER?

- **SECURITY DEFINER**: View 以创建者的权限执行
- **SECURITY INVOKER**: View 以查询者的权限执行（默认且更安全）

### 安全风险

当 view 使用 `SECURITY DEFINER` 时：

1. **权限提升攻击**: 任何能访问 view 的用户都能获得 view 创建者的权限
2. **RLS 绕过**: Row Level Security 策略使用创建者身份而非查询者身份
3. **数据泄露**: 用户可能访问到本不应该看到的数据

### 受影响的 Views

以下 6 个 views 被检测到使用 SECURITY DEFINER：

| View 名称 | 用途 | 风险等级 |
|-----------|------|----------|
| `buddies_room_timeline` | 房间事件时间线 | ERROR |
| `buddies_event_stats` | 事件统计 | ERROR |
| `room_completion_funnel` | 完成率漏斗 | ERROR |
| `cleanup_health_status` | 清理系统状态 | ERROR |
| `cleanup_history_stats` | 清理历史统计 | ERROR |
| `v_swifttaste_sessions_with_interactions` | SwiftTaste 会话统计 | ERROR |

---

## ✅ 修复方案

### 方法 1: 使用提供的修复脚本 (推荐)

**执行步骤**:

1. 打开 Supabase Dashboard
2. 进入 SQL Editor
3. 复制并执行 `database/migrations/fix-security-definer-views.sql`
4. 等待执行完成
5. 重新运行 Database Linter 验证

**脚本执行内容**:

```sql
-- 将所有 SECURITY DEFINER views 改为 SECURITY INVOKER
CREATE OR REPLACE VIEW public.buddies_room_timeline
WITH (security_invoker = true)  -- 👈 关键修改
AS
SELECT ...
```

### 方法 2: 手动修复单个 View

如果只想修复特定 view：

```sql
-- 1. 删除旧 view
DROP VIEW IF EXISTS public.buddies_room_timeline CASCADE;

-- 2. 重新创建，添加 security_invoker = true
CREATE OR REPLACE VIEW public.buddies_room_timeline
WITH (security_invoker = true)
AS
SELECT
  e.room_id,
  e.event_type,
  e.user_id,
  e.event_data,
  e.created_at,
  EXTRACT(EPOCH FROM (e.created_at - LAG(e.created_at) OVER (PARTITION BY e.room_id ORDER BY e.created_at)))::integer AS seconds_since_last_event
FROM buddies_events e
ORDER BY e.room_id, e.created_at;
```

---

## 🔒 配套 RLS 策略

修复 views 的同时，脚本会为底层表设置适当的 Row Level Security 策略：

### 1. buddies_events & buddies_rooms

```sql
-- 允许所有人读取（用于公开统计）
CREATE POLICY "Allow public read access to buddies_events"
ON public.buddies_events
FOR SELECT
TO public
USING (true);
```

**原因**: 这些表包含事件统计，需要公开展示。

### 2. cleanup_logs

```sql
-- 只允许管理员读取
CREATE POLICY "Allow admins read access to cleanup_logs"
ON public.cleanup_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE email = current_setting('request.jwt.claims', true)::json->>'email'
    AND is_active = true
  )
);
```

**原因**: 清理日志是管理员专用信息。

### 3. swifttaste_interactions

```sql
-- 用户可以读取自己的互动记录
CREATE POLICY "Users can read own interactions"
ON public.swifttaste_interactions
FOR SELECT
TO authenticated
USING (
  user_id::text = current_setting('request.jwt.claims', true)::json->>'sub'
  OR user_id IS NULL  -- 允许匿名互动
);
```

**原因**: 保护用户隐私，只能查看自己的数据。

### 4. user_selection_history

```sql
-- 用户可以读取自己的选择历史
CREATE POLICY "Users can read own history"
ON public.user_selection_history
FOR SELECT
TO authenticated
USING (
  user_id = current_setting('request.jwt.claims', true)::json->>'sub'
  OR user_id IS NULL  -- 允许匿名会话
);
```

**原因**: 同样保护用户隐私。

---

## 📊 修复前后对比

### 修复前 (不安全)

```sql
CREATE VIEW buddies_room_timeline AS  -- 默认 SECURITY DEFINER
SELECT ...
```

**问题**:
- ❌ 任何用户查询这个 view 都会以创建者权限执行
- ❌ 如果创建者是超级用户，普通用户可能访问到敏感数据
- ❌ RLS 策略被绕过

### 修复后 (安全)

```sql
CREATE VIEW buddies_room_timeline
WITH (security_invoker = true)  -- 明确指定
AS SELECT ...
```

**改进**:
- ✅ 查询者使用自己的权限
- ✅ RLS 策略正确应用
- ✅ 无法提升权限
- ✅ 数据访问受到正确控制

---

## 🧪 测试验证

### 1. 验证 View 已修复

```sql
SELECT
  schemaname,
  viewname,
  viewowner,
  definition
FROM pg_views
WHERE viewname IN (
  'buddies_room_timeline',
  'buddies_event_stats',
  'room_completion_funnel',
  'cleanup_health_status',
  'cleanup_history_stats',
  'v_swifttaste_sessions_with_interactions'
)
AND schemaname = 'public';
```

检查 `definition` 中是否包含 `WITH (security_invoker = true)`。

### 2. 运行 Database Linter

在 Supabase Dashboard:
1. 进入 Database → Linter
2. 点击 "Run Linter"
3. 确认 `security_definer_view` 警告已消失

### 3. 功能测试

测试应用功能确保 views 仍然正常工作：

- [ ] Buddies 模式房间统计
- [ ] SwiftTaste 会话统计
- [ ] 清理系统健康检查
- [ ] 管理面板数据分析

---

## ⚠️ 重要注意事项

### 1. 向后兼容性

✅ **完全向后兼容**
- Views 的查询结果不变
- API 调用不需要修改
- 前端代码无需更改

### 2. 权限变化

修复后，views 会使用**查询者的权限**而不是**创建者的权限**：

- **公开统计 views** (buddies_event_stats 等):
  - 底层表设置了公开读取策略
  - 任何人都可以查询 ✅

- **管理员 views** (cleanup_logs 相关):
  - 需要管理员身份才能查询
  - 普通用户会收到权限拒绝错误 ⚠️

- **用户数据 views** (v_swifttaste_sessions_with_interactions):
  - 用户只能看到自己的数据
  - 遵循 RLS 策略 ✅

### 3. 潜在影响

**可能需要调整的场景**:

1. **如果有代码依赖于 SECURITY DEFINER 行为**
   - 检查是否有代码期望普通用户能访问管理员数据
   - 修改代码使用正确的权限模型

2. **如果有外部服务查询这些 views**
   - 确保服务使用适当的凭证
   - 管理员服务需要管理员权限

---

## 🔐 安全最佳实践

### 1. 默认使用 SECURITY INVOKER

创建新 view 时总是明确指定：

```sql
CREATE VIEW my_new_view
WITH (security_invoker = true)  -- 👈 总是添加这一行
AS
SELECT ...
```

### 2. 只在必要时使用 SECURITY DEFINER

极少数情况下可能需要 SECURITY DEFINER（例如需要绕过 RLS 的系统函数），此时：

1. **明确记录原因**
2. **最小化暴露的数据**
3. **添加额外的安全检查**
4. **定期审计**

```sql
CREATE VIEW sensitive_view
WITH (security_definer = true)  -- 谨慎使用！
AS
SELECT
  -- 只暴露必要的字段
  id,
  summary_data
FROM sensitive_table
WHERE
  -- 添加额外的安全检查
  is_public = true;

COMMENT ON VIEW sensitive_view IS
  '⚠️ SECURITY DEFINER view - 需要绕过 RLS 以提供公开摘要数据';
```

### 3. 定期运行 Database Linter

- 每次数据库迁移后运行
- 每周自动检查
- 将 linting 加入 CI/CD 流程

---

## 📚 相关资源

- [Supabase Database Linter 文档](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view)
- [PostgreSQL Views Security](https://www.postgresql.org/docs/current/sql-createview.html)
- [Row Level Security 最佳实践](https://supabase.com/docs/guides/database/postgres/row-level-security)

---

## ✅ 检查清单

执行修复后，确认以下项目：

- [ ] 执行了 `fix-security-definer-views.sql`
- [ ] Database Linter 不再显示 SECURITY DEFINER 警告
- [ ] 所有应用功能正常工作
- [ ] 统计页面正确显示数据
- [ ] 管理员可以访问管理数据
- [ ] 普通用户无法访问他人数据
- [ ] 已提交代码到版本控制

---

## 🆘 故障排除

### 问题 1: "permission denied for view"

**原因**: 用户没有权限访问底层表

**解决方案**:
```sql
-- 为公开统计添加读取策略
CREATE POLICY "Allow public read access"
ON public.your_table
FOR SELECT
TO public
USING (true);
```

### 问题 2: Views 查询结果为空

**原因**: RLS 策略过于严格

**解决方案**:
```sql
-- 检查 RLS 策略
SELECT * FROM pg_policies WHERE tablename = 'your_table';

-- 调整策略允许适当的访问
```

### 问题 3: 管理员也无法访问数据

**原因**: `is_admin()` 函数未正确识别管理员

**解决方案**:
```sql
-- 测试管理员函数
SELECT public.is_admin();  -- 应该返回 true

-- 检查 admin_users 表
SELECT * FROM admin_users WHERE is_active = true;
```

---

**执行修复后，您的数据库将更加安全，符合最佳实践！** 🔒✨
