"use client";

interface WikiEditorProps {
  content: string;
  editable: boolean;
  onChange?: (content: string) => void;
  placeholder?: string;
}

/**
 * Simple markdown editor/viewer
 */
export function WikiEditor({
  content,
  editable,
  onChange,
  placeholder,
}: WikiEditorProps) {
  if (!editable) {
    // View mode: render as preformatted markdown
    return (
      <div className="prose prose-sm max-w-none dark:prose-invert">
        <pre className="bg-muted p-4 rounded overflow-auto text-sm whitespace-pre-wrap break-words font-mono">
          {content}
        </pre>
      </div>
    );
  }

  // Edit mode: textarea
  return (
    <textarea
      value={content}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder || "Write markdown here..."}
      className="w-full h-96 p-4 border border-input rounded-lg bg-background text-foreground font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
    />
  );
}
