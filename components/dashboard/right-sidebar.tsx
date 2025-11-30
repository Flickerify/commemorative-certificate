"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  X,
  CheckCircle2,
  Circle,
  Rocket,
  BookOpen,
  Database,
  Zap,
  Bell,
  Clock,
  AlertTriangle,
  TrendingUp,
  ExternalLink,
  GitBranch,
} from "lucide-react"
import type { SpaceType } from "./dashboard"

interface RightSidebarProps {
  isOpen: boolean
  onClose: () => void
  activeSpace: SpaceType
}

const gettingStartedSteps = [
  { id: 1, label: "Define a data schema", completed: true, icon: Database },
  { id: 2, label: "Import source data", completed: true, icon: Zap },
  { id: 3, label: "Create compatibility rules", completed: false, icon: GitBranch },
  { id: 4, label: "Publish your first match", completed: false, icon: Rocket },
]

const notifications = [
  {
    title: "Import completed",
    description: "Vehicle Database synced 12,450 records",
    type: "success",
    time: "2m ago",
  },
  {
    title: "Rule needs review",
    description: "Legacy Support rule accuracy dropped to 89%",
    type: "warning",
    time: "1h ago",
  },
  {
    title: "Publish scheduled",
    description: "Production deploy in 2 hours",
    type: "info",
    time: "3h ago",
  },
]

export function RightSidebar({ isOpen, onClose, activeSpace }: RightSidebarProps) {
  const completedSteps = gettingStartedSteps.filter((s) => s.completed).length
  const progressPercentage = (completedSteps / gettingStartedSteps.length) * 100

  return (
    <>
      {/* Overlay for click-outside-to-close */}
      {isOpen && <div className="fixed inset-0 z-40 bg-black/50 md:bg-transparent" onClick={onClose} />}

      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-80 flex-col border-l border-sidebar-border bg-sidebar transition-transform duration-300",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Header */}
        <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
          <h2 className="font-semibold text-sidebar-foreground">Activity</h2>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-sidebar-accent"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-sm flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Notifications
              </h3>
              <Button variant="ghost" size="sm" className="text-xs h-7">
                Mark all read
              </Button>
            </div>
            <div className="space-y-2">
              {notifications.map((notification, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-sidebar-border bg-card p-3 hover:bg-sidebar-accent/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-start gap-2">
                    {notification.type === "warning" && (
                      <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                    )}
                    {notification.type === "info" && <Clock className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />}
                    {notification.type === "success" && (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{notification.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{notification.description}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{notification.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Getting Started */}
          <div className="rounded-xl border border-sidebar-border bg-card p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-sm">Getting Started</h3>
              <span className="text-xs text-sidebar-muted">
                {completedSteps}/{gettingStartedSteps.length} complete
              </span>
            </div>
            <Progress value={progressPercentage} className="h-1.5 mb-4" />

            <div className="space-y-3">
              {gettingStartedSteps.map((step) => (
                <div key={step.id} className="flex items-center gap-3 text-sm">
                  {step.completed ? (
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-sidebar-muted shrink-0" />
                  )}
                  <span className={cn("truncate", step.completed && "text-sidebar-muted line-through")}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <h3 className="font-medium text-sm mb-3">Quick Stats</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-sidebar-border bg-card p-3 text-center">
                <p className="text-2xl font-semibold text-primary">12.4K</p>
                <p className="text-xs text-muted-foreground">Total Matches</p>
              </div>
              <div className="rounded-lg border border-sidebar-border bg-card p-3 text-center">
                <p className="text-2xl font-semibold text-emerald-600">97.2%</p>
                <p className="text-xs text-muted-foreground">Accuracy</p>
              </div>
            </div>
          </div>

          {/* Resources */}
          <div>
            <h3 className="font-medium text-sm mb-3">Resources</h3>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start gap-2 bg-transparent" size="sm">
                <BookOpen className="h-4 w-4" />
                Documentation
                <ExternalLink className="h-3 w-3 ml-auto" />
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2 bg-transparent" size="sm">
                <Rocket className="h-4 w-4" />
                API Reference
                <ExternalLink className="h-3 w-3 ml-auto" />
              </Button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-sidebar-border p-4">
          <div className="rounded-xl bg-primary/5 p-4 text-center">
            <TrendingUp className="h-8 w-8 mx-auto mb-2 text-primary" />
            <h4 className="font-medium text-sm mb-1">Upgrade to Enterprise</h4>
            <p className="text-xs text-muted-foreground mb-3">
              Unlimited records, advanced analytics, and priority support.
            </p>
            <Button size="sm" className="w-full">
              View Plans
            </Button>
          </div>
        </div>
      </aside>
    </>
  )
}

