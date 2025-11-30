"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  X,
  Plus,
  GripVertical,
  MoreVertical,
  Trash2,
  Copy,
  Eye,
  Key,
  Link2,
  Type,
  Hash,
  Calendar,
  ToggleLeft,
  List,
  FileJson,
  Save,
  ArrowLeft,
} from "lucide-react"

interface SchemaColumn {
  id: string
  name: string
  type: "string" | "number" | "boolean" | "date" | "enum" | "json" | "reference"
  required: boolean
  unique: boolean
  isPrimaryKey: boolean
  isForeignKey: boolean
  foreignKeyRef?: string
  enumValues?: string[]
  defaultValue?: string
  description?: string
}

interface Schema {
  id: string
  name: string
  description: string
  columns: SchemaColumn[]
}

interface SchemaBuilderProps {
  onClose: () => void
  schema?: Schema
  onSave?: (schema: Schema) => void
}

const typeIcons: Record<string, typeof Type> = {
  string: Type,
  number: Hash,
  boolean: ToggleLeft,
  date: Calendar,
  enum: List,
  json: FileJson,
  reference: Link2,
}

const typeColors: Record<string, string> = {
  string: "bg-blue-500/10 text-blue-600",
  number: "bg-emerald-500/10 text-emerald-600",
  boolean: "bg-amber-500/10 text-amber-600",
  date: "bg-violet-500/10 text-violet-600",
  enum: "bg-pink-500/10 text-pink-600",
  json: "bg-orange-500/10 text-orange-600",
  reference: "bg-cyan-500/10 text-cyan-600",
}

export function SchemaBuilder({ onClose, schema, onSave }: SchemaBuilderProps) {
  const [schemaName, setSchemaName] = useState(schema?.name || "")
  const [schemaDescription, setSchemaDescription] = useState(schema?.description || "")
  const [columns, setColumns] = useState<SchemaColumn[]>(
    schema?.columns || [
      { id: "1", name: "id", type: "string", required: true, unique: true, isPrimaryKey: true, isForeignKey: false },
    ],
  )
  const [selectedColumn, setSelectedColumn] = useState<SchemaColumn | null>(null)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  const addColumn = () => {
    const newColumn: SchemaColumn = {
      id: Date.now().toString(),
      name: `column_${columns.length + 1}`,
      type: "string",
      required: false,
      unique: false,
      isPrimaryKey: false,
      isForeignKey: false,
    }
    setColumns([...columns, newColumn])
    setSelectedColumn(newColumn)
  }

  const updateColumn = (id: string, updates: Partial<SchemaColumn>) => {
    setColumns(columns.map((col) => (col.id === id ? { ...col, ...updates } : col)))
    if (selectedColumn?.id === id) {
      setSelectedColumn({ ...selectedColumn, ...updates })
    }
  }

  const deleteColumn = (id: string) => {
    setColumns(columns.filter((col) => col.id !== id))
    if (selectedColumn?.id === id) {
      setSelectedColumn(null)
    }
  }

  const duplicateColumn = (column: SchemaColumn) => {
    const newColumn: SchemaColumn = {
      ...column,
      id: Date.now().toString(),
      name: `${column.name}_copy`,
      isPrimaryKey: false,
    }
    setColumns([...columns, newColumn])
  }

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return

    const newColumns = [...columns]
    const draggedColumn = newColumns[draggedIndex]
    newColumns.splice(draggedIndex, 1)
    newColumns.splice(index, 0, draggedColumn)
    setColumns(newColumns)
    setDraggedIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  const handleSave = () => {
    if (onSave) {
      onSave({
        id: schema?.id || Date.now().toString(),
        name: schemaName,
        description: schemaDescription,
        columns,
      })
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
          <div>
            <Input
              value={schemaName}
              onChange={(e) => setSchemaName(e.target.value)}
              placeholder="Schema name"
              className="h-8 border-0 bg-transparent px-0 text-lg font-semibold focus-visible:ring-0"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="gap-2">
            <Save className="h-4 w-4" />
            Save Schema
          </Button>
        </div>
      </div>

      <div className="flex h-[calc(100vh-57px)]">
        {/* Column List */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto space-y-4">
            {/* Description */}
            <div className="mb-6">
              <Label className="text-sm text-muted-foreground">Description</Label>
              <Input
                value={schemaDescription}
                onChange={(e) => setSchemaDescription(e.target.value)}
                placeholder="Describe what this schema represents…"
                className="mt-1"
              />
            </div>

            {/* Columns Header */}
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Columns</h3>
              <Button variant="outline" size="sm" onClick={addColumn} className="gap-2 bg-transparent">
                <Plus className="h-4 w-4" />
                Add Column
              </Button>
            </div>

            {/* Column List */}
            <div className="rounded-xl border border-border bg-card divide-y divide-border">
              {columns.map((column, index) => {
                const TypeIcon = typeIcons[column.type]
                return (
                  <div
                    key={column.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    onClick={() => setSelectedColumn(column)}
                    className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${
                      selectedColumn?.id === column.id ? "bg-accent" : "hover:bg-accent/50"
                    } ${draggedIndex === index ? "opacity-50" : ""}`}
                  >
                    <div className="cursor-grab text-muted-foreground hover:text-foreground">
                      <GripVertical className="h-4 w-4" />
                    </div>

                    <div className={`h-8 w-8 rounded-md flex items-center justify-center ${typeColors[column.type]}`}>
                      <TypeIcon className="h-4 w-4" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{column.name}</span>
                        {column.isPrimaryKey && <Key className="h-3 w-3 text-amber-500" />}
                        {column.isForeignKey && <Link2 className="h-3 w-3 text-cyan-500" />}
                      </div>
                      <span className="text-xs text-muted-foreground">{column.type}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {column.required && (
                        <Badge variant="secondary" className="text-xs">
                          Required
                        </Badge>
                      )}
                      {column.unique && (
                        <Badge variant="outline" className="text-xs">
                          Unique
                        </Badge>
                      )}
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => duplicateColumn(column)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => deleteColumn(column.id)}
                          className="text-destructive"
                          disabled={column.isPrimaryKey}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )
              })}

              {columns.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  <p className="text-sm">No columns defined yet.</p>
                  <Button variant="link" onClick={addColumn} className="mt-2">
                    Add your first column
                  </Button>
                </div>
              )}
            </div>

            {/* Quick Add */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">Quick add:</span>
              {[
                { name: "created_at", type: "date" as const },
                { name: "updated_at", type: "date" as const },
                { name: "name", type: "string" as const },
                { name: "status", type: "enum" as const },
                { name: "is_active", type: "boolean" as const },
              ].map((preset) => (
                <Button
                  key={preset.name}
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs bg-transparent"
                  onClick={() => {
                    const newColumn: SchemaColumn = {
                      id: Date.now().toString(),
                      name: preset.name,
                      type: preset.type,
                      required: false,
                      unique: false,
                      isPrimaryKey: false,
                      isForeignKey: false,
                      enumValues: preset.type === "enum" ? ["active", "inactive", "pending"] : undefined,
                    }
                    setColumns([...columns, newColumn])
                  }}
                >
                  + {preset.name}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Column Properties Panel */}
        <div className="w-80 border-l border-border bg-muted/30 overflow-y-auto">
          {selectedColumn ? (
            <div className="p-4 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Column Properties</h3>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedColumn(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-4">
                {/* Name */}
                <div>
                  <Label className="text-sm">Column Name</Label>
                  <Input
                    value={selectedColumn.name}
                    onChange={(e) => updateColumn(selectedColumn.id, { name: e.target.value })}
                    className="mt-1"
                  />
                </div>

                {/* Type */}
                <div>
                  <Label className="text-sm">Data Type</Label>
                  <Select
                    value={selectedColumn.type}
                    onValueChange={(value) => updateColumn(selectedColumn.id, { type: value as SchemaColumn["type"] })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="string">String</SelectItem>
                      <SelectItem value="number">Number</SelectItem>
                      <SelectItem value="boolean">Boolean</SelectItem>
                      <SelectItem value="date">Date</SelectItem>
                      <SelectItem value="enum">Enum</SelectItem>
                      <SelectItem value="json">JSON</SelectItem>
                      <SelectItem value="reference">Reference</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Enum Values */}
                {selectedColumn.type === "enum" && (
                  <div>
                    <Label className="text-sm">Enum Values</Label>
                    <Input
                      value={selectedColumn.enumValues?.join(", ") || ""}
                      onChange={(e) =>
                        updateColumn(selectedColumn.id, {
                          enumValues: e.target.value.split(",").map((v) => v.trim()),
                        })
                      }
                      placeholder="value1, value2, value3"
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Comma-separated values</p>
                  </div>
                )}

                {/* Reference */}
                {selectedColumn.type === "reference" && (
                  <div>
                    <Label className="text-sm">Reference Schema</Label>
                    <Select
                      value={selectedColumn.foreignKeyRef || ""}
                      onValueChange={(value) =>
                        updateColumn(selectedColumn.id, { foreignKeyRef: value, isForeignKey: true })
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select schema" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vehicles">Vehicles</SelectItem>
                        <SelectItem value="printers">Printers</SelectItem>
                        <SelectItem value="products">Products</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Default Value */}
                <div>
                  <Label className="text-sm">Default Value</Label>
                  <Input
                    value={selectedColumn.defaultValue || ""}
                    onChange={(e) => updateColumn(selectedColumn.id, { defaultValue: e.target.value })}
                    placeholder="Optional"
                    className="mt-1"
                  />
                </div>

                {/* Description */}
                <div>
                  <Label className="text-sm">Description</Label>
                  <Input
                    value={selectedColumn.description || ""}
                    onChange={(e) => updateColumn(selectedColumn.id, { description: e.target.value })}
                    placeholder="Describe this column…"
                    className="mt-1"
                  />
                </div>

                {/* Toggles */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Required</Label>
                    <Switch
                      checked={selectedColumn.required}
                      onCheckedChange={(checked) => updateColumn(selectedColumn.id, { required: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Unique</Label>
                    <Switch
                      checked={selectedColumn.unique}
                      onCheckedChange={(checked) => updateColumn(selectedColumn.id, { unique: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Primary Key</Label>
                    <Switch
                      checked={selectedColumn.isPrimaryKey}
                      onCheckedChange={(checked) => {
                        // Remove primary key from other columns
                        if (checked) {
                          setColumns(
                            columns.map((col) => ({
                              ...col,
                              isPrimaryKey: col.id === selectedColumn.id,
                            })),
                          )
                        }
                        updateColumn(selectedColumn.id, {
                          isPrimaryKey: checked,
                          unique: checked || selectedColumn.unique,
                        })
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center p-6">
                <Eye className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Select a column to edit its properties</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

