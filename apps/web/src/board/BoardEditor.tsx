import { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from "reactflow";
import "reactflow/dist/style.css";
import { api } from "../api/client";
import { ClassNode } from "../canvas/ClassNode";
import { ComponentNode } from "../canvas/ComponentNode";
import { EntityNode } from "../canvas/EntityNode";
import { toReactFlowEdge } from "../canvas/edgeStyles";
import type { Board, BoardEdge, BoardNode } from "../types";
import { NodeEditor } from "./NodeEditor";

const nodeTypes = {
  class: ClassNode,
  interface: ClassNode,
  enum: ClassNode,
  function: ClassNode,
  component: ComponentNode,
  entity: EntityNode,
};

const CLASS_STYLE = new Set(["class", "interface", "enum", "function"]);

const NODE_PALETTE = [
  "class",
  "interface",
  "service",
  "controller",
  "repository",
  "database",
  "model",
  "actor",
  "component",
];

const EDGE_KINDS = [
  "association",
  "inheritance",
  "dependency",
  "composition",
  "aggregation",
  "calls",
];

function toRfNode(n: BoardNode): Node {
  const rfType = CLASS_STYLE.has(n.type) ? n.type : "entity";
  return {
    id: n.id,
    type: rfType,
    position: { x: n.x, y: n.y },
    data: {
      ...n.data,
      label: n.label,
      nodeType: n.type,
      boardType: n.type,
      group: n.data?.group ?? (rfType === "entity" ? n.type : undefined),
    },
    style: { width: n.width },
  };
}

function toRfEdge(e: BoardEdge): Edge {
  const rf = toReactFlowEdge({ id: e.id, source: e.source, target: e.target, type: e.type, label: e.label });
  rf.data = { kind: e.type };
  return rf;
}

function fromRfNode(n: Node): BoardNode {
  const type = (n.data?.boardType as string) ?? n.type ?? "entity";
  const width = typeof n.style?.width === "number" ? n.style.width : CLASS_STYLE.has(type) ? 200 : 160;
  return {
    id: n.id,
    type,
    label: (n.data?.label as string) ?? n.id,
    x: Math.round(n.position.x),
    y: Math.round(n.position.y),
    width,
    height: n.height ?? 80,
    data: {
      properties: n.data?.properties,
      methods: n.data?.methods,
      group: n.data?.group,
    },
  };
}

function fromRfEdge(e: Edge): BoardEdge {
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    type: (e.data?.kind as string) ?? "association",
    label: typeof e.label === "string" ? e.label : undefined,
  };
}

interface Props {
  board: Board;
}

export function BoardEditor({ board }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState(board.nodes.map(toRfNode));
  const [edges, setEdges, onEdgesChange] = useEdgesState(board.edges.map(toRfEdge));
  const [selected, setSelected] = useState<{ kind: "node" | "edge"; id: string } | null>(null);
  const [newType, setNewType] = useState("class");
  const [edgeKind, setEdgeKind] = useState("association");
  const [name, setName] = useState(board.name);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNodes(board.nodes.map(toRfNode));
    setEdges(board.edges.map(toRfEdge));
    setName(board.name);
    setSelected(null);
    setStatus(null);
  }, [board, setNodes, setEdges]);

  const onConnect = useCallback(
    (conn: Connection) => {
      const id = `e-${conn.source}-${conn.target}-${Date.now()}`;
      setEdges((eds) =>
        addEdge(toRfEdge({ id, source: conn.source!, target: conn.target!, type: edgeKind }), eds),
      );
      setStatus(null);
    },
    [edgeKind, setEdges],
  );

  const addNode = useCallback(() => {
    const id = `n-${Date.now()}`;
    const isClass = CLASS_STYLE.has(newType);
    const node: BoardNode = {
      id,
      type: newType,
      label: `New ${newType}`,
      x: 80 + Math.random() * 160,
      y: 80 + Math.random() * 120,
      width: isClass ? 200 : 160,
      height: isClass ? 100 : 60,
      data: isClass ? { properties: [], methods: [] } : { group: newType },
    };
    setNodes((nds) => [...nds, toRfNode(node)]);
    setStatus(null);
  }, [newType, setNodes]);

  const deleteSelected = useCallback(() => {
    if (!selected) return;
    if (selected.kind === "node") {
      setNodes((nds) => nds.filter((n) => n.id !== selected.id));
      setEdges((eds) => eds.filter((e) => e.source !== selected.id && e.target !== selected.id));
    } else {
      setEdges((eds) => eds.filter((e) => e.id !== selected.id));
    }
    setSelected(null);
  }, [selected, setNodes, setEdges]);

  const patchNode = useCallback(
    (id: string, patch: Partial<BoardNode>) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== id) return n;
          const merged = fromRfNode(n);
          const next: BoardNode = { ...merged, ...patch, data: { ...merged.data, ...patch.data } };
          return toRfNode(next);
        }),
      );
    },
    [setNodes],
  );

  const save = useCallback(async () => {
    setSaving(true);
    setStatus(null);
    try {
      const content = {
        name,
        nodes: nodes.map(fromRfNode),
        edges: edges.map(fromRfEdge),
      };
      await api.saveBoard(board.id, content);
      setStatus("Saved");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [board.id, name, nodes, edges]);

  const selectedNode = useMemo(
    () => (selected?.kind === "node" ? nodes.find((n) => n.id === selected.id) : undefined),
    [selected, nodes],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-surface-border bg-surface-raised px-3 py-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-40 rounded-md border border-surface-border bg-surface px-2 py-1 text-sm text-slate-100"
        />
        <span className="mx-1 h-4 w-px bg-surface-border" />
        <select
          value={newType}
          onChange={(e) => setNewType(e.target.value)}
          className="rounded-md border border-surface-border bg-surface px-2 py-1 text-xs text-slate-200"
        >
          {NODE_PALETTE.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button
          onClick={addNode}
          className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accent/90"
        >
          + Add node
        </button>
        <span className="mx-1 h-4 w-px bg-surface-border" />
        <label className="text-xs text-slate-500">Connection:</label>
        <select
          value={edgeKind}
          onChange={(e) => setEdgeKind(e.target.value)}
          className="rounded-md border border-surface-border bg-surface px-2 py-1 text-xs text-slate-200"
        >
          {EDGE_KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <button
          onClick={deleteSelected}
          disabled={!selected}
          className="rounded-md border border-surface-border px-3 py-1 text-xs text-slate-300 hover:bg-surface disabled:opacity-40"
        >
          Delete selected
        </button>
        <div className="ml-auto flex items-center gap-2">
          {status && <span className="text-xs text-slate-400">{status}</span>}
          <button
            onClick={save}
            disabled={saving}
            className="rounded-md bg-emerald-600 px-4 py-1 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) => setSelected({ kind: "node", id: node.id })}
          onEdgeClick={(_, edge) => setSelected({ kind: "edge", id: edge.id })}
          onPaneClick={() => setSelected(null)}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.1}
          deleteKeyCode={["Backspace", "Delete"]}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#242938" />
          <Controls className="!bg-surface-raised !border-surface-border" />
          <MiniMap pannable zoomable className="!bg-surface-raised" maskColor="rgba(15,17,23,0.7)" nodeColor="#334155" />
        </ReactFlow>

        {selectedNode && (
          <NodeEditor
            node={fromRfNode(selectedNode)}
            onChange={(patch) => patchNode(selectedNode.id, patch)}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
    </div>
  );
}
