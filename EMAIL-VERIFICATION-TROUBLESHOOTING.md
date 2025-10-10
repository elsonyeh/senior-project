# Email 驗證郵件未寄出問題診斷

## 問題描述
使用者註冊後，應該會收到一封郵件驗證信，但郵件沒有成功寄出。

---

## 診斷步驟

### 1️⃣ 檢查 Supabase Dashboard - Auth Settings

#### 位置
```
Supabase Dashboard → Authentication → Settings
```

#### 必須檢查的設定

**A. Email Confirmation (最重要！)**
- ✅ 確認 **Enable email confirmations** 是否開啟
- 位置：`Authentication → Settings → Email Auth`
- 如果這個選項是關閉的，Supabase 就不會發送驗證郵件

**B. Site URL**
- 確認設定為：`https://senior-project-ruby.vercel.app`
- 或開發環境：`http://localhost:5173`

**C. Redirect URLs**
- 確認包含以下網址：
  ```
  http://localhost:5173
  http://localhost:5174
  https://senior-project-ruby.vercel.app
  https://senior-project-ruby.vercel.app/*
  ```

---

### 2️⃣ 檢查 Supabase Auth Logs

#### 如何檢查
1. 前往 **Supabase Dashboard**
2. **Authentication** → **Logs**
3. 查找最近的註冊事件

#### 要找什麼
- ✅ 有 `user.created` 事件
- ✅ 有 `email.confirmation.sent` 事件
- ❌ 如果只有 `user.created` 但沒有 `email.confirmation.sent`，表示郵件沒有發送

---

### 3️⃣ 檢查郵件配額

#### Supabase 免費方案限制
- **每小時**: 最多 3 封郵件
- **每天**: 最多 30 封郵件

#### 如何檢查
1. **Authentication** → **Settings** → **SMTP Settings**
2. 查看是否顯示 "Rate limit exceeded"

#### 解決方案
如果超過配額：
- 等待一段時間後再試
- 設置自定義 SMTP (SendGrid, Mailgun, AWS SES)

---

### 4️⃣ 檢查郵件模板設定

#### 位置
```
Authentication → Email Templates → Confirm signup
```

#### 確認事項
- ✅ 模板是否正確設定
- ✅ `{{ .ConfirmationURL }}` 變數是否存在
- ✅ 沒有 HTML 語法錯誤

---

### 5️⃣ 檢查程式碼設定

#### authService.js (Line 6-29)

當前設定：
```javascript
async signUp(email, password, userData = {}) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name: userData.name || email.split('@')[0],
        bio: userData.bio || '',
        avatar_url: userData.avatar_url || null
      },
      emailRedirectTo: import.meta.env.DEV ?
        window.location.origin :
        'https://senior-project-ruby.vercel.app'
    }
  });
  // ...
}
```

#### 檢查點
✅ `emailRedirectTo` 設定正確
✅ 沒有設定 `emailRedirectTo: undefined`

---

### 6️⃣ 檢查環境變數

#### .env 檔案
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

#### 確認
- ✅ Supabase URL 正確
- ✅ Anon Key 正確
- ✅ 沒有多餘的空格或引號

---

### 7️⃣ 測試註冊流程

#### 測試步驟
1. 打開瀏覽器開發者工具 (F12)
2. 切換到 **Console** 和 **Network** 標籤
3. 執行註冊操作

#### Console 輸出檢查
應該看到：
```javascript
// UserProfilePage.jsx Line 203
'註冊成功！請檢查您的電子郵件以確認帳戶。'
```

#### Network 請求檢查
查找 `/auth/v1/signup` 請求：
- **Status**: 200 OK
- **Response**: 檢查是否包含 `user` 物件
- **Email Send**: 查看 response 中是否有郵件發送相關資訊

---

### 8️⃣ 檢查垃圾郵件資料夾

#### 常見情況
- Gmail: 檢查「促銷內容」、「社交」、「垃圾郵件」
- Outlook: 檢查「其他」、「垃圾郵件」
- Yahoo: 檢查「大量郵件」

#### 提示
Supabase 預設 SMTP 發送的郵件容易被標記為垃圾郵件

---

## 常見原因與解決方案

### ❌ 問題 1: Email Confirmation 未開啟

**症狀**: 註冊成功，但沒有收到郵件

**解決**:
```
Dashboard → Authentication → Settings → Email Auth
→ 開啟 "Enable email confirmations"
```

---

### ❌ 問題 2: 超過郵件配額

**症狀**: 前幾次可以收到郵件，後來收不到

**解決**:
1. **短期**: 等待配額重置（每小時/每天）
2. **長期**: 設置自定義 SMTP

#### 設置自定義 SMTP (推薦)
```
Dashboard → Authentication → Email Templates → SMTP Settings
→ Enable Custom SMTP
```

推薦服務：
- **SendGrid**: 免費 100 封/天
- **Mailgun**: 免費 100 封/天
- **AWS SES**: 便宜且可靠

---

### ❌ 問題 3: 郵件模板錯誤

**症狀**: Auth logs 顯示錯誤

**解決**:
1. 檢查 Email Templates
2. 使用本專案提供的模板（SUPABASE-EMAIL-TEMPLATE-SETUP.md）
3. 確認 HTML 語法正確

---

### ❌ 問題 4: Redirect URLs 未設定

**症狀**: 郵件收到了，但點擊連結後跳轉失敗

**解決**:
```
Dashboard → Authentication → URL Configuration
→ 加入所有需要的 Redirect URLs
```

---

### ❌ 問題 5: Email Provider 封鎖

**症狀**: 特定郵件地址收不到（例如某些企業郵箱）

**解決**:
1. 使用不同郵件地址測試（Gmail, Outlook）
2. 聯絡郵件管理員檢查防火牆設定
3. 設置自定義 SMTP 並驗證域名

---

## 立即檢查清單

### 快速診斷（5分鐘）

- [ ] **Step 1**: 前往 `Authentication → Settings`，確認 "Enable email confirmations" 已開啟
- [ ] **Step 2**: 前往 `Authentication → Logs`，查看是否有 `email.confirmation.sent` 事件
- [ ] **Step 3**: 檢查垃圾郵件資料夾
- [ ] **Step 4**: 前往 `Authentication → Email Templates`，確認模板正確
- [ ] **Step 5**: 測試使用不同郵件地址註冊（Gmail, Outlook）

### 如果還是收不到

- [ ] **Step 6**: 檢查是否超過郵件配額
- [ ] **Step 7**: 前往 `Authentication → URL Configuration`，確認所有 URLs 設定正確
- [ ] **Step 8**: 檢查 Network 請求，看 signup 是否成功
- [ ] **Step 9**: 考慮設置自定義 SMTP

---

## 測試用郵件地址

建議使用以下郵件服務測試：

1. **Gmail** (`@gmail.com`)
   - 最常用，送達率高
   - 檢查「促銷內容」分類

2. **Outlook** (`@outlook.com` / `@hotmail.com`)
   - 檢查「其他」資料夾

3. **臨時郵箱** (測試用)
   - [Temp Mail](https://temp-mail.org/)
   - [Guerrilla Mail](https://www.guerrillamail.com/)
   - ⚠️ 僅用於測試，不用於正式註冊

---

## Debug 日誌收集

如果問題持續，請收集以下資訊：

### 前端 Console 日誌
```javascript
// 打開瀏覽器 Console
// 註冊時應該看到：
handleRegister called // (如果你加了 console.log)
註冊成功！請檢查您的電子郵件以確認帳戶。
```

### Network 請求
```
POST /auth/v1/signup
Status: 200
Response: {
  "user": { ... },
  "session": null // 因為需要郵件驗證
}
```

### Supabase Auth Logs
```
Event: user.created
Email: test@example.com
Time: 2024-xx-xx xx:xx:xx

Event: email.confirmation.sent (或缺少這個)
Email: test@example.com
Time: 2024-xx-xx xx:xx:xx
```

---

## 臨時解決方案

如果急需測試其他功能，可以暫時關閉郵件驗證：

```
Dashboard → Authentication → Settings → Email Auth
→ 關閉 "Enable email confirmations"
```

⚠️ **注意**: 這會讓用戶無需驗證即可登入，僅適合開發測試！

---

## 推薦的長期解決方案

### 設置自定義 SMTP (SendGrid)

#### 優點
- ✅ 免費額度高（100封/天）
- ✅ 送達率更高
- ✅ 不易被標記為垃圾郵件
- ✅ 詳細的發送統計

#### 設置步驟
1. 註冊 [SendGrid](https://sendgrid.com/)
2. 創建 API Key
3. 在 Supabase 設定：
   ```
   Host: smtp.sendgrid.net
   Port: 587
   Username: apikey
   Password: your_api_key
   Sender: noreply@yourdomain.com
   ```

---

## 相關文件

- `authService.js` - 註冊實作
- `UserProfilePage.jsx` - 註冊UI (Line 193-205)
- `SUPABASE-EMAIL-TEMPLATE-SETUP.md` - 郵件模板設定
- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Supabase SMTP Setup](https://supabase.com/docs/guides/auth/auth-smtp)

---

## 需要幫助？

如果以上步驟都無法解決問題，請提供：

1. Supabase Auth Logs 截圖
2. Browser Console 輸出
3. Network 請求的 Response
4. Email Confirmation 設定截圖

這樣可以更準確地診斷問題！
