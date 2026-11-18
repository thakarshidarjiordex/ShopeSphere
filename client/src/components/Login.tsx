import "./Auth.css";    
import { useState } from "react";
import { useLoginMutation } from "../services/authApi";

interface LoginProps {
  onLoginSuccess: () => void;
  onShowRegister: () => void;
}

export default function Login({
  onLoginSuccess,
  onShowRegister,
}: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [login, { isLoading, error }] = useLoginMutation();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    try {
      await login({ email, password }).unwrap();
      onLoginSuccess();
    } catch {
      // The API error is displayed below.
    }
  }

  const errorMessage =
    error && "data" in error
      ? (error.data as { message?: string })?.message
      : "Unable to log in. Please try again.";

  return (
    <section className="auth-page">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h2>Welcome Back</h2>
        <p>Log in to your ShopSphere account.</p>

        <label htmlFor="login-email">Email</label>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <p role="alert">{errorMessage}</p>}

        <button type="submit" disabled={isLoading}>
          {isLoading ? "Logging in..." : "Login"}
        </button>

        <p>
          Don't have an account?{" "}
          <button type="button" onClick={onShowRegister}>
            Register
          </button>
        </p>
      </form>
    </section>
  );
}
