"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { LogOut, Settings, User, CreditCard, Bell, Moon, Sun, Keyboard, Languages, Check } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu"
import { Switch } from "@/components/ui/switch"

const languages = [
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "pt", label: "Português", flag: "🇧🇷" },
  { code: "ja", label: "日本語", flag: "🇯🇵" },
  { code: "zh", label: "中文", flag: "🇨🇳" },
]

export function UserAccountDropdown({ className }: { className?: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState("en")

  const currentLanguage = languages.find((l) => l.code === selectedLanguage)

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "rounded-full transition-all",
            "hover:ring-2 hover:ring-primary/20 hover:ring-offset-2 hover:ring-offset-sidebar",
            "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 focus:ring-offset-sidebar",
            className,
          )}
        >
          <Avatar className="h-8 w-8 cursor-pointer">
            <AvatarImage src="/diverse-user-avatars.png" alt="User" />
            <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600 text-white text-xs">
              JD
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end" sideOffset={12} className="w-64 p-0 overflow-hidden">
        {/* User Header */}
        <div className="bg-muted/50 px-3 py-3 border-b">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
              <AvatarImage src="/diverse-user-avatars.png" alt="User" />
              <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600 text-white">JD</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">John Doe</p>
              <p className="text-xs text-muted-foreground truncate">john@example.com</p>
            </div>
          </div>
        </div>

        {/* Account Settings */}
        <DropdownMenuGroup className="p-1.5">
          <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-2 py-1.5">
            Account
          </DropdownMenuLabel>

          <DropdownMenuItem className="flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Profile</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Account settings</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Billing</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Notifications</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator className="my-0" />

        {/* Preferences */}
        <DropdownMenuGroup className="p-1.5">
          <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-2 py-1.5">
            Preferences
          </DropdownMenuLabel>

          <div className="flex items-center justify-between px-2 py-2 rounded-md">
            <div className="flex items-center gap-3">
              {darkMode ? (
                <Moon className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Sun className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-sm">Dark mode</span>
            </div>
            <Switch checked={darkMode} onCheckedChange={setDarkMode} className="scale-90" />
          </div>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer">
              <Languages className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 flex items-center justify-between">
                <span className="text-sm">Language</span>
                <span className="text-xs text-muted-foreground mr-1">
                  {currentLanguage?.flag} {currentLanguage?.label}
                </span>
              </div>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent className="w-48 p-1.5">
                {languages.map((language) => (
                  <DropdownMenuItem
                    key={language.code}
                    className="flex items-center justify-between px-2 py-2 rounded-md cursor-pointer"
                    onClick={() => setSelectedLanguage(language.code)}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-base">{language.flag}</span>
                      <span className="text-sm">{language.label}</span>
                    </div>
                    {selectedLanguage === language.code && <Check className="h-4 w-4 text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>

          <DropdownMenuItem className="flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer">
            <Keyboard className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1 flex items-center justify-between">
              <span className="text-sm">Keyboard shortcuts</span>
              <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">?</kbd>
            </div>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator className="my-0" />

        {/* Sign Out */}
        <DropdownMenuGroup className="p-1.5">
          <DropdownMenuItem className="flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10">
            <LogOut className="h-4 w-4" />
            <span className="text-sm">Sign out</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

