'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useTheme } from 'next-themes';
import { PageShell } from '@/components/dashboard/page-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { User, Loader2, Check, Mail, Shield, Moon, Sun, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';

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

export default function AccountPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  // Fetch user data
  const user = useQuery(api.users.query.me);
  const updatePreferencesAction = useAction(api.users.action.updatePreferences);
  const updateProfile = useAction(api.users.action.updateProfile);

  // Local state for form
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [marketingEmails, setMarketingEmails] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Debounce ref for preferences updates
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitializedRef = useRef(false);

  // Initialize form with user data (only once)
  useEffect(() => {
    if (user && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      setFirstName(user.firstName || '');
      setLastName(user.lastName || '');
      setSelectedLanguage(user.metadata?.preferredLocale || 'en');
      setEmailNotifications(user.metadata?.emailNotifications !== 'false');
      setMarketingEmails(user.metadata?.marketingEmails === 'true');

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
      emailNotifications?: boolean;
      marketingEmails?: boolean;
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

  const handleEmailNotificationsChange = (checked: boolean) => {
    setEmailNotifications(checked);
    updatePreferences({ emailNotifications: checked });
  };

  const handleMarketingEmailsChange = (checked: boolean) => {
    setMarketingEmails(checked);
    updatePreferences({ marketingEmails: checked });
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await updateProfile({
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error('Failed to save profile:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const isLoading = user === undefined;
  const currentLanguage = languages.find((l) => l.code === selectedLanguage);

  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user?.email?.[0]?.toUpperCase() || 'U';
  };

  return (
    <PageShell title="Account Settings" description="Manage your profile and preferences">
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : user ? (
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Profile Card */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold mb-6">Profile Information</h3>

            <div className="flex items-start gap-6 mb-6">
              <Avatar className="h-20 w-20 border-2 border-border">
                <AvatarImage src={user.profilePictureUrl || undefined} alt={user.firstName || 'User'} />
                <AvatarFallback className="bg-linear-to-br from-violet-500 to-purple-600 text-white text-xl">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1">
                <p className="font-semibold text-lg">
                  {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email}
                </p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  {user.email}
                  {user.emailVerified && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <Check className="h-3 w-3" />
                      Verified
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Shield className="h-4 w-4" />
                  <span className="capitalize">{user.role}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" />
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSaveProfile} disabled={isSaving} className="gap-2">
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : saveSuccess ? (
                  <>
                    <Check className="h-4 w-4" />
                    Saved
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </div>

          {/* Preferences Card */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold mb-6">Preferences</h3>

            {/* Theme Selection */}
            <div className="mb-6">
              <Label className="mb-3 block">Theme</Label>
              <div className="grid grid-cols-3 gap-3">
                {themeOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleThemeChange(option.value)}
                    className={cn(
                      'flex flex-col items-center gap-2 p-4 rounded-lg border transition-all',
                      theme === option.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
                    )}
                  >
                    <option.icon
                      className={cn('h-5 w-5', theme === option.value ? 'text-primary' : 'text-muted-foreground')}
                    />
                    <span className={cn('text-sm', theme === option.value ? 'font-medium' : 'text-muted-foreground')}>
                      {option.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Language Selection */}
            <div className="mb-6">
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
            </div>

            {/* Notification Preferences */}
            <div>
              <Label className="mb-3 block">Notifications</Label>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Email notifications</p>
                    <p className="text-xs text-muted-foreground">Receive updates about your account</p>
                  </div>
                  <Switch checked={emailNotifications} onCheckedChange={handleEmailNotificationsChange} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Marketing emails</p>
                    <p className="text-xs text-muted-foreground">News, tips, and product updates</p>
                  </div>
                  <Switch checked={marketingEmails} onCheckedChange={handleMarketingEmailsChange} />
                </div>
              </div>
            </div>
          </div>

          {/* Account Info */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold mb-4">Account Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">User ID</p>
                <p className="font-mono text-xs truncate">{user.externalId}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Member Since</p>
                <p>
                  {new Date(user._creationTime).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6">
            <h3 className="font-semibold text-destructive mb-2">Danger Zone</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Permanently delete your account and all associated data.
            </p>
            <Button variant="destructive">Delete Account</Button>
          </div>
        </div>
      ) : (
        <div className="flex h-full items-center justify-center">
          <div className="max-w-md text-center">
            <div className="mb-6 mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <User className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold mb-2">Account Not Found</h2>
            <p className="text-muted-foreground text-sm">Unable to load your account information.</p>
          </div>
        </div>
      )}
    </PageShell>
  );
}
