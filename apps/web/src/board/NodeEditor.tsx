import type { BoardNode } from "../types";

interface Props {
  node: BoardNode;
  onChange: (patch: Partial<BoardNode>) => void;
  onClose: () => void;
}

const CLASS_STYLE = new Set(["class", "interface", "enum", "function"]);

type PropList = NonNullable<BoardNode["data"]>["properties"];

function propsToText(props?: PropList): string {
  return (props ?? [])
    .map((p) => (p.type ? `${p.name}: ${p.type}` : p.name))
    .join("\n");
}

function textToProps(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, type] = line.split(":").map((s) => s.trim());
      return type ? { name: name!, type } : { name: name! };
    });
}

function textToMethods(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim().replace(/\(\)$/, ""))
    .filter(Boolean)
    .map((name) => ({ name }));
}

export function NodeEditor({ node, onChange, onClose }: Props) {
  const isClass = CLASS_STYLE.has(node.type);

  return (
    <div className="absolute right-3 top-3 z-10 flex max-h-[calc(100%-1.5rem)] w-72 flex-col rounded-xl border border-surface-border bg-surface-raised/95 shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
        <span className="text-sm font-semibold text-slate-100">Edit node</span>
        <button onClick={onClose} className="rounded p-1 text-slate-500 hover:text-slate-200" title="Close">
          ✕
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 text-xs">
        <Field label="Name">
          <input
            value={node.label}
            onChange={(e) => onChange({ label: e.target.value })}
            className="w-full rounded-md border border-surface-border bg-surface px-2 py-1 text-slate-100"
          />
        </Field>

        <Field label="Type">
          <div className="rounded-md border border-surface-border bg-surface px-2 py-1 text-slate-400">
            {node.type}
          </div>
        </Field>

        {isClass && (
          <>
            <Field label="Properties (one per line, name: type)">
              <textarea
                rows={4}
                defaultValue={propsToText(node.data?.properties)}
                onBlur={(e) => onChange({ data: { properties: textToProps(e.target.value) } })}
                className="w-full rounded-md border border-surface-border bg-surface px-2 py-1 font-mono text-[11px] text-slate-200"
              />
            </Field>
            <Field label="Methods (one per line)">
              <textarea
                rows={4}
                defaultValue={(node.data?.methods ?? []).map((m) => m.name).join("\n")}
                onBlur={(e) => onChange({ data: { methods: textToMethods(e.target.value) } })}
                className="w-full rounded-md border border-surface-border bg-surface px-2 py-1 font-mono text-[11px] text-slate-200"
              />
            </Field>
            <p className="text-[10px] text-slate-500">Changes apply when a field loses focus.</p>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}
