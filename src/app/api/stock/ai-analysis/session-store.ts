export interface AiAnalysisSessionBinding {
  sessionId: string;
  code: string;
  snapshotKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface BindAiAnalysisSessionSnapshotInput {
  code: string;
  snapshotKey: string;
}

declare global {
  var __aiAnalysisSessionBindings: Map<string, AiAnalysisSessionBinding> | undefined;
}

function getSessionBindingStore(): Map<string, AiAnalysisSessionBinding> {
  if (!globalThis.__aiAnalysisSessionBindings) {
    globalThis.__aiAnalysisSessionBindings = new Map<string, AiAnalysisSessionBinding>();
  }

  return globalThis.__aiAnalysisSessionBindings;
}

export function bindAiAnalysisSessionSnapshot(
  sessionId: string,
  bindingInput: BindAiAnalysisSessionSnapshotInput
): void {
  const now = new Date().toISOString();
  const existing = getSessionBindingStore().get(sessionId);

  getSessionBindingStore().set(sessionId, {
    sessionId,
    code: bindingInput.code,
    snapshotKey: bindingInput.snapshotKey,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  });
}

export function getAiAnalysisSessionBinding(
  sessionId: string
): AiAnalysisSessionBinding | undefined {
  return getSessionBindingStore().get(sessionId);
}

export function getAiAnalysisSnapshotForSession(sessionId: string): string | undefined {
  return getSessionBindingStore().get(sessionId)?.snapshotKey;
}

export function clearAiAnalysisSessionSnapshots(): void {
  getSessionBindingStore().clear();
}
