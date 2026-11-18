    import { useState } from "react";
import { useRegisterMutation } from "../services/authApi";
import "./Auth.css";

interface RegisterProps {
  onRegisterSuccess: () => void;
  onShowLogin: () => void;
}

export default function Register({
  onRegisterSuccess,
  onShowLogin,
}: RegisterProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [register, { isLoading, error }] = useRegisterMutation();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    try {
      await register({ name, email, password }).unwrap();
      onRegisterSuccess();
    } catch {
      // The API error is displayed below.
    }
  }

  const errorMessage =
    error && "data" in error
      ? (error.data as { message?: string })?.message
      : "Unable to register. Please try again.";

  return (
    <section className="auth-page">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h2>Create Account</h2>
        <p>Join ShopSphere and start shopping.</p>

        <label htmlFor="register-name">Full name</label>
        <input
          id="register-name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <label htmlFor="register-email">Email</label>
        <input
          id="register-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label htmlFor="register-password">Password</label>
        <input
          id="register-password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={72}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <p role="alert">{errorMessage}</p>}

        <button type="submit" disabled={isLoading}>
          {isLoading ? "Creating account..." : "Register"}
        </button>

        <p>
          Already have an account?{" "}
          <button type="button" onClick={onShowLogin}>
            Login
          </button>
        </p>
      </form>
    </section>
  );
}
