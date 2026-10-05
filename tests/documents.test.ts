import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { POST as loginPost } from "@/app/api/auth/login/route";
import { POST as registerPost } from "@/app/api/auth/register/route";
import { GET as verifyGet } from "@/app/api/auth/verify-email/route";
import {
  DELETE as deleteDocument,
  GET as getDocument,
} from "@/app/api/documents/[documentId]/route";
import { GET as getDocumentPages } from "@/app/api/documents/[documentId]/pages/route";
import { GET as getDocumentOriginal } from "@/app/api/documents/[documentId]/original/route";
import { POST as processDocument } from "@/app/api/documents/[documentId]/process/route";
import { POST as retryDocument } from "@/app/api/documents/[documentId]/retry/route";
import {
  GET as listDocuments,
  POST as uploadDocument,
} from "@/app/api/matters/[matterId]/documents/route";
import { POST as uploadPhotos } from "@/app/api/matters/[matterId]/documents/photos/route";
import { POST as createMatter } from "@/app/api/workspaces/[workspaceId]/matters/route";
import { POST as createWorkspace } from "@/app/api/workspaces/route";
import { db } from "@/lib/db";
import { documentAuditLogs, documentPages, documents } from "@/lib/db/schema";
import { resetDocumentAiServiceForTests } from "@/modules/document-ai";
import { createMockDocumentAiService } from "@/modules/document-ai/mock";
import { resetObjectStorageForTests } from "@/modules/storage";

import { TINY_JPEG, TINY_PDF, TINY_PNG } from "./fixtures";
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
        "x-forwarded-for": "203.0.113.80",
      },
      body: JSON.stringify({
        email,
        password: STRONG_PASSWORD,
        firstName: "Doc",
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
        "x-forwarded-for": "203.0.113.81",
      },
      body: JSON.stringify({ email, password: STRONG_PASSWORD }),
    }),
  );

  return collectCookies(login);
}

async function createWorkspaceAndMatter(cookie: string) {
  const workspaceRes = await createWorkspace(
    new Request("http://localhost/api/workspaces", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({ name: "Doc Workspace" }),
    }),
  );
  expect(workspaceRes.status).toBe(201);
  const workspaceBody = await workspaceRes.json();

  const matterRes = await createMatter(
    new Request(
      `http://localhost/api/workspaces/${workspaceBody.workspace.id}/matters`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie,
        },
        body: JSON.stringify({ title: "Doc Matter" }),
      },
    ),
    { params: Promise.resolve({ workspaceId: workspaceBody.workspace.id }) },
  );
  expect(matterRes.status).toBe(201);
  const matterBody = await matterRes.json();
  return {
    workspaceId: workspaceBody.workspace.id as string,
    matterId: matterBody.matter.id as string,
  };
}

function fileForm(file: Buffer, filename: string, type: string) {
  const form = new FormData();
  form.set("file", new File([file], filename, { type }));
  return form;
}

describe("documents + document AI", () => {
  beforeEach(() => {
    resetTestState();
    resetObjectStorageForTests();
    resetDocumentAiServiceForTests(createMockDocumentAiService());
  });

  it("uploads PDF and image, processes pages, and preserves the original", async () => {
    const email = uniqueEmail("docok");
    const cookie = await registerVerifyLogin(email);
    const { matterId } = await createWorkspaceAndMatter(cookie);

    const pdfUpload = await uploadDocument(
      new Request(`http://localhost/api/matters/${matterId}/documents`, {
        method: "POST",
        headers: { cookie },
        body: fileForm(TINY_PDF, "contract.pdf", "application/pdf"),
      }),
      { params: Promise.resolve({ matterId }) },
    );
    expect(pdfUpload.status).toBe(201);
    const pdfBody = await pdfUpload.json();
    expect(pdfBody.document.processingStatus).toBe("PROCESSED");
    expect(pdfBody.document.pageCount).toBeGreaterThanOrEqual(1);

    const imageUpload = await uploadDocument(
      new Request(`http://localhost/api/matters/${matterId}/documents`, {
        method: "POST",
        headers: { cookie },
        body: fileForm(TINY_PNG, "scan.png", "image/png"),
      }),
      { params: Promise.resolve({ matterId }) },
    );
    expect(imageUpload.status).toBe(201);

    const detail = await getDocument(
      new Request(`http://localhost/api/documents/${pdfBody.document.id}`, {
        headers: { cookie },
      }),
      { params: Promise.resolve({ documentId: pdfBody.document.id }) },
    );
    expect(detail.status).toBe(200);
    const detailBody = await detail.json();
    expect(detailBody.pages.length).toBeGreaterThanOrEqual(1);
    expect(detailBody.pages[0].pageNumber).toBe(1);
    expect(detailBody.document.extractedText).toContain("Mock OCR");
    expect(detailBody.document.ragReadyMetadata.domain).toBe(
      "customer_matter_data",
    );

    const pages = await getDocumentPages(
      new Request(
        `http://localhost/api/documents/${pdfBody.document.id}/pages`,
        { headers: { cookie } },
      ),
      { params: Promise.resolve({ documentId: pdfBody.document.id }) },
    );
    expect(pages.status).toBe(200);
    const pagesBody = await pages.json();
    expect(pagesBody.pages.length).toBeGreaterThanOrEqual(1);

    const original = await getDocumentOriginal(
      new Request(
        `http://localhost/api/documents/${pdfBody.document.id}/original`,
        { headers: { cookie } },
      ),
      { params: Promise.resolve({ documentId: pdfBody.document.id }) },
    );
    expect(original.status).toBe(200);
    const originalBytes = Buffer.from(await original.arrayBuffer());
    expect(originalBytes.equals(TINY_PDF)).toBe(true);

    await cleanupUserByEmail(email);
  });

  it("rejects unsupported, empty, and oversized uploads", async () => {
    const email = uniqueEmail("reject");
    const cookie = await registerVerifyLogin(email);
    const { matterId } = await createWorkspaceAndMatter(cookie);

    const invalid = await uploadDocument(
      new Request(`http://localhost/api/matters/${matterId}/documents`, {
        method: "POST",
        headers: { cookie },
        body: fileForm(Buffer.from("hello"), "notes.txt", "text/plain"),
      }),
      { params: Promise.resolve({ matterId }) },
    );
    expect(invalid.status).toBe(400);
    const invalidBody = await invalid.json();
    expect(invalidBody.error.message).toMatch(/not supported/i);

    const empty = await uploadDocument(
      new Request(`http://localhost/api/matters/${matterId}/documents`, {
        method: "POST",
        headers: { cookie },
        body: fileForm(Buffer.alloc(0), "empty.pdf", "application/pdf"),
      }),
      { params: Promise.resolve({ matterId }) },
    );
    expect(empty.status).toBe(400);
    const emptyBody = await empty.json();
    expect(emptyBody.error.message).toMatch(/empty/i);

    const previous = process.env.DOCUMENT_MAX_UPLOAD_BYTES;
    process.env.DOCUMENT_MAX_UPLOAD_BYTES = "100";
    resetTestState();
    resetObjectStorageForTests();
    resetDocumentAiServiceForTests(createMockDocumentAiService());

    const oversized = await uploadDocument(
      new Request(`http://localhost/api/matters/${matterId}/documents`, {
        method: "POST",
        headers: { cookie },
        body: fileForm(TINY_PDF, "big.pdf", "application/pdf"),
      }),
      { params: Promise.resolve({ matterId }) },
    );
    expect(oversized.status).toBe(400);
    const oversizedBody = await oversized.json();
    expect(oversizedBody.error.message).toMatch(/exceeds the allowed size/i);

    process.env.DOCUMENT_MAX_UPLOAD_BYTES = previous;
    resetTestState();

    await cleanupUserByEmail(email);
  });

  it("enforces cross-workspace and cross-matter document isolation", async () => {
    const emailA = uniqueEmail("doca");
    const emailB = uniqueEmail("docb");
    const cookieA = await registerVerifyLogin(emailA);
    const cookieB = await registerVerifyLogin(emailB);

    const matterA = await createWorkspaceAndMatter(cookieA);
    const matterB = await createWorkspaceAndMatter(cookieB);

    const uploadA = await uploadDocument(
      new Request(`http://localhost/api/matters/${matterA.matterId}/documents`, {
        method: "POST",
        headers: { cookie: cookieA },
        body: fileForm(TINY_PDF, "a.pdf", "application/pdf"),
      }),
      { params: Promise.resolve({ matterId: matterA.matterId }) },
    );
    const docA = (await uploadA.json()).document.id as string;

    // User A → Matter A → Document A ✓
    const own = await getDocument(
      new Request(`http://localhost/api/documents/${docA}`, {
        headers: { cookie: cookieA },
      }),
      { params: Promise.resolve({ documentId: docA }) },
    );
    expect(own.status).toBe(200);

    // User B → Matter A → Document A ✕
    const foreignUser = await getDocument(
      new Request(`http://localhost/api/documents/${docA}`, {
        headers: { cookie: cookieB },
      }),
      { params: Promise.resolve({ documentId: docA }) },
    );
    expect(foreignUser.status).toBe(403);

    // User A → Matter B upload ✕
    const crossMatterUpload = await uploadDocument(
      new Request(`http://localhost/api/matters/${matterB.matterId}/documents`, {
        method: "POST",
        headers: { cookie: cookieA },
        body: fileForm(TINY_JPEG, "intrusion.jpg", "image/jpeg"),
      }),
      { params: Promise.resolve({ matterId: matterB.matterId }) },
    );
    expect(crossMatterUpload.status).toBe(403);

    // User A → Workspace/Matter B document list ✕
    const listB = await listDocuments(
      new Request(`http://localhost/api/matters/${matterB.matterId}/documents`, {
        headers: { cookie: cookieA },
      }),
      { params: Promise.resolve({ matterId: matterB.matterId }) },
    );
    expect(listB.status).toBe(403);

    const unauth = await uploadDocument(
      new Request(`http://localhost/api/matters/${matterB.matterId}/documents`, {
        method: "POST",
        body: fileForm(TINY_JPEG, "photo.jpg", "image/jpeg"),
      }),
      { params: Promise.resolve({ matterId: matterB.matterId }) },
    );
    expect(unauth.status).toBe(401);

    await cleanupUserByEmail(emailA);
    await cleanupUserByEmail(emailB);
  });

  it("marks processing FAILED and retries to PROCESSED without losing original", async () => {
    const email = uniqueEmail("retry");
    const cookie = await registerVerifyLogin(email);
    const { matterId } = await createWorkspaceAndMatter(cookie);

    resetDocumentAiServiceForTests({
      async processDocument() {
        throw new Error("provider unavailable");
      },
    });

    const failed = await uploadDocument(
      new Request(`http://localhost/api/matters/${matterId}/documents`, {
        method: "POST",
        headers: { cookie },
        body: fileForm(TINY_PDF, "fail.pdf", "application/pdf"),
      }),
      { params: Promise.resolve({ matterId }) },
    );
    expect(failed.status).toBe(201);
    const failedBody = await failed.json();
    expect(failedBody.document.processingStatus).toBe("FAILED");
    expect(failedBody.document.processingError).toMatch(/couldn't process/i);

    const originalWhileFailed = await getDocumentOriginal(
      new Request(
        `http://localhost/api/documents/${failedBody.document.id}/original`,
        { headers: { cookie } },
      ),
      { params: Promise.resolve({ documentId: failedBody.document.id }) },
    );
    expect(originalWhileFailed.status).toBe(200);

    resetDocumentAiServiceForTests(createMockDocumentAiService());

    const retried = await retryDocument(
      new Request(
        `http://localhost/api/documents/${failedBody.document.id}/retry`,
        {
          method: "POST",
          headers: { cookie },
        },
      ),
      { params: Promise.resolve({ documentId: failedBody.document.id }) },
    );
    expect(retried.status).toBe(200);
    const retryBody = await retried.json();
    expect(retryBody.status).toBe("PROCESSED");

    const detail = await getDocument(
      new Request(
        `http://localhost/api/documents/${failedBody.document.id}`,
        { headers: { cookie } },
      ),
      { params: Promise.resolve({ documentId: failedBody.document.id }) },
    );
    const detailBody = await detail.json();
    expect(detailBody.document.processingStatus).toBe("PROCESSED");
    expect(detailBody.pages.length).toBeGreaterThanOrEqual(1);

    const retryProcessed = await processDocument(
      new Request(
        `http://localhost/api/documents/${failedBody.document.id}/process`,
        {
          method: "POST",
          headers: { cookie },
        },
      ),
      { params: Promise.resolve({ documentId: failedBody.document.id }) },
    );
    expect(retryProcessed.status).toBe(400);

    await cleanupUserByEmail(email);
  });

  it("uploads multi-page photos as one document", async () => {
    const email = uniqueEmail("photos");
    const cookie = await registerVerifyLogin(email);
    const { matterId } = await createWorkspaceAndMatter(cookie);

    const form = new FormData();
    form.set("title", "Filing photos");
    form.append("pages", new File([TINY_JPEG], "p1.jpg", { type: "image/jpeg" }));
    form.append("pages", new File([TINY_PNG], "p2.png", { type: "image/png" }));

    const response = await uploadPhotos(
      new Request(`http://localhost/api/matters/${matterId}/documents/photos`, {
        method: "POST",
        headers: { cookie },
        body: form,
      }),
      { params: Promise.resolve({ matterId }) },
    );
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.document.processingStatus).toBe("PROCESSED");
    expect(body.document.pageCount).toBe(2);

    const detail = await getDocument(
      new Request(`http://localhost/api/documents/${body.document.id}`, {
        headers: { cookie },
      }),
      { params: Promise.resolve({ documentId: body.document.id }) },
    );
    const detailBody = await detail.json();
    expect(detailBody.pages).toHaveLength(2);
    expect(detailBody.pages.map((p: { pageNumber: number }) => p.pageNumber)).toEqual([
      1, 2,
    ]);

    await cleanupUserByEmail(email);
  });

  it("deletes authorized documents and leaves sibling matter documents intact", async () => {
    const emailA = uniqueEmail("dela");
    const emailB = uniqueEmail("delb");
    const cookieA = await registerVerifyLogin(emailA);
    const cookieB = await registerVerifyLogin(emailB);
    const matterA = await createWorkspaceAndMatter(cookieA);
    const matterB = await createWorkspaceAndMatter(cookieB);

    const keep = await uploadDocument(
      new Request(`http://localhost/api/matters/${matterA.matterId}/documents`, {
        method: "POST",
        headers: { cookie: cookieA },
        body: fileForm(TINY_PNG, "keep.png", "image/png"),
      }),
      { params: Promise.resolve({ matterId: matterA.matterId }) },
    );
    const keepId = (await keep.json()).document.id as string;

    const remove = await uploadDocument(
      new Request(`http://localhost/api/matters/${matterA.matterId}/documents`, {
        method: "POST",
        headers: { cookie: cookieA },
        body: fileForm(TINY_PDF, "remove.pdf", "application/pdf"),
      }),
      { params: Promise.resolve({ matterId: matterA.matterId }) },
    );
    const removeId = (await remove.json()).document.id as string;

    const foreignDelete = await deleteDocument(
      new Request(`http://localhost/api/documents/${removeId}`, {
        method: "DELETE",
        headers: { cookie: cookieB },
      }),
      { params: Promise.resolve({ documentId: removeId }) },
    );
    expect(foreignDelete.status).toBe(403);

    const okDelete = await deleteDocument(
      new Request(`http://localhost/api/documents/${removeId}`, {
        method: "DELETE",
        headers: { cookie: cookieA },
      }),
      { params: Promise.resolve({ documentId: removeId }) },
    );
    expect(okDelete.status).toBe(200);

    const removedPages = await db
      .select()
      .from(documentPages)
      .where(eq(documentPages.documentId, removeId));
    expect(removedPages).toHaveLength(0);

    const removedDoc = await db
      .select()
      .from(documents)
      .where(eq(documents.id, removeId));
    expect(removedDoc).toHaveLength(0);

    const kept = await getDocument(
      new Request(`http://localhost/api/documents/${keepId}`, {
        headers: { cookie: cookieA },
      }),
      { params: Promise.resolve({ documentId: keepId }) },
    );
    expect(kept.status).toBe(200);

    const audit = await db
      .select()
      .from(documentAuditLogs)
      .where(
        and(
          eq(documentAuditLogs.matterId, matterA.matterId),
          eq(documentAuditLogs.action, "document.deleted"),
        ),
      );
    expect(audit.length).toBeGreaterThanOrEqual(1);

    // Matter B untouched
    const listB = await listDocuments(
      new Request(`http://localhost/api/matters/${matterB.matterId}/documents`, {
        headers: { cookie: cookieB },
      }),
      { params: Promise.resolve({ matterId: matterB.matterId }) },
    );
    expect(listB.status).toBe(200);
    const listBBody = await listB.json();
    expect(listBBody.documents).toHaveLength(0);

    await cleanupUserByEmail(emailA);
    await cleanupUserByEmail(emailB);
  });
});
