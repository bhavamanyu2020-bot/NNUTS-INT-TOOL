import { create } from "zustand";
import type { TaskStage, TaskStatus } from "@/generated/prisma/client";

interface TaskFiltersState {
  stage: TaskStage | null;
  status: TaskStatus | null;
  setStage: (stage: TaskStage | null) => void;
  setStatus: (status: TaskStatus | null) => void;
  reset: () => void;
}

export const useTaskFiltersStore = create<TaskFiltersState>((set) => ({
  stage: null,
  status: null,
  setStage: (stage) => set({ stage }),
  setStatus: (status) => set({ status }),
  reset: () => set({ stage: null, status: null }),
}));
