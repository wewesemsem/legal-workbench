"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { LogoutButton } from "@/components/auth/logout-button";
import {
  TOUR_OPEN_SIDEBAR_EVENT,
  WorkbenchTourButton,
} from "@/components/workbench/workbench-tour";
import { WorkflowDemoButton } from "@/components/workbench/workflow-demo-guide";
import { useI18n } from "@/modules/i18n/provider";

function MenuToggleButton({
  open,
  onClick,
  label,
}: {
  open: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-stone-300 bg-white text-stone-800"
      onClick={onClick}
      aria-expanded={open}
      aria-controls="app-sidebar"
      aria-label={label}
    >
      <span className="relative block h-3.5 w-5" aria-hidden="true">
        <span
          className={`absolute inset-x-0 top-0 h-0.5 origin-center rounded-full bg-current transition duration-200 ${
            open ? "translate-y-[6px] rotate-45" : ""
          }`}
        />
        <span
          className={`absolute inset-x-0 top-[6px] h-0.5 rounded-full bg-current transition duration-200 ${
            open ? "scale-x-0 opacity-0" : ""
          }`}
        />
        <span
          className={`absolute inset-x-0 top-[12px] h-0.5 origin-center rounded-full bg-current transition duration-200 ${
            open ? "-translate-y-[6px] -rotate-45" : ""
          }`}
        />
      </span>
    </button>
  );
}

export function AppSidebar({
  userName,
  userEmail,
  children,
}: {
  userName: string;
  userEmail: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { t } = useI18n();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    function sync() {
      setOpen(media.matches);
    }
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    function openSidebar() {
      setOpen(true);
    }
    window.addEventListener(TOUR_OPEN_SIDEBAR_EVENT, openSidebar);
    return () => window.removeEventListener(TOUR_OPEN_SIDEBAR_EVENT, openSidebar);
  }, []);

  const navItems = [
    { href: "/app", label: t.home, exact: true },
    { href: "/app/matters", label: t.matters },
    { href: "/app/clients", label: t.clients },
    { href: "/app/documents", label: t.documents },
  ] as const;

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function closeMenu() {
    if (window.matchMedia("(max-width: 1023px)").matches) {
      setOpen(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-stone-900/30 lg:hidden"
          aria-label={t.close}
          onClick={() => setOpen(false)}
        />
      ) : null}

      <div
        className={`relative z-40 flex shrink-0 border-e border-stone-200 bg-[var(--panel)] transition-[width] duration-200 ${
          open ? "w-64" : "w-12"
        }`}
      >
        {open ? (
          <aside
            id="app-sidebar"
            data-tour="sidebar"
            className="flex h-full w-64 flex-col"
          >
            <div className="flex items-start justify-between gap-2 px-3 pt-5 pb-4">
              <div className="min-w-0">
                <Link
                  href="/app"
                  className="block text-sm font-semibold tracking-tight text-stone-900"
                  onClick={closeMenu}
                >
                  {t.brand}
                </Link>
                <p className="mt-1 text-xs text-stone-500">{t.brandTagline}</p>
              </div>
              <MenuToggleButton
                open={open}
                onClick={() => setOpen(false)}
                label={t.close}
              />
            </div>

            <nav className="flex flex-col gap-1 px-2" aria-label="Global">
              {navItems.map((item) => {
                const active = isActive(
                  item.href,
                  "exact" in item ? item.exact : false,
                );
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeMenu}
                    className={`rounded-md px-3 py-2 text-sm transition ${
                      active
                        ? "bg-[var(--accent)] text-white"
                        : "text-stone-700 hover:bg-stone-100"
                    }`}
                    aria-current={active ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-3 border-t border-stone-200 px-3 py-4">
              <div className="mb-3 space-y-1">
                <WorkflowDemoButton />
                <WorkbenchTourButton />
                <Link
                  href="/app/settings"
                  onClick={closeMenu}
                  className={`block rounded-md px-3 py-2 text-sm transition ${
                    isActive("/app/settings")
                      ? "bg-stone-200 text-stone-900"
                      : "text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  {t.settings}
                </Link>
              </div>
              <div className="px-3">
                <p className="truncate text-sm font-medium text-stone-900">
                  {userName}
                </p>
                <p className="truncate text-xs text-stone-500">{userEmail}</p>
                <div className="mt-3">
                  <LogoutButton />
                </div>
              </div>
            </div>
          </aside>
        ) : (
          <div className="flex w-12 flex-col items-center pt-4">
            <MenuToggleButton
              open={open}
              onClick={() => setOpen(true)}
              label={t.menu}
            />
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
