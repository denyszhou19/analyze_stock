'use client';

import { buildProjectedSegmentOverlay } from '@/lib/structure-topology-projection';

export interface StructureRenderViewport {
  width: number;
  height: number;
  padding: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  draw_width: number;
  draw_height: number;
  date_label_y: number;
  label_box: {
    width: number;
    height: number;
    radius: number;
  };
}

export interface StructureRenderPoint {
  point_id?: string;
  sequence: number;
  type: string;
  role: string;
  price: number;
  price_label: string;
  date: string;
  date_label: string;
  x: number;
  y: number;
  label_x: number;
  label_y: number;
  label_side: string;
  label_box_width: number;
  label_box_height: number;
  marker_radius: number;
  marker_fill: string;
  marker_stroke: string;
  marker_stroke_width: number;
  show_date_label: boolean;
  date_label_y: number;
  is_current: boolean;
}

export interface StructureRenderSegment {
  segment_id?: string;
  sequence: number;
  from_point: number;
  to_point: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  direction: string;
  length: number;
  is_current: boolean;
  stroke: string;
  stroke_width: number;
  stroke_dasharray: string | null;
}

export interface StructureExplainabilityData {
  structure_family: 'A' | 'B' | 'C' | 'D' | 'complex' | 'unfinished';
  structure_start_point_id: string | null;
  current_point_id: string | null;
  current_segment: {
    from_point_id: string;
    to_point_id: string;
    label: string;
  } | null;
  next_segment_preview: {
    from_point_id: string;
    to_point_id: string;
    label: string;
    status: 'projected' | 'completion' | 'direction_choice';
  } | null;
  point_labels: Array<{
    point_id: string;
    label: string;
    role: 'start' | 'current' | 'normal' | 'projected';
  }>;
  segment_labels: Array<{
    segment_id: string;
    from_point_id: string;
    to_point_id: string;
    label: string;
    role: 'current' | 'projected' | 'normal';
  }>;
  display_reason: string;
}

export interface StructureRenderPayload {
  version: number;
  viewport: StructureRenderViewport;
  price_range: {
    min: number;
    max: number;
    range: number;
  } | null;
  points: StructureRenderPoint[];
  segments: StructureRenderSegment[];
  point_count: number;
  segment_count: number;
}

interface StructureTopologySvgProps {
  payload?: StructureRenderPayload;
  explainability?: StructureExplainabilityData | null;
  className?: string;
}

type PointAnchorRole = 'start' | 'current' | null;

function resolvePointAnchorRole(
  pointId: string | undefined,
  explainability?: StructureExplainabilityData | null,
  pointRole?: StructureExplainabilityData['point_labels'][number]['role']
): PointAnchorRole {
  if (!pointId) {
    return null;
  }
  if (pointId === explainability?.current_point_id || pointRole === 'current') {
    return 'current';
  }
  if (pointId === explainability?.structure_start_point_id || pointRole === 'start') {
    return 'start';
  }
  return null;
}

function getAnchorVisuals(role: Exclude<PointAnchorRole, null>) {
  if (role === 'start') {
    return {
      label: '起点',
      stroke: '#f59e0b',
      fill: 'rgba(245, 158, 11, 0.18)',
      textFill: '#fef3c7',
      badgeFill: 'rgba(120, 53, 15, 0.9)',
      badgeStroke: '#f59e0b',
    };
  }

  return {
    label: '当前',
    stroke: '#38bdf8',
    fill: 'rgba(56, 189, 248, 0.18)',
    textFill: '#e0f2fe',
    badgeFill: 'rgba(8, 47, 73, 0.92)',
    badgeStroke: '#38bdf8',
  };
}

export function StructureTopologySvg({
  payload,
  explainability = null,
  className = 'w-full h-40',
}: StructureTopologySvgProps) {
  if (!payload || payload.point_count === 0) {
    return null;
  }

  const { viewport, points, segments } = payload;
  const viewBox = `0 0 ${viewport.width} ${viewport.height}`;
  const pointLabelMap = new Map(
    (explainability?.point_labels ?? []).map((item) => [item.point_id, item])
  );
  const currentSegmentId = explainability?.current_segment
    ? `${explainability.current_segment.from_point_id}-${explainability.current_segment.to_point_id}`
    : null;
  const projectedSegmentId = explainability?.next_segment_preview
    ? `${explainability.next_segment_preview.from_point_id}-${explainability.next_segment_preview.to_point_id}`
    : null;
  const projectedOverlay = buildProjectedSegmentOverlay(payload, explainability);

  return (
    <svg viewBox={viewBox} className={className} preserveAspectRatio="xMidYMid meet">
      {segments.map((segment) => {
        const isCurrentSegment = Boolean(
          currentSegmentId && segment.segment_id && segment.segment_id === currentSegmentId
        );
        const isProjectedSegment = Boolean(
          projectedSegmentId && segment.segment_id && segment.segment_id === projectedSegmentId
        );

        return (
          <line
            key={segment.sequence}
            x1={segment.x1}
            y1={segment.y1}
            x2={segment.x2}
            y2={segment.y2}
            stroke={isProjectedSegment ? '#94a3b8' : segment.stroke}
            strokeWidth={isCurrentSegment ? Math.max(segment.stroke_width, 3.5) : segment.stroke_width}
            strokeDasharray={isProjectedSegment ? '6,4' : segment.stroke_dasharray ?? undefined}
          />
        );
      })}

      {projectedOverlay ? (
        <g>
          <line
            x1={projectedOverlay.x1}
            y1={projectedOverlay.y1}
            x2={projectedOverlay.x2}
            y2={projectedOverlay.y2}
            stroke="#94a3b8"
            strokeWidth={2.5}
            strokeDasharray="6,4"
          />
          <circle cx={projectedOverlay.x2} cy={projectedOverlay.y2} r={2.5} fill="#94a3b8" />
          <text
            x={projectedOverlay.x2}
            y={projectedOverlay.y2 - 8}
            textAnchor="middle"
            fill="#cbd5e1"
            fontSize="9"
            fontWeight="700"
          >
            {projectedOverlay.targetLabel}
          </text>
        </g>
      ) : null}

      {points.map((point) => (
        <g key={point.sequence}>
          {(() => {
            const pointLabel = point.point_id ? pointLabelMap.get(point.point_id) : undefined;
            const anchorRole = resolvePointAnchorRole(point.point_id, explainability, pointLabel?.role);
            const anchorVisuals = anchorRole ? getAnchorVisuals(anchorRole) : null;
            const badgeWidth = anchorVisuals ? (anchorRole === 'current' ? 34 : 30) : 0;
            const badgeHeight = 16;
            const badgeY = Math.max(8, point.y - 34);

            return (
              <>
                {anchorVisuals ? (
                  <g data-point-role={anchorRole}>
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={point.marker_radius + 5}
                      fill={anchorVisuals.fill}
                      stroke={anchorVisuals.stroke}
                      strokeWidth={1.5}
                    />
                    <rect
                      x={point.x - badgeWidth / 2}
                      y={badgeY}
                      width={badgeWidth}
                      height={badgeHeight}
                      rx={badgeHeight / 2}
                      fill={anchorVisuals.badgeFill}
                      stroke={anchorVisuals.badgeStroke}
                      strokeWidth={1}
                    />
                    <text
                      x={point.x}
                      y={badgeY + 11}
                      textAnchor="middle"
                      fill={anchorVisuals.textFill}
                      fontSize="8"
                      fontWeight="700"
                    >
                      {anchorVisuals.label}
                    </text>
                  </g>
                ) : null}
                {point.point_id && pointLabel?.label ? (
                  <text
                    x={point.x}
                    y={point.y - 12}
                    textAnchor="middle"
                    fill={anchorRole === 'current' ? '#f8fafc' : '#cbd5e1'}
                    fontSize="9"
                    fontWeight="700"
                  >
                    {pointLabel.label}
                  </text>
                ) : null}
              </>
            );
          })()}
          <rect
            x={point.label_x - point.label_box_width / 2}
            y={point.label_y - 8}
            width={point.label_box_width}
            height={point.label_box_height}
            rx={viewport.label_box.radius}
            fill="rgba(0,0,0,0.7)"
          />
          <text
            x={point.label_x}
            y={point.label_y + 2}
            textAnchor="middle"
            fill="white"
            fontSize="9"
            fontWeight="500"
          >
            {point.price_label}
          </text>
          <circle
            cx={point.x}
            cy={point.y}
            r={point.marker_radius}
            fill={point.marker_fill}
            stroke={point.marker_stroke}
            strokeWidth={point.marker_stroke_width}
          />
          {point.show_date_label && (
            <text
              x={point.x}
              y={point.date_label_y}
              textAnchor="middle"
              fill="#94a3b8"
              fontSize="8"
            >
              {point.date_label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
