"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  ArrowLeft,
  GitBranch,
  GitCommit,
  Clock,
  User,
  Eye,
  RotateCcw,
  ChevronRight,
  Plus,
  Minus,
  FileCode,
  CheckCircle2,
} from "lucide-react"

interface Revision {
  id: string
  version: string
  createdAt: string
  author: {
    name: string
    avatar?: string
  }
  message: string
  changes: {
    added: number
    modified: number
    removed: number
  }
  isPublished: boolean
  isCurrent: boolean
}

interface RevisionHistoryProps {
  onClose: () => void
  onRestore?: (revisionId: string) => void
}

const mockRevisions: Revision[] = [
  {
    id: "1",
    version: "v2.4.0",
    createdAt: "2 hours ago",
    author: { name: "Sarah Chen", avatar: "/placeholder.svg?height=32&width=32" },
    message: "Updated compatibility rules for 2024 vehicles",
    changes: { added: 12, modified: 5, removed: 2 },
    isPublished: true,
    isCurrent: true,
  },
  {
    id: "2",
    version: "v2.3.0",
    createdAt: "1 day ago",
    author: { name: "Mike Johnson", avatar: "/placeholder.svg?height=32&width=32" },
    message: "Added support for new OBD protocols",
    changes: { added: 8, modified: 15, removed: 0 },
    isPublished: true,
    isCurrent: false,
  },
  {
    id: "3",
    version: "v2.2.0",
    createdAt: "3 days ago",
    author: { name: "Emily Davis" },
    message: "Fixed validation errors for hybrid vehicles",
    changes: { added: 3, modified: 7, removed: 1 },
    isPublished: true,
    isCurrent: false,
  },
  {
    id: "4",
    version: "v2.1.0",
    createdAt: "1 week ago",
    author: { name: "Alex Turner", avatar: "/placeholder.svg?height=32&width=32" },
    message: "Initial schema setup for vehicle database",
    changes: { added: 45, modified: 0, removed: 0 },
    isPublished: true,
    isCurrent: false,
  },
]

export function RevisionHistory({ onClose, onRestore }: RevisionHistoryProps) {
  const [selectedRevision, setSelectedRevision] = useState<Revision | null>(null)
  const [compareMode, setCompareMode] = useState(false)
  const [compareRevisions, setCompareRevisions] = useState<[string | null, string | null]>([null, null])

  const handleCompareSelect = (revisionId: string) => {
    if (compareRevisions[0] === null) {
      setCompareRevisions([revisionId, null])
    } else if (compareRevisions[1] === null && compareRevisions[0] !== revisionId) {
      setCompareRevisions([compareRevisions[0], revisionId])
    } else {
      setCompareRevisions([revisionId, null])
    }
  }

  const handleRestore = (revisionId: string) => {
    if (onRestore) {
      onRestore(revisionId)
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-lg font-semibold">Revision History</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={compareMode ? "default" : "outline"}
            onClick={() => {
              setCompareMode(!compareMode)
              setCompareRevisions([null, null])
            }}
            className="gap-2"
          >
            <Eye className="h-4 w-4" />
            {compareMode ? "Exit Compare" : "Compare Versions"}
          </Button>
        </div>
      </div>

      <div className="flex h-[calc(100vh-57px)]">
        {/* Revision List */}
        <div className="w-96 border-r border-border overflow-y-auto">
          <div className="p-4">
            <div className="text-sm text-muted-foreground mb-4">{mockRevisions.length} revisions</div>
            <div className="space-y-2">
              {mockRevisions.map((revision) => (
                <div
                  key={revision.id}
                  onClick={() => !compareMode && setSelectedRevision(revision)}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedRevision?.id === revision.id
                      ? "border-primary bg-primary/5"
                      : compareRevisions.includes(revision.id)
                        ? "border-blue-500 bg-blue-500/5"
                        : "border-border hover:bg-accent/50"
                  }`}
                >
                  {compareMode && (
                    <div className="mb-2">
                      <Button
                        variant={compareRevisions.includes(revision.id) ? "default" : "outline"}
                        size="sm"
                        className="w-full text-xs"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleCompareSelect(revision.id)
                        }}
                      >
                        {compareRevisions[0] === revision.id
                          ? "Selected as Base"
                          : compareRevisions[1] === revision.id
                            ? "Selected to Compare"
                            : "Select for Compare"}
                      </Button>
                    </div>
                  )}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <GitCommit className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono text-sm font-medium">{revision.version}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {revision.isCurrent && (
                        <Badge variant="default" className="text-xs">
                          Current
                        </Badge>
                      )}
                      {revision.isPublished && !revision.isCurrent && (
                        <Badge variant="secondary" className="text-xs">
                          Published
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-sm mb-2 line-clamp-2">{revision.message}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Avatar className="h-4 w-4">
                        <AvatarImage src={revision.author.avatar || "/placeholder.svg"} />
                        <AvatarFallback className="text-[8px]">
                          {revision.author.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <span>{revision.author.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{revision.createdAt}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs">
                    <span className="text-emerald-500 flex items-center gap-1">
                      <Plus className="h-3 w-3" />
                      {revision.changes.added}
                    </span>
                    <span className="text-amber-500 flex items-center gap-1">
                      <FileCode className="h-3 w-3" />
                      {revision.changes.modified}
                    </span>
                    <span className="text-red-500 flex items-center gap-1">
                      <Minus className="h-3 w-3" />
                      {revision.changes.removed}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Detail View */}
        <div className="flex-1 overflow-y-auto">
          {compareMode && compareRevisions[0] && compareRevisions[1] ? (
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4">
                Comparing {mockRevisions.find((r) => r.id === compareRevisions[0])?.version} →{" "}
                {mockRevisions.find((r) => r.id === compareRevisions[1])?.version}
              </h2>
              <div className="rounded-lg border border-border divide-y divide-border">
                {/* Mock diff view */}
                <div className="p-4 bg-emerald-500/5">
                  <div className="flex items-center gap-2 text-emerald-600 mb-2">
                    <Plus className="h-4 w-4" />
                    <span className="font-medium">Added</span>
                  </div>
                  <div className="font-mono text-sm space-y-1">
                    <div className="bg-emerald-500/10 px-2 py-1 rounded">+ rule: &quot;2024_vehicle_support&quot;</div>
                    <div className="bg-emerald-500/10 px-2 py-1 rounded">+ condition: year {">"}= 2024</div>
                  </div>
                </div>
                <div className="p-4 bg-amber-500/5">
                  <div className="flex items-center gap-2 text-amber-600 mb-2">
                    <FileCode className="h-4 w-4" />
                    <span className="font-medium">Modified</span>
                  </div>
                  <div className="font-mono text-sm space-y-1">
                    <div className="bg-red-500/10 px-2 py-1 rounded text-red-600">
                      - protocol: [&quot;CAN&quot;, &quot;OBD2&quot;]
                    </div>
                    <div className="bg-emerald-500/10 px-2 py-1 rounded text-emerald-600">
                      + protocol: [&quot;CAN&quot;, &quot;OBD2&quot;, &quot;CAN-FD&quot;]
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-red-500/5">
                  <div className="flex items-center gap-2 text-red-600 mb-2">
                    <Minus className="h-4 w-4" />
                    <span className="font-medium">Removed</span>
                  </div>
                  <div className="font-mono text-sm">
                    <div className="bg-red-500/10 px-2 py-1 rounded">- deprecated_rule: &quot;legacy_support&quot;</div>
                  </div>
                </div>
              </div>
            </div>
          ) : selectedRevision ? (
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-xl font-semibold">{selectedRevision.version}</h2>
                    {selectedRevision.isCurrent && <Badge>Current</Badge>}
                  </div>
                  <p className="text-muted-foreground">{selectedRevision.message}</p>
                </div>
                {!selectedRevision.isCurrent && (
                  <Button onClick={() => handleRestore(selectedRevision.id)} className="gap-2">
                    <RotateCcw className="h-4 w-4" />
                    Restore This Version
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="rounded-lg border border-border p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <User className="h-4 w-4" />
                    <span className="text-sm">Author</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={selectedRevision.author.avatar || "/placeholder.svg"} />
                      <AvatarFallback className="text-xs">
                        {selectedRevision.author.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{selectedRevision.author.name}</span>
                  </div>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm">Created</span>
                  </div>
                  <span className="font-medium">{selectedRevision.createdAt}</span>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm">Status</span>
                  </div>
                  <span className="font-medium">{selectedRevision.isPublished ? "Published" : "Draft"}</span>
                </div>
              </div>

              <div className="rounded-lg border border-border">
                <div className="p-3 border-b border-border bg-muted/50">
                  <span className="font-medium">Changes in this revision</span>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/5">
                    <div className="flex items-center gap-2">
                      <Plus className="h-4 w-4 text-emerald-500" />
                      <span>{selectedRevision.changes.added} rules added</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/5">
                    <div className="flex items-center gap-2">
                      <FileCode className="h-4 w-4 text-amber-500" />
                      <span>{selectedRevision.changes.modified} rules modified</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/5">
                    <div className="flex items-center gap-2">
                      <Minus className="h-4 w-4 text-red-500" />
                      <span>{selectedRevision.changes.removed} rules removed</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <GitBranch className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a revision to view details</p>
                <p className="text-sm mt-1">or enable compare mode to diff versions</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

