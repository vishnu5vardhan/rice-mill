"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ idleText, pendingText }: { idleText: string; pendingText: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      className="tap-target w-full rounded-md bg-leaf px-4 py-3 text-base font-bold text-white disabled:cursor-wait disabled:opacity-70"
      disabled={pending}
      type="submit"
    >
      {pending ? pendingText : idleText}
    </button>
  );
}
