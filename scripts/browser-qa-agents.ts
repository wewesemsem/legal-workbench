/**
 * Live HTTP QA for Phase 4 agent UI/API surfaces.
 * Uses the same auth + agent endpoints as the Matter AI Agents panel.
 */
import "dotenv/config";

import { POST as loginPost } from "@/app/api/auth/login/route";
import { POST as registerPost } from "@/app/api/auth/register/route";
import { GET as verifyGet } from "@/app/api/auth/verify-email/route";
import { POST as approvalPost } from "@/app/api/agents/approvals/[approvalId]/route";
import { POST as runAgentPost } from "@/app/api/agents/run/route";
import { POST as uploadDocument } from "@/app/api/matters/[matterId]/documents/route";
import { GET as matterAgentsGet } from "@/app/api/matters/[matterId]/agents/route";
import { POST as createMatter } from "@/app/api/workspaces/[workspaceId]/matters/route";
import { POST as createWorkspace } from "@/app/api/workspaces/route";
import { db } from "@/lib/db";
import { documentPages, documents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  STRONG_PASSWORD,
  cleanupUserByEmail,
  collectCookies,
  extractVerificationTokenFromEmail,
  uniqueEmail,
} from "../tests/helpers";
import { TINY_PDF } from "../tests/fixtures";

async function main() {
  const email = uniqueEmail("browserqa");
  const lines: string[] = [];

  try {
    await registerPost(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          password: STRONG_PASSWORD,
          firstName: "Browser",
          lastName: "QA",
          role: "LAWYER",
        }),
      }),
    );
    const token = extractVerificationTokenFromEmail(email);
    await verifyGet(
      new Request(`http://localhost/api/auth/verify-email?token=${token}`),
    );
    const login = await loginPost(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password: STRONG_PASSWORD }),
      }),
    );
    const cookie = collectCookies(login);

    const workspaceRes = await createWorkspace(
      new Request("http://localhost/api/workspaces", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ name: "Browser QA Workspace" }),
      }),
    );
    const workspaceId = (await workspaceRes.json()).workspace.id as string;
    const matterRes = await createMatter(
      new Request(`http://localhost/api/workspaces/${workspaceId}/matters`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({
          title: "Browser QA Employment",
          matterType: "EMPLOYMENT",
        }),
      }),
      { params: Promise.resolve({ workspaceId }) },
    );
    const matterId = (await matterRes.json()).matter.id as string;

    // Test 1 — Research
    const research = await runAgentPost(
      new Request("http://localhost/api/agents/run", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({
          matter_id: matterId,
          task: "What does the Egyptian Constitution say about equality?",
          agent_type: "ORCHESTRATOR",
        }),
      }),
    );
    const researchBody = await research.json();
    lines.push(
      `Test1 Research: HTTP ${research.status}, status=${researchBody.status}, workflow=${researchBody.plan?.workflow}, agents=${JSON.stringify(researchBody.plan?.steps)}`,
    );

    const upload = await uploadDocument(
      new Request(`http://localhost/api/matters/${matterId}/documents`, {
        method: "POST",
        headers: { cookie },
        body: (() => {
          const form = new FormData();
          form.set(
            "file",
            new File([TINY_PDF], "employment-contract.pdf", {
              type: "application/pdf",
            }),
          );
          return form;
        })(),
      }),
      { params: Promise.resolve({ matterId }) },
    );
    const documentId = (await upload.json()).document.id as string;
    const contractText =
      "Employment Contract. Termination clause: either party may terminate with 30 days notice.";
    await db
      .update(documents)
      .set({
        processingStatus: "PROCESSED",
        extractedText: contractText,
        pageCount: 1,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, documentId));
    await db
      .update(documentPages)
      .set({ extractedText: contractText, updatedAt: new Date() })
      .where(eq(documentPages.documentId, documentId));

    // Test 2 — Document / Matter RAG
    const docRun = await runAgentPost(
      new Request("http://localhost/api/agents/run", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({
          matter_id: matterId,
          task: "Find the termination clause in this contract.",
          agent_type: "ORCHESTRATOR",
        }),
      }),
    );
    const docBody = await docRun.json();
    lines.push(
      `Test2 Document: HTTP ${docRun.status}, status=${docBody.status}, steps=${JSON.stringify(docBody.plan?.steps)}`,
    );

    // Test 3 — Multi-agent
    const multi = await runAgentPost(
      new Request("http://localhost/api/agents/run", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({
          matter_id: matterId,
          task: "Review this employment contract against Egyptian law and identify the issues.",
          agent_type: "ORCHESTRATOR",
        }),
      }),
    );
    const multiBody = await multi.json();
    lines.push(
      `Test3 Multi: HTTP ${multi.status}, status=${multiBody.status}, steps=${JSON.stringify(multiBody.plan?.steps)}`,
    );

    // Test 4 — Drafting + approval
    const draft = await runAgentPost(
      new Request("http://localhost/api/agents/run", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({
          matter_id: matterId,
          task: "Draft a letter explaining these issues under Egyptian law.",
          agent_type: "ORCHESTRATOR",
        }),
      }),
    );
    const draftBody = await draft.json();
    lines.push(
      `Test4 Draft: HTTP ${draft.status}, status=${draftBody.status}, approval=${draftBody.approval_id ?? "none"}`,
    );
    if (draftBody.approval_id) {
      const approve = await approvalPost(
        new Request(
          `http://localhost/api/agents/approvals/${draftBody.approval_id}`,
          {
            method: "POST",
            headers: { "content-type": "application/json", cookie },
            body: JSON.stringify({ decision: "APPROVED" }),
          },
        ),
        { params: Promise.resolve({ approvalId: draftBody.approval_id }) },
      );
      lines.push(`Test4 Approve: HTTP ${approve.status}`);
    }

    // Test 5 — Security: other user denied
    const emailB = uniqueEmail("browserqb");
    await registerPost(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: emailB,
          password: STRONG_PASSWORD,
          firstName: "Other",
          lastName: "Lawyer",
          role: "LAWYER",
        }),
      }),
    );
    const tokenB = extractVerificationTokenFromEmail(emailB);
    await verifyGet(
      new Request(`http://localhost/api/auth/verify-email?token=${tokenB}`),
    );
    const loginB = await loginPost(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: emailB, password: STRONG_PASSWORD }),
      }),
    );
    const cookieB = collectCookies(loginB);
    const denied = await matterAgentsGet(
      new Request(`http://localhost/api/matters/${matterId}/agents`, {
        headers: { cookie: cookieB },
      }),
      { params: Promise.resolve({ matterId }) },
    );
    lines.push(`Test5 Security cross-matter list: HTTP ${denied.status} (expect 403)`);
    await cleanupUserByEmail(emailB);

    // Live page check against running Next server if available
    try {
      const page = await fetch(`http://localhost:3000/app/matters/${matterId}`, {
        headers: { cookie },
        redirect: "manual",
      });
      const html = await page.text();
      lines.push(
        `Live UI: HTTP ${page.status}, hasAIAgents=${html.includes("AI Agents")}, hasRunButton=${html.includes("Run AI agents")}`,
      );
    } catch {
      lines.push("Live UI: server fetch skipped/unavailable");
    }

    for (const line of lines) console.log(line);
  } finally {
    await cleanupUserByEmail(email);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
