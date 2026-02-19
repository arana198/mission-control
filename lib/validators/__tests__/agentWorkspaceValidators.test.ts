import {
  isSafeFilePath,
  formatFileSize,
  getFileExtension,
  getFileIcon,
  FileMetadataSchema,
  DirectoryTreeSchema,
  WorkspaceStructureSchema,
  GetWorkspaceStructureSchema,
  GetWorkspaceFolderSchema,
  FILE_TYPE,
  validateWorkspaceInput,
} from "@/lib/validators/agentWorkspaceValidators";

describe("agentWorkspaceValidators", () => {
  describe("isSafeFilePath", () => {
    it("should accept relative paths", () => {
      expect(isSafeFilePath("docs/readme.md")).toBe(true);
      expect(isSafeFilePath("src/components/Button.tsx")).toBe(true);
      expect(isSafeFilePath("file.txt")).toBe(true);
    });

    it("should reject paths with ..", () => {
      expect(isSafeFilePath("../etc/passwd")).toBe(false);
      expect(isSafeFilePath("docs/../../../secret")).toBe(false);
      expect(isSafeFilePath("./.././secret")).toBe(false);
    });

    it("should reject absolute paths", () => {
      expect(isSafeFilePath("/etc/passwd")).toBe(false);
      expect(isSafeFilePath("C:\\Windows\\System32")).toBe(false);
      expect(isSafeFilePath("D:\\test")).toBe(false);
    });

    it("should reject paths with backslash traversal", () => {
      expect(isSafeFilePath("docs\\..\\.\\secret")).toBe(false);
    });
  });

  describe("formatFileSize", () => {
    it("should format bytes", () => {
      expect(formatFileSize(0)).toBe("0 B");
      expect(formatFileSize(512)).toBe("512 B");
      expect(formatFileSize(1024)).toBe("1 KB");
    });

    it("should format kilobytes", () => {
      expect(formatFileSize(1024 * 10)).toBe("10 KB");
      expect(formatFileSize(1024 * 500)).toBe("500 KB");
    });

    it("should format megabytes", () => {
      expect(formatFileSize(1024 * 1024)).toBe("1 MB");
      expect(formatFileSize(1024 * 1024 * 100)).toBe("100 MB");
    });

    it("should format gigabytes", () => {
      expect(formatFileSize(1024 * 1024 * 1024)).toBe("1 GB");
      expect(formatFileSize(1024 * 1024 * 1024 * 5.5)).toBe("5.5 GB");
    });
  });

  describe("getFileExtension", () => {
    it("should extract file extensions", () => {
      expect(getFileExtension("file.txt")).toBe(".txt");
      expect(getFileExtension("script.js")).toBe(".js");
      expect(getFileExtension("document.pdf")).toBe(".pdf");
    });

    it("should handle multiple dots", () => {
      expect(getFileExtension("archive.tar.gz")).toBe(".gz");
      expect(getFileExtension("backup.2024.01.zip")).toBe(".zip");
    });

    it("should return empty for files without extension", () => {
      expect(getFileExtension("README")).toBe("");
      expect(getFileExtension("Makefile")).toBe("");
    });

    it("should handle hidden files", () => {
      expect(getFileExtension(".gitignore")).toBe("");
      expect(getFileExtension(".env.local")).toBe(".local");
    });
  });

  describe("getFileIcon", () => {
    it("should return folder emoji for directories", () => {
      expect(getFileIcon("folder", FILE_TYPE.DIRECTORY)).toBe("📁");
    });

    it("should return symlink emoji for symlinks", () => {
      expect(getFileIcon("link", FILE_TYPE.SYMLINK)).toBe("🔗");
    });

    it("should return correct icons for known file types", () => {
      expect(getFileIcon("file.ts", FILE_TYPE.FILE)).toBe("🟦");
      expect(getFileIcon("file.tsx", FILE_TYPE.FILE)).toBe("⚛️");
      expect(getFileIcon("file.py", FILE_TYPE.FILE)).toBe("🐍");
      expect(getFileIcon("file.md", FILE_TYPE.FILE)).toBe("📝");
      expect(getFileIcon("file.json", FILE_TYPE.FILE)).toBe("📄");
      expect(getFileIcon("file.html", FILE_TYPE.FILE)).toBe("🌐");
      expect(getFileIcon("file.css", FILE_TYPE.FILE)).toBe("🎨");
      expect(getFileIcon("file.zip", FILE_TYPE.FILE)).toBe("📦");
    });

    it("should return default emoji for unknown types", () => {
      expect(getFileIcon("file.xyz", FILE_TYPE.FILE)).toBe("📄");
      expect(getFileIcon("file", FILE_TYPE.FILE)).toBe("📄");
    });

    it("should be case-insensitive for extensions", () => {
      expect(getFileIcon("FILE.TS", FILE_TYPE.FILE)).toBe("🟦");
      expect(getFileIcon("FILE.TXT", FILE_TYPE.FILE)).toBe("📄");
    });
  });

  describe("Zod Schemas", () => {
    describe("FileMetadataSchema", () => {
      it("should validate file metadata", () => {
        const valid = {
          name: "test.txt",
          path: "/test.txt",
          type: FILE_TYPE.FILE,
          size: 1024,
          modified: Date.now(),
          extension: ".txt",
          isHidden: false,
        };
        const result = FileMetadataSchema.safeParse(valid);
        expect(result.success).toBe(true);
      });

      it("should require name and path", () => {
        const invalid = {
          type: FILE_TYPE.FILE,
        };
        const result = FileMetadataSchema.safeParse(invalid);
        expect(result.success).toBe(false);
      });

      it("should accept optional fields", () => {
        const minimal = {
          name: "file.txt",
          path: "/file.txt",
          type: FILE_TYPE.FILE,
        };
        const result = FileMetadataSchema.safeParse(minimal);
        expect(result.success).toBe(true);
      });

      it("should reject negative size", () => {
        const invalid = {
          name: "file.txt",
          path: "/file.txt",
          type: FILE_TYPE.FILE,
          size: -100,
        };
        const result = FileMetadataSchema.safeParse(invalid);
        expect(result.success).toBe(false);
      });
    });

    describe("DirectoryTreeSchema", () => {
      it("should validate directory tree", () => {
        const valid = {
          name: "root",
          path: "/",
          type: FILE_TYPE.DIRECTORY,
          children: [
            {
              name: "file.txt",
              path: "/file.txt",
              type: FILE_TYPE.FILE,
              size: 1024,
            },
            {
              name: "subdir",
              path: "/subdir",
              type: FILE_TYPE.DIRECTORY,
              children: [],
            },
          ],
          fileCount: 1,
          folderCount: 1,
        };
        const result = DirectoryTreeSchema.safeParse(valid);
        expect(result.success).toBe(true);
      });

      it("should handle recursive nesting", () => {
        const valid = {
          name: "a",
          path: "/a",
          type: FILE_TYPE.DIRECTORY,
          children: [
            {
              name: "b",
              path: "/a/b",
              type: FILE_TYPE.DIRECTORY,
              children: [
                {
                  name: "c.txt",
                  path: "/a/b/c.txt",
                  type: FILE_TYPE.FILE,
                },
              ],
            },
          ],
        };
        const result = DirectoryTreeSchema.safeParse(valid);
        expect(result.success).toBe(true);
      });
    });

    describe("WorkspaceStructureSchema", () => {
      it("should validate workspace structure", () => {
        const valid = {
          agentId: "agent_123",
          agentName: "jarvis",
          rootPath: "/home/user/.openclaw/workspace/jarvis",
          totalFiles: 42,
          totalFolders: 5,
          totalSize: 1024 * 1024,
          lastUpdated: Date.now(),
        };
        const result = WorkspaceStructureSchema.safeParse(valid);
        expect(result.success).toBe(true);
      });

      it("should accept tree and error", () => {
        const valid = {
          agentId: "agent_123",
          agentName: "jarvis",
          rootPath: "/path",
          totalFiles: 0,
          totalFolders: 0,
          totalSize: 0,
          lastUpdated: Date.now(),
          tree: {
            name: "jarvis",
            path: "/",
            type: FILE_TYPE.DIRECTORY,
            children: [],
          },
          error: undefined,
        };
        const result = WorkspaceStructureSchema.safeParse(valid);
        expect(result.success).toBe(true);
      });

      it("should reject negative counts", () => {
        const invalid = {
          agentId: "agent_123",
          agentName: "jarvis",
          rootPath: "/path",
          totalFiles: -1,
          totalFolders: 0,
          totalSize: 0,
          lastUpdated: Date.now(),
        };
        const result = WorkspaceStructureSchema.safeParse(invalid);
        expect(result.success).toBe(false);
      });
    });

    describe("GetWorkspaceStructureSchema", () => {
      it("should validate request with defaults", () => {
        const valid = { agentId: "agent_123" };
        const result = GetWorkspaceStructureSchema.safeParse(valid);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.maxDepth).toBe(3);
          expect(result.data.includeHidden).toBe(false);
        }
      });

      it("should accept custom parameters", () => {
        const valid = {
          agentId: "agent_123",
          maxDepth: 5,
          includeHidden: true,
        };
        const result = GetWorkspaceStructureSchema.safeParse(valid);
        expect(result.success).toBe(true);
      });

      it("should reject missing agentId", () => {
        const invalid = { maxDepth: 5 };
        const result = GetWorkspaceStructureSchema.safeParse(invalid);
        expect(result.success).toBe(false);
      });
    });

    describe("GetWorkspaceFolderSchema", () => {
      it("should validate request with defaults", () => {
        const valid = { agentId: "agent_123" };
        const result = GetWorkspaceFolderSchema.safeParse(valid);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.folderPath).toBe(".");
          expect(result.data.sortBy).toBe("name");
          expect(result.data.order).toBe("asc");
        }
      });

      it("should accept custom parameters", () => {
        const valid = {
          agentId: "agent_123",
          folderPath: "docs",
          sortBy: "modified",
          order: "desc",
        };
        const result = GetWorkspaceFolderSchema.safeParse(valid);
        expect(result.success).toBe(true);
      });
    });
  });

  describe("validateWorkspaceInput", () => {
    it("should validate and return data", () => {
      const data = {
        agentId: "agent_123",
      };
      const result = validateWorkspaceInput(
        GetWorkspaceStructureSchema,
        data
      );
      expect(result.agentId).toBe("agent_123");
    });

    it("should throw on invalid data", () => {
      const data = { maxDepth: 5 }; // Missing required agentId
      expect(() => {
        validateWorkspaceInput(GetWorkspaceStructureSchema, data);
      }).toThrow();
    });

    it("should include field path in error message", () => {
      const data = { agentId: "" }; // Empty string not allowed
      try {
        validateWorkspaceInput(GetWorkspaceStructureSchema, data);
        fail("Should have thrown");
      } catch (err: any) {
        expect(err.message).toContain("agentId");
      }
    });
  });
});
