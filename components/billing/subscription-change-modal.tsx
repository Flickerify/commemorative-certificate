'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import {
  IconArrowUp,
  IconArrowDown,
  IconSwitch2,
  IconCalendar,
  IconCreditCard,
  IconCheck,
  IconInfoCircle,
  IconSparkles,
  IconHeart,
  IconRocket,
  IconGift,
} from '@tabler/icons-react';
import { cn } from '@/lib/utils';

// Tier configuration
const tierConfig = {
  personal: {
    name: 'Personal',
    color: 'bg-emerald-500',
    textColor: 'text-emerald-600 dark:text-emerald-400',
    borderColor: 'border-emerald-500/30',
    bgColor: 'bg-emerald-500/10',
  },
  pro: {
    name: 'Pro',
    color: 'bg-blue-500',
    textColor: 'text-blue-600 dark:text-blue-400',
    borderColor: 'border-blue-500/30',
    bgColor: 'bg-blue-500/10',
  },
  enterprise: {
    name: 'Enterprise',
    color: 'bg-purple-500',
    textColor: 'text-purple-600 dark:text-purple-400',
    borderColor: 'border-purple-500/30',
    bgColor: 'bg-purple-500/10',
  },
};

// Static pricing - should match your Stripe products
const staticPricing = {
  personal: { monthly: 29.99, yearly: 299.99 },
  pro: { monthly: 59.99, yearly: 599.99 },
  enterprise: { monthly: 599.99, yearly: 5999.99 },
};

export type ChangeType = 'upgrade' | 'downgrade' | 'interval_upgrade' | 'interval_downgrade';

export interface SubscriptionChangeDetails {
  changeType: ChangeType;
  currentTier: 'personal' | 'pro' | 'enterprise';
  newTier: 'personal' | 'pro' | 'enterprise';
  currentInterval: 'month' | 'year';
  newInterval: 'month' | 'year';
  isTrialing?: boolean;
  trialEndsAt?: number;
  currentPeriodEnd?: number;
}

interface SubscriptionChangeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  details: SubscriptionChangeDetails;
  onConfirm: () => Promise<void>;
  /** Called when user opts out of trial and wants to start paying */
  onStartPayingNow?: () => Promise<void>;
  isLoading?: boolean;
}

export function SubscriptionChangeModal({
  open,
  onOpenChange,
  details,
  onConfirm,
  onStartPayingNow,
  isLoading = false,
}: SubscriptionChangeModalProps) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [showStartPayingConfirm, setShowStartPayingConfirm] = useState(false);

  const { changeType, currentTier, newTier, currentInterval, newInterval, isTrialing, trialEndsAt, currentPeriodEnd } =
    details;

  const currentConfig = tierConfig[currentTier];
  const newConfig = tierConfig[newTier];

  const currentPrice = staticPricing[currentTier][currentInterval === 'month' ? 'monthly' : 'yearly'];
  const newPrice = staticPricing[newTier][newInterval === 'month' ? 'monthly' : 'yearly'];

  const isUpgrade = changeType === 'upgrade' || changeType === 'interval_upgrade';
  const isDowngrade = changeType === 'downgrade' || changeType === 'interval_downgrade';
  const isIntervalChange = changeType === 'interval_upgrade' || changeType === 'interval_downgrade';

  // Reset acknowledgment when modal opens/closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setAcknowledged(false);
      setShowStartPayingConfirm(false);
    }
    onOpenChange(newOpen);
  };

  const handleConfirm = async () => {
    if (!acknowledged && !isTrialing) return;
    await onConfirm();
  };

  const handleStartPayingNow = async () => {
    if (!onStartPayingNow) return;
    await onStartPayingNow();
  };

  // Determine effective date
  const effectiveDate = isDowngrade && !isTrialing && currentPeriodEnd ? new Date(currentPeriodEnd) : new Date();

  // Calculate trial days remaining (using a stable reference time from when the modal opened)
  const [now] = useState(() => Date.now());
  const trialDaysRemaining = trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt - now) / (1000 * 60 * 60 * 24))) : 0;

  const formatDate = (date: Date) =>
    date.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

  // Get change icon
  const ChangeIcon = isUpgrade ? IconArrowUp : isDowngrade ? IconArrowDown : IconSwitch2;

  // Get title
  const getTitle = () => {
    if (isTrialing) {
      return isUpgrade ? 'Upgrade Your Trial Plan' : 'Change Your Trial Plan';
    }
    if (isIntervalChange) {
      return isUpgrade ? 'Switch to Yearly Billing' : 'Switch to Monthly Billing';
    }
    return isUpgrade ? 'Upgrade Subscription' : 'Downgrade Subscription';
  };

  // Get description
  const getDescription = () => {
    if (isTrialing) {
      return 'Your 14-day free trial applies to all plans. Explore freely!';
    }

    if (isUpgrade) {
      return 'This change will take effect immediately. You will be charged a prorated amount.';
    }

    return `This change will take effect at the end of your current billing period on ${formatDate(effectiveDate)}.`;
  };

  // Get billing impact explanation
  const getBillingImpact = () => {
    if (isTrialing) {
      return {
        title: '✨ Free During Trial',
        description: `Switch to ${newConfig.name} for free! Your trial continues with ${trialDaysRemaining} days remaining. No charges until ${trialEndsAt ? formatDate(new Date(trialEndsAt)) : 'trial ends'}.`,
        icon: IconSparkles,
        variant: 'success' as const,
      };
    }

    if (isUpgrade) {
      const priceDiff = newPrice - currentPrice;
      return {
        title: 'Prorated Charge',
        description: `You will be charged approximately $${priceDiff.toFixed(2)} now for the upgrade. Your next full charge will be $${newPrice}/${newInterval}.`,
        icon: IconCreditCard,
        variant: 'info' as const,
      };
    }

    return {
      title: 'Scheduled Change',
      description: `You will keep your current ${currentConfig.name} plan until ${formatDate(effectiveDate)}. After that, you will be billed $${newPrice}/${newInterval} for ${newConfig.name}.`,
      icon: IconCalendar,
      variant: 'default' as const,
    };
  };

  const billingImpact = getBillingImpact();

  // Get acknowledgment text
  const getAcknowledgmentText = () => {
    if (isUpgrade && !isTrialing) {
      return 'I understand I will be charged a prorated amount immediately.';
    }
    if (isDowngrade && !isTrialing) {
      return `I understand the change will take effect on ${formatDate(effectiveDate)} and I can cancel this scheduled change before then.`;
    }
    return 'I understand and agree to this change.';
  };

  // Calculate bonus days and next billing date for display
  const billingIntervalDays = newInterval === 'year' ? 365 : 30;
  const totalFirstCycleDays = billingIntervalDays + trialDaysRemaining;
  const nextBillingDate = new Date(now + totalFirstCycleDays * 24 * 60 * 60 * 1000);
  const intervalLabel = newInterval === 'year' ? '1 year' : '1 month';

  // Show the "start paying now" confirmation view
  if (showStartPayingConfirm && isTrialing) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-full p-2 bg-gradient-to-br from-pink-500/20 to-purple-500/20 text-pink-500">
                <IconHeart className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl">Ready to Go All In? 🚀</DialogTitle>
                <DialogDescription className="mt-1">
                  We&apos;re thrilled you&apos;re loving it! Here&apos;s a thank you gift.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* 🎁 Bonus Days Gift - The Hero Section */}
            <div className="rounded-xl border-2 border-emerald-500/50 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-cyan-500/10 p-5">
              <div className="text-center space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  <IconGift className="h-4 w-4" />
                  Special Thank You Gift
                </div>
                <div className="space-y-1">
                  <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                    +{trialDaysRemaining} Bonus Days
                  </div>
                  <p className="text-sm text-muted-foreground">Your remaining trial days added to your subscription!</p>
                </div>
              </div>
            </div>

            {/* Visual Timeline */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Your first billing cycle:</h4>
              <div className="rounded-lg border bg-muted/30 p-4">
                {/* Timeline visualization */}
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex-1 flex items-center">
                    {/* Standard period bar */}
                    <div
                      className={cn('h-3 rounded-l-full', newConfig.color)}
                      style={{ width: `${(billingIntervalDays / totalFirstCycleDays) * 100}%` }}
                    />
                    {/* Bonus days bar */}
                    <div
                      className="h-3 rounded-r-full bg-gradient-to-r from-emerald-500 to-teal-400"
                      style={{ width: `${(trialDaysRemaining / totalFirstCycleDays) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Timeline labels */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex flex-col items-start">
                    <span className="font-medium text-foreground">Today</span>
                    <span>Subscription starts</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="font-medium text-foreground">{formatDate(nextBillingDate)}</span>
                    <span>Next billing</span>
                  </div>
                </div>

                {/* Period breakdown */}
                <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <div className={cn('h-3 w-3 rounded-sm', newConfig.color)} />
                    <span>{intervalLabel}</span>
                  </div>
                  <span className="text-muted-foreground">+</span>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-sm bg-gradient-to-r from-emerald-500 to-teal-400" />
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      {trialDaysRemaining} bonus days
                    </span>
                  </div>
                  <span className="text-muted-foreground">=</span>
                  <span className="font-bold">{totalFirstCycleDays} days</span>
                </div>
              </div>
            </div>

            <Separator />

            {/* What happens */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Summary:</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <IconCreditCard className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                  <span>
                    Charged <strong>${newPrice}</strong> today for {newConfig.name}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <IconGift className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  <span>
                    First cycle extended by <strong>{trialDaysRemaining} days</strong> as a thank you
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <IconCalendar className="h-4 w-4 text-purple-500 mt-0.5 shrink-0" />
                  <span>
                    Next billing on <strong>{formatDate(nextBillingDate)}</strong>
                  </span>
                </li>
              </ul>
            </div>

            {/* Thank you message */}
            <div className="rounded-lg border border-pink-500/30 bg-gradient-to-br from-pink-500/5 to-purple-500/5 p-4">
              <div className="flex items-start gap-3">
                <IconHeart className="h-5 w-5 mt-0.5 shrink-0 text-pink-500" />
                <div>
                  <h4 className="font-medium text-pink-600 dark:text-pink-400">Thank you for believing in us!</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your early support means the world. We&apos;ll keep building amazing features for you.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-4">
            <Button variant="outline" onClick={() => setShowStartPayingConfirm(false)} disabled={isLoading}>
              Back
            </Button>
            <Button
              onClick={handleStartPayingNow}
              disabled={isLoading}
              className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white"
            >
              {isLoading ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Activating…
                </>
              ) : (
                <>
                  <IconHeart className="mr-2 h-4 w-4" />
                  Start Paying &amp; Get {trialDaysRemaining} Bonus Days
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'rounded-full p-2',
                isTrialing
                  ? 'bg-emerald-500/10 text-emerald-600'
                  : isUpgrade
                    ? 'bg-emerald-500/10 text-emerald-600'
                    : 'bg-amber-500/10 text-amber-600',
              )}
            >
              {isTrialing ? <IconSparkles className="h-5 w-5" /> : <ChangeIcon className="h-5 w-5" />}
            </div>
            <div>
              <DialogTitle className="text-xl">{getTitle()}</DialogTitle>
              <DialogDescription className="mt-1">{getDescription()}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Plan comparison visual */}
          <div className="flex items-center justify-center gap-4">
            {/* Current plan */}
            <div
              className={cn('rounded-lg border p-4 text-center min-w-[140px]', currentConfig.borderColor, 'bg-card')}
            >
              <Badge variant="outline" className="mb-2">
                Current
              </Badge>
              <div className={cn('font-semibold', currentConfig.textColor)}>{currentConfig.name}</div>
              <div className="text-sm text-muted-foreground capitalize">{currentInterval}ly</div>
              <div className="text-lg font-bold mt-1">${currentPrice}</div>
            </div>

            {/* Arrow */}
            <div className="flex flex-col items-center">
              <ChangeIcon
                className={cn('h-6 w-6', isUpgrade ? 'text-emerald-500' : 'text-amber-500', 'rotate-90 sm:rotate-0')}
              />
            </div>

            {/* New plan */}
            <div
              className={cn(
                'rounded-lg border-2 p-4 text-center min-w-[140px]',
                newConfig.borderColor,
                newConfig.bgColor,
              )}
            >
              <Badge className={cn(newConfig.color, 'text-white mb-2')}>New</Badge>
              <div className={cn('font-semibold', newConfig.textColor)}>{newConfig.name}</div>
              <div className="text-sm text-muted-foreground capitalize">{newInterval}ly</div>
              <div className="text-lg font-bold mt-1">${newPrice}</div>
            </div>
          </div>

          <Separator />

          {/* Billing impact explanation */}
          <div
            className={cn(
              'rounded-lg border p-4',
              billingImpact.variant === 'success'
                ? 'border-emerald-500/30 bg-emerald-500/10'
                : billingImpact.variant === 'info'
                  ? 'border-blue-500/30 bg-blue-500/10'
                  : 'border-border bg-muted/50',
            )}
          >
            <div className="flex items-start gap-3">
              <billingImpact.icon
                className={cn(
                  'h-5 w-5 mt-0.5 shrink-0',
                  billingImpact.variant === 'success'
                    ? 'text-emerald-500'
                    : billingImpact.variant === 'info'
                      ? 'text-blue-500'
                      : 'text-muted-foreground',
                )}
              />
              <div>
                <h4 className="font-medium">{billingImpact.title}</h4>
                <p className="text-sm text-muted-foreground mt-1">{billingImpact.description}</p>
              </div>
            </div>
          </div>

          {/* What happens next */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">What happens next:</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {isTrialing && (
                <>
                  <li className="flex items-start gap-2">
                    <IconCheck className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                    <span>Switch to {newConfig.name} immediately — completely free!</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <IconCheck className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                    <span>Your trial continues with {trialDaysRemaining} days remaining</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <IconInfoCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <span>
                      After trial, you&apos;ll be billed ${newPrice}/{newInterval} for {newConfig.name}
                    </span>
                  </li>
                </>
              )}
              {isUpgrade && !isTrialing && (
                <>
                  <li className="flex items-start gap-2">
                    <IconCheck className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                    <span>Your new plan features are available immediately</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <IconCheck className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                    <span>You will be charged the prorated difference now</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <IconCheck className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                    <span>Your billing cycle remains unchanged</span>
                  </li>
                </>
              )}
              {isDowngrade && !isTrialing && (
                <>
                  <li className="flex items-start gap-2">
                    <IconCheck className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                    <span>
                      Keep all {currentConfig.name} features until {formatDate(effectiveDate)}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <IconCalendar className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                    <span>Change takes effect automatically on your next billing date</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <IconInfoCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <span>You can cancel this scheduled change anytime before then</span>
                  </li>
                </>
              )}
            </ul>
          </div>

          {/* Start paying now option - only during trial */}
          {isTrialing && onStartPayingNow && (
            <>
              <Separator />
              <div className="rounded-lg border border-dashed border-pink-500/30 bg-gradient-to-br from-pink-500/5 to-purple-500/5 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <IconHeart className="h-5 w-5 mt-0.5 shrink-0 text-pink-500" />
                    <div>
                      <h4 className="font-medium text-pink-600 dark:text-pink-400">Love it already?</h4>
                      <p className="text-sm text-muted-foreground">Skip the trial and start supporting us today!</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowStartPayingConfirm(true)}
                    className="shrink-0 border-pink-500/50 text-pink-600 hover:bg-pink-500/10 dark:text-pink-400"
                  >
                    <IconRocket className="mr-1 h-4 w-4" />
                    Let&apos;s Go!
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* Acknowledgment checkbox - only for non-trial changes */}
          {!isTrialing && (
            <>
              <Separator />
              <div className="flex items-start gap-3">
                <Checkbox
                  id="acknowledge"
                  checked={acknowledged}
                  onCheckedChange={(checked) => setAcknowledged(checked === true)}
                  disabled={isLoading}
                />
                <Label htmlFor="acknowledge" className="text-sm leading-relaxed cursor-pointer">
                  {getAcknowledgmentText()}
                </Label>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-4">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={(!acknowledged && !isTrialing) || isLoading}
            className={cn(
              isTrialing
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : isUpgrade
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-amber-600 hover:bg-amber-700 text-white',
            )}
          >
            {isLoading ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Processing…
              </>
            ) : (
              <>
                <IconCheck className="mr-2 h-4 w-4" />
                {isTrialing ? 'Switch Plan (Free)' : isUpgrade ? 'Confirm Upgrade' : 'Confirm Downgrade'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Helper function to determine the change type between two subscription states.
 */
export function getChangeType(
  currentTier: 'personal' | 'pro' | 'enterprise',
  newTier: 'personal' | 'pro' | 'enterprise',
  currentInterval: 'month' | 'year',
  newInterval: 'month' | 'year',
): ChangeType {
  const tierOrder = { personal: 1, pro: 2, enterprise: 3 };

  // Same tier - check interval change
  if (currentTier === newTier) {
    if (currentInterval === 'month' && newInterval === 'year') {
      return 'interval_upgrade'; // Monthly to yearly is an upgrade (saves money)
    }
    if (currentInterval === 'year' && newInterval === 'month') {
      return 'interval_downgrade'; // Yearly to monthly is a downgrade
    }
  }

  // Different tier
  if (tierOrder[newTier] > tierOrder[currentTier]) {
    return 'upgrade';
  }

  return 'downgrade';
}
