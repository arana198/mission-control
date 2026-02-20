"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common } from "lowlight";
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Code2,
  LinkIcon,
  Quote,
  Minus,
} from "lucide-react";
import { useCallback, useEffect } from "react";

interface WikiEditorProps {
  content: string; // TipTap JSON string or empty string
  editable: boolean;
  onChange?: (json: string, text: string) => void;
  placeholder?: string;
}

/**
 * WikiEditor - TipTap rich text editor for wiki pages
 *
 * In edit mode: Shows full toolbar with formatting options
 * In view mode: Content-only, no toolbar (editable=false)
 */
export function WikiEditor({
  content,
  editable,
  onChange,
  placeholder = "Start typing...",
}: WikiEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false, // Disable default code block, use lowlight version
      }),
      Link.configure({
        openOnClick: false,
        protocols: ["http", "https", "mailto"],
        autolink: true,
      }),
      Placeholder.configure({
        placeholder,
      }),
      CodeBlockLowlight.configure({
        lowlight: common,
      }),
    ],
    content: content ? JSON.parse(content) : "<p></p>",
    editable,
  });

  // Update editor content when content prop changes (e.g., page switches)
  useEffect(() => {
    if (editor && content) {
      try {
        const parsed = JSON.parse(content);
        editor.commands.setContent(parsed);
      } catch {
        // Invalid JSON, keep current content
      }
    }
  }, [content, editor]);

  // Update editor editable state
  useEffect(() => {
    if (editor) {
      editor.setEditable(editable);
    }
  }, [editable, editor]);

  // Debounced onChange handler (1000ms debounce)
  const handleUpdate = useCallback(() => {
    if (editor && onChange) {
      const json = JSON.stringify(editor.getJSON());
      const text = editor.getText();
      onChange(json, text);
    }
  }, [editor, onChange]);

  // Set up debounce timeout
  useEffect(() => {
    if (!editor || !onChange) return;

    const timeout = setTimeout(handleUpdate, 1000);
    editor.on("update", () => {
      clearTimeout(timeout);
      setTimeout(handleUpdate, 1000);
    });

    return () => {
      clearTimeout(timeout);
    };
  }, [editor, handleUpdate, onChange]);

  if (!editor) {
    return <div className="min-h-[300px] p-4 text-muted-foreground">Loading editor...</div>;
  }

  return (
    <div className="wiki-editor border rounded-lg overflow-hidden bg-background">
      {/* Toolbar - Only show in edit mode */}
      {editable && (
        <div className="flex flex-wrap gap-1 border-b bg-muted/50 p-2 overflow-x-auto">
          <ToolbarButton
            icon={Bold}
            isActive={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Bold (Cmd+B)"
          />
          <ToolbarButton
            icon={Italic}
            isActive={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Italic (Cmd+I)"
          />
          <div className="w-px bg-border mx-1" />
          <ToolbarButton
            icon={Heading1}
            isActive={editor.isActive("heading", { level: 1 })}
            onClick={() => editor.chain().focus().setHeading({ level: 1 }).run()}
            title="Heading 1"
          />
          <ToolbarButton
            icon={Heading2}
            isActive={editor.isActive("heading", { level: 2 })}
            onClick={() => editor.chain().focus().setHeading({ level: 2 }).run()}
            title="Heading 2"
          />
          <ToolbarButton
            icon={Heading3}
            isActive={editor.isActive("heading", { level: 3 })}
            onClick={() => editor.chain().focus().setHeading({ level: 3 }).run()}
            title="Heading 3"
          />
          <div className="w-px bg-border mx-1" />
          <ToolbarButton
            icon={List}
            isActive={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title="Bullet list"
          />
          <ToolbarButton
            icon={ListOrdered}
            isActive={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title="Numbered list"
          />
          <ToolbarButton
            icon={Quote}
            isActive={editor.isActive("blockquote")}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            title="Blockquote"
          />
          <div className="w-px bg-border mx-1" />
          <ToolbarButton
            icon={Code2}
            isActive={editor.isActive("codeBlock")}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            title="Code block"
          />
          <ToolbarButton
            icon={LinkIcon}
            isActive={editor.isActive("link")}
            onClick={() => {
              const url = prompt("Enter URL:");
              if (url) {
                editor
                  .chain()
                  .focus()
                  .setLink({ href: url })
                  .run();
              }
            }}
            title="Insert link"
          />
          <ToolbarButton
            icon={Minus}
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title="Horizontal rule"
          />
        </div>
      )}

      {/* Content Area */}
      <EditorContent
        editor={editor}
        className={`prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[300px] p-4 ${
          editable ? "bg-background" : "bg-muted/20"
        }`}
      />
    </div>
  );
}

interface ToolbarButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  isActive?: boolean;
  onClick: () => void;
  title: string;
}

function ToolbarButton({ icon: Icon, isActive, onClick, title }: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-1.5 md:p-1 rounded transition-colors flex-shrink-0 ${
        isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground"
      }`}
    >
      <Icon className="w-5 md:w-4 h-5 md:h-4" />
    </button>
  );
}
