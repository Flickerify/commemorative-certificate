"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Play,
  Code,
  ChevronDown,
  ChevronRight,
  Copy,
  CheckCircle2,
  XCircle,
  GripVertical,
} from "lucide-react"

interface Condition {
  id: string
  field: string
  operator: string
  value: string
}

interface ConditionGroup {
  id: string
  logic: "and" | "or"
  conditions: (Condition | ConditionGroup)[]
}

interface Rule {
  id: string
  name: string
  description: string
  conditionGroup: ConditionGroup
  action: "allow" | "deny" | "warn"
  priority: number
}

const fieldOptions = [
  { value: "source.year", label: "Source: Year" },
  { value: "source.make", label: "Source: Make" },
  { value: "source.model", label: "Source: Model" },
  { value: "source.engine", label: "Source: Engine" },
  { value: "target.brand", label: "Target: Brand" },
  { value: "target.model", label: "Target: Model" },
  { value: "target.protocol", label: "Target: Protocol" },
  { value: "target.voltage", label: "Target: Voltage" },
]

const operatorOptions = [
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "not equals" },
  { value: "contains", label: "contains" },
  { value: "not_contains", label: "does not contain" },
  { value: "starts_with", label: "starts with" },
  { value: "ends_with", label: "ends with" },
  { value: "greater_than", label: "greater than" },
  { value: "less_than", label: "less than" },
  { value: "in", label: "is in list" },
  { value: "not_in", label: "is not in list" },
]

interface RuleBuilderProps {
  onClose: () => void
  rule?: Rule
  onSave?: (rule: Rule) => void
}

export function RuleBuilder({ onClose, rule, onSave }: RuleBuilderProps) {
  const [ruleName, setRuleName] = useState(rule?.name || "")
  const [ruleDescription, setRuleDescription] = useState(rule?.description || "")
  const [action, setAction] = useState<"allow" | "deny" | "warn">(rule?.action || "allow")
  const [priority, setPriority] = useState(rule?.priority || 1)
  const [conditionGroup, setConditionGroup] = useState<ConditionGroup>(
    rule?.conditionGroup || {
      id: "root",
      logic: "and",
      conditions: [{ id: "1", field: "source.year", operator: "equals", value: "" }],
    },
  )
  const [showJson, setShowJson] = useState(false)
  const [testData, setTestData] = useState(
    JSON.stringify(
      {
        source: { year: 2020, make: "Toyota", model: "Camry", engine: "2.5L" },
        target: { brand: "OBDLink", model: "MX+", protocol: "CAN", voltage: 12 },
      },
      null,
      2,
    ),
  )
  const [testResult, setTestResult] = useState<{ passed: boolean; message: string } | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["root"]))

  const toggleGroup = (id: string) => {
    const newExpanded = new Set(expandedGroups)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedGroups(newExpanded)
  }

  const addCondition = (groupId: string) => {
    const newCondition: Condition = {
      id: Date.now().toString(),
      field: "source.year",
      operator: "equals",
      value: "",
    }

    const updateGroup = (group: ConditionGroup): ConditionGroup => {
      if (group.id === groupId) {
        return { ...group, conditions: [...group.conditions, newCondition] }
      }
      return {
        ...group,
        conditions: group.conditions.map((c) => ("logic" in c ? updateGroup(c) : c)),
      }
    }

    setConditionGroup(updateGroup(conditionGroup))
  }

  const addNestedGroup = (parentGroupId: string) => {
    const newGroup: ConditionGroup = {
      id: Date.now().toString(),
      logic: "and",
      conditions: [{ id: Date.now().toString() + "-1", field: "source.year", operator: "equals", value: "" }],
    }

    const updateGroup = (group: ConditionGroup): ConditionGroup => {
      if (group.id === parentGroupId) {
        return { ...group, conditions: [...group.conditions, newGroup] }
      }
      return {
        ...group,
        conditions: group.conditions.map((c) => ("logic" in c ? updateGroup(c) : c)),
      }
    }

    setConditionGroup(updateGroup(conditionGroup))
    setExpandedGroups(new Set([...expandedGroups, newGroup.id]))
  }

  const updateCondition = (groupId: string, conditionId: string, updates: Partial<Condition>) => {
    const updateGroup = (group: ConditionGroup): ConditionGroup => {
      return {
        ...group,
        conditions: group.conditions.map((c) => {
          if ("logic" in c) {
            return updateGroup(c)
          }
          if (c.id === conditionId) {
            return { ...c, ...updates }
          }
          return c
        }),
      }
    }

    setConditionGroup(updateGroup(conditionGroup))
  }

  const deleteCondition = (conditionId: string) => {
    const updateGroup = (group: ConditionGroup): ConditionGroup => {
      return {
        ...group,
        conditions: group.conditions
          .filter((c) => {
            if ("logic" in c) return true
            return c.id !== conditionId
          })
          .map((c) => ("logic" in c ? updateGroup(c) : c)),
      }
    }

    setConditionGroup(updateGroup(conditionGroup))
  }

  const toggleGroupLogic = (groupId: string) => {
    const updateGroup = (group: ConditionGroup): ConditionGroup => {
      if (group.id === groupId) {
        return { ...group, logic: group.logic === "and" ? "or" : "and" }
      }
      return {
        ...group,
        conditions: group.conditions.map((c) => ("logic" in c ? updateGroup(c) : c)),
      }
    }

    setConditionGroup(updateGroup(conditionGroup))
  }

  const generateJsonLogic = (): object => {
    const buildCondition = (condition: Condition): object => {
      const field = { var: condition.field }
      switch (condition.operator) {
        case "equals":
          return { "==": [field, condition.value] }
        case "not_equals":
          return { "!=": [field, condition.value] }
        case "contains":
          return { in: [condition.value, field] }
        case "greater_than":
          return { ">": [field, Number(condition.value)] }
        case "less_than":
          return { "<": [field, Number(condition.value)] }
        default:
          return { "==": [field, condition.value] }
      }
    }

    const buildGroup = (group: ConditionGroup): object => {
      const conditions = group.conditions.map((c) => {
        if ("logic" in c) {
          return buildGroup(c)
        }
        return buildCondition(c)
      })

      return { [group.logic]: conditions }
    }

    return buildGroup(conditionGroup)
  }

  const runTest = () => {
    try {
      JSON.parse(testData)
      // Simulate rule evaluation
      const passed = Math.random() > 0.3
      setTestResult({
        passed,
        message: passed ? "Rule conditions matched successfully" : "Rule conditions did not match",
      })
    } catch {
      setTestResult({ passed: false, message: "Invalid JSON test data" })
    }
  }

  const handleSave = () => {
    if (onSave) {
      onSave({
        id: rule?.id || Date.now().toString(),
        name: ruleName,
        description: ruleDescription,
        conditionGroup,
        action,
        priority,
      })
    }
    onClose()
  }

  const renderConditionGroup = (group: ConditionGroup, depth = 0) => {
    const isExpanded = expandedGroups.has(group.id)

    return (
      <div
        key={group.id}
        className={`rounded-lg border border-border ${depth > 0 ? "ml-6 mt-2 bg-muted/30" : "bg-card"}`}
      >
        {/* Group Header */}
        <div className="flex items-center gap-2 p-3 border-b border-border">
          <button onClick={() => toggleGroup(group.id)} className="text-muted-foreground hover:text-foreground">
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>

          <button
            onClick={() => toggleGroupLogic(group.id)}
            className={`px-2 py-0.5 rounded text-xs font-semibold ${
              group.logic === "and" ? "bg-blue-500/10 text-blue-600" : "bg-orange-500/10 text-orange-600"
            }`}
          >
            {group.logic.toUpperCase()}
          </button>

          <span className="text-sm text-muted-foreground">
            {group.conditions.length} condition{group.conditions.length !== 1 ? "s" : ""}
          </span>

          <div className="flex-1" />

          <Button variant="ghost" size="sm" onClick={() => addCondition(group.id)} className="h-7 text-xs gap-1">
            <Plus className="h-3 w-3" />
            Condition
          </Button>
          <Button variant="ghost" size="sm" onClick={() => addNestedGroup(group.id)} className="h-7 text-xs gap-1">
            <Plus className="h-3 w-3" />
            Group
          </Button>
        </div>

        {/* Conditions */}
        {isExpanded && (
          <div className="p-3 space-y-2">
            {group.conditions.map((condition, index) => {
              if ("logic" in condition) {
                return renderConditionGroup(condition, depth + 1)
              }

              return (
                <div
                  key={condition.id}
                  className="flex items-center gap-2 p-2 rounded-md bg-background border border-border"
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />

                  <Select
                    value={condition.field}
                    onValueChange={(value) => updateCondition(group.id, condition.id, { field: value })}
                  >
                    <SelectTrigger className="w-40 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fieldOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={condition.operator}
                    onValueChange={(value) => updateCondition(group.id, condition.id, { operator: value })}
                  >
                    <SelectTrigger className="w-36 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {operatorOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    value={condition.value}
                    onChange={(e) => updateCondition(group.id, condition.id, { value: e.target.value })}
                    placeholder="Value"
                    className="flex-1 h-8"
                  />

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteCondition(condition.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )
            })}

            {group.conditions.length === 0 && (
              <div className="text-center py-4 text-sm text-muted-foreground">
                No conditions. Add one to get started.
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <Input
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              placeholder="Rule name"
              className="h-8 border-0 bg-transparent px-0 text-lg font-semibold focus-visible:ring-0"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowJson(!showJson)} className="gap-2">
            <Code className="h-4 w-4" />
            {showJson ? "Hide" : "Show"} JSON
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="gap-2">
            <Save className="h-4 w-4" />
            Save Rule
          </Button>
        </div>
      </div>

      <div className="flex h-[calc(100vh-57px)]">
        {/* Main Editor */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Description */}
            <div>
              <Label className="text-sm text-muted-foreground">Description</Label>
              <Input
                value={ruleDescription}
                onChange={(e) => setRuleDescription(e.target.value)}
                placeholder="Describe what this rule does…"
                className="mt-1"
              />
            </div>

            {/* Action & Priority */}
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label className="text-sm text-muted-foreground">Action</Label>
                <Select value={action} onValueChange={(value) => setAction(value as typeof action)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="allow">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-emerald-500" />
                        Allow
                      </div>
                    </SelectItem>
                    <SelectItem value="deny">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-red-500" />
                        Deny
                      </div>
                    </SelectItem>
                    <SelectItem value="warn">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-amber-500" />
                        Warn
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-32">
                <Label className="text-sm text-muted-foreground">Priority</Label>
                <Input
                  type="number"
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                  min={1}
                  max={100}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Conditions */}
            <div>
              <Label className="text-sm text-muted-foreground mb-2 block">Conditions</Label>
              {renderConditionGroup(conditionGroup)}
            </div>

            {/* JSON Output */}
            {showJson && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm text-muted-foreground">Generated JSONLogic</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => navigator.clipboard.writeText(JSON.stringify(generateJsonLogic(), null, 2))}
                  >
                    <Copy className="h-3 w-3" />
                    Copy
                  </Button>
                </div>
                <pre className="p-4 rounded-lg bg-muted text-sm font-mono overflow-x-auto">
                  {JSON.stringify(generateJsonLogic(), null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Test Panel */}
        <div className="w-96 border-l border-border bg-muted/30 overflow-y-auto">
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Test Rule</h3>
              <Button size="sm" onClick={runTest} className="gap-2">
                <Play className="h-4 w-4" />
                Run Test
              </Button>
            </div>

            <div>
              <Label className="text-sm text-muted-foreground">Sample Data</Label>
              <Textarea
                value={testData}
                onChange={(e) => setTestData(e.target.value)}
                className="mt-1 font-mono text-sm h-48"
              />
            </div>

            {testResult && (
              <div
                className={`p-4 rounded-lg flex items-start gap-3 ${
                  testResult.passed ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"
                }`}
              >
                {testResult.passed ? (
                  <CheckCircle2 className="h-5 w-5 mt-0.5" />
                ) : (
                  <XCircle className="h-5 w-5 mt-0.5" />
                )}
                <div>
                  <div className="font-medium">{testResult.passed ? "Test Passed" : "Test Failed"}</div>
                  <div className="text-sm opacity-80">{testResult.message}</div>
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-border">
              <h4 className="text-sm font-medium mb-2">Quick Test Scenarios</h4>
              <div className="space-y-2">
                {[
                  { label: "2020 Toyota Camry", data: { year: 2020, make: "Toyota", model: "Camry" } },
                  { label: "2019 Honda Civic", data: { year: 2019, make: "Honda", model: "Civic" } },
                  { label: "2021 Ford F-150", data: { year: 2021, make: "Ford", model: "F-150" } },
                ].map((scenario, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-xs bg-transparent"
                    onClick={() =>
                      setTestData(
                        JSON.stringify(
                          {
                            source: { ...scenario.data, engine: "2.5L" },
                            target: { brand: "OBDLink", model: "MX+", protocol: "CAN", voltage: 12 },
                          },
                          null,
                          2,
                        ),
                      )
                    }
                  >
                    {scenario.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

