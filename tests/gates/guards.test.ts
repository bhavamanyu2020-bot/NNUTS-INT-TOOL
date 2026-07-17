// PLAN.md P1.3: the insert guard (supabase/sql/007_task_insert_guard.sql, P2.1) and the
// column-authorization guard (supabase/sql/009_task_column_guard.sql, P2.4). Every write below
// goes through supabase-js as a real authenticated role, never a server action.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SEED_EMAILS, signInAs, signOutAll, type AuthedUser } from "../helpers/auth";

let superAdmin: AuthedUser;
let onboarding: AuthedUser;
let leadProduction: AuthedUser;
let member1: AuthedUser;
let member2: AuthedUser;

let testClientId: string;
const createdTaskIds: string[] = [];

beforeAll(async () => {
  [superAdmin, onboarding, leadProduction, member1, member2] = await Promise.all([
    signInAs(SEED_EMAILS.superAdmin),
    signInAs(SEED_EMAILS.onboarding),
    signInAs(SEED_EMAILS.leadProduction),
    signInAs(SEED_EMAILS.member1),
    signInAs(SEED_EMAILS.member2),
  ]);

  const { data: client, error: clientErr } = await onboarding.client
    .from("clients")
    .insert({
      brand_name: "P1.3 Guards Fixture",
      contact_name: "Test Contact",
      contact_email: "test@p13guards.example",
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
  await signOutAll(superAdmin, onboarding, leadProduction, member1, member2);
});

// Inserted via super_admin, which is exempt from 007's insert-time pin - lets a fixture start at
// any status/stage/column values a given column-guard test needs, isolated from insert-guard
// behaviour (which gets its own dedicated tests below, via non-super_admin inserters).
async function newTask(input: Record<string, unknown>): Promise<string> {
  const { data, error } = await superAdmin.client
    .from("tasks")
    .insert({ client_id: testClientId, service_type: "social_media", ...input })
    .select("id")
    .single();
  if (error || !data) throw new Error(`fixture task insert failed: ${JSON.stringify(error)}`);
  createdTaskIds.push(data.id);
  return data.id;
}

describe("insert guard (P2.1)", () => {
  it("silently pins status/stage for a non-super_admin insert, even when explicitly overridden", async () => {
    const { data, error } = await leadProduction.client
      .from("tasks")
      .insert({
        client_id: testClientId,
        title: "P1.3 lead tries to insert pre-completed",
        service_type: "social_media",
        assigned_to: member1.id,
        assigned_by: leadProduction.id,
        status: "completed", // requested - should be silently overridden, not rejected
        stage: "closed",
      })
      .select("id, status, stage")
      .single();

    expect(error).toBeNull(); // pins, does not reject - see 007's own comment on why
    expect(data?.status).toBe("yet_to_start");
    expect(data?.stage).toBe("onboarding");
    if (data) createdTaskIds.push(data.id);
  });

  it("does NOT pin a super_admin insert - explicit values are retained as-is", async () => {
    const { data, error } = await superAdmin.client
      .from("tasks")
      .insert({
        client_id: testClientId,
        title: "P1.3 super_admin inserts mid-pipeline",
        service_type: "social_media",
        assigned_by: superAdmin.id, // NOT NULL, no default
        status: "approval_sent",
        stage: "production",
      })
      .select("id, status, stage")
      .single();

    expect(error).toBeNull();
    expect(data?.status).toBe("approval_sent");
    expect(data?.stage).toBe("production");
    if (data) createdTaskIds.push(data.id);
  });
});

describe("column guard (P2.4)", () => {
  it("rejects a member changing a forbidden column (title)", async () => {
    const taskId = await newTask({
      title: "P1.3 member column guard - forbidden",
      status: "yet_to_start",
      assigned_to: member1.id,
      assigned_by: leadProduction.id,
    });

    const { error } = await member1.client
      .from("tasks")
      .update({ title: "member tried to rename this" })
      .eq("id", taskId)
      .select()
      .single();

    expect(error?.code).toBe("P0001");
    expect(error?.message).toMatch(/member may only change task status/i);
  });

  it("allows a member changing only status", async () => {
    const taskId = await newTask({
      title: "P1.3 member column guard - status only",
      status: "yet_to_start",
      assigned_to: member1.id,
      assigned_by: leadProduction.id,
    });

    const { data, error } = await member1.client
      .from("tasks")
      .update({ status: "in_process" }) // yet_to_start -> in_process is FSM-legal
      .eq("id", taskId)
      .select("status")
      .single();

    expect(error).toBeNull();
    expect(data?.status).toBe("in_process");
  });

  it("rejects the WHOLE update when a legal status change is bundled with a forbidden column change", async () => {
    const taskId = await newTask({
      title: "P1.3 member column guard - bundled",
      status: "yet_to_start",
      assigned_to: member1.id,
      assigned_by: leadProduction.id,
    });

    const { error } = await member1.client
      .from("tasks")
      .update({ status: "in_process", title: "sneaking a rename in" })
      .eq("id", taskId)
      .select()
      .single();

    expect(error?.code).toBe("P0001");

    // Confirm status did NOT change either - the guard rejects the statement atomically, it
    // doesn't apply the allowed part and drop the disallowed part.
    const { data: after } = await superAdmin.client.from("tasks").select("status").eq("id", taskId).single();
    expect(after?.status).toBe("yet_to_start");
  });

  it("rejects a lead changing a forbidden column (title)", async () => {
    const taskId = await newTask({
      title: "P1.3 lead column guard - forbidden",
      status: "yet_to_start",
      assigned_to: member1.id,
      assigned_by: leadProduction.id,
    });

    const { error } = await leadProduction.client
      .from("tasks")
      .update({ title: "lead tried to rename this" })
      .eq("id", taskId)
      .select()
      .single();

    expect(error?.code).toBe("P0001");
    expect(error?.message).toMatch(/lead may only change status, stage, assigned_to, and deadline/i);
  });

  it("allows a lead changing an explicitly-permitted column (deadline)", async () => {
    const taskId = await newTask({
      title: "P1.3 lead column guard - deadline allowed",
      status: "yet_to_start",
      assigned_to: member1.id,
      assigned_by: leadProduction.id,
    });

    const deadline = new Date(Date.now() + 86_400_000).toISOString();
    const { data, error } = await leadProduction.client
      .from("tasks")
      .update({ deadline })
      .eq("id", taskId)
      .select("deadline")
      .single();

    expect(error).toBeNull();
    // Postgres round-trips timestamptz as "+00:00", not the "Z" suffix it was sent with - same
    // instant, different string. Compare as instants, not strings.
    expect(new Date(data?.deadline ?? 0).getTime()).toBe(new Date(deadline).getTime());
  });

  it("allows a lead reassigning within their team (assigned_to is explicitly permitted)", async () => {
    const taskId = await newTask({
      title: "P1.3 lead column guard - reassign allowed",
      status: "yet_to_start",
      assigned_to: member1.id,
      assigned_by: leadProduction.id,
    });

    const { data, error } = await leadProduction.client
      .from("tasks")
      .update({ assigned_to: member2.id })
      .eq("id", taskId)
      .select("assigned_to")
      .single();

    expect(error).toBeNull();
    expect(data?.assigned_to).toBe(member2.id);
  });

  it("admin_onboarding is unrestricted by the column guard (can change title)", async () => {
    const taskId = await newTask({
      title: "P1.3 admin_onboarding column guard",
      status: "yet_to_start",
      stage: "onboarding",
      assigned_by: onboarding.id,
    });

    const { data, error } = await onboarding.client
      .from("tasks")
      .update({ title: "renamed by admin_onboarding" })
      .eq("id", taskId)
      .select("title")
      .single();

    expect(error).toBeNull();
    expect(data?.title).toBe("renamed by admin_onboarding");
  });
});
