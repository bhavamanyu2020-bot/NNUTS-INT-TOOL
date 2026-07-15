// Prisma's generated types are camelCase (via @map to snake_case DB columns), but
// supabase-js/PostgREST returns whatever the actual column names are (snake_case) - it has no
// knowledge of Prisma's mapping. These select strings use PostgREST's `alias:column` syntax so
// every read returns objects that actually match the camelCase Prisma types they're cast to.
// Keep in sync with prisma/schema.prisma's @map directives.

export const USERS_SELECT =
  "id, email, name, role, teamId:team_id, leadId:lead_id, createdAt:created_at, updatedAt:updated_at";

export const TEAMS_SELECT = "id, name, leadId:lead_id";

export const CLIENTS_SELECT =
  "id, brandName:brand_name, contactName:contact_name, contactEmail:contact_email, " +
  "contactPhone:contact_phone, package, serviceType:service_type, documentsLink:documents_link, " +
  "driveFolderLink:drive_folder_link, timeline, notes, createdBy:created_by, " +
  "createdAt:created_at, updatedAt:updated_at";

export const TASKS_SELECT =
  "id, clientId:client_id, title, description, assignedTo:assigned_to, assignedBy:assigned_by, " +
  "stage, status, serviceType:service_type, deadline, createdAt:created_at, updatedAt:updated_at";

export const TASK_FILES_SELECT =
  "id, taskId:task_id, driveLink:drive_link, fileType:file_type, uploadedBy:uploaded_by, createdAt:created_at";
