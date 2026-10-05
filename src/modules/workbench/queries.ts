import { listMatterAgentRuns } from "@/modules/agents/service";
import type { AuthContext } from "@/modules/authorization/permissions";
import { listMatterDocuments } from "@/modules/documents/service";
import { listAllMattersForUser } from "@/modules/matters/service";
import { listMatterMemory } from "@/modules/memory";
import { listWorkspacesForUser } from "@/modules/workspaces/service";

export async function listWorkbenchMatters(context: AuthContext) {
  const [matters, workspaces] = await Promise.all([
    listAllMattersForUser(context),
    listWorkspacesForUser(context),
  ]);
  const workspaceName = new Map(workspaces.map((item) => [item.id, item.name]));
  return matters.map((matter) => ({
    ...matter,
    workspaceName: workspaceName.get(matter.workspaceId) ?? "Workspace",
  }));
}

export async function listWorkbenchDocuments(context: AuthContext) {
  const matters = await listAllMattersForUser(context);
  const documentGroups = await Promise.all(
    matters.map(async (matter) => {
      const documents = await listMatterDocuments({
        matterId: matter.id,
        context,
      });
      return documents.map((document) => ({
        ...document,
        matterId: matter.id,
        matterTitle: matter.title,
      }));
    }),
  );
  return documentGroups
    .flat()
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
}

export async function listWorkbenchClients(context: AuthContext) {
  const matters = await listAllMattersForUser(context);
  const clients = new Map<
    string,
    { name: string; matterIds: string[]; matterTitles: string[] }
  >();

  for (const matter of matters) {
    const memories = await listMatterMemory({
      matterId: matter.id,
      context,
      includePending: false,
    });
    const clientMemory = memories.find((item) => {
      const key = item.key.toLowerCase();
      return (
        (key === "client" || key === "client_name" || key === "client name") &&
        item.status === "ACTIVE"
      );
    });
    const name = (clientMemory?.value || matter.title).trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const existing = clients.get(key);
    if (existing) {
      existing.matterIds.push(matter.id);
      existing.matterTitles.push(matter.title);
    } else {
      clients.set(key, {
        name,
        matterIds: [matter.id],
        matterTitles: [matter.title],
      });
    }
  }

  return Array.from(clients.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

export async function listPendingApprovalsAcrossMatters(context: AuthContext) {
  const matters = await listAllMattersForUser(context);
  const { listPendingMatterApprovals } = await import(
    "@/modules/agents/service"
  );
  const groups = await Promise.all(
    matters.map(async (matter) => {
      const approvals = await listPendingMatterApprovals({
        matterId: matter.id,
        context,
      });
      return approvals.map((approval) => ({
        ...approval,
        matterId: matter.id,
        matterTitle: matter.title,
      }));
    }),
  );
  return groups.flat();
}

export async function buildMatterActivity(input: {
  matterId: string;
  context: AuthContext;
}) {
  const [documents, runs] = await Promise.all([
    listMatterDocuments({
      matterId: input.matterId,
      context: input.context,
    }),
    listMatterAgentRuns({
      matterId: input.matterId,
      context: input.context,
    }),
  ]);

  const items = [
    ...documents.map((document) => ({
      id: `doc-${document.id}`,
      at: new Date(document.createdAt),
      title: `You uploaded ${document.originalFilename}`,
      href: `/app/matters/${input.matterId}/documents/${document.id}`,
      kind: "document" as const,
    })),
    ...runs.map((run) => {
      const status = run.status;
      let title = `AI worked on: ${run.task}`;
      if (status === "COMPLETED") {
        title = `AI completed: ${run.task}`;
      } else if (status === "WAITING_FOR_APPROVAL") {
        title = `Approval needed: ${run.task}`;
      } else if (status === "FAILED") {
        title = `AI failed: ${run.task}`;
      }
      const isDraft =
        (run.workflow ?? "").toLowerCase().includes("draft") ||
        run.agentType === "DRAFTING";
      return {
        id: `run-${run.runId}`,
        at: new Date(run.createdAt),
        title,
        href: isDraft
          ? `/app/matters/${input.matterId}/drafts/${run.runId}`
          : `/app/matters/${input.matterId}/ai`,
        kind: "ai" as const,
      };
    }),
  ];

  return items.sort((a, b) => b.at.getTime() - a.at.getTime());
}
