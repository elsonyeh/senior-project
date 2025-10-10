# Supabase 郵件模板設置指南

## 目錄
- [訪問郵件模板設置](#訪問郵件模板設置)
- [郵件驗證模板](#郵件驗證模板)
- [忘記密碼模板](#忘記密碼模板)
- [魔術連結模板](#魔術連結模板)
- [自定義 SMTP 設置](#自定義-smtp-設置)

---

## 訪問郵件模板設置

1. 登入 [Supabase Dashboard](https://supabase.com/dashboard)
2. 選擇你的專案 (`SwiftTaste`)
3. 點擊左側選單 **Authentication** → **Email Templates**

---

## 郵件驗證模板

### 位置
**Confirm signup** 模板

### 建議模板內容

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang TC', 'Microsoft JhengHei', sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); overflow: hidden;">

          <!-- Header with brand color -->
          <tr>
            <td style="background: linear-gradient(135deg, #FF6B35 0%, #FF8C61 100%); padding: 40px 20px; text-align: center;">
              <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
                🍽️ SwiftTaste
              </h1>
              <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px; font-weight: 500;">
                美食探索，從這裡開始
              </p>
            </td>
          </tr>

          <!-- Main content -->
          <tr>
            <td style="padding: 40px 40px 20px 40px;">
              <h2 style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 24px; font-weight: 600; line-height: 1.4;">
                歡迎加入 SwiftTaste！
              </h2>
              <p style="margin: 0 0 20px 0; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                嗨！很高興你選擇加入我們 🎉
              </p>
              <p style="margin: 0 0 30px 0; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                只需要確認你的電子郵件地址，就能開始探索美味餐廳了！
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 10px 0 30px 0;">
                    <a href="{{ .ConfirmationURL }}" style="display: inline-block; padding: 16px 48px; background: linear-gradient(135deg, #FF6B35 0%, #FF8C61 100%); color: white; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(255, 107, 53, 0.3); transition: all 0.3s ease;">
                      ✓ 確認電子郵件
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Alternative link -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border-radius: 8px; padding: 20px;">
                <tr>
                  <td>
                    <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 13px; font-weight: 500;">
                      如果按鈕無法使用，請複製以下連結到瀏覽器：
                    </p>
                    <p style="margin: 0; word-break: break-all;">
                      <a href="{{ .ConfirmationURL }}" style="color: #FF6B35; font-size: 13px; text-decoration: underline;">
                        {{ .ConfirmationURL }}
                      </a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px 40px 40px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px 0; color: #9ca3af; font-size: 13px; line-height: 1.6;">
                這是一封自動發送的郵件，請勿直接回覆。
              </p>
              <p style="margin: 0 0 8px 0; color: #9ca3af; font-size: 13px; line-height: 1.6;">
                如果你沒有註冊 SwiftTaste，請忽略此郵件。
              </p>
              <p style="margin: 20px 0 0 0; color: #d1d5db; font-size: 12px;">
                © 2024 SwiftTaste. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 忘記密碼模板

### 位置
**Reset password** 模板

### 建議模板內容

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang TC', 'Microsoft JhengHei', sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); overflow: hidden;">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #FF6B35 0%, #FF8C61 100%); padding: 40px 20px; text-align: center;">
              <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
                🔐 SwiftTaste
              </h1>
              <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px; font-weight: 500;">
                密碼重設請求
              </p>
            </td>
          </tr>

          <!-- Main content -->
          <tr>
            <td style="padding: 40px 40px 20px 40px;">
              <h2 style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 24px; font-weight: 600; line-height: 1.4;">
                重設你的密碼
              </h2>
              <p style="margin: 0 0 20px 0; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                嗨！我們收到了重設你 SwiftTaste 帳戶密碼的請求。
              </p>
              <p style="margin: 0 0 30px 0; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                點擊下方按鈕即可設定新密碼：
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 10px 0 30px 0;">
                    <a href="{{ .ConfirmationURL }}" style="display: inline-block; padding: 16px 48px; background: linear-gradient(135deg, #FF6B35 0%, #FF8C61 100%); color: white; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(255, 107, 53, 0.3);">
                      🔑 重設密碼
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Warning box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #fff5f2 0%, #ffe8e0 100%); border-left: 4px solid #FF6B35; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                <tr>
                  <td>
                    <p style="margin: 0; color: #dc2626; font-size: 14px; font-weight: 600;">
                      ⚠️ 重要提醒
                    </p>
                    <p style="margin: 10px 0 0 0; color: #991b1b; font-size: 13px; line-height: 1.6;">
                      此連結將在 <strong>1 小時後過期</strong>，請盡快完成密碼重設。
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Alternative link -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border-radius: 8px; padding: 20px;">
                <tr>
                  <td>
                    <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 13px; font-weight: 500;">
                      如果按鈕無法使用，請複製以下連結到瀏覽器：
                    </p>
                    <p style="margin: 0; word-break: break-all;">
                      <a href="{{ .ConfirmationURL }}" style="color: #FF6B35; font-size: 13px; text-decoration: underline;">
                        {{ .ConfirmationURL }}
                      </a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px 40px 40px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px 0; color: #9ca3af; font-size: 13px; line-height: 1.6;">
                這是一封自動發送的郵件，請勿直接回覆。
              </p>
              <p style="margin: 0 0 8px 0; color: #9ca3af; font-size: 13px; line-height: 1.6;">
                如果你沒有請求重設密碼，請忽略此郵件並確保你的帳戶安全。
              </p>
              <p style="margin: 20px 0 0 0; color: #d1d5db; font-size: 12px;">
                © 2024 SwiftTaste. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 魔術連結模板

### 位置
**Magic Link** 模板

### 建議模板內容

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang TC', 'Microsoft JhengHei', sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); overflow: hidden;">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #FF6B35 0%, #FF8C61 100%); padding: 40px 20px; text-align: center;">
              <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
                ✨ SwiftTaste
              </h1>
              <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px; font-weight: 500;">
                快速登入連結
              </p>
            </td>
          </tr>

          <!-- Main content -->
          <tr>
            <td style="padding: 40px 40px 20px 40px;">
              <h2 style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 24px; font-weight: 600; line-height: 1.4;">
                一鍵快速登入
              </h2>
              <p style="margin: 0 0 20px 0; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                嗨！這是你的專屬登入連結 🚀
              </p>
              <p style="margin: 0 0 30px 0; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                點擊下方按鈕即可安全登入，無需輸入密碼：
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 10px 0 30px 0;">
                    <a href="{{ .ConfirmationURL }}" style="display: inline-block; padding: 16px 48px; background: linear-gradient(135deg, #FF6B35 0%, #FF8C61 100%); color: white; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(255, 107, 53, 0.3);">
                      🚀 立即登入
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Info box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-left: 4px solid #0ea5e9; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                <tr>
                  <td>
                    <p style="margin: 0; color: #0369a1; font-size: 14px; font-weight: 600;">
                      💡 安全提示
                    </p>
                    <p style="margin: 10px 0 0 0; color: #075985; font-size: 13px; line-height: 1.6;">
                      此連結將在 <strong>1 小時後過期</strong>，且只能使用一次。
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Alternative link -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border-radius: 8px; padding: 20px;">
                <tr>
                  <td>
                    <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 13px; font-weight: 500;">
                      如果按鈕無法使用，請複製以下連結到瀏覽器：
                    </p>
                    <p style="margin: 0; word-break: break-all;">
                      <a href="{{ .ConfirmationURL }}" style="color: #FF6B35; font-size: 13px; text-decoration: underline;">
                        {{ .ConfirmationURL }}
                      </a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px 40px 40px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px 0; color: #9ca3af; font-size: 13px; line-height: 1.6;">
                這是一封自動發送的郵件，請勿直接回覆。
              </p>
              <p style="margin: 0 0 8px 0; color: #9ca3af; font-size: 13px; line-height: 1.6;">
                如果你沒有請求登入連結，請忽略此郵件並確保你的帳戶安全。
              </p>
              <p style="margin: 20px 0 0 0; color: #d1d5db; font-size: 12px;">
                © 2024 SwiftTaste. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 郵件變數說明

Supabase 提供以下變數可在郵件模板中使用：

- `{{ .ConfirmationURL }}` - 確認連結（驗證/重設密碼/魔術連結）
- `{{ .Token }}` - 驗證 token（如需自定義確認流程）
- `{{ .TokenHash }}` - Token 的 hash 值
- `{{ .SiteURL }}` - 你的網站 URL
- `{{ .Email }}` - 用戶的電子郵件地址

---

## 自定義 SMTP 設置（可選）

如果你想使用自己的 SMTP 服務（例如 SendGrid、Mailgun、AWS SES）：

### 步驟

1. 前往 **Authentication** → **Email Templates** → **SMTP Settings**
2. 開啟 **Enable Custom SMTP**
3. 填寫以下資訊：
   - **Sender name**: SwiftTaste
   - **Sender email**: noreply@swifttaste.com（或你的域名）
   - **Host**: smtp.sendgrid.net（或其他服務）
   - **Port**: 587
   - **Username**: apikey（SendGrid）或其他
   - **Password**: 你的 API key

### 優點
- ✅ 更高的郵件送達率
- ✅ 避免被標記為垃圾郵件
- ✅ 更好的追蹤和分析
- ✅ 自定義寄件者域名

---

## 設置步驟總結

1. **訪問 Supabase Dashboard**
   ```
   Dashboard → Authentication → Email Templates
   ```

2. **編輯每個模板**
   - Confirm signup（註冊驗證）
   - Reset password（重設密碼）
   - Magic Link（魔術連結）
   - Change Email Address（更改郵件地址，可選）

3. **測試郵件**
   - 在開發環境註冊新帳號
   - 檢查郵件是否正確顯示
   - 確認連結是否正常運作

4. **調整 redirectTo URL**
   - 確保 `authService.js` 中的 redirectTo 設置正確
   - 開發環境：`window.location.origin`
   - 生產環境：`https://senior-project-ruby.vercel.app`

---

## 品牌配色參考

SwiftTaste 主題色：
- 主色：`#FF6B35` （橘紅色）
- 輔助灰色：`#666666`
- 淺灰色：`#999999`
- 背景色：`#FFFFFF`

---

## 測試檢查清單

- [ ] 註冊驗證郵件正常發送
- [ ] 註冊驗證連結可正常跳轉
- [ ] 忘記密碼郵件正常發送
- [ ] 重設密碼連結可正常運作
- [ ] 郵件樣式在主流郵件客戶端正常顯示
  - [ ] Gmail
  - [ ] Outlook
  - [ ] Apple Mail
  - [ ] 手機郵件 App
- [ ] 按鈕可點擊且樣式正確
- [ ] 備用文字連結正常運作

---

## 常見問題

### Q: 郵件沒有收到？
A:
1. 檢查垃圾郵件資料夾
2. 確認 Supabase 專案的郵件配額未超過
3. 檢查 Supabase 的 Auth logs
4. 考慮設置自定義 SMTP

### Q: 郵件樣式顯示不正確？
A:
1. 避免使用複雜的 CSS
2. 使用行內樣式（inline styles）
3. 測試不同郵件客戶端
4. 使用郵件 HTML 預處理工具

### Q: 連結跳轉錯誤？
A:
1. 檢查 `authService.js` 的 redirectTo 設置
2. 確認 Supabase Dashboard 的 Site URL 設置
3. 檢查 Redirect URLs 白名單

---

## Redirect URLs 設定

### 什麼是 Redirect URLs？

Redirect URLs（重定向網址）是 Supabase Auth 的安全機制，用來限制用戶認證後可以被重定向到哪些網址。這是為了防止惡意攻擊者將用戶重定向到釣魚網站。

### 為什麼需要設定？

當用戶點擊郵件中的確認連結（註冊驗證、重設密碼、魔術連結）時，Supabase 會將用戶重定向回你的應用程式。如果目標網址不在白名單中，重定向會失敗。

### 在哪裡設定？

1. 前往 **Supabase Dashboard**
2. 選擇你的專案
3. **Authentication** → **URL Configuration**
4. 找到 **Redirect URLs** 區域

### 需要加入的網址

根據 `authService.js` 的設定，你需要加入以下網址：

#### 開發環境
```
http://localhost:5173
http://localhost:5173/reset-password
http://localhost:5174
http://localhost:5174/reset-password
```

#### 生產環境
```
https://senior-project-ruby.vercel.app
https://senior-project-ruby.vercel.app/reset-password
```

#### 完整設定範例

在 **Redirect URLs** 欄位中加入（每個網址一行）：

```
http://localhost:5173
http://localhost:5174
https://senior-project-ruby.vercel.app
https://senior-project-ruby.vercel.app/*
```

> 💡 **提示**: 使用萬用字元 `/*` 可以涵蓋所有子路徑

### Site URL 設定

**Site URL** 是預設的重定向網址，當沒有指定 `redirectTo` 時會使用這個：

- **開發環境**: `http://localhost:5173`
- **生產環境**: `https://senior-project-ruby.vercel.app`

### authService.js 中的相關設定

```javascript
// 註冊時的 redirectTo
emailRedirectTo: import.meta.env.DEV ?
  window.location.origin :
  'https://senior-project-ruby.vercel.app'

// 重設密碼時的 redirectTo
redirectTo: `${import.meta.env.DEV ?
  window.location.origin :
  'https://senior-project-ruby.vercel.app'}/reset-password`
```

### 常見問題

#### Q: 為什麼郵件連結點擊後出現錯誤？
A: 檢查以下項目：
1. Redirect URLs 是否已正確設定
2. 網址拼寫是否正確（注意 http vs https）
3. 是否包含所有需要的路徑

#### Q: 需要加入 www 版本嗎？
A: 如果你的網站同時支援 `www.domain.com` 和 `domain.com`，兩個都需要加入。

#### Q: Vercel 的預覽部署需要加入嗎？
A: 預覽部署（`*.vercel.app`）的網址會經常變動，建議：
- 使用萬用字元：`https://*.vercel.app`
- 或者在測試時手動加入特定的預覽網址

#### Q: 本地開發的端口號不同怎麼辦？
A: 如果你的 Vite 使用不同端口（例如 5175），記得加入：
```
http://localhost:5175
http://localhost:5175/reset-password
```

### 安全建議

✅ **應該做的**：
- 只加入你擁有的網域
- 生產環境使用 HTTPS
- 定期檢查並移除不再使用的網址

❌ **不應該做的**：
- 加入萬用字元 `*`（允許任何網址）
- 加入測試或臨時網址後忘記移除
- 加入不受信任的第三方網址

### 測試檢查清單

設定完成後，測試以下情況：

- [ ] 開發環境註冊 → 郵件連結可正常跳轉
- [ ] 開發環境重設密碼 → 郵件連結可正常跳轉
- [ ] 生產環境註冊 → 郵件連結可正常跳轉
- [ ] 生產環境重設密碼 → 郵件連結可正常跳轉
- [ ] Google OAuth 登入後正確跳轉
- [ ] Apple OAuth 登入後正確跳轉（如有使用）

---

## 相關文件

- [Supabase Auth Email Templates 官方文檔](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Supabase SMTP 設置](https://supabase.com/docs/guides/auth/auth-smtp)
- [Supabase Redirect URLs 官方說明](https://supabase.com/docs/guides/auth/redirect-urls)
- `authService.js` - 認證服務實作
