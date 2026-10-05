import { beforeEach, describe, expect, it } from "vitest";

import { POST as loginPost } from "@/app/api/auth/login/route";
import { POST as registerPost } from "@/app/api/auth/register/route";
import { GET as verifyGet } from "@/app/api/auth/verify-email/route";
import {
  DELETE as deleteMatter,
  GET as getMatter,
  PATCH as patchMatter,
} from "@/app/api/matters/[matterId]/route";
import {
  GET as listMembers,
} from "@/app/api/workspaces/[workspaceId]/members/route";
import {
  POST as createMatter,
  GET as listMatters,
} from "@/app/api/workspaces/[workspaceId]/matters/route";
import {
  DELETE as deleteWorkspace,
  GET as getWorkspace,
  PATCH as patchWorkspace,
} from "@/app/api/workspaces/[workspaceId]/route";
import {
  GET as listWorkspaces,
  POST as createWorkspace,
} from "@/app/api/workspaces/route";

import {
  STRONG_PASSWORD,
  cleanupUserByEmail,
  collectCookies,
  extractVerificationTokenFromEmail,
  resetTestState,
  uniqueEmail,
} from "./helpers";

async function registerVerifyLogin(
  email: string,
  role: "LAWYER" | "CLIENT" = "LAWYER",
) {
  await registerPost(
    new Request("http://localhost/api/auth/register", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.10",
      },
      body: JSON.stringify({
        email,
        password: STRONG_PASSWORD,
        firstName: "Wes",
        lastName: "Lawyer",
        role,
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
        "x-forwarded-for": "203.0.113.11",
      },
      body: JSON.stringify({ email, password: STRONG_PASSWORD }),
    }),
  );

  const body = await login.json();
  return { cookie: collectCookies(login), user: body.user };
}

describe("workspaces + matters", () => {
  beforeEach(() => {
    resetTestState();
  });

  it("lets a lawyer create and view their workspace, and blocks outsiders", async () => {
    const emailA = uniqueEmail("wsa");
    const emailB = uniqueEmail("wsb");
    const userA = await registerVerifyLogin(emailA);
    const userB = await registerVerifyLogin(emailB);

    const created = await createWorkspace(
      new Request("http://localhost/api/workspaces", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: userA.cookie,
        },
        body: JSON.stringify({ name: "Alpha Practice" }),
      }),
    );
    expect(created.status).toBe(201);
    const createdBody = await created.json();
    const workspaceId = createdBody.workspace.id as string;

    const listA = await listWorkspaces(
      new Request("http://localhost/api/workspaces", {
        headers: { cookie: userA.cookie },
      }),
    );
    expect(listA.status).toBe(200);
    const listABody = await listA.json();
    expect(
      listABody.workspaces.some(
        (workspace: { id: string }) => workspace.id === workspaceId,
      ),
    ).toBe(true);

    const getA = await getWorkspace(
      new Request(`http://localhost/api/workspaces/${workspaceId}`, {
        headers: { cookie: userA.cookie },
      }),
      { params: Promise.resolve({ workspaceId }) },
    );
    expect(getA.status).toBe(200);

    const getB = await getWorkspace(
      new Request(`http://localhost/api/workspaces/${workspaceId}`, {
        headers: { cookie: userB.cookie },
      }),
      { params: Promise.resolve({ workspaceId }) },
    );
    expect(getB.status).toBe(403);

    const membersB = await listMembers(
      new Request(`http://localhost/api/workspaces/${workspaceId}/members`, {
        headers: { cookie: userB.cookie },
      }),
      { params: Promise.resolve({ workspaceId }) },
    );
    expect(membersB.status).toBe(403);

    const patchB = await patchWorkspace(
      new Request(`http://localhost/api/workspaces/${workspaceId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: userB.cookie,
        },
        body: JSON.stringify({ name: "Hijacked" }),
      }),
      { params: Promise.resolve({ workspaceId }) },
    );
    expect(patchB.status).toBe(403);

    const patchA = await patchWorkspace(
      new Request(`http://localhost/api/workspaces/${workspaceId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: userA.cookie,
        },
        body: JSON.stringify({ name: "Alpha Renamed" }),
      }),
      { params: Promise.resolve({ workspaceId }) },
    );
    expect(patchA.status).toBe(200);
    const patched = await patchA.json();
    expect(patched.workspace.name).toBe("Alpha Renamed");

    const membersA = await listMembers(
      new Request(`http://localhost/api/workspaces/${workspaceId}/members`, {
        headers: { cookie: userA.cookie },
      }),
      { params: Promise.resolve({ workspaceId }) },
    );
    expect(membersA.status).toBe(200);
    const membersBody = await membersA.json();
    expect(membersBody.members).toHaveLength(1);
    expect(membersBody.members[0].role).toBe("OWNER");

    await cleanupUserByEmail(emailA);
    await cleanupUserByEmail(emailB);
  });

  it("enforces matter ownership, status updates, and cross-tenant isolation", async () => {
    const emailA = uniqueEmail("mta");
    const emailB = uniqueEmail("mtb");
    const userA = await registerVerifyLogin(emailA);
    const userB = await registerVerifyLogin(emailB);

    const workspaceARes = await createWorkspace(
      new Request("http://localhost/api/workspaces", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: userA.cookie,
        },
        body: JSON.stringify({ name: "Workspace A" }),
      }),
    );
    const workspaceA = (await workspaceARes.json()).workspace.id as string;

    const workspaceBRes = await createWorkspace(
      new Request("http://localhost/api/workspaces", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: userB.cookie,
        },
        body: JSON.stringify({ name: "Workspace B" }),
      }),
    );
    const workspaceB = (await workspaceBRes.json()).workspace.id as string;

    const matterARes = await createMatter(
      new Request(`http://localhost/api/workspaces/${workspaceA}/matters`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: userA.cookie,
        },
        body: JSON.stringify({
          title: "Matter A",
          matterType: "CIVIL",
        }),
      }),
      { params: Promise.resolve({ workspaceId: workspaceA }) },
    );
    expect(matterARes.status).toBe(201);
    const matterABody = await matterARes.json();
    const matterA = matterABody.matter.id as string;
    expect(matterABody.matter.workspaceId).toBe(workspaceA);
    expect(matterABody.matter.matterType).toBe("CIVIL");
    expect(matterABody.matter.name).toBe("Matter A");

    const matterBRes = await createMatter(
      new Request(`http://localhost/api/workspaces/${workspaceB}/matters`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: userB.cookie,
        },
        body: JSON.stringify({ title: "Matter B", matterType: "CORPORATE" }),
      }),
      { params: Promise.resolve({ workspaceId: workspaceB }) },
    );
    const matterB = (await matterBRes.json()).matter.id as string;

    // User A → Workspace A → Matter A ✓
    const getOwn = await getMatter(
      new Request(`http://localhost/api/matters/${matterA}`, {
        headers: { cookie: userA.cookie },
      }),
      { params: Promise.resolve({ matterId: matterA }) },
    );
    expect(getOwn.status).toBe(200);

    // User A → Workspace B ✕
    const getWsB = await getWorkspace(
      new Request(`http://localhost/api/workspaces/${workspaceB}`, {
        headers: { cookie: userA.cookie },
      }),
      { params: Promise.resolve({ workspaceId: workspaceB }) },
    );
    expect(getWsB.status).toBe(403);

    // User A → Matter B ✕
    const getMatterB = await getMatter(
      new Request(`http://localhost/api/matters/${matterB}`, {
        headers: { cookie: userA.cookie },
      }),
      { params: Promise.resolve({ matterId: matterB }) },
    );
    expect(getMatterB.status).toBe(403);

    // User B → Workspace A ✕
    const getWsA = await getWorkspace(
      new Request(`http://localhost/api/workspaces/${workspaceA}`, {
        headers: { cookie: userB.cookie },
      }),
      { params: Promise.resolve({ workspaceId: workspaceA }) },
    );
    expect(getWsA.status).toBe(403);

    // Cannot create matter in another workspace by ID swap
    const createInForeign = await createMatter(
      new Request(`http://localhost/api/workspaces/${workspaceB}/matters`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: userA.cookie,
        },
        body: JSON.stringify({ title: "Intrusion" }),
      }),
      { params: Promise.resolve({ workspaceId: workspaceB }) },
    );
    expect(createInForeign.status).toBe(403);

    // Listing matters under wrong workspace does not leak matter A
    const listUnderB = await listMatters(
      new Request(`http://localhost/api/workspaces/${workspaceB}/matters`, {
        headers: { cookie: userA.cookie },
      }),
      { params: Promise.resolve({ workspaceId: workspaceB }) },
    );
    expect(listUnderB.status).toBe(403);

    const listUnderA = await listMatters(
      new Request(`http://localhost/api/workspaces/${workspaceA}/matters`, {
        headers: { cookie: userA.cookie },
      }),
      { params: Promise.resolve({ workspaceId: workspaceA }) },
    );
    expect(listUnderA.status).toBe(200);
    const listed = await listUnderA.json();
    expect(listed.matters.map((m: { id: string }) => m.id)).toEqual([matterA]);

    const statusUpdate = await patchMatter(
      new Request(`http://localhost/api/matters/${matterA}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: userA.cookie,
        },
        body: JSON.stringify({ status: "CLOSED" }),
      }),
      { params: Promise.resolve({ matterId: matterA }) },
    );
    expect(statusUpdate.status).toBe(200);
    const updated = await statusUpdate.json();
    expect(updated.matter.status).toBe("CLOSED");

    const foreignPatch = await patchMatter(
      new Request(`http://localhost/api/matters/${matterA}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: userB.cookie,
        },
        body: JSON.stringify({ status: "ARCHIVED" }),
      }),
      { params: Promise.resolve({ matterId: matterA }) },
    );
    expect(foreignPatch.status).toBe(403);

    const foreignDelete = await deleteMatter(
      new Request(`http://localhost/api/matters/${matterA}`, {
        method: "DELETE",
        headers: { cookie: userB.cookie },
      }),
      { params: Promise.resolve({ matterId: matterA }) },
    );
    expect(foreignDelete.status).toBe(403);

    const deleteA = await deleteMatter(
      new Request(`http://localhost/api/matters/${matterA}`, {
        method: "DELETE",
        headers: { cookie: userA.cookie },
      }),
      { params: Promise.resolve({ matterId: matterA }) },
    );
    expect(deleteA.status).toBe(200);

    const deleteWsForeign = await deleteWorkspace(
      new Request(`http://localhost/api/workspaces/${workspaceA}`, {
        method: "DELETE",
        headers: { cookie: userB.cookie },
      }),
      { params: Promise.resolve({ workspaceId: workspaceA }) },
    );
    expect(deleteWsForeign.status).toBe(403);

    await cleanupUserByEmail(emailA);
    await cleanupUserByEmail(emailB);
  });
});
