export class TaskFsmError extends Error {
  readonly from: string;
  readonly to: string;
  readonly dimension: "status" | "stage";

  constructor(from: string, to: string, dimension: "status" | "stage") {
    super(`Illegal task ${dimension} transition: ${from} -> ${to}`);
    this.name = "TaskFsmError";
    this.from = from;
    this.to = to;
    this.dimension = dimension;
  }
}
