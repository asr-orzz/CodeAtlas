import { useEffect, useMemo } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
} from "reactflow";
import "reactflow/dist/style.css";
import type { DiagramModel } from "../types";
import { ClassNode } from "./ClassNode";
import { ComponentNode } from "./ComponentNode";
import { EntityNode } from "./EntityNode";
import { toReactFlowEdge } from "./edgeStyles";

const nodeTypes = {
  class: ClassNode,
  interface: ClassNode,
  enum: ClassNode,
  function: ClassNode,
  component: ComponentNode,
  entity: EntityNode,
};

function toNodes(model: DiagramModel): Node[] {
  return model.nodes.map((n) => ({
    id: n.id,
    type: nodeTypes[n.type as keyof typeof nodeTypes] ? n.type : "class",
    position: { x: n.x, y: n.y },
    data: { ...n.data, label: n.label, nodeType: n.type },
    style: { width: n.width },
  }));
}

interface Props {
  model: DiagramModel;
  onSelectNode?: (id: string | null) => void;
}

export function DiagramCanvas({ model, onSelectNode }: Props) {
  const initialNodes = useMemo(() => toNodes(model), [model]);
  const initialEdges = useMemo<Edge[]>(
    () => model.edges.map(toReactFlowEdge),
    [model],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Re-sync when a new diagram model arrives.
  useEffect(() => setNodes(initialNodes), [initialNodes, setNodes]);
  useEffect(() => setEdges(initialEdges), [initialEdges, setEdges]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      onNodeClick={(_, node) => onSelectNode?.(node.id)}
      onPaneClick={() => onSelectNode?.(null)}
      fitView
      fitViewOptions={{ padding: 0.12, maxZoom: 1.5 }}
      minZoom={0.05}
      maxZoom={2.5}
      nodesConnectable={false}
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#242938" />
      <Controls className="!bg-surface-raised !border-surface-border" />
      <MiniMap
        pannable
        zoomable
        className="!bg-surface-raised"
        maskColor="rgba(15,17,23,0.7)"
        nodeColor="#334155"
      />
    </ReactFlow>
  );
}
