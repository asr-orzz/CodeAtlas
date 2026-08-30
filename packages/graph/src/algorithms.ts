import { DirectedGraph } from "./graph.js";

/** Breadth-first traversal order starting from `start`. */
export function bfs(graph: DirectedGraph, start: string): string[] {
  if (!graph.hasNode(start)) return [];
  const visited = new Set<string>([start]);
  const order: string[] = [];
  const queue: string[] = [start];
  while (queue.length > 0) {
    const node = queue.shift()!;
    order.push(node);
    for (const next of graph.successors(node)) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return order;
}

/** Depth-first (pre-order) traversal starting from `start`. Iterative. */
export function dfs(graph: DirectedGraph, start: string): string[] {
  if (!graph.hasNode(start)) return [];
  const visited = new Set<string>();
  const order: string[] = [];
  const stack: string[] = [start];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (visited.has(node)) continue;
    visited.add(node);
    order.push(node);
    // push in reverse so successors are visited in their natural order
    const succ = graph.successors(node);
    for (let i = succ.length - 1; i >= 0; i--) stack.push(succ[i]!);
  }
  return order;
}

/**
 * Shortest path (fewest edges) from `from` to `to`, or `null` if unreachable.
 * The returned array includes both endpoints.
 */
export function shortestPath(
  graph: DirectedGraph,
  from: string,
  to: string,
): string[] | null {
  if (!graph.hasNode(from) || !graph.hasNode(to)) return null;
  if (from === to) return [from];
  const prev = new Map<string, string>();
  const visited = new Set<string>([from]);
  const queue: string[] = [from];
  while (queue.length > 0) {
    const node = queue.shift()!;
    for (const next of graph.successors(node)) {
      if (visited.has(next)) continue;
      visited.add(next);
      prev.set(next, node);
      if (next === to) {
        const path = [to];
        let cur = to;
        while (cur !== from) {
          cur = prev.get(cur)!;
          path.push(cur);
        }
        return path.reverse();
      }
      queue.push(next);
    }
  }
  return null;
}

/** All nodes reachable from `start` following edge direction. */
export function reachableFrom(
  graph: DirectedGraph,
  start: string,
  includeStart = false,
): Set<string> {
  const result = new Set<string>();
  if (!graph.hasNode(start)) return result;
  for (const node of bfs(graph, start)) result.add(node);
  if (!includeStart) result.delete(start);
  return result;
}

/** Transitive dependencies: everything `start` (directly or indirectly) points to. */
export function transitiveDependencies(
  graph: DirectedGraph,
  start: string,
): Set<string> {
  return reachableFrom(graph, start, false);
}

/** Transitive dependents: everything that (directly or indirectly) points to `start`. */
export function transitiveDependents(
  graph: DirectedGraph,
  start: string,
): Set<string> {
  return reachableFrom(graph.reversed(), start, false);
}

export interface TopologicalSortResult {
  /** Nodes in a valid topological order. Cyclic nodes are omitted. */
  order: string[];
  /** True if the graph contains at least one cycle. */
  hasCycle: boolean;
}

/** Kahn's algorithm. Reports a cycle if not every node can be ordered. */
export function topologicalSort(graph: DirectedGraph): TopologicalSortResult {
  const indegree = new Map<string, number>();
  for (const node of graph.nodes()) indegree.set(node, graph.inDegree(node));

  const queue: string[] = [];
  for (const [node, deg] of indegree) if (deg === 0) queue.push(node);

  const order: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    order.push(node);
    for (const next of graph.successors(node)) {
      const deg = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, deg);
      if (deg === 0) queue.push(next);
    }
  }

  return { order, hasCycle: order.length !== graph.nodeCount() };
}

interface TarjanFrame {
  node: string;
  edgeIndex: number;
}

/**
 * Tarjan's strongly connected components, implemented iteratively so it does
 * not overflow the call stack on large real-world graphs.
 *
 * Returns every SCC (including singletons). Components are returned in reverse
 * topological order, which is Tarjan's natural output.
 */
export function stronglyConnectedComponents(graph: DirectedGraph): string[][] {
  const index = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const onStack = new Set<string>();
  const tarjanStack: string[] = [];
  const result: string[][] = [];
  let counter = 0;

  for (const root of graph.nodes()) {
    if (index.has(root)) continue;
    const work: TarjanFrame[] = [{ node: root, edgeIndex: 0 }];

    while (work.length > 0) {
      const frame = work[work.length - 1]!;
      const v = frame.node;

      if (frame.edgeIndex === 0) {
        index.set(v, counter);
        lowlink.set(v, counter);
        counter++;
        tarjanStack.push(v);
        onStack.add(v);
      }

      const succ = graph.successors(v);
      if (frame.edgeIndex < succ.length) {
        const w = succ[frame.edgeIndex]!;
        frame.edgeIndex++;
        if (!index.has(w)) {
          work.push({ node: w, edgeIndex: 0 });
        } else if (onStack.has(w)) {
          lowlink.set(v, Math.min(lowlink.get(v)!, index.get(w)!));
        }
        continue;
      }

      // All successors of v processed.
      if (lowlink.get(v) === index.get(v)) {
        const component: string[] = [];
        for (;;) {
          const w = tarjanStack.pop()!;
          onStack.delete(w);
          component.push(w);
          if (w === v) break;
        }
        result.push(component);
      }

      work.pop();
      if (work.length > 0) {
        const parent = work[work.length - 1]!.node;
        lowlink.set(parent, Math.min(lowlink.get(parent)!, lowlink.get(v)!));
      }
    }
  }

  return result;
}

/**
 * All cycles in the graph, expressed as the set of nodes that participate in
 * each cycle. A cycle is either an SCC with more than one node, or a single
 * node with a self-loop.
 */
export function findCycles(graph: DirectedGraph): string[][] {
  const cycles: string[][] = [];
  for (const component of stronglyConnectedComponents(graph)) {
    if (component.length > 1) {
      cycles.push(component);
    } else {
      const only = component[0]!;
      if (graph.hasEdge(only, only)) cycles.push([only]);
    }
  }
  return cycles;
}

/** True if the graph contains at least one directed cycle. */
export function hasCycle(graph: DirectedGraph): boolean {
  return topologicalSort(graph).hasCycle;
}

/**
 * Weakly connected components: treat edges as undirected and group nodes that
 * are mutually reachable.
 */
export function weaklyConnectedComponents(graph: DirectedGraph): string[][] {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let root = x;
    while (parent.get(root)! !== root) root = parent.get(root)!;
    // path compression
    let cur = x;
    while (parent.get(cur)! !== root) {
      const next = parent.get(cur)!;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };
  const union = (a: string, b: string): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  for (const node of graph.nodes()) parent.set(node, node);
  for (const node of graph.nodes()) {
    for (const next of graph.successors(node)) union(node, next);
  }

  const groups = new Map<string, string[]>();
  for (const node of graph.nodes()) {
    const root = find(node);
    const bucket = groups.get(root);
    if (bucket) bucket.push(node);
    else groups.set(root, [node]);
  }
  return [...groups.values()];
}
