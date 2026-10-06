import type { ReactNode } from "react";

import { WorkspaceScreenshots } from "@/components/auth/workspace-screenshots";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(24rem,0.85fr)]">
      <aside className="relative hidden min-h-[calc(100vh-3.5rem)] overflow-hidden border-e border-stone-200/80 bg-[var(--sidebar)] lg:block">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_10%,rgba(31,61,43,0.16),transparent_50%),radial-gradient(ellipse_at_90%_90%,rgba(28,25,23,0.08),transparent_45%)]"
        />
        <div className="relative h-full">
          <WorkspaceScreenshots />
        </div>
      </aside>

      <section className="flex flex-col justify-center px-6 py-12 sm:px-10 lg:px-12 xl:px-16">
        <div className="mx-auto w-full max-w-md">
          <div className="rounded-xl border border-stone-200 bg-[var(--panel)] p-8 shadow-sm">
            {children}
          </div>
        </div>
      </section>
    </main>
  );
}
