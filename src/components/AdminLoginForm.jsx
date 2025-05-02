import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../services/firebase";

// 管理員郵箱列表
const ADMIN_EMAILS = ["elson921121@gmail.com", "bli86327@gmail.com"];

export default function AdminLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 檢查是否為管理員郵箱
      if (!ADMIN_EMAILS.includes(user.email)) {
        setError("您無權限使用此後台功能。");
        return;
      }

      // 登入成功導向管理頁面
      navigate("/admin");
    } catch (err) {
      console.error("登入失敗：", err);
      setError("登入失敗，請確認帳號密碼。");
    }
  };

  return (
    <div className="admin-login-container">
      <h2>管理員登入</h2>
      <form onSubmit={handleLogin}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit">登入</button>
        {error && <p className="error-message">{error}</p>}
      </form>
    </div>
  );
}