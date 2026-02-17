// Pure functions for exporting knowledge data

export interface KnowledgeItem {
  type: string;
  title: string;
  content: string;
  importance: number;
  timestamp: number;
  tags?: string[];
}

export function exportAsJSON(items: KnowledgeItem[]): Blob {
  const exportData = {
    exportDate: new Date().toISOString(),
    itemCount: items.length,
    items: items.map((item) => ({
      type: item.type,
      title: item.title,
      content: item.content,
      importance: item.importance,
      timestamp: item.timestamp,
      tags: item.tags || [],
    })),
  };

  const jsonString = JSON.stringify(exportData, null, 2);
  return new Blob([jsonString], { type: "application/json" });
}

export function exportAsMarkdown(items: KnowledgeItem[]): Blob {
  let markdown = `# Knowledge Export\n\n`;
  markdown += `**Export Date:** ${new Date().toLocaleDateString()}\n`;
  markdown += `**Total Items:** ${items.length}\n\n`;
  markdown += `---\n\n`;

  items.forEach((item, index) => {
    markdown += `## ${index + 1}. ${item.title}\n\n`;
    markdown += `- **Type:** ${item.type}\n`;
    markdown += `- **Importance:** ${"⭐".repeat(item.importance)}\n`;
    markdown += `- **Date:** ${new Date(item.timestamp).toLocaleDateString()}\n`;
    if (item.tags && item.tags.length > 0) {
      markdown += `- **Tags:** ${item.tags.map((t) => `#${t}`).join(", ")}\n`;
    }
    markdown += `\n${item.content}\n\n`;
    markdown += `---\n\n`;
  });

  return new Blob([markdown], { type: "text/markdown" });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
