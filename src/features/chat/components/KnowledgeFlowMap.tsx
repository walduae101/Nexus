import { useMemo, useState } from 'react';

export type KnowledgeNode = {
  id: string;
  label: string;
  type?: 'objective' | 'decision' | 'milestone' | 'blocker';
  detail?: string;
};

export type KnowledgeEdge = {
  from: string;
  to: string;
};

export type KnowledgeGraph = {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
};

/**
 * Deterministic vertical tree layout. BFS from root nodes (no incoming edges)
 * to assign each node a layer; within each layer, nodes are arranged left-to-right
 * centered against the widest layer. Orphan nodes (unreachable from any root)
 * fall back onto layer 0. Produces stable coordinates for any acyclic DAG up to
 * ~12 nodes; denser graphs remain readable because layers respect edge direction.
 */
function computeLayout(
  nodes: KnowledgeNode[],
  edges: KnowledgeEdge[],
  opts: { nodeW: number; nodeH: number; gapX: number; gapY: number; padding: number }
) {
  const { nodeW, nodeH, gapX, gapY, padding } = opts;

  const incoming = new Map<string, number>();
  nodes.forEach(n => incoming.set(n.id, 0));
  edges.forEach(e => incoming.set(e.to, (incoming.get(e.to) ?? 0) + 1));

  // Roots = nodes with no incoming edges. If cyclic and no roots, seed from first node.
  const roots = nodes.filter(n => incoming.get(n.id) === 0).map(n => n.id);
  if (roots.length === 0 && nodes.length > 0) roots.push(nodes[0].id);

  const layerOf = new Map<string, number>();
  const queue: { id: string; depth: number }[] = roots.map(id => ({ id, depth: 0 }));
  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    const prior = layerOf.get(id);
    if (prior !== undefined && prior >= depth) continue;
    layerOf.set(id, depth);
    edges.filter(e => e.from === id).forEach(e => queue.push({ id: e.to, depth: depth + 1 }));
  }
  // Any node not reached gets layer 0.
  nodes.forEach(n => {
    if (!layerOf.has(n.id)) layerOf.set(n.id, 0);
  });

  // Group ids by layer, preserving input order within each layer.
  const byLayer = new Map<number, string[]>();
  nodes.forEach(n => {
    const l = layerOf.get(n.id) ?? 0;
    if (!byLayer.has(l)) byLayer.set(l, []);
    byLayer.get(l)!.push(n.id);
  });

  const sortedLayers = Array.from(byLayer.keys()).sort((a, b) => a - b);
  const maxNodesInAnyLayer = Math.max(...Array.from(byLayer.values()).map(v => v.length));
  const totalWidth = padding * 2 + maxNodesInAnyLayer * nodeW + (maxNodesInAnyLayer - 1) * gapX;

  const positions = new Map<string, { x: number; y: number }>();
  sortedLayers.forEach((layer, layerIdx) => {
    const idsInLayer = byLayer.get(layer)!;
    const rowWidth = idsInLayer.length * nodeW + (idsInLayer.length - 1) * gapX;
    const startX = (totalWidth - rowWidth) / 2;
    idsInLayer.forEach((id, i) => {
      positions.set(id, {
        x: startX + i * (nodeW + gapX),
        y: padding + layerIdx * (nodeH + gapY)
      });
    });
  });

  const totalHeight = padding * 2 + sortedLayers.length * nodeH + (sortedLayers.length - 1) * gapY;

  return { positions, width: totalWidth, height: totalHeight };
}

/**
 * KnowledgeFlowMap — native SVG renderer for the Phase-16 session knowledge graph.
 * Zero external graph-rendering dependencies (no React Flow, no D3). Uses only
 * <svg>, <rect>, <path>, and <text> primitives styled with Tailwind stroke/fill
 * utility classes. Interactive hover state surfaces a native tooltip block
 * beneath the diagram with the hovered node's full detail.
 */
export function KnowledgeFlowMap({
  graph,
  isArabic
}: {
  graph: KnowledgeGraph | null;
  isArabic?: boolean;
}) {
  const [hoverId, setHoverId] = useState<string | null>(null);

  const NODE_W = 132;
  const NODE_H = 38;
  const GAP_X = 22;
  const GAP_Y = 54;
  const PADDING = 18;

  const layout = useMemo(() => {
    if (!graph || !Array.isArray(graph.nodes) || graph.nodes.length === 0) return null;
    return computeLayout(graph.nodes, Array.isArray(graph.edges) ? graph.edges : [], {
      nodeW: NODE_W, nodeH: NODE_H, gapX: GAP_X, gapY: GAP_Y, padding: PADDING
    });
  }, [graph]);

  if (!graph || !layout) {
    return (
      <div className="text-zinc-500 italic text-center py-10 text-sm px-4">
        {isArabic
          ? 'لم يتم توليد مخطط المعرفة بعد. سيظهر بعد حفظ الملخص التنفيذي.'
          : 'No knowledge graph yet. One will appear once the executive summary is generated.'}
      </div>
    );
  }

  const hoveredNode = hoverId ? graph.nodes.find(n => n.id === hoverId) : null;

  const fillClassFor = (type?: string) => {
    switch (type) {
      case 'blocker': return 'fill-red-500/15';
      case 'decision': return 'fill-amber-500/15';
      case 'objective': return 'fill-primary/20';
      default: return 'fill-zinc-700/25';
    }
  };
  const strokeClassFor = (type?: string) => {
    switch (type) {
      case 'blocker': return 'stroke-red-500/70';
      case 'decision': return 'stroke-amber-500/70';
      case 'objective': return 'stroke-primary/80';
      default: return 'stroke-zinc-500/60';
    }
  };

  return (
    <div className="px-3 pb-4">
      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        role="img"
        aria-label={isArabic ? 'مخطط تدفق المعرفة للجلسة' : 'Knowledge flow diagram for this session'}
        className="w-full h-auto"
      >
        {/* Edges — cubic bezier from parent bottom-center to child top-center */}
        {graph.edges.map((edge, i) => {
          const from = layout.positions.get(edge.from);
          const to = layout.positions.get(edge.to);
          if (!from || !to) return null;
          const sx = from.x + NODE_W / 2;
          const sy = from.y + NODE_H;
          const ex = to.x + NODE_W / 2;
          const ey = to.y;
          const midY = (sy + ey) / 2;
          const dimmed = hoverId !== null && hoverId !== edge.from && hoverId !== edge.to;
          return (
            <path
              key={`e-${i}`}
              d={`M ${sx} ${sy} C ${sx} ${midY}, ${ex} ${midY}, ${ex} ${ey}`}
              className={`fill-none transition-opacity ${dimmed ? 'stroke-zinc-700/30 opacity-40' : 'stroke-primary/40'}`}
              strokeWidth={1.5}
            />
          );
        })}

        {/* Nodes */}
        {graph.nodes.map(node => {
          const pos = layout.positions.get(node.id);
          if (!pos) return null;
          const isHover = hoverId === node.id;
          const dimmed = hoverId !== null && hoverId !== node.id;
          return (
            <g
              key={node.id}
              onMouseEnter={() => setHoverId(node.id)}
              onMouseLeave={() => setHoverId(prev => (prev === node.id ? null : prev))}
              className="cursor-pointer"
            >
              <rect
                x={pos.x}
                y={pos.y}
                width={NODE_W}
                height={NODE_H}
                rx={8}
                className={`${fillClassFor(node.type)} ${strokeClassFor(node.type)} transition-all ${dimmed ? 'opacity-40' : 'opacity-100'}`}
                strokeWidth={isHover ? 2.5 : 1.5}
              />
              <text
                x={pos.x + NODE_W / 2}
                y={pos.y + NODE_H / 2}
                dy="0.35em"
                textAnchor="middle"
                className="fill-zinc-100 pointer-events-none select-none"
                fontSize={11}
                fontWeight={500}
              >
                {node.label.length > 18 ? `${node.label.slice(0, 17)}…` : node.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Hover detail tooltip — rendered as a native block below the SVG so it
          works across touch devices without flicker/positioning math. */}
      {hoveredNode && (
        <div
          role="tooltip"
          className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/80 p-3 text-xs"
          dir={isArabic ? 'rtl' : 'ltr'}
        >
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                hoveredNode.type === 'blocker' ? 'bg-red-500' :
                hoveredNode.type === 'decision' ? 'bg-amber-500' :
                hoveredNode.type === 'objective' ? 'bg-primary' : 'bg-zinc-500'
              }`}
              aria-hidden="true"
            />
            <span className="font-semibold text-zinc-100 text-[13px]">{hoveredNode.label}</span>
            {hoveredNode.type && (
              <span className="text-[9px] uppercase tracking-wider text-zinc-500">{hoveredNode.type}</span>
            )}
          </div>
          {hoveredNode.detail && (
            <div className="text-zinc-400 leading-relaxed">{hoveredNode.detail}</div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1.5 text-[10px] uppercase tracking-wider text-zinc-500" dir={isArabic ? 'rtl' : 'ltr'}>
        <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary" aria-hidden="true" />{isArabic ? 'هدف' : 'Objective'}</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" aria-hidden="true" />{isArabic ? 'قرار' : 'Decision'}</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-zinc-500" aria-hidden="true" />{isArabic ? 'إنجاز' : 'Milestone'}</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" aria-hidden="true" />{isArabic ? 'عائق' : 'Blocker'}</span>
      </div>
    </div>
  );
}
