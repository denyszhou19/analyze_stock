'use client';

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
  className?: string;
}

export function StructureTopologySvg({
  payload,
  className = 'w-full h-40',
}: StructureTopologySvgProps) {
  if (!payload || payload.point_count === 0) {
    return null;
  }

  const { viewport, points, segments } = payload;
  const viewBox = `0 0 ${viewport.width} ${viewport.height}`;

  return (
    <svg viewBox={viewBox} className={className} preserveAspectRatio="xMidYMid meet">
      {segments.map((segment) => (
        <line
          key={segment.sequence}
          x1={segment.x1}
          y1={segment.y1}
          x2={segment.x2}
          y2={segment.y2}
          stroke={segment.stroke}
          strokeWidth={segment.stroke_width}
          strokeDasharray={segment.stroke_dasharray ?? undefined}
        />
      ))}

      {points.map((point) => (
        <g key={point.sequence}>
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
