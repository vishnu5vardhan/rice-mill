// Who can log in. Configured entirely through the APP_USERS env var so you can
// add/remove people without changing code — locally in .env.local, on Vercel in
// Project Settings -> Environment Variables.
//
// Format:  name:passcode,name2:passcode2
// Example: APP_USERS=vivek:8421,manager:5570
//
// - Names are shown in the login dropdown. Passcodes are never sent to the browser.
// - A name cannot contain ":" (first colon splits name from passcode).
// - Passcodes cannot contain "," (comma separates users).

interface AppUser {
  name: string;
  passcode: string;
}

function parseUsers(): AppUser[] {
  const raw = process.env.APP_USERS || "";
  return raw
    .split(",")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const idx = pair.indexOf(":");
      if (idx === -1) return null;
      const name = pair.slice(0, idx).trim();
      const passcode = pair.slice(idx + 1).trim();
      if (!name || !passcode) return null;
      return { name, passcode } satisfies AppUser;
    })
    .filter((user): user is AppUser => user !== null);
}

export function listUserNames(): string[] {
  return parseUsers().map((user) => user.name);
}

// Env-defined users are the admins — they can manage login profiles.
export function isAdminUser(name: string): boolean {
  return parseUsers().some((user) => user.name === name);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export function verifyUser(name: string, passcode: string): boolean {
  const user = parseUsers().find((candidate) => candidate.name === name);
  if (!user) return false;
  return timingSafeEqual(user.passcode, passcode);
}
