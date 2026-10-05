import { beforeEach, describe, expect, it } from "vitest";

import { POST as loginPost } from "@/app/api/auth/login/route";
import { POST as registerPost } from "@/app/api/auth/register/route";
import { GET as verifyGet } from "@/app/api/auth/verify-email/route";
import {
  DELETE as deleteConversation,
  GET as getConversation,
} from "@/app/api/conversations/[conversationId]/route";
import {
  GET as listMessages,
  POST as sendMessage,
} from "@/app/api/conversations/[conversationId]/messages/route";
import { POST as uploadDocument } from "@/app/api/matters/[matterId]/documents/route";
import {
  GET as listConversations,
  POST as createConversation,
} from "@/app/api/matters/[matterId]/conversations/route";
import { POST as createMatter } from "@/app/api/workspaces/[workspaceId]/matters/route";
import { POST as createWorkspace } from "@/app/api/workspaces/route";
import { requireAuthContext } from "@/modules/auth/service";
import { getAuthorizedMatterContextForTests } from "@/modules/chat/service";
import { resetDocumentAiServiceForTests } from "@/modules/document-ai";
import { createMockDocumentAiService } from "@/modules/document-ai/mock";
import { resetLlmServiceForTests } from "@/modules/llm";
import { createMockLlmService } from "@/modules/llm/mock";
import { resetObjectStorageForTests } from "@/modules/storage";

import { TINY_PDF } from "./fixtures";
import {
  STRONG_PASSWORD,
  cleanupUserByEmail,
  collectCookies,
  extractVerificationTokenFromEmail,
  resetTestState,
  uniqueEmail,
} from "./helpers";

async function registerVerifyLogin(email: string) {
  await registerPost(
    new Request("http://localhost/api/auth/register", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.40",
      },
      body: JSON.stringify({
        email,
        password: STRONG_PASSWORD,
        firstName: "Chat",
        lastName: "Lawyer",
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
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.41",
      },
      body: JSON.stringify({ email, password: STRONG_PASSWORD }),
    }),
  );

  return collectCookies(login);
}

async function createWorkspaceAndMatter(cookie: string, title = "Chat Matter") {
  const workspaceRes = await createWorkspace(
    new Request("http://localhost/api/workspaces", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({ name: "Chat Workspace" }),
    }),
  );
  const workspaceId = (await workspaceRes.json()).workspace.id as string;

  const matterRes = await createMatter(
    new Request(`http://localhost/api/workspaces/${workspaceId}/matters`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({ title, matterType: "EMPLOYMENT" }),
    }),
    { params: Promise.resolve({ workspaceId }) },
  );
  const matterId = (await matterRes.json()).matter.id as string;
  return { workspaceId, matterId };
}

describe("chat + matter context", () => {
  beforeEach(() => {
    resetTestState();
    resetObjectStorageForTests();
    resetDocumentAiServiceForTests(createMockDocumentAiService());
    resetLlmServiceForTests(createMockLlmService());
  });

  it("creates conversations and persists USER/ASSISTANT messages", async () => {
    const email = uniqueEmail("chata");
    const cookie = await registerVerifyLogin(email);
    const { matterId } = await createWorkspaceAndMatter(cookie);

    const created = await createConversation(
      new Request(`http://localhost/api/matters/${matterId}/conversations`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie,
        },
        body: JSON.stringify({ title: "Employment Contract Review" }),
      }),
      { params: Promise.resolve({ matterId }) },
    );
    expect(created.status).toBe(201);
    const conversationId = (await created.json()).conversation.id as string;

    const sent = await sendMessage(
      new Request(`http://localhost/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie,
        },
        body: JSON.stringify({
          content: "What does this contract say about termination?",
        }),
      }),
      { params: Promise.resolve({ conversationId }) },
    );
    expect(sent.status).toBe(201);
    const sentBody = await sent.json();
    expect(sentBody.userMessage.role).toBe("USER");
    expect(sentBody.assistantMessage.role).toBe("ASSISTANT");
    expect(sentBody.assistantMessage.content.length).toBeGreaterThan(10);
    expect(sentBody.matterContextSummary.matterId).toBe(matterId);
    expect(sentBody.matterContextSummary.layers.matterRag).toBe(false);

    const listed = await listMessages(
      new Request(`http://localhost/api/conversations/${conversationId}/messages`, {
        headers: { cookie },
      }),
      { params: Promise.resolve({ conversationId }) },
    );
    expect(listed.status).toBe(200);
    const messagesBody = await listed.json();
    expect(messagesBody.messages).toHaveLength(2);
    expect(messagesBody.messages[0].role).toBe("USER");
    expect(messagesBody.messages[1].role).toBe("ASSISTANT");

    await cleanupUserByEmail(email);
  });

  it("blocks unauthorized conversation access across matters and users", async () => {
    const emailA = uniqueEmail("chisoa");
    const emailB = uniqueEmail("chisob");
    const cookieA = await registerVerifyLogin(emailA);
    const cookieB = await registerVerifyLogin(emailB);

    const matterA = await createWorkspaceAndMatter(cookieA, "Matter A");
    const matterB = await createWorkspaceAndMatter(cookieB, "Matter B");

    const convA = await createConversation(
      new Request(
        `http://localhost/api/matters/${matterA.matterId}/conversations`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: cookieA,
          },
          body: JSON.stringify({ title: "Conversation A" }),
        },
      ),
      { params: Promise.resolve({ matterId: matterA.matterId }) },
    );
    const conversationA = (await convA.json()).conversation.id as string;

    // User B cannot create in Matter A
    const foreignCreate = await createConversation(
      new Request(
        `http://localhost/api/matters/${matterA.matterId}/conversations`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: cookieB,
          },
          body: JSON.stringify({ title: "Intrusion" }),
        },
      ),
      { params: Promise.resolve({ matterId: matterA.matterId }) },
    );
    expect(foreignCreate.status).toBe(403);

    // User B cannot read Conversation A
    const foreignGet = await getConversation(
      new Request(`http://localhost/api/conversations/${conversationA}`, {
        headers: { cookie: cookieB },
      }),
      { params: Promise.resolve({ conversationId: conversationA }) },
    );
    expect(foreignGet.status).toBe(403);

    // User A cannot list Matter B conversations
    const listB = await listConversations(
      new Request(
        `http://localhost/api/matters/${matterB.matterId}/conversations`,
        { headers: { cookie: cookieA } },
      ),
      { params: Promise.resolve({ matterId: matterB.matterId }) },
    );
    expect(listB.status).toBe(403);

    const foreignDelete = await deleteConversation(
      new Request(`http://localhost/api/conversations/${conversationA}`, {
        method: "DELETE",
        headers: { cookie: cookieB },
      }),
      { params: Promise.resolve({ conversationId: conversationA }) },
    );
    expect(foreignDelete.status).toBe(403);

    await cleanupUserByEmail(emailA);
    await cleanupUserByEmail(emailB);
  });

  it("builds matter context that never includes another matter's data", async () => {
    const emailA = uniqueEmail("ctxa");
    const emailB = uniqueEmail("ctxb");
    const cookieA = await registerVerifyLogin(emailA);
    const cookieB = await registerVerifyLogin(emailB);

    const matterA = await createWorkspaceAndMatter(cookieA, "Context Matter A");
    const matterB = await createWorkspaceAndMatter(cookieB, "Context Matter B");

    await uploadDocument(
      new Request(
        `http://localhost/api/matters/${matterA.matterId}/documents`,
        {
          method: "POST",
          headers: { cookie: cookieA },
          body: (() => {
            const form = new FormData();
            form.set("file", new File([TINY_PDF], "contract-a.pdf", { type: "application/pdf" }));
            return form;
          })(),
        },
      ),
      { params: Promise.resolve({ matterId: matterA.matterId }) },
    );

    await uploadDocument(
      new Request(
        `http://localhost/api/matters/${matterB.matterId}/documents`,
        {
          method: "POST",
          headers: { cookie: cookieB },
          body: (() => {
            const form = new FormData();
            form.set("file", new File([TINY_PDF], "contract-b.pdf", { type: "application/pdf" }));
            return form;
          })(),
        },
      ),
      { params: Promise.resolve({ matterId: matterB.matterId }) },
    );

    const convA = await createConversation(
      new Request(
        `http://localhost/api/matters/${matterA.matterId}/conversations`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: cookieA,
          },
          body: JSON.stringify({ title: "A chat" }),
        },
      ),
      { params: Promise.resolve({ matterId: matterA.matterId }) },
    );
    const conversationA = (await convA.json()).conversation.id as string;

    const authRequest = new Request("http://localhost", {
      headers: { cookie: cookieA },
    });
    const auth = await requireAuthContext(authRequest);

    const contextA = await getAuthorizedMatterContextForTests({
      matterId: matterA.matterId,
      conversationId: conversationA,
      context: auth,
    });

    expect(contextA.matter.id).toBe(matterA.matterId);
    expect(contextA.matter.name).toBe("Context Matter A");
    expect(contextA.documents.map((d) => d.filename)).toEqual(["contract-a.pdf"]);
    expect(contextA.documents.some((d) => d.filename.includes("contract-b"))).toBe(
      false,
    );
    expect(contextA.layers.matterRag).toBe(false);
    expect(contextA.layers.legalCorpusRag).toBe(false);
    // No extracted OCR text in context documents.
    expect(
      Object.keys(contextA.documents[0] ?? {}).includes("extractedText"),
    ).toBe(false);

    await expect(
      getAuthorizedMatterContextForTests({
        matterId: matterB.matterId,
        context: auth,
      }),
    ).rejects.toThrow(/do not have access/i);

    await cleanupUserByEmail(emailA);
    await cleanupUserByEmail(emailB);
  });

  it("returns a safe error when the LLM provider fails", async () => {
    const email = uniqueEmail("llmfail");
    const cookie = await registerVerifyLogin(email);
    const { matterId } = await createWorkspaceAndMatter(cookie);

    const created = await createConversation(
      new Request(`http://localhost/api/matters/${matterId}/conversations`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie,
        },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ matterId }) },
    );
    const conversationId = (await created.json()).conversation.id as string;

    resetLlmServiceForTests({
      async chat() {
        throw new Error("provider timeout");
      },
    });

    const failed = await sendMessage(
      new Request(`http://localhost/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie,
        },
        body: JSON.stringify({ content: "Hello" }),
      }),
      { params: Promise.resolve({ conversationId }) },
    );
    expect(failed.status).toBe(400);
    const body = await failed.json();
    expect(body.error.message).toMatch(/temporarily unavailable/i);
    expect(JSON.stringify(body)).not.toMatch(/provider timeout/i);

    // User message may already be stored; history should not contain a fake assistant answer.
    const listed = await listMessages(
      new Request(`http://localhost/api/conversations/${conversationId}/messages`, {
        headers: { cookie },
      }),
      { params: Promise.resolve({ conversationId }) },
    );
    const messagesBody = await listed.json();
    expect(messagesBody.messages.every((m: { role: string }) => m.role !== "ASSISTANT")).toBe(
      true,
    );

    await cleanupUserByEmail(email);
  });
});
