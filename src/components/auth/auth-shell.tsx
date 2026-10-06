import type { ReactNode } from "react";

import { WorkspaceScreenshots } from "@/components/auth/workspace-screenshots";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-full flex-1">
      <section className="relative hidden w-[54%] shrink-0 border-e border-stone-200/80 bg-[var(--sidebar)] lg:block">
        <WorkspaceScreenshots />
      </section>

      <section className="flex w-full flex-1 flex-col justify-center px-6 py-12 sm:px-10 lg:w-[46%] lg:px-12 xl:px-16">
        <div className="mx-auto w-full max-w-md">
          <div className="rounded-xl border border-stone-200 bg-[var(--panel)] p-8 shadow-sm">
            {children}
          </div>
        </div>
      </section>
    </main>
  );
}
