"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { startWorkflowDemo } from "@/components/workbench/workflow-demo-guide";
import { useI18n } from "@/modules/i18n/provider";

export default function DemoPage() {
  const router = useRouter();
  const { t } = useI18n();

  useEffect(() => {
    startWorkflowDemo();
    router.replace("/app");
  }, [router]);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
      <p className="text-sm text-stone-600">{t.demoPreparing}</p>
    </main>
  );
}
