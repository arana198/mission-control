/**
 * Agent Workspace Validators
 * Zod schemas for agent workspace operations
 * Validates file paths, structures, and metadata
 */

import { z } from "zod";

/**
 * File type enumeration
 */
export const FILE_TYPE = {
  FILE: "file",
  DIRECTORY: "directory",
  SYMLINK: "symlink",
} as const;

export type FileType = typeof FILE_TYPE[keyof typeof FILE_TYPE];

/**
 * Single file/folder metadata
 */
export const FileMetadataSchema = z.object({
  name: z.string().min(1, "File name required"),
  path: z.string().min(1, "File path required"),
  type: z.enum([FILE_TYPE.FILE, FILE_TYPE.DIRECTORY, FILE_TYPE.SYMLINK]),
  size: z.number().nonnegative("File size must be non-negative").optional(),
  modified: z.number().nonnegative("Modified time must be positive").optional(),
  extension: z.string().optional(), // e.g., ".txt", ".json"
  isHidden: z.boolean().optional(),
});

export type FileMetadata = z.infer<typeof FileMetadataSchema>;

/**
 * Folder/directory with recursive children
 */
export const DirectoryTreeSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    name: z.string(),
    path: z.string(),
    type: z.literal(FILE_TYPE.DIRECTORY),
    size: z.number().optional(),
    modified: z.number().optional(),
    isHidden: z.boolean().optional(),
    children: z.array(
      z.union([
        FileMetadataSchema,
        DirectoryTreeSchema,
      ])
    ).optional(),
    fileCount: z.number().nonnegative().optional(),
    folderCount: z.number().nonnegative().optional(),
  })
);

export type DirectoryTree = z.infer<typeof DirectoryTreeSchema>;

/**
 * Workspace structure response
 */
export const WorkspaceStructureSchema = z.object({
  agentId: z.string(),
  agentName: z.string(),
  rootPath: z.string(),
  totalFiles: z.number().nonnegative(),
  totalFolders: z.number().nonnegative(),
  totalSize: z.number().nonnegative(),
  tree: DirectoryTreeSchema.optional(),
  lastUpdated: z.number(),
  error: z.string().optional(),
});

export type WorkspaceStructure = z.infer<typeof WorkspaceStructureSchema>;

/**
 * Request to get workspace structure
 */
export const GetWorkspaceStructureSchema = z.object({
  agentId: z.string().min(1, "Agent ID required"),
  maxDepth: z.number().nonnegative().default(3).optional(),
  includeHidden: z.boolean().default(false).optional(),
  filter: z.enum(["all", "files", "directories"]).default("all").optional(),
});

export type GetWorkspaceStructureInput = z.infer<typeof GetWorkspaceStructureSchema>;

/**
 * Request to get files in a specific folder
 */
export const GetWorkspaceFolderSchema = z.object({
  agentId: z.string().min(1, "Agent ID required"),
  folderPath: z.string().default(".").optional(),
  sortBy: z.enum(["name", "modified", "size"]).default("name").optional(),
  order: z.enum(["asc", "desc"]).default("asc").optional(),
});

export type GetWorkspaceFolderInput = z.infer<typeof GetWorkspaceFolderSchema>;

/**
 * Workspace file list response
 */
export const WorkspaceFileListSchema = z.object({
  agentId: z.string(),
  agentName: z.string(),
  folderPath: z.string(),
  files: z.array(FileMetadataSchema),
  folderSize: z.number().nonnegative().optional(),
  lastUpdated: z.number(),
  canGoUp: z.boolean(), // Can navigate to parent folder
});

export type WorkspaceFileList = z.infer<typeof WorkspaceFileListSchema>;

/**
 * Validation helper
 */
export function validateWorkspaceInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T {
  const result = schema.safeParse(data);

  if (!result.success) {
    throw new Error(
      `Invalid workspace input: ${result.error.issues
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join(", ")}`
    );
  }

  return result.data;
}

/**
 * Safe file path validation (prevent directory traversal attacks)
 */
export function isSafeFilePath(path: string): boolean {
  // Reject paths with ../ or .\
  if (path.includes("..") || path.includes("\\..")) {
    return false;
  }

  // Reject absolute paths
  if (path.startsWith("/") || (path.length > 1 && path[1] === ":")) {
    return false;
  }

  return true;
}

/**
 * Parse file extension
 */
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot <= 0) return "";
  return filename.substring(lastDot);
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Get file type icon
 */
export function getFileIcon(filename: string, type: FileType): string {
  if (type === FILE_TYPE.DIRECTORY) return "📁";
  if (type === FILE_TYPE.SYMLINK) return "🔗";

  const ext = getFileExtension(filename).toLowerCase();

  const iconMap: Record<string, string> = {
    ".json": "📄",
    ".js": "🟨",
    ".ts": "🟦",
    ".tsx": "⚛️",
    ".py": "🐍",
    ".md": "📝",
    ".txt": "📄",
    ".pdf": "📕",
    ".png": "🖼️",
    ".jpg": "🖼️",
    ".jpeg": "🖼️",
    ".gif": "🎬",
    ".zip": "📦",
    ".tar": "📦",
    ".gz": "📦",
    ".sh": "⚙️",
    ".yaml": "⚙️",
    ".yml": "⚙️",
    ".xml": "🏷️",
    ".html": "🌐",
    ".css": "🎨",
  };

  return iconMap[ext] || "📄";
}
