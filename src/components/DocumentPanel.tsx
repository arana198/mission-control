"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useBusiness } from "./BusinessProvider";
import { GlassCard } from "./ui/GlassCard";
import {
  FileText, Plus, Search, Clock, FileCode,
  BookOpen, ScrollText, FileSearch, X, ChevronLeft,
  Save, Trash2, Loader2
} from "lucide-react";

const DOC_TYPE_ICONS = {
  deliverable: FileText,
  research: FileSearch,
  protocol: ScrollText,
  spec: FileCode,
  draft: BookOpen,
  receipt: Clock,
};

const DOC_TYPE_COLORS = {
  deliverable: "text-success bg-success/10",
  research: "text-primary bg-primary/10",
  protocol: "text-warning bg-warning/10",
  spec: "text-accent bg-accent/10",
  draft: "text-muted-foreground bg-muted/10",
  receipt: "text-destructive bg-destructive/10",
};

export function DocumentPanel() {
  const { currentBusiness } = useBusiness();
  const documents = currentBusiness ? useQuery(api.documents.getAll, { businessId: currentBusiness._id as any, limit: 50 }) : null;
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [viewingDoc, setViewingDoc] = useState<any>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Create mutation
  let createDoc: any;
  let updateDoc: any;
  try {
    createDoc = useMutation(api.documents.create);
    updateDoc = useMutation(api.documents.update);
  } catch (e) {
    // Convex not available
  }

  // New doc form
  const [newDoc, setNewDoc] = useState<{
    title: string;
    content: string;
    type: keyof typeof DOC_TYPE_ICONS;
  }>({
    title: "",
    content: "",
    type: "draft",
  });

  if (!currentBusiness || documents === undefined) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    );
  }

  // Filter documents
  const filteredDocs = (documents || []).filter((doc) => {
    const matchesSearch =
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType ? doc.type === selectedType : true;
    return matchesSearch && matchesType;
  });

  // View single document
  if (viewingDoc) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => { setViewingDoc(null); setIsEditing(false); }}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            Back to documents
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="px-3 py-1.5 text-sm bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors flex items-center gap-2"
            >
              {isEditing ? "Cancel" : "Edit"}
            </button>
          </div>
        </div>

        <GlassCard className="p-6">
          {isEditing ? (
            <div className="space-y-4">
              <input
                type="text"
                value={viewingDoc.title}
                onChange={(e) => setViewingDoc({ ...viewingDoc, title: e.target.value })}
                className="w-full px-4 py-3 bg-muted/50 border border-border rounded-xl text-foreground text-xl font-semibold focus:outline-none focus:border-primary"
              />
              <textarea
                value={viewingDoc.content}
                onChange={(e) => setViewingDoc({ ...viewingDoc, content: e.target.value })}
                className="w-full h-96 px-4 py-3 bg-muted/50 border border-border rounded-xl text-foreground font-mono text-sm focus:outline-none focus:border-primary resize-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!updateDoc) return;
                    await updateDoc({
                      id: viewingDoc._id,
                      title: viewingDoc.title,
                      content: viewingDoc.content,
                      updatedBy: "user",
                    });
                    setIsEditing(false);
                  }}
                  className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save Changes
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-2xl font-bold text-foreground mb-2">{viewingDoc.title}</h1>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className={`px-2 py-1 rounded-md text-xs font-medium ${DOC_TYPE_COLORS[viewingDoc.type as keyof typeof DOC_TYPE_COLORS]}`}>
                      {viewingDoc.type}
                    </span>
                    <span>Created by {viewingDoc.createdByName}</span>
                    <span>•</span>
                    <span>v{viewingDoc.version}</span>
                    <span>•</span>
                    <span>{new Date(viewingDoc.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              <div className="prose prose-invert prose-slate max-w-none">
                <pre className="whitespace-pre-wrap text-foreground font-mono text-sm leading-relaxed bg-muted/30 p-4 rounded-lg">
                  {viewingDoc.content}
                </pre>
              </div>
            </>
          )}
        </GlassCard>
      </div>
    );
  }

  // Create new document
  if (isCreating) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setIsCreating(false)}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            Back to documents
          </button>
        </div>

        <GlassCard className="p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">Create New Document</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Title</label>
              <input
                type="text"
                value={newDoc.title}
                onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })}
                placeholder="Document title..."
                className="w-full px-4 py-3 bg-muted/50 border border-border rounded-xl text-foreground focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Type</label>
              <div className="flex flex-wrap gap-2">
                {Object.keys(DOC_TYPE_ICONS).map((type) => {
                  const Icon = DOC_TYPE_ICONS[type as keyof typeof DOC_TYPE_ICONS];
                  return (
                    <button
                      key={type}
                      onClick={() => setNewDoc({ ...newDoc, type: type as keyof typeof DOC_TYPE_ICONS })}
                      className={`px-3 py-2 rounded-lg text-sm capitalize transition-colors flex items-center gap-2 ${
                        newDoc.type === type
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {type}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Content</label>
              <textarea
                value={newDoc.content}
                onChange={(e) => setNewDoc({ ...newDoc, content: e.target.value })}
                placeholder="Write your document content here... (Markdown supported)"
                className="w-full h-64 px-4 py-3 bg-muted/50 border border-border rounded-xl text-foreground font-mono text-sm focus:outline-none focus:border-primary resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-border">
              <button
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!createDoc || !newDoc.title.trim()) return;
                  await createDoc({
                    title: newDoc.title,
                    content: newDoc.content,
                    type: newDoc.type,
                    createdBy: "user",
                    createdByName: "Boss",
                  });
                  setIsCreating(false);
                  setNewDoc({ title: "", content: "", type: "draft" });
                }}
                disabled={!newDoc.title.trim()}
                className="px-4 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground rounded-lg flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Create Document
              </button>
            </div>
          </div>
        </GlassCard>
      </div>
    );
  }

  // Document list view
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">Documents</h2>
        <button
          onClick={() => setIsCreating(true)}
          className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Document
        </button>
      </div>

      {/* Search and filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents..."
            className="w-full pl-10 pr-4 py-2.5 bg-muted/50 border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-primary"
          />
        </div>

        <select
          value={selectedType || ""}
          onChange={(e) => setSelectedType(e.target.value || null)}
          className="px-3 py-2.5 bg-muted/50 border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-primary"
        >
          <option value="">All types</option>
          <option value="deliverable">Deliverable</option>
          <option value="research">Research</option>
          <option value="protocol">Protocol</option>
          <option value="spec">Spec</option>
          <option value="draft">Draft</option>
        </select>
      </div>

      {/* Document grid */}
      {filteredDocs.length === 0 ? (
        <GlassCard className="p-8 text-center">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            {searchQuery || selectedType
              ? "No documents match your filters"
              : "No documents yet. Create your first document to get started."}
          </p>
        </GlassCard>
      ) : (
        <div className="grid gap-3">
          {filteredDocs.map((doc) => {
            const Icon = DOC_TYPE_ICONS[doc.type];
            return (
              <button
                key={doc._id}
                onClick={() => setViewingDoc(doc)}
                className="w-full text-left p-4 bg-muted/40 hover:bg-muted/60 border border-border hover:border-border-strong rounded-xl transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${DOC_TYPE_COLORS[doc.type]}`}>
                    <Icon className="w-5 h-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-foreground group-hover:text-primary transition-colors truncate">
                      {doc.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {doc.content.slice(0, 150)}{doc.content.length > 150 ? "..." : ""}
                    </p>

                    <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                      <span className="capitalize">{doc.type}</span>
                      <span>•</span>
                      <span>{doc.createdByName}</span>
                      <span>•</span>
                      <span>v{doc.version}</span>
                      <span>•</span>
                      <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <ChevronLeft className="w-5 h-5 text-muted-foreground rotate-180 group-hover:text-foreground transition-colors" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
