"use client";

import { useState } from "react";

interface ProfileSummary {
  name: string;
  created_at: string;
  created_by: string | null;
}

export function ProfilesClient({ initialProfiles }: { initialProfiles: ProfileSummary[] }) {
  const [profiles, setProfiles] = useState<ProfileSummary[]>(initialProfiles);
  const [name, setName] = useState("");
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const response = await fetch("/api/auth/profiles");
    if (response.ok) {
      const data = await response.json();
      setProfiles(data.profiles ?? []);
    }
  }

  async function onAdd(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/auth/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, passcode })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data?.error ?? "Could not add profile.");
        return;
      }
      setName("");
      setPasscode("");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(profileName: string) {
    setError("");
    setBusy(true);
    try {
      const response = await fetch(`/api/auth/profiles?name=${encodeURIComponent(profileName)}`, {
        method: "DELETE"
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data?.error ?? "Could not delete profile.");
        return;
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onAdd} className="space-y-3 rounded-2xl bg-white p-5 shadow-soft">
        <h2 className="font-bold text-ink">Add a profile</h2>
        <label className="block">
          <span className="text-sm font-semibold text-ink">Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="tap-target mt-1 w-full rounded-xl border border-ink/15 bg-white px-3 text-ink"
            placeholder="e.g. supervisor"
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-ink">Passcode</span>
          <input
            value={passcode}
            onChange={(event) => setPasscode(event.target.value)}
            className="tap-target mt-1 w-full rounded-xl border border-ink/15 bg-white px-3 text-ink"
            placeholder="at least 4 characters"
          />
        </label>
        {error ? <p className="text-sm font-medium text-rust">{error}</p> : null}
        <button
          type="submit"
          disabled={busy || !name || passcode.length < 4}
          className="tap-target w-full rounded-xl bg-leaf px-4 font-bold text-white shadow-soft disabled:opacity-50"
        >
          {busy ? "Saving…" : "Add profile"}
        </button>
      </form>

      <div className="space-y-2">
        <h2 className="font-bold text-ink">Existing profiles</h2>
        {profiles.length === 0 ? (
          <p className="text-sm text-ink/60">No added profiles yet.</p>
        ) : (
          profiles.map((profile) => (
            <div
              key={profile.name}
              className="flex items-center justify-between rounded-xl bg-white p-4 shadow-soft"
            >
              <div>
                <p className="font-semibold text-ink">{profile.name}</p>
                <p className="text-xs text-ink/50">
                  Added {new Date(profile.created_at).toLocaleDateString()}
                  {profile.created_by ? ` by ${profile.created_by}` : ""}
                </p>
              </div>
              <button
                onClick={() => onDelete(profile.name)}
                disabled={busy}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-rust disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
