"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";

import { useI18n } from "@/modules/i18n/provider";

export const TOUR_SHELL_COOKIE = "lw_tour_shell_v1";
export const TOUR_AI_COOKIE = "lw_tour_ai_v1";
export const TOUR_START_EVENT = "lw:start-tour";
export const TOUR_OPEN_SIDEBAR_EVENT = "lw:open-sidebar";

type TourKind = "shell" | "ai";

type TourStepDef = {
  id: string;
  selector?: string;
  titleKey: TourMessageKey;
  bodyKey: TourMessageKey;
};

type TourMessageKey =
  | "tourWelcomeTitle"
  | "tourWelcomeBody"
  | "tourSidebarTitle"
  | "tourSidebarBody"
  | "tourNewMatterTitle"
  | "tourNewMatterBody"
  | "tourRecentMattersTitle"
  | "tourRecentMattersBody"
  | "tourShortcutsTitle"
  | "tourShortcutsBody"
  | "tourCommandTitle"
  | "tourCommandBody"
  | "tourShellDoneTitle"
  | "tourShellDoneBody"
  | "tourMatterTabsTitle"
  | "tourMatterTabsBody"
  | "tourAiActionsTitle"
  | "tourAiActionsBody"
  | "tourAiComposerTitle"
  | "tourAiComposerBody"
  | "tourMatterContextTitle"
  | "tourMatterContextBodyTour"
  | "tourAiDoneTitle"
  | "tourAiDoneBody";

const SHELL_STEPS: TourStepDef[] = [
  {
    id: "welcome",
    titleKey: "tourWelcomeTitle",
    bodyKey: "tourWelcomeBody",
  },
  {
    id: "sidebar",
    selector: "[data-tour='sidebar']",
    titleKey: "tourSidebarTitle",
    bodyKey: "tourSidebarBody",
  },
  {
    id: "new-matter",
    selector: "[data-tour='new-matter']",
    titleKey: "tourNewMatterTitle",
    bodyKey: "tourNewMatterBody",
  },
  {
    id: "recent-matters",
    selector: "[data-tour='recent-matters']",
    titleKey: "tourRecentMattersTitle",
    bodyKey: "tourRecentMattersBody",
  },
  {
    id: "shortcuts",
    selector: "[data-tour='home-shortcuts']",
    titleKey: "tourShortcutsTitle",
    bodyKey: "tourShortcutsBody",
  },
  {
    id: "command",
    selector: "[data-tour='command-hint']",
    titleKey: "tourCommandTitle",
    bodyKey: "tourCommandBody",
  },
  {
    id: "shell-done",
    titleKey: "tourShellDoneTitle",
    bodyKey: "tourShellDoneBody",
  },
];

const AI_STEPS: TourStepDef[] = [
  {
    id: "matter-tabs",
    selector: "[data-tour='matter-tabs']",
    titleKey: "tourMatterTabsTitle",
    bodyKey: "tourMatterTabsBody",
  },
  {
    id: "ai-actions",
    selector: "[data-tour='ai-quick-actions']",
    titleKey: "tourAiActionsTitle",
    bodyKey: "tourAiActionsBody",
  },
  {
    id: "ai-composer",
    selector: "[data-tour='ai-composer']",
    titleKey: "tourAiComposerTitle",
    bodyKey: "tourAiComposerBody",
  },
  {
    id: "matter-context",
    selector: "[data-tour='matter-context']",
    titleKey: "tourMatterContextTitle",
    bodyKey: "tourMatterContextBodyTour",
  },
  {
    id: "ai-done",
    titleKey: "tourAiDoneTitle",
    bodyKey: "tourAiDoneBody",
  },
];

function readCookie(name: string) {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : null;
}

function writeCookie(name: string, value: string) {
  const maxAge = 60 * 60 * 24 * 365 * 2;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; samesite=lax`;
}

function clearCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0; samesite=lax`;
}

function isTourComplete(kind: TourKind) {
  const name = kind === "shell" ? TOUR_SHELL_COOKIE : TOUR_AI_COOKIE;
  return readCookie(name) === "done";
}

function markTourComplete(kind: TourKind) {
  const name = kind === "shell" ? TOUR_SHELL_COOKIE : TOUR_AI_COOKIE;
  writeCookie(name, "done");
}

function isMatterAiPath(pathname: string) {
  return /^\/app\/matters\/[^/]+\/ai(?:\/|$)/.test(pathname);
}

type TargetRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

function findTourElement(selector: string) {
  const el = document.querySelector(selector);
  if (!(el instanceof HTMLElement)) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return null;
  return el;
}

function measureTarget(
  selector: string | undefined,
  options?: { scroll?: boolean },
): TargetRect | null {
  if (!selector) return null;
  const el = findTourElement(selector);
  if (!el) return null;
  if (options?.scroll) {
    el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }
  const next = el.getBoundingClientRect();
  return {
    top: next.top,
    left: next.left,
    width: next.width,
    height: next.height,
  };
}

function resolveSteps(defs: TourStepDef[]) {
  return defs.filter((step) => {
    if (!step.selector) return true;
    return findTourElement(step.selector) !== null;
  });
}

export function WorkbenchTourHost() {
  const pathname = usePathname();
  const router = useRouter();
  const { t, dir } = useI18n();
  const [activeKind, setActiveKind] = useState<TourKind | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [steps, setSteps] = useState<TourStepDef[]>([]);
  const [target, setTarget] = useState<TargetRect | null>(null);
  const [ready, setReady] = useState(false);
  const pendingKindRef = useRef<TourKind | null>(null);
  const startTokenRef = useRef(0);
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const beginTour = useCallback((kind: TourKind) => {
    const token = ++startTokenRef.current;

    if (kind === "shell" && pathnameRef.current !== "/app") {
      pendingKindRef.current = "shell";
      setActiveKind(null);
      setSteps([]);
      setStepIndex(0);
      setTarget(null);
      router.push("/app");
      return;
    }

    if (kind === "ai" && !isMatterAiPath(pathnameRef.current)) {
      return;
    }

    window.dispatchEvent(new Event(TOUR_OPEN_SIDEBAR_EVENT));

    window.setTimeout(() => {
      if (token !== startTokenRef.current) return;
      const defs = kind === "shell" ? SHELL_STEPS : AI_STEPS;
      const available = resolveSteps(defs);
      if (!available.length) return;
      setActiveKind(kind);
      setSteps(available);
      setStepIndex(0);
      setTarget(null);
    }, 160);
  }, [router]);

  const startTour = useCallback(
    (kind: TourKind, options?: { force?: boolean }) => {
      if (!options?.force && isTourComplete(kind)) return;
      beginTour(kind);
    },
    [beginTour],
  );

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;

    function onStart(event: Event) {
      const detail = (event as CustomEvent<{ kind?: TourKind; force?: boolean }>)
        .detail;
      const kind = detail?.kind ?? "shell";
      startTour(kind, { force: detail?.force ?? true });
    }

    window.addEventListener(TOUR_START_EVENT, onStart);
    return () => window.removeEventListener(TOUR_START_EVENT, onStart);
  }, [ready, startTour]);

  useEffect(() => {
    if (!ready || activeKind) return;

    if (pendingKindRef.current === "shell" && pathname === "/app") {
      pendingKindRef.current = null;
      beginTour("shell");
      return;
    }

    const timer = window.setTimeout(() => {
      if (!isTourComplete("shell") && pathname === "/app") {
        startTour("shell");
        return;
      }
      if (!isTourComplete("ai") && isMatterAiPath(pathname)) {
        startTour("ai");
      }
    }, 700);

    return () => window.clearTimeout(timer);
  }, [ready, pathname, activeKind, startTour, beginTour]);

  const current = steps[stepIndex] ?? null;

  const refreshTarget = useCallback(
    (options?: { scroll?: boolean }) => {
      if (!current) {
        setTarget(null);
        return;
      }
      if (current.selector === "[data-tour='sidebar']") {
        window.dispatchEvent(new Event(TOUR_OPEN_SIDEBAR_EVENT));
      }
      setTarget(measureTarget(current.selector, { scroll: options?.scroll }));
    },
    [current],
  );

  useLayoutEffect(() => {
    if (!activeKind || !current) return;
    refreshTarget({ scroll: true });
    function onViewportChange() {
      refreshTarget({ scroll: false });
    }
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
    return () => {
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
    };
  }, [activeKind, current, refreshTarget, stepIndex]);

  useEffect(() => {
    if (!activeKind) return;
    if (activeKind === "shell" && pathname !== "/app") {
      setActiveKind(null);
      setSteps([]);
      setStepIndex(0);
      setTarget(null);
      return;
    }
    if (activeKind === "ai" && !isMatterAiPath(pathname)) {
      setActiveKind(null);
      setSteps([]);
      setStepIndex(0);
      setTarget(null);
    }
  }, [pathname, activeKind]);

  const popoverStyle = useMemo(() => {
    const margin = 16;
    const gap = 14;
    const estimatedHeight = 220;
    const viewportW =
      typeof window === "undefined" ? 1024 : window.innerWidth;
    const viewportH =
      typeof window === "undefined" ? 768 : window.innerHeight;
    const popoverWidth = Math.min(360, viewportW - margin * 2);

    if (!target) {
      return {
        top: "50%",
        left: "50%",
        width: popoverWidth,
        transform: "translate(-50%, -50%)",
      } as const;
    }
    const tallTarget = target.height > viewportH * 0.55;
    const wideTarget = target.width > viewportW * 0.55;

    let top: number;
    let left: number;

    if (tallTarget && !wideTarget) {
      // Full-height sidebar (and similar): place the card beside the highlight.
      const spaceEnd = viewportW - (target.left + target.width);
      const spaceStart = target.left;
      const preferEnd = dir === "rtl" ? spaceStart < spaceEnd : spaceEnd >= spaceStart;
      if (preferEnd && spaceEnd >= popoverWidth + gap) {
        left = target.left + target.width + gap;
      } else if (spaceStart >= popoverWidth + gap) {
        left = target.left - popoverWidth - gap;
      } else {
        left = Math.max(
          margin,
          Math.min(
            target.left + target.width + gap,
            viewportW - popoverWidth - margin,
          ),
        );
      }
      top = Math.max(
        margin,
        Math.min(target.top + gap, viewportH - estimatedHeight - margin),
      );
    } else {
      const spaceBelow = viewportH - (target.top + target.height);
      const spaceAbove = target.top;
      const placeBelow =
        spaceBelow >= estimatedHeight + gap || spaceBelow >= spaceAbove;
      top = placeBelow
        ? target.top + target.height + gap
        : target.top - estimatedHeight - gap;
      left = target.left + target.width / 2 - popoverWidth / 2;
    }

    top = Math.max(margin, Math.min(top, viewportH - estimatedHeight - margin));
    left = Math.max(margin, Math.min(left, viewportW - popoverWidth - margin));

    return {
      top,
      left,
      width: popoverWidth,
      maxHeight: viewportH - margin * 2,
      transform: "none",
    } as const;
  }, [target, dir]);

  const finish = useCallback((kind: TourKind) => {
    markTourComplete(kind);
    setActiveKind(null);
    setSteps([]);
    setStepIndex(0);
    setTarget(null);
  }, []);

  const skip = useCallback(() => {
    if (!activeKind) return;
    finish(activeKind);
  }, [activeKind, finish]);

  const next = useCallback(() => {
    if (!activeKind) return;
    if (stepIndex >= steps.length - 1) {
      finish(activeKind);
      return;
    }
    setStepIndex((value) => value + 1);
  }, [activeKind, finish, stepIndex, steps.length]);

  const back = useCallback(() => {
    setStepIndex((value) => Math.max(0, value - 1));
  }, []);

  useEffect(() => {
    if (!activeKind) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        skip();
        return;
      }
      if (event.key === "ArrowRight" || event.key === "Enter") {
        event.preventDefault();
        next();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        back();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeKind, skip, next, back]);

  if (!activeKind || !current) return null;

  const isLast = stepIndex >= steps.length - 1;
  const title = t[current.titleKey];
  const body = t[current.bodyKey];
  const pad = 8;

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" dir={dir}>
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-stone-900/40"
        aria-label={t.tourSkip}
        onClick={skip}
      />

      {target ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-xl border-2 border-white/90 transition-[top,left,width,height] duration-200"
          style={{
            top: target.top - pad,
            left: target.left - pad,
            width: target.width + pad * 2,
            height: target.height + pad * 2,
            boxShadow: "0 0 0 9999px rgba(28, 25, 23, 0.48)",
          }}
        />
      ) : null}

      <div
        className="absolute z-[71] flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-xl border border-stone-200 bg-[var(--panel)] shadow-xl"
        style={popoverStyle}
      >
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
              {t.tourProgress
                .replace("{current}", String(stepIndex + 1))
                .replace("{total}", String(steps.length))}
            </p>
            <button
              type="button"
              onClick={skip}
              className="text-xs text-stone-500 hover:text-stone-800"
            >
              {t.tourSkip}
            </button>
          </div>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-stone-900">
            {title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">{body}</p>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-stone-200 px-5 py-3">
          <button
            type="button"
            onClick={back}
            disabled={stepIndex === 0}
            className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50 disabled:opacity-40"
          >
            {t.tourBack}
          </button>
          <button
            type="button"
            onClick={next}
            className="rounded-md bg-[var(--accent)] px-3.5 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            {isLast ? t.tourDone : t.tourNext}
          </button>
        </div>
      </div>
    </div>
  );
}

export function startWorkbenchTour(kind: TourKind = "shell") {
  // Clear both so the full tutorial (home + AI) can play again.
  clearCookie(TOUR_SHELL_COOKIE);
  clearCookie(TOUR_AI_COOKIE);
  window.dispatchEvent(
    new CustomEvent(TOUR_START_EVENT, { detail: { kind, force: true } }),
  );
}

export function WorkbenchTourButton({
  className,
  variant = "nav",
}: {
  className?: string;
  variant?: "nav" | "panel";
}) {
  const { t } = useI18n();
  const defaultClass =
    variant === "panel"
      ? "rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
      : "w-full rounded-md px-3 py-2 text-start text-sm text-stone-700 hover:bg-stone-100";

  return (
    <button
      type="button"
      data-tour="restart-tour"
      onClick={() => startWorkbenchTour("shell")}
      className={className ?? defaultClass}
    >
      {t.tourRestart}
    </button>
  );
}
