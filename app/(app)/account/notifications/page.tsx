'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { PageShell } from '@/components/dashboard/page-shell';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Bell, Mail, Megaphone, MessageSquare, AlertCircle, Zap } from 'lucide-react';

export default function NotificationsPage() {
  // Fetch user data
  const user = useQuery(api.users.query.me);
  const updatePreferencesAction = useAction(api.users.action.updatePreferences);

  // Local state for notification preferences
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [marketingEmails, setMarketingEmails] = useState(false);

  // Debounce ref for preferences updates
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitializedRef = useRef(false);

  // Initialize form with user data (only once)
  useEffect(() => {
    if (user && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      setEmailNotifications(user.metadata?.emailNotifications !== false);
      setMarketingEmails(user.metadata?.marketingEmails === true);
    }
  }, [user]);

  // Debounced preference update
  const updatePreferences = useCallback(
    (prefs: { emailNotifications?: boolean; marketingEmails?: boolean }) => {
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

  const handleEmailNotificationsChange = (checked: boolean) => {
    setEmailNotifications(checked);
    updatePreferences({ emailNotifications: checked });
  };

  const handleMarketingEmailsChange = (checked: boolean) => {
    setMarketingEmails(checked);
    updatePreferences({ marketingEmails: checked });
  };

  const isLoading = user === undefined;

  return (
    <PageShell title="Notifications" description="Manage how you receive updates">
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : user ? (
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Email Notifications Card */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Bell className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Email Notifications</h3>
                <p className="text-sm text-muted-foreground">Control what emails you receive</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Account Updates */}
              <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                    <Mail className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Account Updates</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Important updates about your account, security alerts, and activity notifications
                    </p>
                  </div>
                </div>
                <Switch checked={emailNotifications} onCheckedChange={handleEmailNotificationsChange} />
              </div>

              {/* Marketing Emails */}
              <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                    <Megaphone className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Marketing & Announcements</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Product news, feature updates, tips, and promotional content
                    </p>
                  </div>
                </div>
                <Switch checked={marketingEmails} onCheckedChange={handleMarketingEmailsChange} />
              </div>
            </div>
          </div>

          {/* Coming Soon Card */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Zap className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold">More Notification Options Coming</h3>
                <p className="text-sm text-muted-foreground">Additional controls are on the way</p>
              </div>
            </div>

            <div className="space-y-3 opacity-60">
              <div className="flex items-center justify-between p-3 rounded-lg border border-dashed border-border">
                <div className="flex items-center gap-3">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">In-app notifications</span>
                </div>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">Soon</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border border-dashed border-border">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Alert frequency settings</span>
                </div>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">Soon</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex h-full items-center justify-center">
          <div className="max-w-md text-center">
            <div className="mb-6 mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Bell className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold mb-2">Notifications Unavailable</h2>
            <p className="text-muted-foreground text-sm">Unable to load your notification settings.</p>
          </div>
        </div>
      )}
    </PageShell>
  );
}
