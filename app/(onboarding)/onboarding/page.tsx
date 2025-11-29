'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Spinner } from '@/components/ui/spinner';
import { api } from '@/convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import { CheckCircle2, Globe, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const LANGUAGES = [
  { value: 'en', label: 'English', flag: '🇬🇧' },
  { value: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { value: 'fr', label: 'Français', flag: '🇫🇷' },
  { value: 'it', label: 'Italiano', flag: '🇮🇹' },
  { value: 'rm', label: 'Rumantsch', flag: '🇨🇭' },
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const user = useQuery(api.users.query.me);
  const completeOnboarding = useMutation(api.users.mutation.completeOnboarding);

  const [selectedLocale, setSelectedLocale] = useState<string>('en');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<'welcome' | 'locale' | 'complete'>('welcome');

  // Redirect if already onboarded
  if (user?.metadata?.onboardingComplete === true) {
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

  if (user === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8 text-white" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md border-slate-800 bg-slate-900/80 backdrop-blur-sm">
        {step === 'welcome' && (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500">
                <Sparkles className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-2xl text-white">
                Welcome{user?.firstName ? `, ${user.firstName}` : ''}!
              </CardTitle>
              <CardDescription className="text-slate-400">Let's get you set up in just a moment.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-center text-sm text-slate-300">
                We're excited to have you here. Let's personalize your experience.
              </p>
              <Button
                onClick={() => setStep('locale')}
                className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500"
              >
                Get Started
              </Button>
            </CardContent>
          </>
        )}

        {step === 'locale' && (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-500">
                <Globe className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-2xl text-white">Choose Your Language</CardTitle>
              <CardDescription className="text-slate-400">
                Select your preferred language for the interface.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <RadioGroup value={selectedLocale} onValueChange={setSelectedLocale} className="space-y-3">
                {LANGUAGES.map((lang) => (
                  <Label
                    key={lang.value}
                    htmlFor={lang.value}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-700 bg-slate-800/50 p-4 transition-colors hover:border-slate-600 hover:bg-slate-800 has-[[data-state=checked]]:border-violet-500 has-[[data-state=checked]]:bg-violet-500/10"
                  >
                    <RadioGroupItem value={lang.value} id={lang.value} className="sr-only" />
                    <span className="text-2xl">{lang.flag}</span>
                    <span className="text-white">{lang.label}</span>
                  </Label>
                ))}
              </RadioGroup>
              <Button
                onClick={handleComplete}
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500"
              >
                {isSubmitting ? <Spinner className="mr-2 h-4 w-4" /> : null}
                {isSubmitting ? 'Saving...' : 'Complete Setup'}
              </Button>
            </CardContent>
          </>
        )}

        {step === 'complete' && (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-green-500">
                <CheckCircle2 className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-2xl text-white">You're All Set!</CardTitle>
              <CardDescription className="text-slate-400">Redirecting you to the dashboard...</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center">
                <Spinner className="h-6 w-6 text-white" />
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
