export type AnalysisLoadingStage =
  | 'checking'
  | 'syncing'
  | 'requesting-analysis'
  | 'finalizing';

export interface AnalysisLoadingStageMeta {
  progress: number;
  title: string;
  detail: string;
}

const STAGE_META: Record<AnalysisLoadingStage, AnalysisLoadingStageMeta> = {
  checking: {
    progress: 15,
    title: '正在检查数据完整性...',
    detail: '正在核对周线、日线与分钟级别数据完整性是否达标。',
  },
  syncing: {
    progress: 38,
    title: '正在同步缺失数据，请稍候...',
    detail: '正在从远程数据源补齐分析所需的历史 K 线。',
  },
  'requesting-analysis': {
    progress: 72,
    title: '正在执行三位一体技术分析...',
    detail: 'Python 分析引擎正在计算周线、日线、60分钟、30分钟、15分钟结构。',
  },
  finalizing: {
    progress: 92,
    title: '正在整理分析结果...',
    detail: '正在汇总分析结果并生成页面展示数据。',
  },
};

export function getAnalysisLoadingStageMeta(stage: AnalysisLoadingStage): AnalysisLoadingStageMeta {
  return STAGE_META[stage];
}
