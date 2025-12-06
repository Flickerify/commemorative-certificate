'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Id } from '@/convex/_generated/dataModel';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckoutButton } from './checkout-button';
import { IconCheck, IconUser, IconUsers, IconBuilding, IconSparkles } from '@tabler/icons-react';
import { cn } from '@/lib/utils';

interface PricingTableProps {
  organizationId?: Id<'organizations'>;
  currentTier?: 'personal' | 'pro' | 'enterprise';
  /** Current billing interval: 'month' or 'year' */
  currentInterval?: 'month' | 'year';
  hasCanceledSubscription?: boolean;
}

// Feature lists for each tier
const planFeatures = {
  personal: ['1 team member', 'Basic API access', 'Standard schemas', 'Community support'],
  pro: [
    'Up to 3 team members',
    'Advanced API access',
    'Custom schemas',
    'API analytics',
    'Email support',
    'Priority queue',
  ],
  enterprise: [
    'Unlimited team members',
    'Everything in Pro',
    'Advanced analytics',
    'Custom integrations',
    'Priority support',
    'SSO/SAML',
    'Audit logs',
    'Custom branding',
  ],
};

const planIcons = {
  personal: IconUser,
  pro: IconUsers,
  enterprise: IconBuilding,
};

// Static pricing - should match your Stripe products
const staticPricing = {
  personal: { monthly: 29.99, yearly: 299.99 },
  pro: { monthly: 59.99, yearly: 599.99 },
  enterprise: { monthly: 599.99, yearly: 5999.99 },
};

interface PlanConfig {
  id: 'personal' | 'pro' | 'enterprise';
  name: string;
  description: string;
  popular: boolean;
  priceIdMonthly?: string;
  priceIdYearly?: string;
}

const plans: PlanConfig[] = [
  {
    id: 'personal',
    name: 'Personal',
    description: 'For individuals getting started',
    popular: false,
    priceIdMonthly: process.env.NEXT_PUBLIC_PRICE_PERSONAL_MONTHLY,
    priceIdYearly: process.env.NEXT_PUBLIC_PRICE_PERSONAL_YEARLY,
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For small teams ready to scale',
    popular: true,
    priceIdMonthly: process.env.NEXT_PUBLIC_PRICE_PRO_MONTHLY,
    priceIdYearly: process.env.NEXT_PUBLIC_PRICE_PRO_YEARLY,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For organizations with advanced needs',
    popular: false,
    priceIdMonthly: process.env.NEXT_PUBLIC_PRICE_ENTERPRISE_MONTHLY,
    priceIdYearly: process.env.NEXT_PUBLIC_PRICE_ENTERPRISE_YEARLY,
  },
];

export function PricingTable({
  organizationId,
  currentTier,
  currentInterval,
  hasCanceledSubscription = false,
}: PricingTableProps) {
  // Default to the current interval if available, otherwise monthly
  const [isYearly, setIsYearly] = useState(currentInterval === 'year');

  // Determine if user is viewing a different interval than their current subscription
  const selectedInterval = isYearly ? 'year' : 'month';
  const isViewingDifferentInterval = currentInterval && selectedInterval !== currentInterval;

  return (
    <div className="space-y-8">
      {/* Free trial notice */}
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <IconCheck className="h-4 w-4 text-emerald-500" />
        <span>All plans include a 14-day free trial — no credit card required</span>
      </div>

      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-3">
        <Label htmlFor="billing-toggle" className={cn(!isYearly && 'font-medium')}>
          Monthly
        </Label>
        <Switch id="billing-toggle" checked={isYearly} onCheckedChange={setIsYearly} />
        <Label htmlFor="billing-toggle" className={cn(isYearly && 'font-medium')}>
          Yearly
          <Badge variant="secondary" className="ml-2">
            Save 17%
          </Badge>
        </Label>
      </div>

      {/* Plans grid */}
      <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
        {plans.map((plan) => {
          const isCurrentTierPlan = currentTier !== undefined && plan.id === currentTier;
          // Current plan means same tier AND same interval (or no interval change)
          const isCurrentPlan = isCurrentTierPlan && !isViewingDifferentInterval;
          // Interval switch: same tier but different interval
          const isIntervalSwitch = isCurrentTierPlan && isViewingDifferentInterval;
          const PlanIcon = planIcons[plan.id];
          const features = planFeatures[plan.id];
          const pricing = staticPricing[plan.id];
          const priceId = isYearly ? plan.priceIdYearly : plan.priceIdMonthly;

          // Determine tier relationship for button text
          const tierOrder: Record<'personal' | 'pro' | 'enterprise', number> = {
            personal: 1,
            pro: 2,
            enterprise: 3,
          };
          const isDowngrade =
            currentTier !== undefined && !isCurrentTierPlan && tierOrder[plan.id] < tierOrder[currentTier];
          const isUpgrade =
            currentTier !== undefined && !isCurrentTierPlan && tierOrder[plan.id] > tierOrder[currentTier];

          // Determine button text based on plan relationship
          const getButtonText = () => {
            // Interval switch on the same tier
            if (isIntervalSwitch) {
              if (isYearly) {
                return 'Switch to Yearly (Save 17%)';
              } else {
                return 'Switch to Monthly';
              }
            }
            if (isDowngrade) return 'Downgrade';
            if (isUpgrade) return 'Upgrade';
            return 'Subscribe';
          };

          // Determine if this is an interval downgrade (yearly to monthly)
          const isIntervalDowngrade = isIntervalSwitch && !isYearly;

          return (
            <Card
              key={plan.id}
              className={cn(
                'relative flex flex-col',
                plan.popular && 'border-primary shadow-lg',
                isCurrentPlan && 'ring-2 ring-primary',
              )}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="gap-1">
                    <IconSparkles className="h-3 w-3" />
                    Most Popular
                  </Badge>
                </div>
              )}

              <CardHeader className="text-center">
                <div className="mx-auto mb-2 rounded-lg bg-muted p-2 w-fit">
                  <PlanIcon className="h-6 w-6" />
                </div>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>

              <CardContent className="flex-1 space-y-6">
                {/* Pricing */}
                <div className="text-center">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold tracking-tight">
                      ${isYearly ? pricing.yearly : pricing.monthly}
                    </span>
                    <span className="text-muted-foreground">/{isYearly ? 'year' : 'month'}</span>
                  </div>
                  {isYearly && (
                    <p className="text-sm text-muted-foreground mt-1">
                      ${Math.round(pricing.yearly / 12)}/month billed annually
                    </p>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-2">
                  {features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <IconCheck className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter className="flex-col gap-2">
                {isCurrentPlan ? (
                  <Button variant="outline" className="w-full" disabled>
                    Current Plan
                  </Button>
                ) : plan.id === 'enterprise' ? (
                  // Enterprise tier - link to contact sales page
                  <Button asChild className="w-full" variant="outline">
                    <Link href="/administration/billing/request/new">Contact Sales</Link>
                  </Button>
                ) : isIntervalSwitch && organizationId && priceId ? (
                  // Same tier but different interval - show switch option
                  <div className="w-full space-y-2">
                    <CheckoutButton
                      organizationId={organizationId}
                      priceId={priceId}
                      hasActiveSubscription={!!currentTier && !hasCanceledSubscription}
                      variant={isIntervalDowngrade ? 'outline' : 'default'}
                      className="w-full"
                    >
                      {getButtonText()}
                    </CheckoutButton>
                    {isIntervalDowngrade && (
                      <p className="text-xs text-muted-foreground text-center">
                        Change takes effect at end of billing cycle
                      </p>
                    )}
                  </div>
                ) : organizationId && priceId ? (
                  <CheckoutButton
                    organizationId={organizationId}
                    priceId={priceId}
                    hasActiveSubscription={!!currentTier && !hasCanceledSubscription}
                    variant={isDowngrade ? 'outline' : plan.popular ? undefined : 'outline'}
                    className="w-full"
                  >
                    {getButtonText()}
                  </CheckoutButton>
                ) : (
                  <Button className="w-full" variant={plan.popular ? 'default' : 'outline'} disabled>
                    {priceId ? 'Select Organization' : 'Configure Stripe'}
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export function PricingTableSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-center gap-3">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-6 w-10" />
        <Skeleton className="h-5 w-20" />
      </div>
      <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="flex flex-col">
            <CardHeader className="text-center">
              <Skeleton className="mx-auto h-10 w-10 rounded-lg" />
              <Skeleton className="mx-auto h-6 w-24" />
              <Skeleton className="mx-auto h-4 w-48" />
            </CardHeader>
            <CardContent className="flex-1 space-y-6">
              <div className="text-center">
                <Skeleton className="mx-auto h-10 w-24" />
              </div>
              <div className="space-y-2">
                {[1, 2, 3, 4].map((j) => (
                  <Skeleton key={j} className="h-4 w-full" />
                ))}
              </div>
            </CardContent>
            <CardFooter>
              <Skeleton className="h-10 w-full" />
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
