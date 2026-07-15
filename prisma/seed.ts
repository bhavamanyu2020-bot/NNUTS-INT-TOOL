import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { PrismaClient } from "../generated/prisma/client";
import { Role, ServiceType, TaskStage, TaskStatus, FileType } from "../generated/prisma/enums";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Not lib/supabase/admin.ts: that module imports "server-only", which throws unconditionally
// outside Next's own bundler (Next aliases it away for real server code; plain tsx has no such
// aliasing). This script is already a trusted, non-request-path context on its own.
const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const SEED_PASSWORD = "nnuts-dev-password";

const SEED_USERS = [
  { email: "super.admin@nnuts.local", name: "Sam SuperAdmin", role: Role.super_admin },
  { email: "onboarding@nnuts.local", name: "Priya Onboarding", role: Role.admin_onboarding },
  { email: "lead.production@nnuts.local", name: "Maya Lead", role: Role.lead },
  { email: "lead.postproduction@nnuts.local", name: "Noah Lead", role: Role.lead },
  { email: "member1@nnuts.local", name: "Ivy Member", role: Role.member },
  { email: "member2@nnuts.local", name: "Jonah Member", role: Role.member },
  { email: "member3@nnuts.local", name: "Kira Member", role: Role.member },
  { email: "member4@nnuts.local", name: "Leo Member", role: Role.member },
  { email: "member5@nnuts.local", name: "Mona Member", role: Role.member },
] as const;

async function main() {
  console.log("Seeding auth users...");
  const authIdByEmail = new Map<string, string>();

  for (const u of SEED_USERS) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: u.email,
      password: SEED_PASSWORD,
      email_confirm: true,
    });
    if (error || !data.user) {
      throw new Error(`Failed to create auth user ${u.email}: ${error?.message}`);
    }
    authIdByEmail.set(u.email, data.user.id);
  }
  const idFor = (email: string) => authIdByEmail.get(email)!;

  console.log("Seeding teams...");
  const production = await prisma.team.create({ data: { name: "Production" } });
  const postProduction = await prisma.team.create({ data: { name: "Post Production" } });

  console.log("Seeding users table...");
  await prisma.user.create({
    data: {
      id: idFor("super.admin@nnuts.local"),
      email: "super.admin@nnuts.local",
      name: "Sam SuperAdmin",
      role: Role.super_admin,
    },
  });
  await prisma.user.create({
    data: {
      id: idFor("onboarding@nnuts.local"),
      email: "onboarding@nnuts.local",
      name: "Priya Onboarding",
      role: Role.admin_onboarding,
    },
  });
  const mayaLead = await prisma.user.create({
    data: {
      id: idFor("lead.production@nnuts.local"),
      email: "lead.production@nnuts.local",
      name: "Maya Lead",
      role: Role.lead,
      teamId: production.id,
    },
  });
  const noahLead = await prisma.user.create({
    data: {
      id: idFor("lead.postproduction@nnuts.local"),
      email: "lead.postproduction@nnuts.local",
      name: "Noah Lead",
      role: Role.lead,
      teamId: postProduction.id,
    },
  });

  await prisma.team.update({ where: { id: production.id }, data: { leadId: mayaLead.id } });
  await prisma.team.update({
    where: { id: postProduction.id },
    data: { leadId: noahLead.id },
  });

  await prisma.user.create({
    data: {
      id: idFor("member1@nnuts.local"),
      email: "member1@nnuts.local",
      name: "Ivy Member",
      role: Role.member,
      teamId: production.id,
      leadId: mayaLead.id,
    },
  });
  const member2 = await prisma.user.create({
    data: {
      id: idFor("member2@nnuts.local"),
      email: "member2@nnuts.local",
      name: "Jonah Member",
      role: Role.member,
      teamId: production.id,
      leadId: mayaLead.id,
    },
  });
  await prisma.user.create({
    data: {
      id: idFor("member3@nnuts.local"),
      email: "member3@nnuts.local",
      name: "Kira Member",
      role: Role.member,
      teamId: production.id,
      leadId: mayaLead.id,
    },
  });
  const member4 = await prisma.user.create({
    data: {
      id: idFor("member4@nnuts.local"),
      email: "member4@nnuts.local",
      name: "Leo Member",
      role: Role.member,
      teamId: postProduction.id,
      leadId: noahLead.id,
    },
  });
  const member5 = await prisma.user.create({
    data: {
      id: idFor("member5@nnuts.local"),
      email: "member5@nnuts.local",
      name: "Mona Member",
      role: Role.member,
      teamId: postProduction.id,
      leadId: noahLead.id,
    },
  });

  console.log("Seeding clients...");
  const clientA = await prisma.client.create({
    data: {
      brandName: "Acme Cafe",
      contactName: "Jane Acme",
      contactEmail: "jane@acmecafe.example",
      package: "Growth",
      serviceType: ServiceType.social_media,
      createdBy: idFor("onboarding@nnuts.local"),
      timeline: "Q3 2026",
    },
  });
  const clientB = await prisma.client.create({
    data: {
      brandName: "Bolt Fitness",
      contactName: "Raj Bolt",
      contactEmail: "raj@boltfitness.example",
      package: "Performance",
      serviceType: ServiceType.google_ads,
      createdBy: idFor("onboarding@nnuts.local"),
      timeline: "Q3 2026",
    },
  });
  const clientC = await prisma.client.create({
    data: {
      brandName: "Coral Skincare",
      contactName: "Zoe Coral",
      contactEmail: "zoe@coralskincare.example",
      package: "Launch",
      serviceType: ServiceType.meta_ads,
      createdBy: idFor("onboarding@nnuts.local"),
      timeline: "Q4 2026",
    },
  });

  console.log("Seeding tasks...");

  // Fresh onboarding task - not yet assigned into a production team.
  await prisma.task.create({
    data: {
      clientId: clientA.id,
      title: "Kickoff shoot planning",
      assignedBy: idFor("onboarding@nnuts.local"),
      serviceType: ServiceType.social_media,
      stage: TaskStage.onboarding,
      status: TaskStatus.yet_to_start,
    },
  });

  // in_process task assigned to a member - use this to manually test an illegal status jump
  // (e.g. straight to completed) during the smoke test.
  await prisma.task.create({
    data: {
      clientId: clientB.id,
      title: "Google Ads creative batch 1",
      assignedTo: member4.id,
      assignedBy: mayaLead.id,
      serviceType: ServiceType.google_ads,
      stage: TaskStage.production,
      status: TaskStatus.in_process,
    },
  });

  // approval_sent task WITH a satisfying task_files row - demonstrates the file gate passing.
  const gatedTask = await prisma.task.create({
    data: {
      clientId: clientC.id,
      title: "Meta Ads launch reel",
      assignedTo: member5.id,
      assignedBy: noahLead.id,
      serviceType: ServiceType.meta_ads,
      stage: TaskStage.post_production,
      status: TaskStatus.approval_sent,
    },
  });
  await prisma.taskFile.create({
    data: {
      taskId: gatedTask.id,
      driveLink: "https://drive.example.com/coral-launch-reel",
      fileType: FileType.edited_video,
      uploadedBy: member5.id,
    },
  });

  // changes_required task.
  await prisma.task.create({
    data: {
      clientId: clientA.id,
      title: "Social media carousel v2",
      assignedTo: member2.id,
      assignedBy: mayaLead.id,
      serviceType: ServiceType.social_media,
      stage: TaskStage.production,
      status: TaskStatus.changes_required,
    },
  });

  console.log("Seed complete.");
  console.log(`All seed users share the password: ${SEED_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
