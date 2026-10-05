import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/workbench/app-sidebar";
import { CommandPaletteHint } from "@/components/workbench/command-palette-hint";
import { CommandPaletteHost } from "@/components/workbench/command-palette-host";
import { WorkbenchTourHost } from "@/components/workbench/workbench-tour";
import { WorkflowDemoGuideHost } from "@/components/workbench/workflow-demo-guide";
import { getSessionUser, requireAuthContext } from "@/modules/auth/service";
import { listWorkbenchMatters } from "@/modules/workbench/queries";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const requestHeaders = await headers();
  const request = new Request("http://localhost", { headers: requestHeaders });
  const user = await getSessionUser(request);

  if (!user) {
    redirect("/login");
  }

  if (!user.emailVerified) {
    redirect(`/verify-email?email=${encodeURIComponent(user.email)}`);
  }

  let matters: Array<{ id: string; title: string }> = [];

  try {
    const context = await requireAuthContext(request);
    const matterRows = await listWorkbenchMatters(context);
    matters = matterRows.map((matter) => ({
      id: matter.id,
      title: matter.title,
    }));
  } catch {
    // Sidebar still renders; command palette stays empty if auth context fails.
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <AppSidebar
        userName={`${user.firstName} ${user.lastName}`.trim()}
        userEmail={user.email}
      >
        <CommandPaletteHint />
        <div className="flex-1">{children}</div>
      </AppSidebar>
      <CommandPaletteHost matters={matters} documents={[]} />
      <WorkbenchTourHost />
      <WorkflowDemoGuideHost />
    </div>
  );
}
