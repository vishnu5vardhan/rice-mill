import Link from "next/link";
import { getServerSession } from "@/lib/auth/server";
import { isAdminUser } from "@/lib/auth/users";
import { listProfiles } from "@/lib/auth/profiles";
import { ProfilesClient } from "./ProfilesClient";

export const dynamic = "force-dynamic";

export default async function ProfilesPage() {
  const session = await getServerSession();
  const admin = session ? isAdminUser(session.u) : false;

  if (!admin) {
    return (
      <div className="mx-auto max-w-md px-4 py-10">
        <div className="rounded-2xl bg-white p-6 shadow-soft">
          <h1 className="text-xl font-bold text-ink">Profiles</h1>
          <p className="mt-2 text-sm text-ink/70">Only an admin can manage login profiles.</p>
          <Link href="/dashboard" className="mt-4 inline-block font-semibold text-leaf">
            ← Back to home
          </Link>
        </div>
      </div>
    );
  }

  const profiles = await listProfiles().catch(() => []);

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Profiles</h1>
        <Link href="/dashboard" className="text-sm font-semibold text-leaf">
          ← Home
        </Link>
      </div>
      <p className="mb-5 text-sm text-ink/70">
        Signed in as <span className="font-semibold">{session?.u}</span> (admin). Add login profiles for
        your team — they sign in with their name and the passcode you set.
      </p>
      <ProfilesClient initialProfiles={profiles} />
    </div>
  );
}
