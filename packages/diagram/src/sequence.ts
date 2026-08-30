import { CALL_EDGE_KINDS, type ArchitectureGraph } from "@archx/core";
import { DirectedGraph } from "@archx/graph";
import {
  emptyDiagram,
  type DiagramEdge,
  type DiagramModel,
  type DiagramNode,
} from "./model.js";

export interface SequenceOptions {
  /** Node id to start the trace from. If omitted, an entry point is chosen. */
  entryId?: string;
  maxMessages?: number;
  maxDepth?: number;
}

interface Message {
  from: string;
  to: string;
  label: string;
}

interface CallTarget {
  target: string;
  label: string;
}

/** Build ordered call adjacency (preserving edge order) from the IR. */
function callAdjacency(ir: ArchitectureGraph): Map<string, CallTarget[]> {
  const calls = new Set(CALL_EDGE_KINDS);
  const adj = new Map<string, CallTarget[]>();
  for (const edge of ir.edges) {
    if (!calls.has(edge.kind)) continue;
    const list = adj.get(edge.source);
    const entry: CallTarget = { target: edge.target, label: edge.label ?? "call" };
    if (list) list.push(entry);
    else adj.set(edge.source, [entry]);
  }
  return adj;
}

/** Pick a sensible entry point: a caller with no callers, preferring controllers. */
function pickEntry(ir: ArchitectureGraph): string | undefined {
  const call = DirectedGraph.fromArchitecture(ir, CALL_EDGE_KINDS);
  const candidates = call
    .nodes()
    .filter((id) => call.outDegree(id) > 0 && call.inDegree(id) === 0);
  const nameById = new Map(ir.nodes.map((n) => [n.id, n.name]));

  const controllerFirst = candidates.sort((a, b) => {
    const an = /controller/i.test(nameById.get(a) ?? "") ? 0 : 1;
    const bn = /controller/i.test(nameById.get(b) ?? "") ? 0 : 1;
    if (an !== bn) return an - bn;
    return call.outDegree(b) - call.outDegree(a);
  });

  if (controllerFirst.length > 0) return controllerFirst[0];
  // Fallback: any node with outgoing calls, most calls first.
  const anyCaller = call
    .nodes()
    .filter((id) => call.outDegree(id) > 0)
    .sort((a, b) => call.outDegree(b) - call.outDegree(a));
  return anyCaller[0];
}

/** Trace an ordered message sequence by walking the call graph depth-first. */
function trace(
  ir: ArchitectureGraph,
  entryId: string,
  maxMessages: number,
  maxDepth: number,
): { participants: string[]; messages: Message[] } {
  const adj = callAdjacency(ir);
  const messages: Message[] = [];
  const participants: string[] = [];
  const seenParticipant = new Set<string>();

  const addParticipant = (id: string): void => {
    if (!seenParticipant.has(id)) {
      seenParticipant.add(id);
      participants.push(id);
    }
  };

  addParticipant(entryId);

  const stack = new Set<string>();
  const walk = (from: string, depth: number): void => {
    if (depth >= maxDepth || messages.length >= maxMessages) return;
    stack.add(from);
    for (const { target, label } of adj.get(from) ?? []) {
      if (messages.length >= maxMessages) break;
      addParticipant(target);
      messages.push({ from, to: target, label });
      if (!stack.has(target)) walk(target, depth + 1);
    }
    stack.delete(from);
  };

  walk(entryId, 0);
  return { participants, messages };
}

const LIFELINE_GAP = 200;
const LIFELINE_WIDTH = 150;
const HEAD_HEIGHT = 48;
const TOP_MARGIN = 24;
const STEP = 64;
const FIRST_MESSAGE_Y = HEAD_HEIGHT + TOP_MARGIN + 24;

/**
 * Generate a sequence diagram by tracing the call graph from an entry point.
 * Participants are placed as lifelines along the x-axis; each resolved call
 * becomes a downward-ordered message between two lifelines.
 */
export function generateSequenceDiagram(
  ir: ArchitectureGraph,
  options: SequenceOptions = {},
): DiagramModel {
  const entryId = options.entryId ?? pickEntry(ir);
  if (!entryId) {
    return emptyDiagram("sequence", [
      "No call relationships were found, so no sequence could be traced.",
    ]);
  }

  const { participants, messages } = trace(
    ir,
    entryId,
    options.maxMessages ?? 30,
    options.maxDepth ?? 8,
  );

  if (messages.length === 0) {
    return emptyDiagram("sequence", [
      "The chosen entry point makes no outgoing calls.",
    ]);
  }

  const nameById = new Map(ir.nodes.map((n) => [n.id, n.name]));
  const indexOf = new Map(participants.map((id, i) => [id, i]));
  const centerX = (id: string): number =>
    (indexOf.get(id) ?? 0) * LIFELINE_GAP + LIFELINE_WIDTH / 2;

  const totalHeight = FIRST_MESSAGE_Y + messages.length * STEP + TOP_MARGIN;

  const nodes: DiagramNode[] = participants.map((id, i) => ({
    id,
    label: nameById.get(id) ?? id,
    type: "lifeline",
    x: i * LIFELINE_GAP,
    y: 0,
    width: LIFELINE_WIDTH,
    height: totalHeight,
  }));

  const edges: DiagramEdge[] = messages.map((m, i) => {
    const y = FIRST_MESSAGE_Y + i * STEP;
    return {
      id: `msg:${i}:${m.from}->${m.to}`,
      source: m.from,
      target: m.to,
      type: "message",
      label: m.label,
      order: i,
      points: [
        { x: centerX(m.from), y },
        { x: centerX(m.to), y },
      ],
    };
  });

  return {
    kind: "sequence",
    nodes,
    edges,
    width: participants.length * LIFELINE_GAP,
    height: totalHeight,
  };
}
