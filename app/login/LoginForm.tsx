"use client";

import { useState } from "react";

function safeNext(): string {
  if (typeof window === "undefined") return "/dashboard";
  const next = new URLSearchParams(window.location.search).get("next");
  // Only allow same-site relative paths — never an absolute URL (open redirect).
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/dashboard";
}

export function LoginForm({ users }: { users: string[] }) {
  const [name, setName] = useState(users[0] ?? "");
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, passcode })
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data?.error ?? "Could not sign in.");
        setLoading(false);
        return;
      }
      window.location.assign(safeNext());
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <label className="block">
        <span className="text-sm font-semibold text-ink">User</span>
        <select
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="tap-target mt-1 w-full rounded-xl border border-ink/15 bg-white px-3 text-ink"
        >
          {users.map((user) => (
            <option key={user} value={user}>
              {user}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-ink">Passcode</span>
        <input
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          value={passcode}
          onChange={(event) => setPasscode(event.target.value)}
          className="tap-target mt-1 w-full rounded-xl border border-ink/15 bg-white px-3 text-ink"
          placeholder="••••"
        />
      </label>

      {error ? <p className="text-sm font-medium text-rust">{error}</p> : null}

      <button
        type="submit"
        disabled={loading || !passcode}
        className="tap-target w-full rounded-xl bg-leaf px-4 font-bold text-white shadow-soft disabled:opacity-50"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
