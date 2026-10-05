"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { getDemoScript } from "@/modules/demo/script";
import type { Messages } from "@/modules/i18n/messages";
import { useI18n } from "@/modules/i18n/provider";

export const WORKFLOW_DEMO_START_EVENT = "lw:start-workflow-demo";

type GuideStep = "setup" | "overview" | "research" | "draft" | "done";

async function readJson(response: Response) {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(
      data?.error?.message ?? data?.reason ?? `Request failed (${response.status})`,
    );
  }
  return data;
}

async function setupDemoMatter(
  t: Messages,
  matterTitle: string,
  matterDescription: string,
) {
  const script = getDemoScript(t);
  const workspacesRes = await fetch("/api/workspaces", {
    credentials: "include",
  });
  const workspacesBody = await readJson(workspacesRes);
  const workspaceId = workspacesBody.workspaces?.[0]?.id as string | undefined;
  if (!workspaceId) {
    throw new Error("NO_WORKSPACE");
  }

  const matterRes = await fetch(`/api/workspaces/${workspaceId}/matters`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: matterTitle,
      matterType: "EMPLOYMENT",
      description: matterDescription,
    }),
  });
  const matterBody = await readJson(matterRes);
  const matterId = String(matterBody.matter.id);

  for (const fact of script.facts) {
    const memoryRes = await fetch(`/api/matters/${matterId}/memory`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        key: fact.key,
        value: fact.value,
        source_type: "USER_PROVIDED",
        require_confirmation: false,
      }),
    });
    await readJson(memoryRes);
  }

  return matterId;
}

export function WorkflowDemoGuideHost() {
  const { t, dir, locale } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [step, setStep] = useState<GuideStep>("setup");
  const [matterId, setMatterId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const startTokenRef = useRef(0);
  const script = getDemoScript(t);

  const stop = useCallback(() => {
    startTokenRef.current += 1;
    setActive(false);
    setBusy(false);
    setError(null);
    setStep("setup");
    setMatterId(null);
  }, []);

  const start = useCallback(async () => {
    const token = ++startTokenRef.current;
    setActive(true);
    setBusy(true);
    setError(null);
    setStep("setup");
    setMatterId(null);

    try {
      const stamp = new Date().toLocaleString(
        locale === "ar" ? "ar-EG" : locale === "fr" ? "fr-FR" : "en-GB",
      );
      const id = await setupDemoMatter(
        t,
        `${t.demoMatterTitle} — ${stamp}`,
        t.demoMatterDescription,
      );
      if (token !== startTokenRef.current) return;
      setMatterId(id);
      setStep("overview");
      setBusy(false);
      router.push(`/app/matters/${id}`);
      router.refresh();
    } catch (err) {
      if (token !== startTokenRef.current) return;
      setBusy(false);
      setError(
        err instanceof Error && err.message === "NO_WORKSPACE"
          ? t.demoNoWorkspace
          : err instanceof Error
            ? err.message
            : t.demoFailed,
      );
    }
  }, [locale, router, t]);

  useEffect(() => {
    function onStart() {
      void start();
    }
    window.addEventListener(WORKFLOW_DEMO_START_EVENT, onStart);
    return () => window.removeEventListener(WORKFLOW_DEMO_START_EVENT, onStart);
  }, [start]);

  useEffect(() => {
    if (!active) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        stop();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, stop]);

  function goResearch() {
    if (!matterId) return;
    setStep("research");
    const params = new URLSearchParams({
      q: script.researchQuery,
      autorun: "1",
      demo: "1",
    });
    router.push(`/app/matters/${matterId}/research?${params.toString()}`);
  }

  function goDraft() {
    if (!matterId) return;
    setStep("draft");
    const params = new URLSearchParams({
      task: script.draftTask,
    });
    router.push(`/app/matters/${matterId}/ai?${params.toString()}`);
  }

  function goDone() {
    if (!matterId) return;
    setStep("done");
    router.push(`/app/matters/${matterId}/drafts`);
  }

  if (!active) return null;

  const copy =
    step === "setup"
      ? {
          title: t.demoGuideSetupTitle,
          body: error ?? t.demoGuideSetupBody,
        }
      : step === "overview"
        ? {
            title: t.demoGuideOverviewTitle,
            body: t.demoGuideOverviewBody,
          }
        : step === "research"
          ? {
              title: t.demoGuideResearchTitle,
              body: t.demoGuideResearchBody,
            }
          : step === "draft"
            ? {
                title: t.demoGuideDraftTitle,
                body: t.demoGuideDraftBody,
              }
            : {
                title: t.demoGuideDoneTitle,
                body: t.demoGuideDoneBody,
              };

  const stepNumber =
    step === "setup"
      ? 1
      : step === "overview"
        ? 1
        : step === "research"
          ? 2
          : step === "draft"
            ? 3
            : 4;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex justify-center p-4 sm:justify-end sm:p-6"
      dir={dir}
    >
      <div
        className="pointer-events-auto w-full max-w-md rounded-xl border border-stone-200 bg-[var(--panel)] p-5 shadow-xl"
        role="dialog"
        aria-modal="false"
        aria-label={t.demoStart}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
            {t.tourProgress
              .replace("{current}", String(stepNumber))
              .replace("{total}", "4")}
          </p>
          <button
            type="button"
            onClick={stop}
            className="text-xs text-stone-500 hover:text-stone-800"
          >
            {t.tourSkip}
          </button>
        </div>
        <h2 className="mt-2 text-lg font-semibold tracking-tight text-stone-900">
          {copy.title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-stone-600">{copy.body}</p>

        {busy ? (
          <p className="mt-4 inline-flex items-center gap-2 text-sm text-stone-500">
            <span className="inline-block animate-spin" aria-hidden>
              ⟳
            </span>
            {t.demoPreparing}
          </p>
        ) : null}

        {error && step === "setup" ? (
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={stop}
              className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
            >
              {t.cancel}
            </button>
            <button
              type="button"
              onClick={() => void start()}
              className="rounded-md bg-[var(--accent)] px-3.5 py-1.5 text-sm font-medium text-white hover:opacity-90"
            >
              {t.retry}
            </button>
          </div>
        ) : null}

        {!busy && !error ? (
          <div className="mt-5 flex items-center justify-between gap-3">
            <p className="truncate text-xs text-stone-500">
              {matterId && pathname.includes(matterId)
                ? t.demoGuideOnMatter
                : null}
            </p>
            {step === "overview" ? (
              <button
                type="button"
                onClick={goResearch}
                className="rounded-md bg-[var(--accent)] px-3.5 py-1.5 text-sm font-medium text-white hover:opacity-90"
              >
                {t.tourNext}
              </button>
            ) : null}
            {step === "research" ? (
              <button
                type="button"
                onClick={goDraft}
                className="rounded-md bg-[var(--accent)] px-3.5 py-1.5 text-sm font-medium text-white hover:opacity-90"
              >
                {t.tourNext}
              </button>
            ) : null}
            {step === "draft" ? (
              <button
                type="button"
                onClick={goDone}
                className="rounded-md bg-[var(--accent)] px-3.5 py-1.5 text-sm font-medium text-white hover:opacity-90"
              >
                {t.tourNext}
              </button>
            ) : null}
            {step === "done" ? (
              <button
                type="button"
                onClick={stop}
                className="rounded-md bg-[var(--accent)] px-3.5 py-1.5 text-sm font-medium text-white hover:opacity-90"
              >
                {t.tourDone}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function startWorkflowDemo() {
  window.dispatchEvent(new Event(WORKFLOW_DEMO_START_EVENT));
}

export function WorkflowDemoButton({
  className,
}: {
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={() => startWorkflowDemo()}
      className={
        className ??
        "w-full rounded-md px-3 py-2 text-start text-sm text-stone-700 hover:bg-stone-100"
      }
    >
      {t.demoStart}
    </button>
  );
}
