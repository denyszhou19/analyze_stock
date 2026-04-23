declare global {
  var __aiAnalysisSessionSnapshots: Map<string, string> | undefined;
}

function getSessionSnapshotStore(): Map<string, string> {
  if (!globalThis.__aiAnalysisSessionSnapshots) {
    globalThis.__aiAnalysisSessionSnapshots = new Map<string, string>();
  }

  return globalThis.__aiAnalysisSessionSnapshots;
}

export function bindAiAnalysisSessionSnapshot(
  sessionId: string,
  snapshotKey: string
): void {
  getSessionSnapshotStore().set(sessionId, snapshotKey);
}

export function getAiAnalysisSnapshotForSession(
  sessionId: string
): string | undefined {
  return getSessionSnapshotStore().get(sessionId);
}

export function clearAiAnalysisSessionSnapshots(): void {
  getSessionSnapshotStore().clear();
}
