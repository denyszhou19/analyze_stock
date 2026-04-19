import fs from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const routeSource = await fs.readFile('src/app/api/stock/ai-analysis/route.ts', 'utf8');

test('AI prompt defines global scope by three trading combinations', () => {
  assert.match(routeSource, /页面级综合结论/);
  assert.match(routeSource, /中线主策略组合（周线→日线）/);
  assert.match(routeSource, /短线执行组合（日线→30分钟）/);
  assert.match(routeSource, /超短线 \/ T 组合（60分钟→15分钟）/);
  assert.match(routeSource, /主约束级别/);
  assert.match(routeSource, /触发级别/);
});
