// PLAN.md P5.1 remainder: every new analytics view (supabase/sql/016_analytics_views.sql) must
// reconcile against the base tables it's derived from, and every role must see only its own RLS-
// scoped slice of each view - not assumed because security_invoker=true is set correctly, but
// proven by querying as a real authenticated role, same discipline as every other test in this
// suite (tests/helpers/auth.ts's signInAs, never service-role, never Prisma).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SEED_EMAILS, signInAs, signOutAll, type AuthedUser } from "../helpers/auth";

let superAdmin: AuthedUser;
let onboarding: AuthedUser;
let leadProduction: AuthedUser;
let member1: AuthedUser;

let testClientId: string;
const createdTaskIds: string[] = [];

beforeAll(async () => {
  [superAdmin, onboarding, leadProduction, member1] = await Promise.all([
    signInAs(SEED_EMAILS.superAdmin),
    signInAs(SEED_EMAILS.onboarding),
    signInAs(SEED_EMAILS.leadProduction),
    signInAs(SEED_EMAILS.member1),
  ]);

  const { data: client, error: clientErr } = await onboarding.client
    .from("clients")
    .insert({
      brand_name: "P5.1 reconcile fixture",
      contact_name: "x",
      contact_email: "p51@x.example",
      package: "x",
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
  await signOutAll(superAdmin, onboarding, leadProduction, member1);
});

describe("overdue_task_count reconciles to overdue_tasks and to tasks directly", () => {
  it("a fresh overdue task is reflected in both the count and the raw table", async () => {
    // Raw reproducing query (pasted per acceptance criteria):
    //   SELECT count(*) FROM tasks
    //   WHERE deadline IS NOT NULL AND deadline < now() AND status <> 'completed';
    const before = await superAdmin.client.from("overdue_task_count").select("count").single();

    const pastDeadline = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1h ago
    const { data: task, error } = await superAdmin.client
      .from("tasks")
      .insert({
        client_id: testClientId,
        title: "P5.1 overdue fixture",
        service_type: "social_media",
        status: "in_process",
        assigned_to: member1.id,
        assigned_by: onboarding.id,
        deadline: pastDeadline,
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    createdTaskIds.push(task!.id);

    const after = await superAdmin.client.from("overdue_task_count").select("count").single();
    expect(after.data!.count).toBe(before.data!.count + 1);

    // sum(detail rows) == top-line
    const detail = await superAdmin.client.from("overdue_tasks").select("task_id");
    expect(detail.data!.length).toBe(after.data!.count);
    expect(detail.data!.some((r) => r.task_id === task!.id)).toBe(true);

    // Raw reproducing query via supabase-js, not just the view - proves the view isn't inventing
    // rows the base table doesn't actually have.
    const raw = await superAdmin.client
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .not("deadline", "is", null)
      .lt("deadline", new Date().toISOString())
      .neq("status", "completed");
    expect(raw.count).toBe(after.data!.count);
  });

  it("as a member, overdue_tasks returns only their own overdue tasks", async () => {
    const { data, error } = await member1.client.from("overdue_tasks").select("task_id, assigned_to");
    expect(error).toBeNull();
    expect(data!.every((r) => r.assigned_to === member1.id)).toBe(true);
  });
});

describe("member_task_load reconciles to tasks directly", () => {
  it("sum(active_task_count) == count of all active assigned tasks", async () => {
    // Raw reproducing query:
    //   SELECT assigned_to, count(*) FROM tasks
    //   WHERE assigned_to IS NOT NULL AND status <> 'completed' GROUP BY assigned_to;
    const { data: loadRows, error } = await superAdmin.client
      .from("member_task_load")
      .select("user_id, active_task_count");
    expect(error).toBeNull();
    const sum = loadRows!.reduce((s, r) => s + r.active_task_count, 0);

    const raw = await superAdmin.client
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .not("assigned_to", "is", null)
      .neq("status", "completed");
    expect(sum).toBe(raw.count);
  });

  it("as a member, member_task_load returns only their own row", async () => {
    const { data, error } = await member1.client.from("member_task_load").select("user_id");
    expect(error).toBeNull();
    expect(data!.every((r) => r.user_id === member1.id)).toBe(true);
  });
});

describe("avg_time_in_stage reconciles to task_stage_durations (real transition, not trivial-empty)", () => {
  it("a real stage transition produces a matching detail row and aggregate", async () => {
    // Fresh task at 'onboarding', then a real transition to 'marketing' - generates genuine
    // audit_log history rather than relying on whatever pre-existing data happens to be live.
    // Transitioned by leadProduction, not onboarding: tasks_update_admin_onboarding's WITH CHECK
    // is `current_role_name() = 'admin_onboarding' AND stage = 'onboarding'`, evaluated against
    // the NEW row - so admin_onboarding can never legally move a task OUT of onboarding via any
    // UPDATE, the resulting row would have to still satisfy stage='onboarding'. Confirmed this
    // empirically (a 42501 RLS violation) before rerouting the test, rather than assuming a role
    // and moving on - real finding, reported separately, out of scope to fix here
    // (002_rls_policies.sql isn't in this task's authorized file list). tasks_update_lead isn't
    // stage-gated, so leadProduction can perform the transition; assigned_by=leadProduction gives
    // them update-visibility regardless of the task's current or new stage.
    const { data: task, error: insertErr } = await superAdmin.client
      .from("tasks")
      .insert({
        client_id: testClientId,
        title: "P5.1 stage duration fixture",
        service_type: "social_media",
        stage: "onboarding",
        assigned_to: member1.id,
        assigned_by: leadProduction.id,
      })
      .select("id")
      .single();
    expect(insertErr).toBeNull();
    createdTaskIds.push(task!.id);

    const beforeAvg = await superAdmin.client
      .from("avg_time_in_stage")
      .select("completed_segment_count")
      .eq("stage", "onboarding")
      .maybeSingle();
    const beforeCount = beforeAvg.data?.completed_segment_count ?? 0;

    const { error: updateErr } = await leadProduction.client
      .from("tasks")
      .update({ stage: "marketing" })
      .eq("id", task!.id)
      .select()
      .single();
    expect(updateErr).toBeNull();

    // Raw reproducing query (pasted per acceptance criteria):
    //   WITH stage_events AS (
    //     SELECT entity_id task_id, after->>'stage' stage, at entered_at FROM audit_log
    //       WHERE entity='tasks' AND action='create'
    //     UNION ALL
    //     SELECT entity_id, after->>'stage', at FROM audit_log
    //       WHERE entity='tasks' AND action='update'
    //         AND before->>'stage' IS DISTINCT FROM after->>'stage'
    //   )
    //   SELECT task_id, stage, entered_at,
    //          LEAD(entered_at) OVER (PARTITION BY task_id ORDER BY entered_at) left_at
    //   FROM stage_events;
    const detail = await superAdmin.client
      .from("task_stage_durations")
      .select("stage, entered_at, left_at")
      .eq("task_id", task!.id)
      .eq("stage", "onboarding")
      .single();
    expect(detail.error).toBeNull();
    expect(detail.data!.left_at).not.toBeNull(); // transitioned away - this segment is complete

    const afterAvg = await superAdmin.client
      .from("avg_time_in_stage")
      .select("completed_segment_count")
      .eq("stage", "onboarding")
      .single();
    expect(afterAvg.data!.completed_segment_count).toBe(beforeCount + 1);

    // sum(detail rows)/count == top-line avg, computed independently from the detail rows rather
    // than trusting the aggregate view's own arithmetic.
    const allOnboardingSegments = await superAdmin.client
      .from("task_stage_durations")
      .select("entered_at, left_at")
      .eq("stage", "onboarding")
      .not("left_at", "is", null);
    const totalMs = allOnboardingSegments.data!.reduce(
      (sum, r) => sum + (new Date(r.left_at!).getTime() - new Date(r.entered_at).getTime()),
      0,
    );
    const expectedAvgMs = totalMs / allOnboardingSegments.data!.length;

    const avgRow = await superAdmin.client
      .from("avg_time_in_stage")
      .select("avg_duration")
      .eq("stage", "onboarding")
      .single();
    // Postgres returns interval as "HH:MM:SS.mmm" (or "D days HH:MM:SS") text via PostgREST -
    // parseIntervalMs below converts it back to milliseconds for a numeric comparison.
    const viewAvgMs = parseIntervalMs(avgRow.data!.avg_duration as string);
    expect(Math.abs(viewAvgMs - expectedAvgMs)).toBeLessThan(1000); // within 1s - clock/rounding slack
  });

  it("as a member, task_stage_durations and avg_time_in_stage return zero rows (audit_log is super_admin-only RLS, unchanged by this task)", async () => {
    const detail = await member1.client.from("task_stage_durations").select("task_id");
    expect(detail.error).toBeNull();
    expect(detail.data!.length).toBe(0);

    const agg = await member1.client.from("avg_time_in_stage").select("stage");
    expect(agg.error).toBeNull();
    expect(agg.data!.length).toBe(0);
  });
});

describe("client_pipeline_health reconciles to clients + tasks directly", () => {
  it("sum(total_tasks) == count(*) FROM tasks", async () => {
    // Raw reproducing query:
    //   SELECT c.id, c.brand_name, count(t.id), ... FROM clients c
    //   LEFT JOIN tasks t ON t.client_id = c.id GROUP BY c.id, c.brand_name;
    const { data: healthRows, error } = await superAdmin.client
      .from("client_pipeline_health")
      .select("client_id, total_tasks");
    expect(error).toBeNull();
    const sum = healthRows!.reduce((s, r) => s + r.total_tasks, 0);

    const raw = await superAdmin.client.from("tasks").select("id", { count: "exact", head: true });
    expect(sum).toBe(raw.count);
  });

  it("as a member, client_pipeline_health returns zero rows (clients RLS is super_admin/admin_onboarding-only, unchanged by this task)", async () => {
    const { data, error } = await member1.client.from("client_pipeline_health").select("client_id");
    expect(error).toBeNull();
    expect(data!.length).toBe(0);
  });
});

// Postgres/PostgREST returns `interval` columns as text like "01:02:03.456" or "1 day 02:03:04" -
// this parses the subset of formats avg_time_in_stage can actually produce (durations on the
// order of seconds to a few days in this test) back into milliseconds for numeric comparison.
function parseIntervalMs(text: string): number {
  const dayMatch = text.match(/(-?\d+) days?/);
  const days = dayMatch ? parseInt(dayMatch[1], 10) : 0;
  const timeMatch = text.match(/(\d+):(\d+):(\d+(?:\.\d+)?)/);
  const [h, m, s] = timeMatch ? [Number(timeMatch[1]), Number(timeMatch[2]), Number(timeMatch[3])] : [0, 0, 0];
  return days * 86_400_000 + h * 3_600_000 + m * 60_000 + s * 1000;
}
