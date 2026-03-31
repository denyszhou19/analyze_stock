interface ProjectionViewport {
  width: number;
  height: number;
  padding?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
}

interface ProjectionPoint {
  sequence: number;
  point_id?: string;
  x: number;
  y: number;
}

interface ProjectionSegment {
  sequence: number;
  segment_id?: string;
  from_point: number;
  to_point: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface ProjectionPayload {
  viewport: ProjectionViewport;
  points: ProjectionPoint[];
  segments: ProjectionSegment[];
}

interface ProjectionExplainability {
  current_point_id?: string | null;
  next_segment_preview?: {
    from_point_id: string;
    to_point_id: string;
    label: string;
    status?: string;
  } | null;
}

export interface ProjectedSegmentOverlay {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
  startPointId: string;
  targetPointId: string;
  targetLabel: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function resolveAnchorPoint(
  payload: ProjectionPayload,
  explainability?: ProjectionExplainability | null
): ProjectionPoint | null {
  const next = explainability?.next_segment_preview;
  if (!next) {
    return null;
  }

  return (
    payload.points.find((point) => point.point_id === next.from_point_id) ??
    payload.points.find((point) => point.point_id === explainability?.current_point_id) ??
    null
  );
}

function resolveProjectionVector(payload: ProjectionPayload, anchorPoint: ProjectionPoint) {
  const prevSegment = payload.segments.find((segment) => segment.to_point === anchorPoint.sequence);
  if (prevSegment) {
    return {
      dx: prevSegment.x2 - prevSegment.x1,
      dy: prevSegment.y2 - prevSegment.y1,
    };
  }

  const nextSegment = payload.segments.find((segment) => segment.from_point === anchorPoint.sequence);
  if (nextSegment) {
    return {
      dx: nextSegment.x2 - nextSegment.x1,
      dy: nextSegment.y2 - nextSegment.y1,
    };
  }

  return { dx: 36, dy: 0 };
}

export function buildProjectedSegmentOverlay(
  payload?: ProjectionPayload | null,
  explainability?: ProjectionExplainability | null
): ProjectedSegmentOverlay | null {
  const next = explainability?.next_segment_preview;
  if (!payload || !next) {
    return null;
  }

  const projectedSegmentId = `${next.from_point_id}-${next.to_point_id}`;
  const hasProjectedSegment = payload.segments.some(
    (segment) => segment.segment_id === projectedSegmentId
  );
  if (hasProjectedSegment) {
    return null;
  }

  const anchorPoint = resolveAnchorPoint(payload, explainability);
  if (!anchorPoint) {
    return null;
  }

  const vector = resolveProjectionVector(payload, anchorPoint);
  const rawLength = Math.hypot(vector.dx, vector.dy);
  const length = rawLength > 0 ? Math.max(rawLength, 24) : 36;
  const normX = rawLength > 0 ? vector.dx / rawLength : 1;
  const normY = rawLength > 0 ? vector.dy / rawLength : 0;

  const padding = payload.viewport.padding ?? {};
  const minX = padding.left ?? 0;
  const maxX = payload.viewport.width - (padding.right ?? 0);
  const minY = padding.top ?? 0;
  const maxY = payload.viewport.height - (padding.bottom ?? 0);

  const x2 = clamp(anchorPoint.x + normX * length, minX, maxX);
  const y2 = clamp(anchorPoint.y + normY * length, minY, maxY);

  return {
    x1: anchorPoint.x,
    y1: anchorPoint.y,
    x2,
    y2,
    label: next.label,
    startPointId: next.from_point_id,
    targetPointId: next.to_point_id,
    targetLabel: next.to_point_id,
  };
}
