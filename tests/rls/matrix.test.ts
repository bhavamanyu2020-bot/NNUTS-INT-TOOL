// PLAN.md P1.1: the RLS permission matrix (CLAUDE.md section 4.3) across all four roles and all
// seven tables. Every assertion below executes as a real, authenticated seeded user
// (tests/helpers/auth.ts's signInAs) - never service-role, never Prisma. That is the entire
// point of this suite: it proves what Postgres actually allows, not what the app happens to
// render. If any test here fails, the correct fix is to change the policy in
// supabase/sql/002_rls_policies.sql (or file it as a bug) - never to loosen this test.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SEED_EMAILS, signInAs, signOutAll, type AuthedUser } from "../helpers/auth";

let superAdmin: AuthedUser;
let onboarding: AuthedUser;
let leadProduction: AuthedUser; // Maya, Production team
let leadPostProduction: AuthedUser; // Noah, Post Production team
let member1: AuthedUser; // Production team
let member2: AuthedUser; // Production team
let member4: AuthedUser; // Post Production team

let productionTeamId: string;

// Fixture rows, created fresh in beforeAll (not reused from prisma/seed.ts's data) so this suite
// doesn't silently break if seed.ts's exact tasks/clients ever change shape. Cleaned up in
// afterAll. Any row created inside an individual it() (the insert-positive tests) is also pushed
// here so cleanup is exhaustive.
let testClientId: string;
let taskOnboardingId: string; // stage=onboarding, unassigned
let taskProdMember1Id: string; // stage=production, assigned to member1
let taskProdMember2Id: string; // stage=production, assigned to member2
let taskPostMember4Id: string; // stage=production, Post Production team, assigned to member4
let taskFileId: string; // on taskProdMember1Id, uploaded_by member1

const createdTaskIds: string[] = [];
const createdClientIds: string[] = [];

beforeAll(async () => {
  [superAdmin, onboarding, leadProduction, leadPostProduction, member1, member2, member4] =
    await Promise.all([
      signInAs(SEED_EMAILS.superAdmin),
      signInAs(SEED_EMAILS.onboarding),
      signInAs(SEED_EMAILS.leadProduction),
      signInAs(SEED_EMAILS.leadPostProduction),
      signInAs(SEED_EMAILS.member1),
      signInAs(SEED_EMAILS.member2),
      signInAs(SEED_EMAILS.member4),
    ]);

  // users_select_all grants every authenticated role read access - no elevated client needed to
  // resolve team ids.
  const { data: leadRow } = await superAdmin.client
    .from("users")
    .select("team_id")
    .eq("id", leadProduction.id)
    .single();
  productionTeamId = leadRow!.team_id;

  // Fixture: a client, created by admin_onboarding's own client - this doubles as the positive
  // "admin_onboarding can insert a client" assertion (see the clients describe block) and as
  // fixture setup, rather than seeding it invisibly via super_admin.
  const { data: client, error: clientErr } = await onboarding.client
    .from("clients")
    .insert({
      brand_name: "P1.1 Test Brand",
      contact_name: "Test Contact",
      contact_email: "test@p11fixture.example",
      package: "Test",
      service_type: "social_media",
      created_by: onboarding.id,
    })
    .select("id")
    .single();
  if (clientErr || !client) throw new Error(`fixture client insert failed: ${clientErr?.message}`);
  testClientId = client.id;
  createdClientIds.push(testClientId);

  // Fixture tasks, created via super_admin (exempt from 007_task_insert_guard.sql's stage/status
  // pin, so stage can be set directly to what each test needs).
  async function insertTask(input: Record<string, unknown>): Promise<string> {
    const { data, error } = await superAdmin.client
      .from("tasks")
      .insert({ client_id: testClientId, service_type: "social_media", ...input })
      .select("id")
      .single();
    if (error || !data) throw new Error(`fixture task insert failed: ${JSON.stringify(error)}`);
    createdTaskIds.push(data.id);
    return data.id;
  }

  taskOnboardingId = await insertTask({
    title: "P1.1 onboarding-stage task",
    stage: "onboarding",
    assigned_by: onboarding.id,
  });
  taskProdMember1Id = await insertTask({
    title: "P1.1 production task (member1)",
    stage: "production",
    assigned_to: member1.id,
    assigned_by: leadProduction.id,
  });
  taskProdMember2Id = await insertTask({
    title: "P1.1 production task (member2)",
    stage: "production",
    assigned_to: member2.id,
    assigned_by: leadProduction.id,
  });
  taskPostMember4Id = await insertTask({
    title: "P1.1 production task (member4, Post Production)",
    stage: "production",
    assigned_to: member4.id,
    assigned_by: leadPostProduction.id,
  });

  const { data: file, error: fileErr } = await superAdmin.client
    .from("task_files")
    .insert({
      task_id: taskProdMember1Id,
      drive_link: "https://drive.example.com/p11-fixture",
      file_type: "document",
      uploaded_by: member1.id,
    })
    .select("id")
    .single();
  if (fileErr || !file) throw new Error(`fixture task_file insert failed: ${fileErr?.message}`);
  taskFileId = file.id;
});

afterAll(async () => {
  // Tasks first (task_files cascade with them via the FK); clients last (tasks.client_id is
  // ON DELETE RESTRICT, so a client with tasks still pointing at it can't be deleted first).
  if (createdTaskIds.length > 0) {
    await superAdmin.client.from("tasks").delete().in("id", createdTaskIds);
  }
  if (createdClientIds.length > 0) {
    await superAdmin.client.from("clients").delete().in("id", createdClientIds);
  }
  await signOutAll(superAdmin, onboarding, leadProduction, leadPostProduction, member1, member2, member4);
});

describe("users", () => {
  it("positive: every role can select the users table", async () => {
    for (const u of [superAdmin, onboarding, leadProduction, member1]) {
      const { data, error } = await u.client.from("users").select("id");
      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThan(0);
    }
  });

  it("negative: a member cannot update their own row (no self-service role/team edit)", async () => {
    // .single() matches the shape server/actions/users.ts's updateUser actually uses - without
    // it, an RLS-denied update (0 rows matched by USING) returns { data: [], error: null }, not
    // an error, which would silently defeat this assertion (see P3.1b's own PGRST116 finding).
    const { data, error } = await member1.client
      .from("users")
      .update({ name: "Ivy Member" }) // same value - idempotent if it somehow succeeded
      .eq("id", member1.id)
      .select()
      .single();
    expect(data).toBeNull();
    expect(error?.code).toBe("PGRST116"); // 0 rows matched by USING - RLS denial shape, see P3.1b
  });

  it("negative: a lead cannot update another user's role", async () => {
    const { error } = await leadProduction.client
      .from("users")
      .update({ role: "super_admin" })
      .eq("id", member1.id)
      .select()
      .single();
    expect(error?.code).toBe("PGRST116");
  });

  it("positive: super_admin can update a user row", async () => {
    const { data, error } = await superAdmin.client
      .from("users")
      .update({ name: "Ivy Member" }) // member1's own seeded name - idempotent, no semantic change
      .eq("id", member1.id)
      .select();
    expect(error).toBeNull();
    expect(data).not.toBeNull();
  });
});

describe("teams", () => {
  it("positive: every role can select the teams table", async () => {
    for (const u of [superAdmin, leadProduction, member1]) {
      const { data, error } = await u.client.from("teams").select("id");
      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("negative: a lead cannot rename their own team", async () => {
    const { error } = await leadProduction.client
      .from("teams")
      .update({ name: "Production" }) // same value
      .eq("id", productionTeamId)
      .select()
      .single();
    expect(error?.code).toBe("PGRST116");
  });

  it("positive: super_admin can update a team", async () => {
    const { data, error } = await superAdmin.client
      .from("teams")
      .update({ name: "Production" }) // same value - idempotent
      .eq("id", productionTeamId)
      .select();
    expect(error).toBeNull();
    expect(data).not.toBeNull();
  });
});

describe("clients", () => {
  it("positive: super_admin sees clients", async () => {
    const { data, error } = await superAdmin.client.from("clients").select("id").eq("id", testClientId);
    expect(error).toBeNull();
    expect(data!.length).toBe(1);
  });

  it("positive: admin_onboarding sees clients (and created the fixture one - see beforeAll)", async () => {
    const { data, error } = await onboarding.client.from("clients").select("id").eq("id", testClientId);
    expect(error).toBeNull();
    expect(data!.length).toBe(1);
  });

  it("negative: a lead sees zero clients", async () => {
    const { data, error } = await leadProduction.client.from("clients").select("id");
    expect(error).toBeNull();
    expect(data!.length).toBe(0);
  });

  it("negative: a member sees zero clients", async () => {
    const { data, error } = await member1.client.from("clients").select("id");
    expect(error).toBeNull();
    expect(data!.length).toBe(0);
  });

  it("negative: a lead cannot insert a client", async () => {
    // created_by set on every payload here (even ones expected to fail) so a NOT NULL violation
    // never masks whether RLS's WITH CHECK is actually what rejected the insert.
    const { error } = await leadProduction.client
      .from("clients")
      .insert({
        brand_name: "Should not exist",
        contact_name: "x",
        contact_email: "x@x.example",
        package: "x",
        service_type: "social_media",
        created_by: leadProduction.id,
      })
      .select();
    expect(error).not.toBeNull();
  });

  it("negative: a member cannot insert a client", async () => {
    const { error } = await member1.client
      .from("clients")
      .insert({
        brand_name: "Should not exist",
        contact_name: "x",
        contact_email: "x@x.example",
        package: "x",
        service_type: "social_media",
        created_by: member1.id,
      })
      .select();
    expect(error).not.toBeNull();
  });
});

describe("tasks", () => {
  it("positive: super_admin sees every fixture task", async () => {
    const { data, error } = await superAdmin.client
      .from("tasks")
      .select("id")
      .in("id", [taskOnboardingId, taskProdMember1Id, taskProdMember2Id, taskPostMember4Id]);
    expect(error).toBeNull();
    expect(data!.length).toBe(4);
  });

  it("positive: admin_onboarding sees the onboarding-stage task", async () => {
    const { data, error } = await onboarding.client.from("tasks").select("id").eq("id", taskOnboardingId);
    expect(error).toBeNull();
    expect(data!.length).toBe(1);
  });

  it("negative: admin_onboarding does not see a production-stage task", async () => {
    const { data, error } = await onboarding.client.from("tasks").select("id").eq("id", taskProdMember1Id);
    expect(error).toBeNull();
    expect(data!.length).toBe(0);
  });

  it("positive: a lead sees their own team's task", async () => {
    const { data, error } = await leadProduction.client.from("tasks").select("id").eq("id", taskProdMember1Id);
    expect(error).toBeNull();
    expect(data!.length).toBe(1);
  });

  it("negative: a lead does not see another team's task", async () => {
    const { data, error } = await leadProduction.client.from("tasks").select("id").eq("id", taskPostMember4Id);
    expect(error).toBeNull();
    expect(data!.length).toBe(0);
  });

  it("positive: a member sees their own assigned task", async () => {
    const { data, error } = await member1.client.from("tasks").select("id").eq("id", taskProdMember1Id);
    expect(error).toBeNull();
    expect(data!.length).toBe(1);
  });

  it("negative: a member does not see a teammate's task", async () => {
    const { data, error } = await member1.client.from("tasks").select("id").eq("id", taskProdMember2Id);
    expect(error).toBeNull();
    expect(data!.length).toBe(0);
  });

  it("negative: a member does not see another team's task", async () => {
    const { data, error } = await member1.client.from("tasks").select("id").eq("id", taskPostMember4Id);
    expect(error).toBeNull();
    expect(data!.length).toBe(0);
  });

  it("positive: a lead can insert a task assigned within their own team", async () => {
    const { data, error } = await leadProduction.client
      .from("tasks")
      .insert({
        client_id: testClientId,
        title: "P1.1 lead-inserted task (in-team)",
        service_type: "social_media",
        assigned_to: member2.id,
        assigned_by: leadProduction.id, // NOT NULL, no default - matches server/actions/tasks.ts
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    if (data) createdTaskIds.push(data.id);
  });

  it("negative: a lead cannot insert a task assigned outside their team", async () => {
    // assigned_by set even though this is expected to fail either way - isolates the assertion
    // to RLS's WITH CHECK specifically, not a NOT NULL violation on a field we didn't bother with.
    const { error } = await leadProduction.client
      .from("tasks")
      .insert({
        client_id: testClientId,
        title: "Should not exist",
        service_type: "social_media",
        assigned_to: member4.id, // Post Production - not leadProduction's team
        assigned_by: leadProduction.id,
      })
      .select();
    expect(error).not.toBeNull();
  });

  it("negative: a member cannot insert a task at all", async () => {
    const { error } = await member1.client
      .from("tasks")
      .insert({
        client_id: testClientId,
        title: "Should not exist",
        service_type: "social_media",
        assigned_to: member1.id,
        assigned_by: member1.id,
      })
      .select();
    expect(error).not.toBeNull();
  });
});

describe("task_files", () => {
  it("positive: a member sees a file on their own visible task", async () => {
    const { data, error } = await member1.client.from("task_files").select("id").eq("id", taskFileId);
    expect(error).toBeNull();
    expect(data!.length).toBe(1);
  });

  it("negative: a member does not see files on a task outside their visibility", async () => {
    // task_files_select's EXISTS(...) subquery against tasks is itself RLS-evaluated as the
    // querying role, so this is invisible for the same reason taskPostMember4Id itself is.
    const { data, error } = await member1.client
      .from("task_files")
      .select("id")
      .eq("task_id", taskPostMember4Id);
    expect(error).toBeNull();
    expect(data!.length).toBe(0);
  });

  it("positive: a member can insert a file on their own assigned task", async () => {
    const { error } = await member1.client.from("task_files").insert({
      task_id: taskProdMember1Id,
      drive_link: "https://drive.example.com/p11-member-upload",
      file_type: "document",
      uploaded_by: member1.id,
    });
    expect(error).toBeNull();
    // cascades with taskProdMember1Id's own deletion in afterAll - no separate cleanup needed.
  });

  it("negative: a member cannot insert a file on a task they don't own", async () => {
    const { error } = await member1.client.from("task_files").insert({
      task_id: taskPostMember4Id,
      drive_link: "https://drive.example.com/should-not-exist",
      file_type: "document",
      uploaded_by: member1.id,
    });
    expect(error).not.toBeNull();
  });
});

describe("notifications", () => {
  // RLS grants NO INSERT policy to any authenticated role on notifications, including
  // super_admin - delivery is meant to arrive via a service-role context (PLAN.md P4, not yet
  // built). That means there is currently no RLS-respecting way for this harness to create a
  // notification row to assert a positive "member sees their own existing notification" case
  // against - doing so would require the service-role key, which this suite is explicitly
  // forbidden from using. Recorded here as a real coverage gap, not silently worked around: once
  // P4.1 lands a SECURITY DEFINER trigger that writes notifications, add that positive case.
  it("negative: nobody can insert a notification, including super_admin", async () => {
    for (const u of [member1, leadProduction, onboarding, superAdmin]) {
      const { error } = await u.client.from("notifications").insert({
        user_id: member1.id,
        type: "task_assigned",
        payload: {},
      });
      expect(error).not.toBeNull();
    }
  });

  it("structural: a member only ever sees their own notifications (vacuously true - table has no rows via any RLS-respecting path yet, see gap above)", async () => {
    const { data, error } = await member1.client.from("notifications").select("id, user_id");
    expect(error).toBeNull();
    expect((data ?? []).every((row) => row.user_id === member1.id)).toBe(true);
  });
});

describe("audit_log", () => {
  it("negative: nobody can insert into audit_log directly, including super_admin", async () => {
    for (const u of [member1, leadProduction, superAdmin]) {
      const { error } = await u.client.from("audit_log").insert({
        entity: "tasks",
        entity_id: taskProdMember1Id,
        action: "create",
      });
      expect(error).not.toBeNull();
    }
  });

  it("positive: super_admin sees audit_log rows (trigger-written by this suite's own fixture setup)", async () => {
    const { data, error } = await superAdmin.client
      .from("audit_log")
      .select("id")
      .eq("entity", "tasks")
      .eq("entity_id", taskProdMember1Id);
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
  });

  it("negative: a member sees zero audit_log rows", async () => {
    const { data, error } = await member1.client.from("audit_log").select("id");
    expect(error).toBeNull();
    expect(data!.length).toBe(0);
  });

  it("negative: a lead sees zero audit_log rows", async () => {
    const { data, error } = await leadProduction.client.from("audit_log").select("id");
    expect(error).toBeNull();
    expect(data!.length).toBe(0);
  });

  it("negative: admin_onboarding sees zero audit_log rows", async () => {
    const { data, error } = await onboarding.client.from("audit_log").select("id");
    expect(error).toBeNull();
    expect(data!.length).toBe(0);
  });
});
