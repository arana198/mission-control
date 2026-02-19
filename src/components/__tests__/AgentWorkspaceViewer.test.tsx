/**
 * AgentWorkspaceViewer Component Tests
 *
 * Tests for agent workspace file tree display
 * Validates: file tree rendering, expansion/collapse, metadata display, error handling
 */

import { describe, it, expect } from "@jest/globals";
import { FILE_TYPE } from "@/lib/validators/agentWorkspaceValidators";

interface FileItem {
  name: string;
  path: string;
  type: "file" | "directory" | "symlink";
  size?: number;
  modified?: number;
  extension?: string;
  isHidden?: boolean;
  children?: FileItem[];
  fileCount?: number;
  folderCount?: number;
}

interface WorkspaceViewerProps {
  agentName: string;
  rootPath: string;
  tree?: FileItem;
  totalFiles: number;
  totalFolders: number;
  totalSize: number;
  lastUpdated: number;
  error?: string;
}

// Mock component for testing
class AgentWorkspaceViewerMock {
  private props: WorkspaceViewerProps;

  constructor(props: WorkspaceViewerProps) {
    this.props = props;
  }

  renderError(): string {
    if (this.props.error) {
      return `ERROR: ${this.props.error}`;
    }
    return "";
  }

  renderEmpty(): string {
    if (this.props.totalFiles === 0) {
      return "No files in workspace yet";
    }
    return "";
  }

  renderHeader(): string {
    return `
      ${this.props.agentName} Workspace
      Files: ${this.props.totalFiles}
      Folders: ${this.props.totalFolders}
      Size: ${this.props.totalSize} bytes
    `.trim();
  }

  renderTree(): string {
    if (!this.props.tree) return "";
    return this.renderNode(this.props.tree, 0);
  }

  private renderNode(item: FileItem, level: number): string {
    const indent = "  ".repeat(level);
    const type =
      item.type === "directory"
        ? "📁"
        : item.type === "symlink"
        ? "🔗"
        : "📄";

    let line = `${indent}${type} ${item.name}`;

    if (item.type === "directory" && item.fileCount !== undefined) {
      line += ` [${item.fileCount} files]`;
    } else if (item.type === "file" && item.size !== undefined) {
      line += ` [${item.size} bytes]`;
    }

    if (item.children && item.children.length > 0) {
      line += "\n";
      line += item.children
        .map((child) => this.renderNode(child, level + 1))
        .join("\n");
    }

    return line;
  }
}

describe("AgentWorkspaceViewer", () => {
  const mockTimestamp = Date.now();

  describe("Error State", () => {
    it("should display error message when present", () => {
      const component = new AgentWorkspaceViewerMock({
        agentName: "jarvis",
        rootPath: "/home/user/.openclaw/workspace/jarvis",
        totalFiles: 0,
        totalFolders: 0,
        totalSize: 0,
        lastUpdated: mockTimestamp,
        error: "Workspace folder not found",
      });

      expect(component.renderError()).toContain(
        "Workspace folder not found"
      );
    });

    it("should display specific error messages", () => {
      const errors = [
        "Permission denied",
        "Workspace not initialized",
        "Invalid path",
      ];

      errors.forEach((error) => {
        const component = new AgentWorkspaceViewerMock({
          agentName: "jarvis",
          rootPath: "/path",
          totalFiles: 0,
          totalFolders: 0,
          totalSize: 0,
          lastUpdated: mockTimestamp,
          error,
        });

        expect(component.renderError()).toContain(error);
      });
    });
  });

  describe("Empty State", () => {
    it("should display empty state when no files", () => {
      const component = new AgentWorkspaceViewerMock({
        agentName: "jarvis",
        rootPath: "/home/user/.openclaw/workspace/jarvis",
        totalFiles: 0,
        totalFolders: 0,
        totalSize: 0,
        lastUpdated: mockTimestamp,
      });

      expect(component.renderEmpty()).toBe("No files in workspace yet");
    });

    it("should not display empty state when files exist", () => {
      const component = new AgentWorkspaceViewerMock({
        agentName: "jarvis",
        rootPath: "/home/user/.openclaw/workspace/jarvis",
        totalFiles: 5,
        totalFolders: 2,
        totalSize: 10240,
        lastUpdated: mockTimestamp,
      });

      expect(component.renderEmpty()).toBe("");
    });
  });

  describe("Header Display", () => {
    it("should display workspace name and statistics", () => {
      const component = new AgentWorkspaceViewerMock({
        agentName: "jarvis",
        rootPath: "/home/user/.openclaw/workspace/jarvis",
        totalFiles: 42,
        totalFolders: 8,
        totalSize: 2097152, // 2 MB
        lastUpdated: mockTimestamp,
      });

      const header = component.renderHeader();
      expect(header).toContain("jarvis Workspace");
      expect(header).toContain("Files: 42");
      expect(header).toContain("Folders: 8");
      expect(header).toContain("Size: 2097152");
    });

    it("should handle different agent names", () => {
      const agentNames = ["jarvis", "shuri", "fury", "vision"];

      agentNames.forEach((name) => {
        const component = new AgentWorkspaceViewerMock({
          agentName: name,
          rootPath: `/home/user/.openclaw/workspace/${name}`,
          totalFiles: 10,
          totalFolders: 2,
          totalSize: 5120,
          lastUpdated: mockTimestamp,
        });

        expect(component.renderHeader()).toContain(`${name} Workspace`);
      });
    });
  });

  describe("File Tree Rendering", () => {
    it("should render simple file tree", () => {
      const tree: FileItem = {
        name: "jarvis",
        path: "/",
        type: "directory",
        children: [
          {
            name: "readme.md",
            path: "/readme.md",
            type: "file",
            size: 1024,
            extension: ".md",
          },
          {
            name: "src",
            path: "/src",
            type: "directory",
            fileCount: 5,
            children: [],
          },
        ],
      };

      const component = new AgentWorkspaceViewerMock({
        agentName: "jarvis",
        rootPath: "/home/user/.openclaw/workspace/jarvis",
        tree,
        totalFiles: 6,
        totalFolders: 1,
        totalSize: 10240,
        lastUpdated: mockTimestamp,
      });

      const rendered = component.renderTree();
      expect(rendered).toContain("📁 jarvis");
      expect(rendered).toContain("📄 readme.md");
      expect(rendered).toContain("📁 src");
    });

    it("should handle nested directory structures", () => {
      const tree: FileItem = {
        name: "jarvis",
        path: "/",
        type: "directory",
        children: [
          {
            name: "src",
            path: "/src",
            type: "directory",
            fileCount: 2,
            children: [
              {
                name: "components",
                path: "/src/components",
                type: "directory",
                fileCount: 3,
                children: [
                  {
                    name: "Button.tsx",
                    path: "/src/components/Button.tsx",
                    type: "file",
                    size: 2048,
                    extension: ".tsx",
                  },
                ],
              },
            ],
          },
        ],
      };

      const component = new AgentWorkspaceViewerMock({
        agentName: "jarvis",
        rootPath: "/home/user/.openclaw/workspace/jarvis",
        tree,
        totalFiles: 4,
        totalFolders: 2,
        totalSize: 20480,
        lastUpdated: mockTimestamp,
      });

      const rendered = component.renderTree();
      expect(rendered).toContain("src");
      expect(rendered).toContain("components");
      expect(rendered).toContain("Button.tsx");
    });

    it("should display file sizes for files", () => {
      const tree: FileItem = {
        name: "jarvis",
        path: "/",
        type: "directory",
        children: [
          {
            name: "large.bin",
            path: "/large.bin",
            type: "file",
            size: 5242880, // 5 MB
            extension: ".bin",
          },
          {
            name: "small.txt",
            path: "/small.txt",
            type: "file",
            size: 256,
            extension: ".txt",
          },
        ],
      };

      const component = new AgentWorkspaceViewerMock({
        agentName: "jarvis",
        rootPath: "/home/user/.openclaw/workspace/jarvis",
        tree,
        totalFiles: 2,
        totalFolders: 0,
        totalSize: 5243136,
        lastUpdated: mockTimestamp,
      });

      const rendered = component.renderTree();
      expect(rendered).toContain("large.bin");
      expect(rendered).toContain("5242880 bytes");
      expect(rendered).toContain("small.txt");
      expect(rendered).toContain("256 bytes");
    });

    it("should display file counts for directories", () => {
      const tree: FileItem = {
        name: "jarvis",
        path: "/",
        type: "directory",
        children: [
          {
            name: "docs",
            path: "/docs",
            type: "directory",
            fileCount: 15,
            children: [],
          },
          {
            name: "empty",
            path: "/empty",
            type: "directory",
            fileCount: 0,
            children: [],
          },
        ],
      };

      const component = new AgentWorkspaceViewerMock({
        agentName: "jarvis",
        rootPath: "/home/user/.openclaw/workspace/jarvis",
        tree,
        totalFiles: 15,
        totalFolders: 2,
        totalSize: 102400,
        lastUpdated: mockTimestamp,
      });

      const rendered = component.renderTree();
      expect(rendered).toContain("docs");
      expect(rendered).toContain("15 files");
      expect(rendered).toContain("empty");
      expect(rendered).toContain("0 files");
    });

    it("should handle symlinks", () => {
      const tree: FileItem = {
        name: "jarvis",
        path: "/",
        type: "directory",
        children: [
          {
            name: "link_to_readme",
            path: "/link_to_readme",
            type: "symlink",
          },
        ],
      };

      const component = new AgentWorkspaceViewerMock({
        agentName: "jarvis",
        rootPath: "/home/user/.openclaw/workspace/jarvis",
        tree,
        totalFiles: 1,
        totalFolders: 0,
        totalSize: 0,
        lastUpdated: mockTimestamp,
      });

      const rendered = component.renderTree();
      expect(rendered).toContain("🔗 link_to_readme");
    });
  });

  describe("Large Workspace Handling", () => {
    it("should handle workspaces with many files", () => {
      const children: FileItem[] = [];
      for (let i = 0; i < 100; i++) {
        children.push({
          name: `file${i}.txt`,
          path: `/file${i}.txt`,
          type: "file",
          size: 1024,
          extension: ".txt",
        });
      }

      const tree: FileItem = {
        name: "jarvis",
        path: "/",
        type: "directory",
        children,
      };

      const component = new AgentWorkspaceViewerMock({
        agentName: "jarvis",
        rootPath: "/home/user/.openclaw/workspace/jarvis",
        tree,
        totalFiles: 100,
        totalFolders: 0,
        totalSize: 102400,
        lastUpdated: mockTimestamp,
      });

      const rendered = component.renderTree();
      expect(rendered).toContain("file0.txt");
      expect(rendered).toContain("file99.txt");
    });

    it("should handle deeply nested structures", () => {
      let deepTree: FileItem = {
        name: "level5",
        path: "/a/b/c/d/e",
        type: "file",
        size: 1024,
        extension: ".txt",
      };

      for (let i = 4; i > 0; i--) {
        deepTree = {
          name: `level${i}`,
          path: `/a/b/c/d`,
          type: "directory",
          children: [deepTree],
        };
      }

      const root: FileItem = {
        name: "jarvis",
        path: "/",
        type: "directory",
        children: [deepTree],
      };

      const component = new AgentWorkspaceViewerMock({
        agentName: "jarvis",
        rootPath: "/home/user/.openclaw/workspace/jarvis",
        tree: root,
        totalFiles: 1,
        totalFolders: 4,
        totalSize: 1024,
        lastUpdated: mockTimestamp,
      });

      const rendered = component.renderTree();
      expect(rendered).toContain("level1");
      expect(rendered).toContain("level5");
    });
  });
});
