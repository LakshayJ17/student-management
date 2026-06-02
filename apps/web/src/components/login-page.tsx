"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../app/page.module.css";
import { request } from "../lib/dashboard";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loginPayload, setLoginPayload] = useState({ email: "", password: "" });

  const onTeacherLogin = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const result = await request<{ token: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(loginPayload),
      });

      window.localStorage.setItem("teacherToken", result.token);
      setMessage("Teacher authenticated successfully.");
      router.push("/teacher");
    } catch (loginError) {
      setError((loginError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.kicker}>StudentPulse Platform</p>
        <h1>Authentication</h1>
        <p>
          Sign in to open the teacher dashboard. Student performance data is available on the
          student dashboard.
        </p>
      </header>

      <section className={styles.panel}>
        <h2>Secure Login</h2>
        <form className={styles.form} onSubmit={onTeacherLogin}>
          <label>
            Email
            <input
              type="email"
              value={loginPayload.email}
              onChange={(event) =>
                setLoginPayload((prev) => ({ ...prev, email: event.target.value }))
              }
              placeholder="Teacher email"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={loginPayload.password}
              onChange={(event) =>
                setLoginPayload((prev) => ({ ...prev, password: event.target.value }))
              }
              placeholder="Teacher password"
              required
            />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Secure Login"}
          </button>
        </form>

        <button type="button" className={styles.ghost} onClick={() => router.push("/student")}>
          Continue as Student
        </button>

        {message && <p className={styles.success}>{message}</p>}
        {error && <p className={styles.error}>{error}</p>}
      </section>
    </div>
  );
}
