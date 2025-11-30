"use client"

import type React from "react"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  FileJson,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Download,
  RefreshCw,
} from "lucide-react"

interface ColumnMapping {
  sourceColumn: string
  targetColumn: string
  transform?: string
}

interface ValidationError {
  row: number
  column: string
  value: string
  message: string
}

interface ImportWizardProps {
  onClose: () => void
  targetType?: "source" | "target"
  onComplete?: (data: unknown[]) => void
}

const steps = ["Upload", "Map Columns", "Validate", "Import"]

export function ImportWizard({ onClose, targetType = "source", onComplete }: ImportWizardProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [file, setFile] = useState<File | null>(null)
  const [fileType, setFileType] = useState<"csv" | "json">("csv")
  const [previewData, setPreviewData] = useState<string[][]>([])
  const [sourceColumns, setSourceColumns] = useState<string[]>([])
  const [mappings, setMappings] = useState<ColumnMapping[]>([])
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  const [isValidating, setIsValidating] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importComplete, setImportComplete] = useState(false)
  const [dragActive, setDragActive] = useState(false)

  const targetColumns =
    targetType === "source"
      ? ["year", "make", "model", "engine", "transmission", "trim", "body_style"]
      : ["brand", "model", "sku", "protocol", "voltage", "connector_type", "features"]

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }, [])

  const handleFile = (selectedFile: File) => {
    setFile(selectedFile)
    const extension = selectedFile.name.split(".").pop()?.toLowerCase()
    setFileType(extension === "json" ? "json" : "csv")

    // Simulate parsing file
    const mockColumns = ["Year", "Make", "Model", "Engine", "Trim"]
    setSourceColumns(mockColumns)
    setPreviewData([
      mockColumns,
      ["2020", "Toyota", "Camry", "2.5L", "LE"],
      ["2021", "Honda", "Accord", "1.5T", "Sport"],
      ["2019", "Ford", "F-150", "3.5L EcoBoost", "XLT"],
      ["2022", "Chevrolet", "Silverado", "5.3L V8", "LT"],
    ])

    // Auto-map columns
    const autoMappings: ColumnMapping[] = mockColumns.map((col) => {
      const lowerCol = col.toLowerCase()
      const matchedTarget = targetColumns.find((t) => t.toLowerCase() === lowerCol || lowerCol.includes(t))
      return {
        sourceColumn: col,
        targetColumn: matchedTarget || "",
      }
    })
    setMappings(autoMappings)
  }

  const handleValidate = () => {
    setIsValidating(true)
    // Simulate validation
    setTimeout(() => {
      setValidationErrors([
        { row: 3, column: "Engine", value: "3.5L EcoBoost", message: "Engine format should be numeric only" },
        { row: 5, column: "Year", value: "202", message: "Invalid year format" },
      ])
      setIsValidating(false)
      setCurrentStep(3)
    }, 1500)
  }

  const handleImport = () => {
    setIsImporting(true)
    // Simulate import progress
    let progress = 0
    const interval = setInterval(() => {
      progress += 10
      setImportProgress(progress)
      if (progress >= 100) {
        clearInterval(interval)
        setIsImporting(false)
        setImportComplete(true)
        if (onComplete) {
          onComplete([])
        }
      }
    }, 300)
  }

  const updateMapping = (sourceColumn: string, targetColumn: string) => {
    setMappings(mappings.map((m) => (m.sourceColumn === sourceColumn ? { ...m, targetColumn } : m)))
  }

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                dragActive ? "border-primary bg-primary/5" : "border-border"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Drop your file here</h3>
              <p className="text-sm text-muted-foreground mb-4">Supports CSV and JSON files up to 50 MB</p>
              <div className="flex items-center justify-center gap-4">
                <Button variant="outline" className="gap-2 bg-transparent" asChild>
                  <label>
                    <FileSpreadsheet className="h-4 w-4" />
                    Choose CSV
                    <input
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                    />
                  </label>
                </Button>
                <Button variant="outline" className="gap-2 bg-transparent" asChild>
                  <label>
                    <FileJson className="h-4 w-4" />
                    Choose JSON
                    <input
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                    />
                  </label>
                </Button>
              </div>
            </div>

            {file && (
              <div className="rounded-lg border border-border p-4">
                <div className="flex items-center gap-3">
                  {fileType === "csv" ? (
                    <FileSpreadsheet className="h-8 w-8 text-emerald-500" />
                  ) : (
                    <FileJson className="h-8 w-8 text-amber-500" />
                  )}
                  <div className="flex-1">
                    <div className="font-medium">{file.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB · {sourceColumns.length} columns detected
                    </div>
                  </div>
                  <Badge variant="secondary">{fileType.toUpperCase()}</Badge>
                </div>

                {previewData.length > 0 && (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          {previewData[0].map((col, i) => (
                            <th key={i} className="px-3 py-2 text-left font-medium text-muted-foreground">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.slice(1, 4).map((row, i) => (
                          <tr key={i} className="border-b border-border">
                            {row.map((cell, j) => (
                              <td key={j} className="px-3 py-2">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="text-xs text-muted-foreground mt-2 text-center">
                      Showing 3 of {previewData.length - 1} rows
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )

      case 1:
        return (
          <div className="space-y-6">
            <div className="rounded-lg border border-border divide-y divide-border">
              <div className="grid grid-cols-3 gap-4 p-3 bg-muted/50 text-sm font-medium text-muted-foreground">
                <div>Source Column</div>
                <div>Target Column</div>
                <div>Transform</div>
              </div>
              {mappings.map((mapping) => (
                <div key={mapping.sourceColumn} className="grid grid-cols-3 gap-4 p-3 items-center">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{mapping.sourceColumn}</Badge>
                  </div>
                  <Select
                    value={mapping.targetColumn}
                    onValueChange={(value) => updateMapping(mapping.sourceColumn, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__skip">Skip this column</SelectItem>
                      {targetColumns.map((col) => (
                        <SelectItem key={col} value={col}>
                          {col}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select defaultValue="none">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No transform</SelectItem>
                      <SelectItem value="uppercase">Uppercase</SelectItem>
                      <SelectItem value="lowercase">Lowercase</SelectItem>
                      <SelectItem value="trim">Trim whitespace</SelectItem>
                      <SelectItem value="number">Parse as number</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/10 text-blue-600">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm">
                {mappings.filter((m) => m.targetColumn && m.targetColumn !== "__skip").length} of {mappings.length}{" "}
                columns mapped
              </span>
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-6">
            {isValidating ? (
              <div className="text-center py-12">
                <RefreshCw className="h-12 w-12 mx-auto text-muted-foreground animate-spin mb-4" />
                <h3 className="text-lg font-medium mb-2">Validating data…</h3>
                <p className="text-sm text-muted-foreground">Checking for errors and inconsistencies</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-lg border border-border p-4 text-center">
                    <div className="text-3xl font-bold text-emerald-500">
                      {previewData.length - 1 - validationErrors.length}
                    </div>
                    <div className="text-sm text-muted-foreground">Valid rows</div>
                  </div>
                  <div className="rounded-lg border border-border p-4 text-center">
                    <div className="text-3xl font-bold text-amber-500">{validationErrors.length}</div>
                    <div className="text-sm text-muted-foreground">Warnings</div>
                  </div>
                  <div className="rounded-lg border border-border p-4 text-center">
                    <div className="text-3xl font-bold">0</div>
                    <div className="text-sm text-muted-foreground">Errors</div>
                  </div>
                </div>

                {validationErrors.length > 0 && (
                  <div className="rounded-lg border border-border">
                    <div className="p-3 border-b border-border bg-muted/50 flex items-center justify-between">
                      <span className="font-medium">Validation Issues</span>
                      <Button variant="ghost" size="sm" className="gap-2">
                        <Download className="h-4 w-4" />
                        Export Report
                      </Button>
                    </div>
                    <div className="divide-y divide-border">
                      {validationErrors.map((error, i) => (
                        <div key={i} className="p-3 flex items-start gap-3">
                          <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
                          <div className="flex-1">
                            <div className="text-sm">
                              Row {error.row}: {error.message}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Column: {error.column} · Value: &quot;{error.value}&quot;
                            </div>
                          </div>
                          <Button variant="ghost" size="sm">
                            Fix
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            {!importComplete ? (
              <div className="text-center py-12">
                {isImporting ? (
                  <>
                    <div className="w-48 mx-auto mb-4">
                      <Progress value={importProgress} />
                    </div>
                    <h3 className="text-lg font-medium mb-2">Importing data…</h3>
                    <p className="text-sm text-muted-foreground">{importProgress}% complete</p>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500 mb-4" />
                    <h3 className="text-lg font-medium mb-2">Ready to import</h3>
                    <p className="text-sm text-muted-foreground mb-6">
                      {previewData.length - 1} rows will be imported with {validationErrors.length} warnings
                    </p>
                    <Button onClick={handleImport} className="gap-2">
                      <Upload className="h-4 w-4" />
                      Start Import
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <CheckCircle2 className="h-16 w-16 mx-auto text-emerald-500 mb-4" />
                <h3 className="text-xl font-medium mb-2">Import Complete!</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Successfully imported {previewData.length - 1 - validationErrors.length} rows
                </p>
                <div className="flex items-center justify-center gap-3">
                  <Button variant="outline" onClick={onClose}>
                    Close
                  </Button>
                  <Button onClick={() => setCurrentStep(0)}>Import More</Button>
                </div>
              </div>
            )}
          </div>
        )

      default:
        return null
    }
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
            <h1 className="text-lg font-semibold">Import {targetType === "source" ? "Sources" : "Targets"}</h1>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="border-b border-border">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step} className="flex items-center">
                <div
                  className={`flex items-center justify-center h-8 w-8 rounded-full text-sm font-medium ${
                    index < currentStep
                      ? "bg-primary text-primary-foreground"
                      : index === currentStep
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {index < currentStep ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                </div>
                <span className={`ml-2 text-sm ${index <= currentStep ? "font-medium" : "text-muted-foreground"}`}>
                  {step}
                </span>
                {index < steps.length - 1 && <div className="w-12 h-px bg-border mx-4" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto p-6">{renderStep()}</div>

      {/* Footer */}
      {currentStep < 3 && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background px-6 py-4">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
            >
              Back
            </Button>
            <Button
              onClick={() => {
                if (currentStep === 1) {
                  handleValidate()
                } else {
                  setCurrentStep(currentStep + 1)
                }
              }}
              disabled={currentStep === 0 && !file}
              className="gap-2"
            >
              {currentStep === 1 ? "Validate" : "Continue"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

