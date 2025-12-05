'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAction, useQuery } from 'convex/react';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  Globe,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Zap,
  Shield,
  Users,
  BarChart3,
  Building2,
  User,
  Check,
  PartyPopper,
} from 'lucide-react';

const LANGUAGES = [
  { value: 'en', label: 'English', flag: '🇺🇸' },
  { value: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { value: 'fr', label: 'Français', flag: '🇫🇷' },
  { value: 'it', label: 'Italiano', flag: '🇮🇹' },
  { value: 'rm', label: 'Rumantsch', flag: '🇨🇭' },
] as const;

const FEATURES = [
  {
    icon: Zap,
    title: 'Fast & Reliable',
    description: 'Built for speed with real-time updates',
  },
  {
    icon: Shield,
    title: 'Enterprise Security',
    description: 'Your data is protected with industry-leading security',
  },
  {
    icon: Users,
    title: 'Team Collaboration',
    description: 'Work together seamlessly with your team',
  },
  {
    icon: BarChart3,
    title: 'Powerful Analytics',
    description: 'Gain insights with comprehensive reporting',
  },
];

// Plans configuration
const plans = [
  {
    id: 'personal' as const,
    name: 'Personal',
    description: 'For individuals getting started',
    icon: User,
    monthlyPrice: 29.99,
    yearlyPrice: 299.99,
    priceIdMonthly: process.env.NEXT_PUBLIC_PRICE_PERSONAL_MONTHLY,
    priceIdYearly: process.env.NEXT_PUBLIC_PRICE_PERSONAL_YEARLY,
    features: ['1 team member', 'Basic API access', 'Standard schemas', 'Community support'],
  },
  {
    id: 'pro' as const,
    name: 'Pro',
    description: 'For small teams ready to scale',
    icon: Users,
    popular: true,
    monthlyPrice: 59.99,
    yearlyPrice: 599.99,
    priceIdMonthly: process.env.NEXT_PUBLIC_PRICE_PRO_MONTHLY,
    priceIdYearly: process.env.NEXT_PUBLIC_PRICE_PRO_YEARLY,
    features: ['Up to 3 team members', 'Advanced API access', 'Custom schemas', 'Email support'],
  },
  {
    id: 'enterprise' as const,
    name: 'Enterprise',
    description: 'For organizations with advanced needs',
    icon: Building2,
    monthlyPrice: 599.99,
    yearlyPrice: 5999.99,
    priceIdMonthly: process.env.NEXT_PUBLIC_PRICE_ENTERPRISE_MONTHLY,
    priceIdYearly: process.env.NEXT_PUBLIC_PRICE_ENTERPRISE_YEARLY,
    features: ['Unlimited team members', 'Priority support', 'SSO/SAML', 'Custom integrations'],
  },
];

// Step types for different flows
type OwnerStep = 'welcome' | 'language' | 'organization' | 'plan';
type MemberStep = 'welcome' | 'language' | 'complete';
type Step = OwnerStep | MemberStep;

export default function OnboardingPage() {
  const router = useRouter();
  const { switchToOrganization } = useAuth();
  const user = useQuery(api.users.query.me);
  const onboardingContext = useQuery(api.users.query.getOnboardingContext);
  const completeOnboarding = useAction(api.users.action.completeOnboarding);
  const createOrganization = useAction(api.organizations.action.create);

  const [step, setStep] = useState<Step>('welcome');
  const [selectedLocale, setSelectedLocale] = useState<string>('en');
  // null = use default, string = user has typed something
  const [orgNameInput, setOrgNameInput] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<'personal' | 'pro' | 'enterprise'>('personal');
  const [isYearly, setIsYearly] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compute the effective org name (user input or default based on user's name)
  const defaultOrgName = user ? `${user.firstName || 'My'}'s Workspace` : '';
  const orgName = orgNameInput ?? defaultOrgName;

  // Determine if user already belongs to an organization (invited user flow)
  // If they have ANY organization membership, they don't need to create one
  const isInvitedUserFlow = onboardingContext?.hasOrganizations ?? false;

  // Steps vary based on user's role
  const steps: Step[] = useMemo(() => {
    if (isInvitedUserFlow) {
      return ['welcome', 'language', 'complete'];
    }
    return ['welcome', 'language', 'organization', 'plan'];
  }, [isInvitedUserFlow]);

  // Redirect if already onboarded
  useEffect(() => {
    if (user?.metadata?.onboardingComplete === 'true') {
      router.replace('/');
    }
  }, [user?.metadata?.onboardingComplete, router]);

  // Show nothing while redirecting
  if (user?.metadata?.onboardingComplete === 'true') {
    return null;
  }

  const handleNext = () => {
    setError(null);
    switch (step) {
      case 'welcome':
        setStep('language');
        break;
      case 'language':
        // Different next step based on flow
        if (isInvitedUserFlow) {
          setStep('complete');
        } else {
          setStep('organization');
        }
        break;
      case 'organization':
        if (!orgName.trim()) {
          setError('Organization name is required');
          return;
        }
        setStep('plan');
        break;
    }
  };

  const handleBack = () => {
    setError(null);
    switch (step) {
      case 'language':
        setStep('welcome');
        break;
      case 'organization':
        setStep('language');
        break;
      case 'plan':
        setStep('organization');
        break;
      case 'complete':
        setStep('language');
        break;
    }
  };

  // Complete onboarding for invited users (simpler flow - just saves preferences)
  const handleInvitedUserComplete = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      // Just save language preference and mark onboarding complete
      await completeOnboarding({
        preferredLocale: selectedLocale as 'en' | 'de' | 'fr' | 'it' | 'rm',
      });

      // If user has organizations, switch to the first one
      if (onboardingContext?.memberships && onboardingContext.memberships.length > 0) {
        const firstOrg = onboardingContext.memberships[0];
        await switchToOrganization(firstOrg.organizationId);
        console.log(`[Onboarding] Switched to organization: ${firstOrg.organizationId}`);
      }

      // Redirect to dashboard
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete onboarding');
      setIsSubmitting(false);
    }
  };

  const handleComplete = async () => {
    setError(null);
    setIsSubmitting(true);

    const plan = plans.find((p) => p.id === selectedPlan);
    if (!plan) {
      setError('Please select a plan');
      setIsSubmitting(false);
      return;
    }

    const priceId = isYearly ? plan.priceIdYearly : plan.priceIdMonthly;
    if (!priceId) {
      setError('Pricing not configured. Please contact support.');
      setIsSubmitting(false);
      return;
    }

    try {
      // 1. Create the organization with subscription
      const result = await createOrganization({
        name: orgName.trim(),
        priceId,
        tier: selectedPlan,
        successUrl: `${window.location.origin}/?onboarding=complete`,
        cancelUrl: `${window.location.origin}/onboarding?step=plan&canceled=true`,
      });

      // 2. Complete onboarding (save language preference)
      await completeOnboarding({
        preferredLocale: selectedLocale as 'en' | 'de' | 'fr' | 'it' | 'rm',
      });

      // 3. Switch to the new organization
      // Wait for auth state to propagate before redirecting
      await switchToOrganization(result.workosOrganizationId);
      console.log(`[Onboarding] Switched to organization: ${result.workosOrganizationId}`);

      // Small delay to ensure auth cookies are set before redirect
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 4. Redirect to Stripe checkout for payment
      // All plans require payment with a 30-day money-back guarantee
      const checkoutUrl = result.checkoutUrl;
      if (checkoutUrl) {
        console.log(`[Onboarding] Redirecting to Stripe checkout`);
        window.location.href = checkoutUrl;
      } else {
        // Fallback - should not happen
        console.error(`[Onboarding] No checkout URL returned`);
        window.location.href = '/?onboarding=complete';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create organization');
      setIsSubmitting(false);
    }
  };

  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user?.email?.[0]?.toUpperCase() || 'U';
  };

  // Loading state - wait for both user and onboarding context
  if (user === undefined || onboardingContext === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const currentStepIndex = steps.indexOf(step);

  return (
    <div className="flex min-h-screen">
      {/* Left side - Branding & Features */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-muted/30 border-r border-border">
        <div>
          {/* Logo */}
          <div className="flex items-center gap-3 mb-12">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-semibold">Flickerify</span>
          </div>

          {/* Tagline */}
          <div className="mb-12">
            <h1 className="text-3xl font-bold mb-3">Welcome to the future of compatibility management</h1>
            <p className="text-lg text-muted-foreground">
              Streamline your workflow with powerful tools designed for modern teams.
            </p>
          </div>

          {/* Features */}
          <div className="grid grid-cols-2 gap-4">
            {FEATURES.map((feature, index) => (
              <div
                key={index}
                className="rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent/50"
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-medium mb-1">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Flickerify. All rights reserved.</p>
      </div>

      {/* Right side - Onboarding Steps */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 overflow-y-auto">
        <div className="w-full max-w-lg">
          {/* Progress indicator */}
          <div className="flex items-center gap-2 mb-8">
            {steps.map((s, index) => (
              <div
                key={s}
                className={cn(
                  'h-1.5 flex-1 rounded-full transition-colors',
                  index <= currentStepIndex ? 'bg-primary' : 'bg-border',
                )}
              />
            ))}
          </div>

          {/* Step: Welcome */}
          {step === 'welcome' && (
            <div className="space-y-8">
              <div className="text-center">
                <Avatar className="h-20 w-20 mx-auto mb-4 border-2 border-border">
                  <AvatarImage src={user?.profilePictureUrl || undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <h2 className="text-2xl font-bold mb-2">Welcome{user?.firstName ? `, ${user.firstName}` : ''}!</h2>
                <p className="text-muted-foreground">
                  {isInvitedUserFlow
                    ? 'Just a few quick preferences and you&apos;re ready to go.'
                    : 'Let&apos;s set up your workspace in just a few steps.'}
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    {isInvitedUserFlow ? (
                      <Users className="h-6 w-6 text-primary" />
                    ) : (
                      <Sparkles className="h-6 w-6 text-primary" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">{isInvitedUserFlow ? 'Almost There' : 'Quick Setup'}</h3>
                    <p className="text-sm text-muted-foreground">
                      {isInvitedUserFlow
                        ? `You've been added to ${onboardingContext?.memberships?.[0]?.organizationName || 'an organization'}. Let's configure your preferences.`
                        : 'We&apos;ll help you configure your preferences and create your first organization. This will only take a minute.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="lg:hidden space-y-3">
                {FEATURES.slice(0, 2).map((feature, index) => (
                  <div key={index} className="flex items-center gap-3 text-sm text-muted-foreground">
                    <feature.icon className="h-4 w-4 text-primary" />
                    <span>{feature.title}</span>
                  </div>
                ))}
              </div>

              <Button onClick={handleNext} className="w-full h-11 gap-2">
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Step: Language Selection */}
          {step === 'language' && (
            <div className="space-y-8">
              <div className="text-center">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Globe className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Choose Your Language</h2>
                <p className="text-muted-foreground">Select your preferred language for the interface.</p>
              </div>

              <RadioGroup value={selectedLocale} onValueChange={setSelectedLocale} className="space-y-2">
                {LANGUAGES.map((lang) => (
                  <Label
                    key={lang.value}
                    htmlFor={lang.value}
                    className={cn(
                      'flex cursor-pointer items-center gap-4 rounded-xl border p-4 transition-all',
                      selectedLocale === lang.value
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border hover:border-primary/50 hover:bg-accent/50',
                    )}
                  >
                    <RadioGroupItem value={lang.value} id={lang.value} className="sr-only" />
                    <span className="text-2xl">{lang.flag}</span>
                    <span className="flex-1 font-medium">{lang.label}</span>
                    {selectedLocale === lang.value && <CheckCircle2 className="h-5 w-5 text-primary" />}
                  </Label>
                ))}
              </RadioGroup>

              <div className="flex gap-3">
                <Button variant="outline" onClick={handleBack} className="flex-1 h-11 gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button onClick={handleNext} className="flex-1 h-11 gap-2">
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step: Organization Name (Owner/Admin flow only) */}
          {step === 'organization' && !isInvitedUserFlow && (
            <div className="space-y-8">
              <div className="text-center">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Building2 className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Name Your Workspace</h2>
                <p className="text-muted-foreground">This is your organization where you&apos;ll manage everything.</p>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-card p-6">
                  <div className="flex items-start gap-4 mb-6">
                    <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-primary-foreground font-bold text-lg">
                      {orgName ? orgName.charAt(0).toUpperCase() : 'O'}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{orgName || 'Your Workspace'}</h3>
                      <p className="text-sm text-muted-foreground">You&apos;ll choose your plan next</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="orgName">Organization Name</Label>
                    <Input
                      id="orgName"
                      type="text"
                      placeholder="Acme Corporation"
                      value={orgName}
                      onChange={(e) => setOrgNameInput(e.target.value)}
                      className="text-base"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && orgName.trim()) {
                          handleNext();
                        }
                      }}
                    />
                  </div>
                </div>

                {error && <p className="text-sm text-destructive text-center">{error}</p>}
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={handleBack} className="flex-1 h-11 gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button onClick={handleNext} disabled={!orgName.trim()} className="flex-1 h-11 gap-2">
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step: Plan Selection (Owner/Admin flow only) */}
          {step === 'plan' && !isInvitedUserFlow && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-2">Choose Your Plan</h2>
                <p className="text-muted-foreground">All plans include a 30-day money-back guarantee.</p>
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

              {/* Plans */}
              <div className="space-y-3">
                {plans.map((plan) => {
                  const isSelected = selectedPlan === plan.id;
                  const price = isYearly ? plan.yearlyPrice : plan.monthlyPrice;
                  const PlanIcon = plan.icon;

                  return (
                    <Card
                      key={plan.id}
                      className={cn(
                        'relative cursor-pointer transition-all hover:border-primary/50',
                        isSelected && 'border-primary ring-2 ring-primary',
                        plan.popular && 'shadow-md',
                      )}
                      onClick={() => setSelectedPlan(plan.id)}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                'h-10 w-10 rounded-lg flex items-center justify-center',
                                isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted',
                              )}
                            >
                              <PlanIcon className="h-5 w-5" />
                            </div>
                            <div>
                              <CardTitle className="text-base flex items-center gap-2">
                                {plan.name}
                                {plan.popular && <Badge>Popular</Badge>}
                              </CardTitle>
                              <CardDescription>{plan.description}</CardDescription>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold">${price}</div>
                            <div className="text-xs text-muted-foreground">/{isYearly ? 'year' : 'month'}</div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex flex-wrap gap-2">
                          {plan.features.map((feature) => (
                            <div key={feature} className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Check className="h-3 w-3 text-emerald-500" />
                              {feature}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Money-back guarantee note */}
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Shield className="h-4 w-4 text-emerald-500" />
                <span>30-day money-back guarantee on all plans</span>
              </div>

              {error && <p className="text-sm text-destructive text-center">{error}</p>}

              <div className="flex gap-3">
                <Button variant="outline" onClick={handleBack} disabled={isSubmitting} className="flex-1 h-11 gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button onClick={handleComplete} disabled={isSubmitting} className="flex-1 h-11 gap-2">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating…
                    </>
                  ) : (
                    <>
                      Continue to Payment
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Step: Complete (Invited user flow - already belongs to an organization) */}
          {step === 'complete' && isInvitedUserFlow && (
            <div className="space-y-8">
              <div className="text-center">
                <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                  <PartyPopper className="h-8 w-8 text-emerald-500" />
                </div>
                <h2 className="text-2xl font-bold mb-2">You&apos;re All Set!</h2>
                <p className="text-muted-foreground">
                  You&apos;re already part of{' '}
                  {onboardingContext?.memberships && onboardingContext.memberships.length > 0 ? (
                    <span className="font-medium text-foreground">
                      {onboardingContext.memberships[0].organizationName}
                    </span>
                  ) : (
                    'an organization'
                  )}
                  . Let&apos;s get you started.
                </p>
              </div>

              {/* Organization info card */}
              {onboardingContext?.memberships && onboardingContext.memberships.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-6">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-primary-foreground font-bold text-lg">
                      {onboardingContext.memberships[0].organizationName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{onboardingContext.memberships[0].organizationName}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="capitalize">
                          {onboardingContext.memberships[0].role}
                        </Badge>
                        {onboardingContext.memberships.length > 1 && (
                          <span className="text-sm text-muted-foreground">
                            +{onboardingContext.memberships.length - 1} more organization
                            {onboardingContext.memberships.length > 2 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                  </div>
                </div>
              )}

              {/* Quick summary */}
              <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                <h4 className="font-medium text-sm">Your preferences</h4>
                <div className="flex items-center gap-3">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    Language:{' '}
                    <span className="font-medium">
                      {LANGUAGES.find((l) => l.value === selectedLocale)?.label || 'English'}
                    </span>
                  </span>
                </div>
              </div>

              {error && <p className="text-sm text-destructive text-center">{error}</p>}

              <div className="flex gap-3">
                <Button variant="outline" onClick={handleBack} disabled={isSubmitting} className="flex-1 h-11 gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button onClick={handleInvitedUserComplete} disabled={isSubmitting} className="flex-1 h-11 gap-2">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Finishing…
                    </>
                  ) : (
                    <>
                      Go to Dashboard
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Terms */}
          <p className="text-xs text-center text-muted-foreground mt-8">
            By continuing, you agree to our{' '}
            <a href="/terms" className="underline hover:text-foreground">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="/privacy" className="underline hover:text-foreground">
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
