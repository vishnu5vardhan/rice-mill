import { listUserNames } from "@/lib/auth/users";
import { listProfileNames } from "@/lib/auth/profiles";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const profileNames = await listProfileNames();
  const users = Array.from(new Set([...listUserNames(), ...profileNames]));

  return (
    <div className="flex min-h-screen items-center justify-center bg-field px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl bg-white p-7 shadow-soft">
        <h1 className="text-2xl font-bold text-ink">Rice Mill</h1>
        <p className="mt-1 text-sm text-ink/70">Select your name and enter your passcode.</p>

        {users.length === 0 ? (
          <div className="mt-6 rounded-xl bg-rust/10 p-4 text-sm text-rust">
            No users are configured yet. Set <code className="font-mono">APP_USERS</code> (for example{" "}
            <code className="font-mono">vivek:8421,manager:5570</code>) in your environment, then reload.
          </div>
        ) : (
          <LoginForm users={users} />
        )}
      </div>
    </div>
  );
}
