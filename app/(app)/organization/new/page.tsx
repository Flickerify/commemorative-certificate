'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAction } from 'convex/react';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import { api } from '@/convex/_generated/api';
import { PageShell } from '@/components/dashboard/page-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { Building2, Loader2, ArrowLeft, ArrowRight, Users, Shield, Zap, Check, Sparkles } from 'lucide-react';

// Pricing configuration - must match Stripe
const plans = [
  {
    id: 'personal' as const,
    name: 'Personal',
    description: 'For individuals getting started',
    popular: false,
    monthlyPrice: 29.99,
    yearlyPrice: 299.99,
    priceIdMonthly: process.env.NEXT_PUBLIC_PRICE_PERSONAL_MONTHLY,
    priceIdYearly: process.env.NEXT_PUBLIC_PRICE_PERSONAL_YEARLY,
    trial: true,
    features: ['1 team member', 'Basic API access', 'Standard schemas', 'Community support', '14-day free trial'],
  },
  {
    id: 'pro' as const,
    name: 'Pro',
    description: 'For small teams ready to scale',
    popular: true,
    monthlyPrice: 59.99,
    yearlyPrice: 599.99,
    priceIdMonthly: process.env.NEXT_PUBLIC_PRICE_PRO_MONTHLY,
    priceIdYearly: process.env.NEXT_PUBLIC_PRICE_PRO_YEARLY,
    trial: false,
    features: [
      'Up to 3 team members',
      'Advanced API access',
      'Custom schemas',
      'API analytics',
      'Email support',
      'Priority queue',
    ],
  },
  {
    id: 'enterprise' as const,
    name: 'Enterprise',
    description: 'For organizations with advanced needs',
    popular: false,
    monthlyPrice: 599.99,
    yearlyPrice: 5999.99,
    priceIdMonthly: process.env.NEXT_PUBLIC_PRICE_ENTERPRISE_MONTHLY,
    priceIdYearly: process.env.NEXT_PUBLIC_PRICE_ENTERPRISE_YEARLY,
    trial: false,
    features: [
      'Unlimited team members',
      'Everything in Pro',
      'Advanced analytics',
      'Custom integrations',
      'Priority support',
      'SSO/SAML',
      'Audit logs',
      'Custom branding',
    ],
  },
];

type Step = 'name' | 'plan';

export default function NewOrganizationPage() {
  const router = useRouter();
  const { switchToOrganization } = useAuth();
  const createOrganization = useAction(api.organizations.action.create);

  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<'personal' | 'pro' | 'enterprise'>('personal');
  const [isYearly, setIsYearly] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNext = () => {
    if (!name.trim()) {
      setError('Organization name is required');
      return;
    }
    setError(null);
    setStep('plan');
  };

  const handleBack = () => {
    if (step === 'plan') {
      setStep('name');
    } else {
      router.back();
    }
  };

  const handleSubmit = async () => {
    setError(null);

    const plan = plans.find((p) => p.id === selectedPlan);
    if (!plan) {
      setError('Please select a plan');
      return;
    }

    const priceId = isYearly ? plan.priceIdYearly : plan.priceIdMonthly;
    if (!priceId) {
      setError('Pricing not configured. Please contact support.');
      return;
    }

    try {
      setIsLoading(true);

      // Create the organization (optimistically inserts into Convex)
      const result = await createOrganization({
        name: name.trim(),
        priceId,
        successUrl: `${window.location.origin}/administration/billing?success=true`,
        cancelUrl: `${window.location.origin}/organization/new?canceled=true`,
      });

      // Switch to the new organization immediately
      // This updates the WorkOS session so the user is in the new org context
      await switchToOrganization(result.workosOrganizationId);
      console.log(`[Auth] Switched to new organization: ${result.workosOrganizationId}`);

      // Handle redirect based on plan type
      if (result.checkoutUrl) {
        // Pro/Enterprise: Redirect immediately to Stripe checkout for payment
        // Stripe will redirect to success URL after payment completes
        console.log(`[Auth] Redirecting to Stripe checkout for organization: ${result.workosOrganizationId}`);
        window.location.href = result.checkoutUrl;
      } else {
        // Personal trial: Go directly to billing page (no payment needed)
        console.log(`[Auth] Personal trial started for organization: ${result.workosOrganizationId}`);
        window.location.href = '/administration/billing?success=true&trial=started';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create organization');
      setIsLoading(false);
    }
  };

  return (
    <PageShell
      title="Create Organization"
      description={step === 'name' ? 'Set up a new organization for your team' : 'Choose your plan'}
      headerActions={
        <Button variant="ghost" className="gap-2" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back</span>
        </Button>
      }
    >
      <div className="max-w-4xl mx-auto">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <div
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
              step === 'name' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
            )}
          >
            <span className="h-5 w-5 rounded-full bg-current/20 flex items-center justify-center text-xs">1</span>
            Name
          </div>
          <div className="h-px w-8 bg-border" />
          <div
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
              step === 'plan' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
            )}
          >
            <span className="h-5 w-5 rounded-full bg-current/20 flex items-center justify-center text-xs">2</span>
            Plan
          </div>
        </div>

        {step === 'name' ? (
          <div className="space-y-8">
            {/* Organization Preview Card */}
            <div className="rounded-xl border border-border bg-card p-6 max-w-2xl mx-auto">
              <div className="flex items-start gap-4 mb-6">
                <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-primary-foreground font-bold text-xl">
                  {name ? name.charAt(0).toUpperCase() : 'O'}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{name || 'Your Organization'}</h3>
                  <p className="text-sm text-muted-foreground">Personal, Pro, or Enterprise Plan</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Organization Name</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Acme Corporation"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="text-base"
                    disabled={isLoading}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && name.trim()) {
                        handleNext();
                      }
                    }}
                  />
                  {error && <p className="text-sm text-destructive">{error}</p>}
                </div>
              </div>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
              {[
                {
                  icon: Users,
                  title: 'Team Collaboration',
                  description: 'Invite team members and assign roles',
                },
                {
                  icon: Shield,
                  title: 'Access Control',
                  description: 'Manage permissions and security settings',
                },
                {
                  icon: Zap,
                  title: 'Shared Resources',
                  description: 'Share templates, certificates, and data',
                },
                {
                  icon: Sparkles,
                  title: 'Pro Features',
                  description: 'Access advanced APIs, analytics, and more',
                },
              ].map((feature, index) => (
                <div key={index} className="rounded-lg border border-border bg-card/50 p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <feature.icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{feature.title}</p>
                      <p className="text-xs text-muted-foreground">{feature.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border max-w-2xl mx-auto">
              <Button type="button" variant="outline" onClick={() => router.back()} disabled={isLoading}>
                Cancel
              </Button>
              <Button onClick={handleNext} disabled={!name.trim()} className="gap-2">
                Continue to Plan Selection
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
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
            <div className="grid gap-6 md:grid-cols-3">
              {plans.map((plan) => {
                const isSelected = selectedPlan === plan.id;
                const price = isYearly ? plan.yearlyPrice : plan.monthlyPrice;

                return (
                  <Card
                    key={plan.id}
                    className={cn(
                      'relative cursor-pointer transition-all hover:border-primary/50',
                      isSelected && 'border-primary ring-2 ring-primary',
                      plan.popular && 'shadow-lg',
                    )}
                    onClick={() => setSelectedPlan(plan.id)}
                  >
                    {plan.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="gap-1">
                          <Sparkles className="h-3 w-3" />
                          Most Popular
                        </Badge>
                      </div>
                    )}
                    {plan.trial && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge
                          variant="secondary"
                          className="gap-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        >
                          14-day free trial
                        </Badge>
                      </div>
                    )}

                    <CardHeader className="text-center pt-6">
                      <div className="flex items-center justify-between">
                        <CardTitle>{plan.name}</CardTitle>
                        <div
                          className={cn(
                            'h-5 w-5 rounded-full border-2 flex items-center justify-center',
                            isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/30',
                          )}
                        >
                          {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                        </div>
                      </div>
                      <CardDescription>{plan.description}</CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-6">
                      {/* Pricing */}
                      <div className="text-center">
                        <div className="flex items-baseline justify-center gap-1">
                          <span className="text-4xl font-bold tracking-tight">${price}</span>
                          <span className="text-muted-foreground">/{isYearly ? 'year' : 'month'}</span>
                        </div>
                        {isYearly && (
                          <p className="text-sm text-muted-foreground mt-1">
                            ${Math.round(price / 12)}/month billed annually
                          </p>
                        )}
                        {plan.trial && (
                          <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
                            Free for 14 days, then ${price}/{isYearly ? 'year' : 'month'}
                          </p>
                        )}
                      </div>

                      {/* Features */}
                      <ul className="space-y-2">
                        {plan.features.map((feature) => (
                          <li key={feature} className="flex items-start gap-2 text-sm">
                            <Check className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {error && <p className="text-sm text-destructive text-center">{error}</p>}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={handleBack} disabled={isLoading}>
                Back
              </Button>
              <Button onClick={handleSubmit} disabled={isLoading} className="gap-2">
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating…
                  </>
                ) : (
                  <>
                    <Building2 className="h-4 w-4" />
                    {selectedPlan === 'personal' ? 'Start Free Trial' : 'Create & Subscribe'}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
