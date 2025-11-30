"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowLeft,
  ExternalLink,
  Smartphone,
  Tablet,
  Monitor,
  Copy,
  Check,
  RefreshCw,
  Palette,
  Code,
  Eye,
  Share2,
} from "lucide-react"

interface PublicPagePreviewProps {
  onClose: () => void
}

export function PublicPagePreview({ onClose }: PublicPagePreviewProps) {
  const [device, setDevice] = useState<"mobile" | "tablet" | "desktop">("desktop")
  const [copied, setCopied] = useState(false)
  const [selectedYear, setSelectedYear] = useState("")
  const [selectedMake, setSelectedMake] = useState("")
  const [selectedModel, setSelectedModel] = useState("")
  const [selectedEngine, setSelectedEngine] = useState("")
  const [compatibilityResult, setCompatibilityResult] = useState<null | { compatible: boolean; products: string[] }>(
    null,
  )
  const [primaryColor, setPrimaryColor] = useState("#2563eb")
  const [activeTab, setActiveTab] = useState("preview")

  const years = ["2024", "2023", "2022", "2021", "2020", "2019", "2018"]
  const makes: Record<string, string[]> = {
    "2024": ["Toyota", "Honda", "Ford", "Chevrolet", "BMW"],
    "2023": ["Toyota", "Honda", "Ford", "Chevrolet", "BMW", "Mercedes"],
    "2022": ["Toyota", "Honda", "Ford", "Chevrolet"],
  }
  const models: Record<string, string[]> = {
    Toyota: ["Camry", "Corolla", "RAV4", "Highlander"],
    Honda: ["Accord", "Civic", "CR-V", "Pilot"],
    Ford: ["F-150", "Mustang", "Explorer", "Escape"],
  }
  const engines: Record<string, string[]> = {
    Camry: ["2.5L 4-Cyl", "3.5L V6", "2.5L Hybrid"],
    Accord: ["1.5L Turbo", "2.0L Turbo", "2.0L Hybrid"],
    "F-150": ["2.7L EcoBoost", "3.5L EcoBoost", "5.0L V8"],
  }

  const handleYearChange = (year: string) => {
    setSelectedYear(year)
    setSelectedMake("")
    setSelectedModel("")
    setSelectedEngine("")
    setCompatibilityResult(null)
  }

  const handleMakeChange = (make: string) => {
    setSelectedMake(make)
    setSelectedModel("")
    setSelectedEngine("")
    setCompatibilityResult(null)
  }

  const handleModelChange = (model: string) => {
    setSelectedModel(model)
    setSelectedEngine("")
    setCompatibilityResult(null)
  }

  const handleEngineChange = (engine: string) => {
    setSelectedEngine(engine)
    setCompatibilityResult({
      compatible: Math.random() > 0.2,
      products: ["OBDLink MX+", "OBDLink CX", "OBDLink LX"],
    })
  }

  const copyEmbedCode = () => {
    const code = `<iframe src="https://compatibility.example.com/embed/abc123" width="100%" height="400" frameborder="0"></iframe>`
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const deviceWidths = {
    mobile: "w-[375px]",
    tablet: "w-[768px]",
    desktop: "w-full max-w-4xl",
  }

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-semibold">Public Page Preview</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-border rounded-lg p-1">
            <Button
              variant={device === "mobile" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setDevice("mobile")}
            >
              <Smartphone className="h-4 w-4" />
            </Button>
            <Button
              variant={device === "tablet" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setDevice("tablet")}
            >
              <Tablet className="h-4 w-4" />
            </Button>
            <Button
              variant={device === "desktop" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setDevice("desktop")}
            >
              <Monitor className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" className="gap-2 bg-transparent">
            <ExternalLink className="h-4 w-4" />
            Open Live Page
          </Button>
          <Button className="gap-2">
            <Share2 className="h-4 w-4" />
            Publish
          </Button>
        </div>
      </div>

      <div className="flex h-[calc(100vh-57px)]">
        {/* Preview Area */}
        <div className="flex-1 bg-muted/30 overflow-auto p-6">
          <div className={`mx-auto ${deviceWidths[device]} transition-all duration-300`}>
            <div className="bg-background rounded-xl shadow-lg border border-border overflow-hidden">
              {/* Mock Browser Chrome */}
              <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 border-b border-border">
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-500" />
                  <div className="h-3 w-3 rounded-full bg-amber-500" />
                  <div className="h-3 w-3 rounded-full bg-emerald-500" />
                </div>
                <div className="flex-1 mx-4">
                  <div className="bg-background rounded-md px-3 py-1.5 text-sm text-muted-foreground">
                    compatibility.example.com/check
                  </div>
                </div>
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
              </div>

              {/* Page Content */}
              <div className="p-6" style={{ "--primary-color": primaryColor } as React.CSSProperties}>
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold mb-2">Vehicle Compatibility Checker</h2>
                  <p className="text-muted-foreground">Find the perfect OBD scanner for your vehicle</p>
                </div>

                <div className={`grid gap-4 ${device === "mobile" ? "grid-cols-1" : "grid-cols-2 lg:grid-cols-4"}`}>
                  <div>
                    <Label className="text-sm mb-1.5 block">Year</Label>
                    <Select value={selectedYear} onValueChange={handleYearChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select year" />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map((year) => (
                          <SelectItem key={year} value={year}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-sm mb-1.5 block">Make</Label>
                    <Select value={selectedMake} onValueChange={handleMakeChange} disabled={!selectedYear}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select make" />
                      </SelectTrigger>
                      <SelectContent>
                        {(makes[selectedYear] || []).map((make) => (
                          <SelectItem key={make} value={make}>
                            {make}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-sm mb-1.5 block">Model</Label>
                    <Select value={selectedModel} onValueChange={handleModelChange} disabled={!selectedMake}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select model" />
                      </SelectTrigger>
                      <SelectContent>
                        {(models[selectedMake] || []).map((model) => (
                          <SelectItem key={model} value={model}>
                            {model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-sm mb-1.5 block">Engine</Label>
                    <Select value={selectedEngine} onValueChange={handleEngineChange} disabled={!selectedModel}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select engine" />
                      </SelectTrigger>
                      <SelectContent>
                        {(engines[selectedModel] || []).map((engine) => (
                          <SelectItem key={engine} value={engine}>
                            {engine}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {compatibilityResult && (
                  <div className="mt-6">
                    <div
                      className={`p-4 rounded-lg ${
                        compatibilityResult.compatible
                          ? "bg-emerald-500/10 border border-emerald-500/20"
                          : "bg-red-500/10 border border-red-500/20"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        {compatibilityResult.compatible ? (
                          <>
                            <Check className="h-5 w-5 text-emerald-500" />
                            <span className="font-semibold text-emerald-600">Compatible Products Found!</span>
                          </>
                        ) : (
                          <span className="font-semibold text-red-600">No Compatible Products</span>
                        )}
                      </div>
                      {compatibilityResult.compatible && (
                        <div className="space-y-2">
                          {compatibilityResult.products.map((product) => (
                            <div
                              key={product}
                              className="flex items-center justify-between p-3 bg-background rounded-md"
                            >
                              <span className="font-medium">{product}</span>
                              <Button size="sm" style={{ backgroundColor: primaryColor }}>
                                View Details
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Settings Panel */}
        <div className="w-80 border-l border-border overflow-y-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full rounded-none border-b border-border h-12">
              <TabsTrigger value="preview" className="flex-1 gap-2">
                <Eye className="h-4 w-4" />
                Preview
              </TabsTrigger>
              <TabsTrigger value="style" className="flex-1 gap-2">
                <Palette className="h-4 w-4" />
                Style
              </TabsTrigger>
              <TabsTrigger value="embed" className="flex-1 gap-2">
                <Code className="h-4 w-4" />
                Embed
              </TabsTrigger>
            </TabsList>

            <TabsContent value="preview" className="p-4 space-y-4">
              <div>
                <Label className="text-sm text-muted-foreground">Page URL</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input value="compatibility.example.com/check" readOnly className="text-sm" />
                  <Button variant="outline" size="icon" className="shrink-0 bg-transparent">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-sm text-muted-foreground">Status</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="default" className="bg-emerald-500">
                    Published
                  </Badge>
                  <span className="text-sm text-muted-foreground">Last updated 2h ago</span>
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <Label className="text-sm text-muted-foreground mb-3 block">Quick Stats</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="text-2xl font-bold">1,234</div>
                    <div className="text-xs text-muted-foreground">Page Views</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="text-2xl font-bold">456</div>
                    <div className="text-xs text-muted-foreground">Checks Today</div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="style" className="p-4 space-y-4">
              <div>
                <Label className="text-sm text-muted-foreground">Primary Color</Label>
                <div className="flex items-center gap-2 mt-1">
                  <div
                    className="h-10 w-10 rounded-md border border-border cursor-pointer"
                    style={{ backgroundColor: primaryColor }}
                  />
                  <Input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>

              <div>
                <Label className="text-sm text-muted-foreground">Color Presets</Label>
                <div className="flex items-center gap-2 mt-2">
                  {["#2563eb", "#7c3aed", "#059669", "#dc2626", "#ea580c"].map((color) => (
                    <button
                      key={color}
                      className={`h-8 w-8 rounded-full border-2 ${
                        primaryColor === color ? "border-foreground" : "border-transparent"
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setPrimaryColor(color)}
                    />
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-sm text-muted-foreground">Layout</Label>
                <Select defaultValue="stacked">
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stacked">Stacked (Mobile-first)</SelectItem>
                    <SelectItem value="inline">Inline (Horizontal)</SelectItem>
                    <SelectItem value="grid">Grid (2x2)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="embed" className="p-4 space-y-4">
              <div>
                <Label className="text-sm text-muted-foreground">Embed Code</Label>
                <div className="relative mt-1">
                  <pre className="p-3 rounded-lg bg-muted text-xs font-mono overflow-x-auto">
                    {`<iframe
  src="https://compatibility.example.com/embed/abc123"
  width="100%"
  height="400"
  frameborder="0"
></iframe>`}
                  </pre>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="absolute top-2 right-2 gap-1"
                    onClick={copyEmbedCode}
                  >
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copied ? "Copied!" : "Copy"}
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-sm text-muted-foreground">Embed Options</Label>
                <div className="space-y-3 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Show header</span>
                    <input type="checkbox" defaultChecked className="rounded" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Show branding</span>
                    <input type="checkbox" defaultChecked className="rounded" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Compact mode</span>
                    <input type="checkbox" className="rounded" />
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}

