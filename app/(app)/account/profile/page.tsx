'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { PageShell } from '@/components/dashboard/page-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { User, Loader2, Check, Mail, Shield, Calendar, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function ProfilePage() {
  // Fetch user data
  const user = useQuery(api.users.query.me);
  const updateProfile = useAction(api.users.action.updateProfile);
  const canDeleteAccount = useAction(api.users.action.canDeleteAccount);
  const deleteAccount = useAction(api.users.action.deleteAccount);

  // Local state for form
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Delete account state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isCheckingDeletion, setIsCheckingDeletion] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletionCheck, setDeletionCheck] = useState<{
    canDelete: boolean;
    reason?: string;
    organizationsWithActiveSubscriptions: string[];
  } | null>(null);

  // Initialize form with user data (only once)
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (user && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      setFirstName(user.firstName || '');
      setLastName(user.lastName || '');
    }
  }, [user]);

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

  const handleOpenDeleteDialog = async () => {
    setIsDeleteDialogOpen(true);
    setIsCheckingDeletion(true);
    setDeletionCheck(null);

    try {
      const result = await canDeleteAccount({});
      setDeletionCheck(result);
    } catch (err) {
      console.error('Failed to check deletion eligibility:', err);
      toast.error('Failed to check if account can be deleted');
    } finally {
      setIsCheckingDeletion(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const result = await deleteAccount({});
      if (result.success) {
        toast.success('Account deleted successfully');
        // Redirect to home/signout page
        window.location.href = '/';
      }
    } catch (err) {
      console.error('Failed to delete account:', err);
      toast.error('Failed to delete account', {
        description: err instanceof Error ? err.message : 'Please try again or contact support',
      });
      setIsDeleting(false);
    }
  };

  const isLoading = user === undefined;

  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user?.email?.[0]?.toUpperCase() || 'U';
  };

  return (
    <PageShell title="Profile" description="Manage your personal information">
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : user ? (
        <>
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
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                  />
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
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>
              <Button variant="destructive" onClick={handleOpenDeleteDialog} className="gap-2">
                <Trash2 className="h-4 w-4" />
                Delete Account
              </Button>
            </div>
          </div>

          {/* Delete Account Dialog */}
          <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Delete Account
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete your account and remove all your data.
                </AlertDialogDescription>
              </AlertDialogHeader>

              {isCheckingDeletion ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : deletionCheck ? (
                <div className="py-4">
                  {deletionCheck.canDelete ? (
                    <Alert>
                      <Check className="h-4 w-4" />
                      <AlertTitle>Ready to delete</AlertTitle>
                      <AlertDescription>
                        Your account and all associated data will be permanently deleted. Any organizations you own will
                        also be deleted.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Cannot delete account</AlertTitle>
                      <AlertDescription>{deletionCheck.reason}</AlertDescription>
                    </Alert>
                  )}
                </div>
              ) : null}

              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                {deletionCheck?.canDelete && (
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    disabled={isDeleting}
                    className="bg-destructive text-shadow-destructive-foreground hover:bg-destructive/90 gap-2"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Deleting…
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4" />
                        Delete Account
                      </>
                    )}
                  </AlertDialogAction>
                )}
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
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
