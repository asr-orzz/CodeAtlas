import type { ProjectSummary } from "../types";

interface Props {
  projects: ProjectSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ProjectList({ projects, selectedId, onSelect, onDelete }: Props) {
  if (projects.length === 0) {
    return (
      <p className="px-1 text-xs text-slate-500">
        No projects yet. Analyze a repository to get started.
      </p>
    );
  }

  return (
    <ul className="space-y-1">
      {projects.map((project) => (
        <li key={project.id}>
          <div
            className={`group flex items-center justify-between rounded-lg border px-3 py-2 transition ${
              selectedId === project.id
                ? "border-accent bg-accent/10"
                : "border-transparent hover:border-surface-border hover:bg-surface-raised"
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect(project.id)}
              className="min-w-0 flex-1 text-left"
            >
              <div className="truncate text-sm font-medium text-slate-100">
                {project.name}
              </div>
              <div className="truncate text-[11px] text-slate-500">
                {project.nodeCount} nodes · {project.edgeCount} edges
                {project.cycleCount > 0 && (
                  <span className="text-amber-400"> · {project.cycleCount} cycles</span>
                )}
              </div>
            </button>
            <button
              type="button"
              onClick={() => onDelete(project.id)}
              className="ml-2 rounded p-1 text-slate-600 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
              title="Delete project"
            >
              ✕
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
