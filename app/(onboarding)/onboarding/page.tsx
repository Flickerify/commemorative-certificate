'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAction, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  Globe,
  Sparkles,
  ArrowRight,
  Loader2,
  Zap,
  Shield,
  Users,
  BarChart3,
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

type Step = 'welcome' | 'language' | 'complete';

export default function OnboardingPage() {
  const router = useRouter();
  const user = useQuery(api.users.query.me);
  const completeOnboarding = useAction(api.users.action.completeOnboarding);

  const [selectedLocale, setSelectedLocale] = useState<string>('en');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<Step>('welcome');

  // Redirect if already onboarded
  if (user?.metadata?.onboardingComplete === 'true') {
    router.replace('/');
    return null;
  }

  const handleComplete = async () => {
    setIsSubmitting(true);
    try {
      await completeOnboarding({
        preferredLocale: selectedLocale as 'en' | 'de' | 'fr' | 'it' | 'rm',
      });
      setStep('complete');
      setTimeout(() => {
        router.replace('/');
      }, 1500);
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user?.email?.[0]?.toUpperCase() || 'U';
  };

  // Loading state
  if (user === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} Flickerify. All rights reserved.
        </p>
      </div>

      {/* Right side - Onboarding Steps */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          {/* Progress indicator */}
          <div className="flex items-center gap-2 mb-8">
            {(['welcome', 'language', 'complete'] as Step[]).map((s, index) => (
              <div
                key={s}
                className={cn(
                  'h-1.5 flex-1 rounded-full transition-colors',
                  step === s || (step === 'complete' && index < 2) || (step === 'language' && index === 0)
                    ? 'bg-primary'
                    : 'bg-border'
                )}
              />
            ))}
          </div>

          {/* Step: Welcome */}
          {step === 'welcome' && (
            <div className="space-y-8">
              {/* User greeting */}
              <div className="text-center">
                <Avatar className="h-20 w-20 mx-auto mb-4 border-2 border-border">
                  <AvatarImage src={user?.profilePictureUrl || undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <h2 className="text-2xl font-bold mb-2">
                  Welcome{user?.firstName ? `, ${user.firstName}` : ''}!
                </h2>
                <p className="text-muted-foreground">
                  Let's personalize your experience in just a moment.
                </p>
              </div>

              {/* Info card */}
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Sparkles className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Quick Setup</h3>
                    <p className="text-sm text-muted-foreground">
                      We'll help you configure your preferences so you can get started right away.
                      This will only take a few seconds.
                    </p>
                  </div>
                </div>
              </div>

              {/* Mobile features (shown only on mobile) */}
              <div className="lg:hidden space-y-3">
                {FEATURES.slice(0, 2).map((feature, index) => (
                  <div key={index} className="flex items-center gap-3 text-sm text-muted-foreground">
                    <feature.icon className="h-4 w-4 text-primary" />
                    <span>{feature.title}</span>
                  </div>
                ))}
              </div>

              <Button onClick={() => setStep('language')} className="w-full h-11 gap-2">
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
                <p className="text-muted-foreground">
                  Select your preferred language for the interface.
                </p>
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
                        : 'border-border hover:border-primary/50 hover:bg-accent/50'
                    )}
                  >
                    <RadioGroupItem value={lang.value} id={lang.value} className="sr-only" />
                    <span className="text-2xl">{lang.flag}</span>
                    <span className="flex-1 font-medium">{lang.label}</span>
                    {selectedLocale === lang.value && (
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    )}
                  </Label>
                ))}
              </RadioGroup>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep('welcome')} className="flex-1 h-11">
                  Back
                </Button>
                <Button onClick={handleComplete} disabled={isSubmitting} className="flex-1 h-11 gap-2">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      Complete Setup
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Step: Complete */}
          {step === 'complete' && (
            <div className="space-y-8 text-center">
              <div>
                <div className="h-20 w-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4 animate-in zoom-in-50 duration-300">
                  <CheckCircle2 className="h-10 w-10 text-green-500" />
                </div>
                <h2 className="text-2xl font-bold mb-2">You're All Set!</h2>
                <p className="text-muted-foreground">
                  Your preferences have been saved. Redirecting you to the dashboard…
                </p>
              </div>

              <div className="flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}

          {/* Terms */}
          {step !== 'complete' && (
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
          )}
        </div>
      </div>
    </div>
  );
}
