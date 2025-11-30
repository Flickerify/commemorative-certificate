'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import {
  LogOut,
  Settings,
  User,
  CreditCard,
  Bell,
  Moon,
  Sun,
  Monitor,
  Keyboard,
  Languages,
  Check,
  Mail,
  Megaphone,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
} from '@/components/ui/dropdown-menu';

const languages = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'rm', label: 'Rumantsch', flag: '🇨🇭' },
];

const themeOptions = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export function UserAccountDropdown({ className }: { className?: string }) {
  const router = useRouter();
  const { signOut } = useAuth();
  const { theme, setTheme } = useTheme();

  // Fetch user data from Convex
  const user = useQuery(api.users.query.me);
  const updatePreferencesAction = useAction(api.users.action.updatePreferences);

  const [isOpen, setIsOpen] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [marketingEmails, setMarketingEmails] = useState(false);

  // Debounce ref for preferences updates
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Get current language from user metadata
  const selectedLanguage = user?.metadata?.preferredLocale || 'en';
  const currentLanguage = languages.find((l) => l.code === selectedLanguage);

  // Sync preferences from user metadata on load (only once)
  const hasInitialized = useRef(false);
  useEffect(() => {
    if (user?.metadata && !hasInitialized.current) {
      hasInitialized.current = true;

      // Sync theme
      if (user.metadata.theme && user.metadata.theme !== theme) {
        setTheme(user.metadata.theme);
      }

      // Sync notification preferences
      setEmailNotifications(user.metadata.emailNotifications !== 'false');
      setMarketingEmails(user.metadata.marketingEmails === 'true');
    }
  }, [user?.metadata, theme, setTheme]);

  // Debounced preference update
  const updatePreferences = useCallback(
    (prefs: {
      theme?: 'light' | 'dark' | 'system';
      preferredLocale?: 'en' | 'de' | 'fr' | 'it' | 'rm';
      emailNotifications?: boolean;
      marketingEmails?: boolean;
    }) => {
      // Clear existing timeout
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Debounce the API call by 300ms to batch rapid changes
      debounceRef.current = setTimeout(async () => {
        try {
          await updatePreferencesAction(prefs);
        } catch (err) {
          console.error('Failed to save preferences:', err);
        }
      }, 300);
    },
    [updatePreferencesAction],
  );

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    updatePreferences({ theme: newTheme as 'light' | 'dark' | 'system' });
  };

  const handleLanguageChange = (newLanguage: string) => {
    updatePreferences({ preferredLocale: newLanguage as 'en' | 'de' | 'fr' | 'it' | 'rm' });
  };

  const handleEmailNotificationsChange = (checked: boolean) => {
    setEmailNotifications(checked);
    updatePreferences({ emailNotifications: checked });
  };

  const handleMarketingEmailsChange = (checked: boolean) => {
    setMarketingEmails(checked);
    updatePreferences({ marketingEmails: checked });
  };

  const handleSignOut = async () => {
    setIsOpen(false);
    await signOut();
  };

  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user?.email?.[0]?.toUpperCase() || 'U';
  };

  const getUserName = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user?.email || 'User';
  };

  // Loading state
  if (user === undefined) {
    return <div className={cn('h-8 w-8 rounded-full bg-muted animate-pulse', className)} />;
  }

  const ThemeIcon = themeOptions.find((t) => t.value === theme)?.icon || Monitor;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'rounded-full transition-all',
            'hover:ring-2 hover:ring-primary/20 hover:ring-offset-2 hover:ring-offset-sidebar',
            'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 focus:ring-offset-sidebar',
            className,
          )}
        >
          <Avatar className="h-8 w-8 cursor-pointer">
            <AvatarImage src={user?.profilePictureUrl || undefined} alt={getUserName()} />
            <AvatarFallback className="bg-linear-to-br from-violet-500 to-purple-600 text-white text-xs">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end" sideOffset={12} className="w-64 p-0 overflow-hidden">
        {/* User Header */}
        <div className="bg-muted/50 px-3 py-3 border-b">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
              <AvatarImage src={user?.profilePictureUrl || undefined} alt={getUserName()} />
              <AvatarFallback className="bg-linear-to-br from-violet-500 to-purple-600 text-white">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{getUserName()}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Account Settings */}
        <DropdownMenuGroup className="p-1.5">
          <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-2 py-1.5">
            Account
          </DropdownMenuLabel>

          <DropdownMenuItem
            className="flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer"
            onClick={() => {
              setIsOpen(false);
              router.push('/account');
            }}
          >
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Profile</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer"
            onClick={() => {
              setIsOpen(false);
              router.push('/settings');
            }}
          >
            <Settings className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Account settings</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer"
            onClick={() => {
              setIsOpen(false);
              router.push('/billing');
            }}
          >
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Billing</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer"
            onClick={() => {
              setIsOpen(false);
              router.push('/account');
            }}
          >
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

          {/* Theme Selector */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer">
              <ThemeIcon className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 flex items-center justify-between">
                <span className="text-sm">Theme</span>
                <span className="text-xs text-muted-foreground mr-1 capitalize">{theme}</span>
              </div>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent className="w-40 p-1.5">
                {themeOptions.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    className="flex items-center justify-between px-2 py-2 rounded-md cursor-pointer"
                    onClick={() => handleThemeChange(option.value)}
                  >
                    <div className="flex items-center gap-2.5">
                      <option.icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{option.label}</span>
                    </div>
                    {theme === option.value && <Check className="h-4 w-4 text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>

          {/* Language Selector */}
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
                    onClick={() => handleLanguageChange(language.code)}
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

          {/* Notifications */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 flex items-center justify-between">
                <span className="text-sm">Notifications</span>
                <span className="text-xs text-muted-foreground mr-1">
                  {emailNotifications || marketingEmails ? 'On' : 'Off'}
                </span>
              </div>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent className="w-56 p-1.5">
                <div
                  className="flex items-center justify-between px-2 py-2.5 rounded-md hover:bg-accent"
                  onClick={(e) => e.preventDefault()}
                >
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm">Email notifications</p>
                      <p className="text-xs text-muted-foreground">Account updates</p>
                    </div>
                  </div>
                  <Switch
                    checked={emailNotifications}
                    onCheckedChange={handleEmailNotificationsChange}
                    className="scale-90"
                  />
                </div>
                <div
                  className="flex items-center justify-between px-2 py-2.5 rounded-md hover:bg-accent"
                  onClick={(e) => e.preventDefault()}
                >
                  <div className="flex items-center gap-3">
                    <Megaphone className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm">Marketing emails</p>
                      <p className="text-xs text-muted-foreground">News & updates</p>
                    </div>
                  </div>
                  <Switch
                    checked={marketingEmails}
                    onCheckedChange={handleMarketingEmailsChange}
                    className="scale-90"
                  />
                </div>
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
          <DropdownMenuItem
            className="flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            <span className="text-sm">Sign out</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
