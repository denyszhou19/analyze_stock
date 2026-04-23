import test from 'node:test';
import assert from 'node:assert/strict';

import {
  beginRequestRun,
  createRequestRunGuard,
  invalidateRequestRun,
  isCurrentRequestRun,
} from '../src/lib/request-run-guard.ts';

test('request run guard marks an old run stale after invalidate', () => {
  const guard = createRequestRunGuard();

  const firstRunId = beginRequestRun(guard);
  assert.equal(isCurrentRequestRun(guard, firstRunId), true);

  invalidateRequestRun(guard);

  assert.equal(isCurrentRequestRun(guard, firstRunId), false);
});

test('request run guard keeps only the latest run current across begin and invalidate sequence', () => {
  const guard = createRequestRunGuard();

  const firstRunId = beginRequestRun(guard);
  invalidateRequestRun(guard);
  const secondRunId = beginRequestRun(guard);

  assert.equal(isCurrentRequestRun(guard, firstRunId), false);
  assert.equal(isCurrentRequestRun(guard, secondRunId), true);
});
