export interface RequestRunGuard {
  currentRunId: number;
}

export function createRequestRunGuard(): RequestRunGuard {
  return {
    currentRunId: 0,
  };
}

export function beginRequestRun(guard: RequestRunGuard): number {
  guard.currentRunId += 1;
  return guard.currentRunId;
}

export function invalidateRequestRun(guard: RequestRunGuard): void {
  guard.currentRunId += 1;
}

export function isCurrentRequestRun(guard: RequestRunGuard, runId: number): boolean {
  return guard.currentRunId === runId;
}
