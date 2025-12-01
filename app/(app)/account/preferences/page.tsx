'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useTheme } from 'next-themes';
import { PageShell } from '@/components/dashboard/page-shell';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Moon, Sun, Monitor, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';

const languages = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'rm', label: 'Rumantsch', flag: '🇨🇭' },
];

const themeOptions = [
  { value: 'light', label: 'Light', icon: Sun, description: 'A clean, bright interface' },
  { value: 'dark', label: 'Dark', icon: Moon, description: 'Easy on the eyes at night' },
  { value: 'system', label: 'System', icon: Monitor, description: 'Follows your device settings' },
];

export default function PreferencesPage() {
  const { theme, setTheme } = useTheme();

  // Fetch user data
  const user = useQuery(api.users.query.me);
  const updatePreferencesAction = useAction(api.users.action.updatePreferences);

  // Local state for form
  const [selectedLanguage, setSelectedLanguage] = useState('en');

  // Debounce ref for preferences updates
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitializedRef = useRef(false);

  // Initialize form with user data (only once)
  useEffect(() => {
    if (user && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      setSelectedLanguage(user.metadata?.preferredLocale || 'en');

      // Sync theme from user metadata on initial load
      const userTheme = user.metadata?.theme;
      if (userTheme && userTheme !== theme) {
        setTheme(userTheme);
      }
    }
  }, [user, theme, setTheme]);

  // Debounced preference update
  const updatePreferences = useCallback(
    (prefs: {
      theme?: 'light' | 'dark' | 'system';
      preferredLocale?: 'en' | 'de' | 'fr' | 'it' | 'rm';
    }) => {
      // Clear existing timeout
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Debounce the API call by 300ms
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
    setSelectedLanguage(newLanguage);
    updatePreferences({ preferredLocale: newLanguage as 'en' | 'de' | 'fr' | 'it' | 'rm' });
  };

  const isLoading = user === undefined;
  const currentLanguage = languages.find((l) => l.code === selectedLanguage);

  return (
    <PageShell title="Preferences" description="Customize your experience">
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : user ? (
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Appearance Card */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Palette className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Appearance</h3>
                <p className="text-sm text-muted-foreground">Choose how the app looks to you</p>
              </div>
            </div>

            {/* Theme Selection */}
            <div className="mb-6">
              <Label className="mb-3 block">Theme</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {themeOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleThemeChange(option.value)}
                    className={cn(
                      'flex flex-col items-center gap-2 p-4 rounded-lg border transition-all text-left',
                      theme === option.value ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:border-primary/50',
                    )}
                  >
                    <option.icon
                      className={cn('h-6 w-6', theme === option.value ? 'text-primary' : 'text-muted-foreground')}
                    />
                    <span className={cn('text-sm font-medium', theme === option.value ? 'text-primary' : 'text-foreground')}>
                      {option.label}
                    </span>
                    <span className="text-xs text-muted-foreground text-center">{option.description}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Language Selection */}
            <div>
              <Label htmlFor="language" className="mb-3 block">
                Language
              </Label>
              <Select value={selectedLanguage} onValueChange={handleLanguageChange}>
                <SelectTrigger className="w-full sm:w-[280px]">
                  <SelectValue>
                    <span className="flex items-center gap-2">
                      <span>{currentLanguage?.flag}</span>
                      <span>{currentLanguage?.label}</span>
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {languages.map((language) => (
                    <SelectItem key={language.code} value={language.code}>
                      <span className="flex items-center gap-2">
                        <span>{language.flag}</span>
                        <span>{language.label}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-2">
                Select your preferred language for the interface
              </p>
            </div>
          </div>

          {/* Additional Preferences Placeholder */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold mb-2">More Settings Coming Soon</h3>
            <p className="text-sm text-muted-foreground">
              Additional preference options like timezone, date format, and accessibility settings will be available here.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex h-full items-center justify-center">
          <div className="max-w-md text-center">
            <div className="mb-6 mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Palette className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold mb-2">Preferences Unavailable</h2>
            <p className="text-muted-foreground text-sm">Unable to load your preferences.</p>
          </div>
        </div>
      )}
    </PageShell>
  );
}

