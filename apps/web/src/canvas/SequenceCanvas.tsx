import type { DiagramModel } from "../types";

interface Props {
  model: DiagramModel;
}

const HEAD_HEIGHT = 40;

/**
 * Sequence diagrams don't fit a node-graph layout, so we render them directly
 * as SVG: lifelines across the top with vertical lifelines, and ordered
 * horizontal messages using the coordinates computed by the diagram engine.
 */
export function SequenceCanvas({ model }: Props) {
  const width = Math.max(model.width, 320);
  const height = Math.max(model.height, 240);

  const centerX = (id: string): number => {
    const node = model.nodes.find((n) => n.id === id);
    return node ? node.x + node.width / 2 : 0;
  };

  return (
    <div className="h-full w-full overflow-auto p-4">
      <svg width={width} height={height} className="min-h-full">
        <defs>
          <marker
            id="seq-arrow"
            markerWidth="10"
            markerHeight="10"
            refX="8"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L8,3 L0,6 Z" fill="#38bdf8" />
          </marker>
        </defs>

        {/* Lifelines */}
        {model.nodes.map((n) => {
          const cx = n.x + n.width / 2;
          return (
            <g key={n.id}>
              <line
                x1={cx}
                y1={HEAD_HEIGHT}
                x2={cx}
                y2={height - 12}
                stroke="#2b3245"
                strokeDasharray="4 4"
              />
              <rect
                x={n.x}
                y={4}
                width={n.width}
                height={HEAD_HEIGHT - 8}
                rx={6}
                className="fill-surface-raised"
                stroke="#242938"
              />
              <text
                x={cx}
                y={HEAD_HEIGHT / 2 + 2}
                textAnchor="middle"
                className="fill-slate-100"
                style={{ fontSize: 12, fontWeight: 600 }}
              >
                {truncate(n.label, Math.floor(n.width / 8))}
              </text>
            </g>
          );
        })}

        {/* Messages */}
        {model.edges.map((e) => {
          const y = e.points?.[0]?.y ?? 0;
          const x1 = e.points?.[0]?.x ?? centerX(e.source);
          const x2 = e.points?.[1]?.x ?? centerX(e.target);
          const selfCall = Math.abs(x1 - x2) < 1;
          const midX = (x1 + x2) / 2;
          return (
            <g key={e.id}>
              {selfCall ? (
                <path
                  d={`M ${x1} ${y} h 40 v 18 h -40`}
                  fill="none"
                  stroke="#38bdf8"
                  markerEnd="url(#seq-arrow)"
                />
              ) : (
                <line
                  x1={x1}
                  y1={y}
                  x2={x2}
                  y2={y}
                  stroke="#38bdf8"
                  markerEnd="url(#seq-arrow)"
                />
              )}
              <text
                x={selfCall ? x1 + 44 : midX}
                y={y - 6}
                textAnchor={selfCall ? "start" : "middle"}
                className="fill-slate-300"
                style={{ fontSize: 11 }}
              >
                {(e.order ?? 0) + 1}. {e.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function truncate(text: string, max: number): string {
  if (max <= 1) return text;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
