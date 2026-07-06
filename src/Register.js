import { useState } from "react";
import { registerUser } from "./api";

export default function Register({ onBack, onLoginSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }
    if (password.length < 4) {
      setError("Password must be at least 4 characters");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await registerUser(email, password);
      if (!res.ok) {
        const text = await res.text();
        setError(text || "Registration failed");
        return;
      }
      // auto login after register
      const { loginUser } = await import("./api");
      const loginRes = await loginUser(email, password);
      const data = await loginRes.json();
      onLoginSuccess(data.token, email);
    } catch (err) {
      setError("Cannot connect to server. Is Spring Boot running?");
    }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">🚀</div>
        <h2>Create Account</h2>
        <p className="auth-sub">Start managing your tasks</p>

        {error && <div className="auth-error">{error}</div>}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleRegister()}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleRegister()}
        />

        <button className="auth-btn" onClick={handleRegister} disabled={loading}>
          {loading ? "Creating account..." : "Create Account"}
        </button>

        <p className="auth-switch">
          Already have an account?{" "}
          <span onClick={onBack}>Sign in here</span>
        </p>
      </div>
    </div>
  );
}