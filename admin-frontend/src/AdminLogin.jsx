import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2,
  Mail,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  BookOpen,
  GraduationCap,
  ShieldCheck,
} from "lucide-react";
import { Brand, Notice } from "./components/ui";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        (import.meta.env.VITE_API_URL ||
          "https://intelliprep-rhx3.onrender.com") + "/api/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        },
      );

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.message || "Invalid email or password.");
      }

      if (data.role !== "Admin") {
        throw new Error("Access denied. Admin role required.");
      }

      localStorage.setItem("admin_token", data.token);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-story">
        <Brand light />
        <div className="login-story-copy">
          <span className="story-kicker">A/L ICT · THE ADMIN WORKSPACE</span>
          <h1>
            Great learning.
            <br />
            Thoughtfully
            <br />
            <em>managed.</em>
          </h1>
          <p>
            A calmer space to prepare assessments, guide study plans and support
            your students.
          </p>
        </div>
        <div className="login-story-workflow">
          <div>
            <BookOpen size={20} />
            <span>Prepare</span>
          </div>
          <ArrowRight size={16} />
          <div>
            <ShieldCheck size={20} />
            <span>Review</span>
          </div>
          <ArrowRight size={16} />
          <div>
            <GraduationCap size={20} />
            <span>Inspire</span>
          </div>
        </div>
        <span className="login-decoration decoration-one" aria-hidden="true" />
        <span className="login-decoration decoration-two" aria-hidden="true" />
        <p className="login-story-footer">
          Built around better learning. Built for IntelliPrep.
        </p>
      </section>
      <section className="login-form-panel">
        <div className="login-mobile-brand">
          <Brand />
        </div>
        <div className="login-form-wrap">
          <span className="login-glyph">
            <ShieldCheck size={27} />
          </span>
          <p className="eyebrow">GOOD TO HAVE YOU BACK</p>
          <h2>Sign in to your workspace</h2>
          <p className="login-description">
            Use your admin account to continue to IntelliPrep.
          </p>
          {error && <Notice type="error" text={error} />}
          <form
            onSubmit={handleSubmit}
            className="login-form"
            aria-busy={loading}
          >
            <div>
              <label htmlFor="email">Email address</label>
              <div className="input-with-icon">
                <Mail size={18} aria-hidden="true" />
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  inputMode="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                />
              </div>
            </div>
            <div>
              <label htmlFor="password">Password</label>
              <div className="input-with-icon password-input">
                <Lock size={18} aria-hidden="true" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button
              className="button button-primary login-submit"
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Signing in…
                </>
              ) : (
                <>
                  Sign in <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
          <p className="login-help">
            <Lock size={14} /> Admin access only. Use the account provided to
            you.
          </p>
        </div>
        <p className="login-form-footer">
          IntelliPrep <span>·</span> A/L ICT learning platform
        </p>
      </section>
    </main>
  );
}
