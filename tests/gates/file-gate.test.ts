// PLAN.md P1.3: the file-uploaded gate (supabase/sql/005_file_gate_trigger.sql). CLAUDE.md
// section 4 rule 2, as actually implemented: a task may reach status='approval_sent' only if a
// task_files row exists for it - there is no 'file_uploaded' status anywhere in this schema, and
// task_files.drive_link is a column on task_files, not tasks. Every UPDATE below is issued as a
// real authenticated member via supabase-js directly, bypassing every server action - a passing
// Zod refine in lib/schemas proves nothing about what Postgres actually enforces.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SEED_EMAILS, signInAs, signOutAll, type AuthedUser } from "../helpers/auth";

let superAdmin: AuthedUser;
let onboarding: AuthedUser;
let member1: AuthedUser;

let testClientId: string;
const createdTaskIds: string[] = [];

beforeAll(async () => {
  [superAdmin, onboarding, member1] = await Promise.all([
    signInAs(SEED_EMAILS.superAdmin),
    signInAs(SEED_EMAILS.onboarding),
    signInAs(SEED_EMAILS.member1),
  ]);

  const { data: client, error: clientErr } = await onboarding.client
    .from("clients")
    .insert({
      brand_name: "P1.3 File Gate Fixture",
      contact_name: "Test Contact",
      contact_email: "test@p13fixture.example",
      package: "Test",
      service_type: "social_media",
      created_by: onboarding.id,
    })
    .select("id")
    .single();
  if (clientErr || !client) throw new Error(`fixture client insert failed: ${clientErr?.message}`);
  testClientId = client.id;
});

afterAll(async () => {
  if (createdTaskIds.length > 0) {
    await superAdmin.client.from("tasks").delete().in("id", createdTaskIds);
  }
  await superAdmin.client.from("clients").delete().eq("id", testClientId);
  await signOutAll(superAdmin, onboarding, member1);
});

// A fresh task at status='in_process', assigned to member1. in_process -> approval_sent is FSM-
// legal (see the P1.2 status matrix), so any rejection here can only be the file gate (005) - not
// the status FSM trigger (003) also firing on the same UPDATE.
async function newInProcessTask(title: string): Promise<string> {
  const { data, error } = await superAdmin.client
    .from("tasks")
    .insert({
      client_id: testClientId,
      title,
      service_type: "social_media",
      status: "in_process", // super_admin insert is exempt from 007's pin
      assigned_to: member1.id,
      assigned_by: onboarding.id,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`fixture task insert failed: ${JSON.stringify(error)}`);
  createdTaskIds.push(data.id);
  return data.id;
}

describe("file-uploaded gate", () => {
  it("approval_sent with no task_files row fails at the DB layer", async () => {
    const taskId = await newInProcessTask("P1.3 no file attached");

    const { data, error } = await member1.client
      .from("tasks")
      .update({ status: "approval_sent" })
      .eq("id", taskId)
      .select()
      .single();

    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.code).toBe("P0001"); // RAISE EXCEPTION ... USING ERRCODE = 'P0001' in 005
    expect(error?.message).toMatch(/no file attached/i);

    // Confirm the row genuinely didn't move - a BEFORE UPDATE exception aborts the whole
    // statement, but assert the actual persisted state rather than trusting that alone.
    const { data: after } = await superAdmin.client.from("tasks").select("status").eq("id", taskId).single();
    expect(after?.status).toBe("in_process");
  });

  it("the same transition succeeds once a task_files row exists", async () => {
    const taskId = await newInProcessTask("P1.3 file attached");

    const { error: fileErr } = await member1.client.from("task_files").insert({
      task_id: taskId,
      drive_link: "https://drive.example.com/p13-gate-fixture",
      file_type: "document",
      uploaded_by: member1.id,
    });
    expect(fileErr).toBeNull();

    const { data, error } = await member1.client
      .from("tasks")
      .update({ status: "approval_sent" })
      .eq("id", taskId)
      .select("status")
      .single();

    expect(error).toBeNull();
    expect(data?.status).toBe("approval_sent");
  });

  it("a task_files row belonging to a DIFFERENT task does not satisfy the gate", async () => {
    const taskId = await newInProcessTask("P1.3 file on wrong task");
    const otherTaskId = await newInProcessTask("P1.3 file gate decoy task");

    const { error: fileErr } = await member1.client.from("task_files").insert({
      task_id: otherTaskId, // attached to the decoy, not taskId
      drive_link: "https://drive.example.com/p13-decoy",
      file_type: "document",
      uploaded_by: member1.id,
    });
    expect(fileErr).toBeNull();

    const { error } = await member1.client
      .from("tasks")
      .update({ status: "approval_sent" })
      .eq("id", taskId)
      .select()
      .single();

    expect(error?.code).toBe("P0001");
  });
});
