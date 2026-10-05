"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { logoutRequest } from "@/modules/auth/client";
import { useI18n } from "@/modules/i18n/provider";

export function LogoutButton() {
  const router = useRouter();
  const { t } = useI18n();
  const [pending, setPending] = useState(false);

  async function onLogout() {
    setPending(true);
    try {
      await logoutRequest();
      router.push("/login");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onLogout}
      disabled={pending}
      className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-800 hover:bg-stone-50 disabled:opacity-60"
    >
      {pending ? t.signingOut : t.signOut}
    </button>
  );
}
