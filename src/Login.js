import { useState } from "react";
import { loginUser } from "./api";
import Register from "./Register";

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  if (showRegister) {
    return <Register onBack={() => setShowRegister(false)} onLoginSuccess={onLoginSuccess} />;
  }

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await loginUser(email, password);

      // ✅ proper error messages
      if (res.status === 401) {
        const text = await res.text();
        if (text.includes("not registered") || text.includes("User not")) {
          setError("❌ Email not registered. Please sign up first!");
        } else {
          setError("❌ Wrong password. Please try again!");
        }
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setError("Something went wrong. Try again!");
        setLoading(false);
        return;
      }

      const data = await res.json();
      onLoginSuccess(data.token);
    } catch (err) {
      setError("🔌 Cannot connect to server. Is Spring Boot running?");
    }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">✅</div>
        <h2>Welcome Back</h2>
        <p className="auth-sub">Sign in to your tasks</p>

        {error && <div className="auth-error">{error}</div>}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
        />

        <button className="auth-btn" onClick={handleLogin} disabled={loading}>
          {loading ? "Signing in..." : "Sign In"}
        </button>

        <p className="auth-switch">
          Don't have an account?{" "}
          <span onClick={() => setShowRegister(true)}>Register here</span>
        </p>
      </div>
    </div>
  );
}