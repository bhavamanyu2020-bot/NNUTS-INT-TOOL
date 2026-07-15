"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { assignTask, changeTaskStatus, changeTaskStage } from "@/server/actions/tasks";
import { createTaskFile } from "@/server/actions/taskFiles";
import { STATUS_TRANSITIONS } from "@/lib/fsm/taskStatus";
import { STAGE_TRANSITIONS } from "@/lib/fsm/taskStage";
import { FileType } from "@/generated/prisma/enums";
import type { Task, TaskFile, User } from "@/generated/prisma/client";

export function TaskDetailActions({
  task,
  users,
  taskFiles,
}: {
  task: Task;
  users: User[];
  taskFiles: TaskFile[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const nextStatuses = STATUS_TRANSITIONS[task.status];
  const nextStages = STAGE_TRANSITIONS[task.stage];

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setPending(true);
    setError(null);
    const result = await fn();
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? "Something went wrong");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Assign</h2>
        <Select
          disabled={pending}
          defaultValue={task.assignedTo ?? ""}
          onChange={(e) =>
            run(() => assignTask({ taskId: task.id, assignedTo: e.target.value || null }))
          }
        >
          <option value="">Unassigned</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Status: {task.status.replace(/_/g, " ")}</h2>
        <div className="flex gap-2">
          {nextStatuses.length === 0 && (
            <p className="text-sm text-neutral-500">Terminal status - no further transitions.</p>
          )}
          {nextStatuses.map((status) => (
            <Button
              key={status}
              variant="secondary"
              disabled={pending}
              onClick={() => run(() => changeTaskStatus({ taskId: task.id, status }))}
            >
              Move to {status.replace(/_/g, " ")}
            </Button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Stage: {task.stage.replace(/_/g, " ")}</h2>
        <div className="flex gap-2">
          {nextStages.length === 0 && (
            <p className="text-sm text-neutral-500">Terminal stage - no further transitions.</p>
          )}
          {nextStages.map((stage) => (
            <Button
              key={stage}
              variant="secondary"
              disabled={pending}
              onClick={() => run(() => changeTaskStage({ taskId: task.id, stage }))}
            >
              Move to {stage.replace(/_/g, " ")}
            </Button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Files</h2>
        <ul className="flex flex-col gap-1">
          {taskFiles.map((f) => (
            <li key={f.id} className="text-sm">
              <a
                href={f.driveLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                {f.fileType.replace(/_/g, " ")}
              </a>
            </li>
          ))}
          {taskFiles.length === 0 && (
            <li className="text-sm text-neutral-500">No files uploaded yet.</li>
          )}
        </ul>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const driveLink = formData.get("driveLink") as string;
            const fileType = formData.get("fileType") as string;
            run(() => createTaskFile({ taskId: task.id, driveLink, fileType })).then(() => {
              (e.target as HTMLFormElement).reset();
            });
          }}
          className="flex gap-2"
        >
          <Input name="driveLink" type="url" placeholder="Drive link" required />
          <Select name="fileType" required defaultValue="">
            <option value="" disabled>
              File type
            </option>
            {Object.values(FileType).map((value) => (
              <option key={value} value={value}>
                {value.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
          <Button type="submit" disabled={pending}>
            Add file
          </Button>
        </form>
      </section>
    </div>
  );
}
