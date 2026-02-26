import { NextRequest, NextResponse } from "next/server";
import { join, relative } from "path";
import { readdirSync, existsSync, statSync } from "fs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * GET /api/agents/workspace/structure
 * Get agent workspace folder structure
 *
 * Query params:
 * - agentId: Agent ID (required)
 * - maxDepth: Maximum directory depth (default: 3)
 * - includeHidden: Include hidden files (default: false)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const agentId = searchParams.get("agentId");
    const maxDepth = parseInt(searchParams.get("maxDepth") || "3");
    const includeHidden = searchParams.get("includeHidden") === "true";

    if (!agentId) {
      return NextResponse.json(
        { error: "agentId query parameter is required" },
        { status: 400 }
      );
    }

    // Validate inputs
    if (maxDepth < 1 || maxDepth > 10) {
      return NextResponse.json(
        { error: "maxDepth must be between 1 and 10" },
        { status: 400 }
      );
    }

    // Fetch agent to get workspace path
    const agent = await convex.query(api.agents.getAgentById, {
      agentId: agentId as any,
    });

    if (!agent) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404 }
      );
    }

    if (!agent.workspacePath) {
      return NextResponse.json(
        {
          agentName: agent.name,
          rootPath: "",
          totalFiles: 0,
          totalFolders: 0,
          totalSize: 0,
          lastUpdated: Date.now(),
          error: "Agent workspace path not configured",
        },
        { status: 200 }
      );
    }

    const workspacePath = agent.workspacePath;

    // Check if workspace exists
    if (!existsSync(workspacePath)) {
      return NextResponse.json(
        {
          agentName: agent.name,
          rootPath: workspacePath,
          totalFiles: 0,
          totalFolders: 0,
          totalSize: 0,
          lastUpdated: Date.now(),
          error: "Workspace folder not found",
        },
        { status: 200 }
      );
    }

    // Recursively build file tree
    const buildTree = (
      dir: string,
      depth: number
    ): {
      tree: any;
      stats: { files: number; folders: number; size: number };
    } => {
      const stats = { files: 0, folders: 0, size: 0 };

      if (depth >= maxDepth) {
        return { tree: null, stats };
      }

      try {
        const entries = readdirSync(dir, { withFileTypes: true });
        const children: any[] = [];

        for (const entry of entries) {
          // Skip hidden files if requested
          if (!includeHidden && entry.name.startsWith(".")) {
            continue;
          }

          const fullPath = join(dir, entry.name);
          const relPath = fullPath.replace(workspacePath, "");

          try {
            const statInfo = statSync(fullPath);
            const fileInfo = {
              name: entry.name,
              path: relPath,
              type: entry.isDirectory()
                ? "directory"
                : entry.isSymbolicLink()
                ? "symlink"
                : "file",
              size: entry.isDirectory() ? undefined : statInfo.size,
              modified: statInfo.mtimeMs,
              extension: entry.isDirectory()
                ? undefined
                : entry.name.substring(entry.name.lastIndexOf(".")),
              isHidden: entry.name.startsWith("."),
            };

            if (entry.isDirectory()) {
              stats.folders++;
              const { tree: subTree, stats: subStats } = buildTree(
                fullPath,
                depth + 1
              );
              children.push({
                ...fileInfo,
                children: subTree?.children || [],
                fileCount: subStats.files,
                folderCount: subStats.folders,
              });
              stats.files += subStats.files;
              stats.folders += subStats.folders;
              stats.size += subStats.size;
            } else {
              stats.files++;
              stats.size += statInfo.size;
              children.push(fileInfo);
            }
          } catch (err) {
            // Skip files we can't read
            console.warn(`Cannot read ${fullPath}:`, err);
          }
        }

        // Sort: directories first, then by name
        children.sort((a, b) => {
          if (a.type === "directory" && b.type !== "directory") return -1;
          if (a.type !== "directory" && b.type === "directory") return 1;
          return a.name.localeCompare(b.name);
        });

        return {
          tree: {
            name: agent.name,
            path: "/",
            type: "directory",
            children,
            fileCount: stats.files,
            folderCount: stats.folders,
          },
          stats,
        };
      } catch (err) {
        console.warn(`Cannot read directory ${dir}:`, err);
        return { tree: null, stats };
      }
    };

    const { tree, stats } = buildTree(workspacePath, 0);

    return NextResponse.json({
      agentName: agent.name,
      rootPath: workspacePath,
      totalFiles: stats.files,
      totalFolders: stats.folders,
      totalSize: stats.size,
      tree,
      lastUpdated: Date.now(),
    });
  } catch (error) {
    console.error("Error reading workspace structure:", error);
    return NextResponse.json(
      {
        error: `Error reading workspace: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 }
    );
  }
}
