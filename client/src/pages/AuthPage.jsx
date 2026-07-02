import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AuthPage() {
  const [tab, setTab] = useState("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [qrCode, setQrCode] = useState(null);

  const { login, register, verifyEmail, user } = useAuth();
  const navigate = useNavigate();

  // If already authenticated, redirect
  if (user) {
    navigate("/dashboard", { replace: true });
  }

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (
      tab !== "verify" &&
      (!email || !password || (tab === "register" && !username))
    ) {
      setError("Please fill in all fields");
      return;
    }

    if (tab === "verify" && !otp) {
      setError("Please enter the OTP");
      return;
    }

    setSubmitting(true);
    try {
      if (tab === "login") {
        await login(email, password);
        showToast("success", "Welcome back!");
        navigate("/dashboard", { replace: true });
      } else if (tab === "register") {
        const res = await register(username, email, password);
        showToast("success", "Scan the QR code to proceed!");
        if (res.qrCode) setQrCode(res.qrCode);
        setTab("verify");
      } else if (tab === "verify") {
        await verifyEmail(email, otp);
        showToast("success", "Email verified successfully!");
        navigate("/dashboard", { replace: true });
      }
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        "Something went wrong";
      setError(msg);
      showToast("error", msg);
    } finally {
      setSubmitting(false);
    }
  };

  const switchTab = (newTab) => {
    setTab(newTab);
    setError("");
    setEmail("");
    setUsername("");
    setPassword("");
    setOtp("");
  };

  return (
    <div className="auth-page">
      <div className="bg-pattern" />

      {/* Toast */}
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <span className="toast-icon">
              {toast.type === "success"
                ? "✓"
                : toast.type === "error"
                  ? "✕"
                  : "ℹ"}
            </span>
            <span className="toast-message">{toast.message}</span>
            <button className="toast-close" onClick={() => setToast(null)}>
              ×
            </button>
          </div>
        </div>
      )}

      <div className="auth-container">
        <div className="auth-header">
          <h1>CoCode</h1>
          <p>Real-time collaborative development workspace</p>
        </div>

        <div className="auth-card">
          <div className="auth-tabs">
            {tab !== "verify" ? (
              <>
                <button
                  className={`auth-tab ${tab === "login" ? "active" : ""}`}
                  onClick={() => switchTab("login")}
                >
                  Sign In
                </button>
                <button
                  className={`auth-tab ${tab === "register" ? "active" : ""}`}
                  onClick={() => switchTab("register")}
                >
                  Sign Up
                </button>
              </>
            ) : (
              <button className="auth-tab active">Verify Email</button>
            )}
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {tab === "verify" ? (
              <>
                <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
                  {qrCode && (
                    <img
                      src={qrCode}
                      alt="Authenticator QR Code"
                      style={{
                        margin: "0 auto",
                        display: "block",
                        borderRadius: "8px",
                        border: "2px solid var(--border-color)",
                        marginBottom: "1rem",
                      }}
                    />
                  )}
                  <p
                    style={{
                      color: "var(--text-secondary)",
                      fontSize: "var(--fs-sm)",
                    }}
                  >
                    Scan this QR code with <strong>Google Authenticator</strong>{" "}
                    or <strong>Authy</strong>, then enter the 6-digit code
                    below.
                  </p>
                </div>
                <div className="input-group">
                  <label>Authenticator Code</label>
                  <input
                    type="text"
                    className={`input ${error && !otp ? "input-error" : ""}`}
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    maxLength={6}
                    autoComplete="one-time-code"
                  />
                </div>
              </>
            ) : (
              <>
                {tab === "register" && (
                  <div className="input-group">
                    <label>Username</label>
                    <input
                      type="text"
                      className={`input ${error && !username ? "input-error" : ""}`}
                      placeholder="Choose a username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoComplete="username"
                    />
                  </div>
                )}

                <div className="input-group">
                  <label>Email</label>
                  <input
                    type="email"
                    className={`input ${error && !email ? "input-error" : ""}`}
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>

                <div className="input-group">
                  <label>Password</label>
                  <input
                    type="password"
                    className={`input ${error && !password ? "input-error" : ""}`}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={
                      tab === "login" ? "current-password" : "new-password"
                    }
                  />
                </div>
              </>
            )}

            {error && (
              <p
                style={{ color: "var(--accent-red)", fontSize: "var(--fs-sm)" }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <span className="spinner spinner-sm" /> Please wait…
                </>
              ) : tab === "login" ? (
                "Sign In"
              ) : tab === "verify" ? (
                "Verify & Continue"
              ) : (
                "Create Account"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
