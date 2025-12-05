'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from '@tanstack/react-form';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import { toast } from 'sonner';
import { z } from 'zod';

import { PageShell } from '@/components/dashboard/page-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from '@/components/ui/field';
import {
  IconBuilding,
  IconUsers,
  IconShieldLock,
  IconChartBar,
  IconApi,
  IconBrandSlack,
  IconArrowLeft,
} from '@tabler/icons-react';

// Constants
const COMPANY_SIZES = [
  { value: '1-10', label: '1–10 employees' },
  { value: '11-50', label: '11–50 employees' },
  { value: '51-200', label: '51–200 employees' },
  { value: '201-500', label: '201–500 employees' },
  { value: '501-1000', label: '501–1,000 employees' },
  { value: '1000+', label: '1,000+ employees' },
] as const;

type CompanySize = (typeof COMPANY_SIZES)[number]['value'];

const INDUSTRIES = [
  'Technology',
  'Healthcare',
  'Finance & Banking',
  'E-commerce & Retail',
  'Manufacturing',
  'Education',
  'Media & Entertainment',
  'Professional Services',
  'Government',
  'Non-profit',
  'Other',
] as const;

const TIMELINES = [
  { value: 'immediate', label: 'Immediately' },
  { value: '1-3-months', label: 'Within 1–3 months' },
  { value: '3-6-months', label: 'Within 3–6 months' },
  { value: '6-12-months', label: 'Within 6–12 months' },
  { value: 'exploring', label: 'Just exploring' },
] as const;

const BUDGETS = [
  { value: 'under-5k', label: 'Under $5,000/year' },
  { value: '5k-10k', label: '$5,000–$10,000/year' },
  { value: '10k-25k', label: '$10,000–$25,000/year' },
  { value: '25k-50k', label: '$25,000–$50,000/year' },
  { value: '50k-100k', label: '$50,000–$100,000/year' },
  { value: 'over-100k', label: 'Over $100,000/year' },
  { value: 'not-sure', label: 'Not sure yet' },
] as const;

const ENTERPRISE_FEATURES = [
  { id: 'unlimited_members', label: 'Unlimited team members', icon: IconUsers },
  { id: 'sso_saml', label: 'SSO/SAML authentication', icon: IconShieldLock },
  { id: 'audit_logs', label: 'Audit logs & compliance', icon: IconChartBar },
  { id: 'advanced_analytics', label: 'Advanced analytics', icon: IconChartBar },
  { id: 'custom_integrations', label: 'Custom integrations', icon: IconApi },
  { id: 'priority_support', label: 'Priority support', icon: IconBrandSlack },
  { id: 'custom_branding', label: 'Custom branding', icon: IconBuilding },
  { id: 'dedicated_infrastructure', label: 'Dedicated infrastructure', icon: IconBuilding },
] as const;

// Individual field validators
const fieldValidators = {
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.email({ message: 'Please enter a valid email address' }).min(1, 'Email is required'),
  phone: z.string().optional(),
  jobTitle: z.string().min(1, 'Job title is required'),
  companyName: z.string().min(2, 'Company name must be at least 2 characters'),
  companyWebsite: z.string().optional(),
  companySize: z
    .string()
    .min(1, 'Please select a company size')
    .refine((val) => ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'].includes(val), {
      message: 'Please select a valid company size',
    }),
  industry: z.string().min(1, 'Please select an industry'),
  expectedUsers: z.number().min(1, 'Expected users must be at least 1'),
  useCase: z.string().min(20, 'Please provide at least 20 characters describing your use case'),
  currentSolution: z.string().optional(),
  timeline: z.string().min(1, 'Please select a timeline'),
  budget: z.string().min(1, 'Please select a budget range'),
  additionalRequirements: z.string().optional(),
  interestedFeatures: z.array(z.string()).min(1, 'Please select at least one feature'),
};

// Helper to create field validator
function createFieldValidator<T>(schema: z.ZodType<T>) {
  return ({ value }: { value: T }) => {
    const result = schema.safeParse(value);
    if (!result.success) {
      return result.error.issues[0]?.message;
    }
    return undefined;
  };
}

export default function EnterpriseRequestPage() {
  const router = useRouter();
  const { organizationId } = useAuth();

  // Get organization and user data
  const organizations = useQuery(api.organizations.query.getOrganizationsByUserId);
  const currentOrg = organizations?.find((org) => org.externalId === organizationId);
  const currentUser = useQuery(api.users.query.me);

  const submitInquiry = useMutation(api.enterpriseInquiry.mutation.submit);

  const form = useForm({
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      jobTitle: '',
      companyName: '',
      companyWebsite: '',
      companySize: '' as CompanySize | '',
      industry: '',
      expectedUsers: 10,
      useCase: '',
      currentSolution: '',
      timeline: '',
      budget: '',
      additionalRequirements: '',
      interestedFeatures: [] as string[],
    },
    onSubmit: async ({ value }) => {
      try {
        const result = await submitInquiry({
          firstName: value.firstName,
          lastName: value.lastName,
          email: value.email,
          phone: value.phone || undefined,
          jobTitle: value.jobTitle,
          companyName: value.companyName,
          companyWebsite: value.companyWebsite || undefined,
          companySize: value.companySize as CompanySize,
          industry: value.industry,
          expectedUsers: value.expectedUsers,
          useCase: value.useCase,
          currentSolution: value.currentSolution || undefined,
          timeline: value.timeline,
          budget: value.budget || undefined,
          additionalRequirements: value.additionalRequirements || undefined,
          interestedFeatures: value.interestedFeatures,
        });

        if (result.success) {
          toast.success(result.message);
          router.push('/administration/billing?enterprise_submitted=true');
        } else {
          toast.error(result.message);
        }
      } catch (error) {
        console.error('Failed to submit inquiry:', error);
        toast.error('Something went wrong. Please try again.');
      }
    },
  });

  // Pre-fill form with user and organization data
  useEffect(() => {
    if (currentUser) {
      form.setFieldValue('firstName', currentUser.firstName || '');
      form.setFieldValue('lastName', currentUser.lastName || '');
      form.setFieldValue('email', currentUser.email || '');
    }
    if (currentOrg) {
      form.setFieldValue('companyName', currentOrg.name || '');
    }
  }, [currentUser, currentOrg, form]);

  return (
    <PageShell
      title="Enterprise Inquiry"
      description="Tell us about your organization and needs. Our team will prepare a custom proposal."
    >
      <div className="mx-auto max-w-3xl">
        <Button variant="ghost" className="mb-6 -ml-2" onClick={() => router.back()}>
          <IconArrowLeft className="mr-2 h-4 w-4" />
          Back to Billing
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Contact Enterprise Sales</CardTitle>
            <CardDescription>
              Complete the form below and our team will get back to you within 1–2 business days with a custom proposal
              tailored to your needs.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form
              id="enterprise-inquiry-form"
              onSubmit={(e) => {
                e.preventDefault();
                form.handleSubmit();
              }}
            >
              <FieldGroup>
                {/* Contact Information */}
                <FieldSet>
                  <FieldLegend>Contact Information</FieldLegend>
                  <FieldDescription>How can we reach you?</FieldDescription>

                  <FieldGroup>
                    <div className="grid gap-6 sm:grid-cols-2">
                      <form.Field
                        name="firstName"
                        validators={{
                          onBlur: createFieldValidator(fieldValidators.firstName),
                        }}
                      >
                        {(field) => {
                          const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                          return (
                            <Field data-invalid={isInvalid}>
                              <FieldLabel htmlFor={field.name}>
                                First name <span className="text-destructive">*</span>
                              </FieldLabel>
                              <Input
                                id={field.name}
                                name={field.name}
                                value={field.state.value}
                                onBlur={field.handleBlur}
                                onChange={(e) => field.handleChange(e.target.value)}
                                aria-invalid={isInvalid}
                                placeholder="John"
                                autoComplete="given-name"
                              />
                              {isInvalid && <FieldError errors={field.state.meta.errors} />}
                            </Field>
                          );
                        }}
                      </form.Field>

                      <form.Field
                        name="lastName"
                        validators={{
                          onBlur: createFieldValidator(fieldValidators.lastName),
                        }}
                      >
                        {(field) => {
                          const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                          return (
                            <Field data-invalid={isInvalid}>
                              <FieldLabel htmlFor={field.name}>
                                Last name <span className="text-destructive">*</span>
                              </FieldLabel>
                              <Input
                                id={field.name}
                                name={field.name}
                                value={field.state.value}
                                onBlur={field.handleBlur}
                                onChange={(e) => field.handleChange(e.target.value)}
                                aria-invalid={isInvalid}
                                placeholder="Doe"
                                autoComplete="family-name"
                              />
                              {isInvalid && <FieldError errors={field.state.meta.errors} />}
                            </Field>
                          );
                        }}
                      </form.Field>
                    </div>

                    <form.Field
                      name="email"
                      validators={{
                        onBlur: createFieldValidator(fieldValidators.email),
                      }}
                    >
                      {(field) => {
                        const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                        return (
                          <Field data-invalid={isInvalid}>
                            <FieldLabel htmlFor={field.name}>
                              Work email <span className="text-destructive">*</span>
                            </FieldLabel>
                            <Input
                              id={field.name}
                              name={field.name}
                              type="email"
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) => field.handleChange(e.target.value)}
                              aria-invalid={isInvalid}
                              placeholder="john@company.com"
                              autoComplete="email"
                            />
                            {isInvalid && <FieldError errors={field.state.meta.errors} />}
                          </Field>
                        );
                      }}
                    </form.Field>

                    <div className="grid gap-6 sm:grid-cols-2">
                      <form.Field name="phone">
                        {(field) => {
                          const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                          return (
                            <Field data-invalid={isInvalid}>
                              <FieldLabel htmlFor={field.name}>
                                Phone number <span className="text-muted-foreground">(optional)</span>
                              </FieldLabel>
                              <Input
                                id={field.name}
                                name={field.name}
                                type="tel"
                                value={field.state.value}
                                onBlur={field.handleBlur}
                                onChange={(e) => field.handleChange(e.target.value)}
                                aria-invalid={isInvalid}
                                placeholder="+1 (555) 123-4567"
                                autoComplete="tel"
                              />
                              {isInvalid && <FieldError errors={field.state.meta.errors} />}
                            </Field>
                          );
                        }}
                      </form.Field>

                      <form.Field
                        name="jobTitle"
                        validators={{
                          onBlur: createFieldValidator(fieldValidators.jobTitle),
                        }}
                      >
                        {(field) => {
                          const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                          return (
                            <Field data-invalid={isInvalid}>
                              <FieldLabel htmlFor={field.name}>
                                Job title <span className="text-destructive">*</span>
                              </FieldLabel>
                              <Input
                                id={field.name}
                                name={field.name}
                                value={field.state.value}
                                onBlur={field.handleBlur}
                                onChange={(e) => field.handleChange(e.target.value)}
                                aria-invalid={isInvalid}
                                placeholder="CTO, Engineering Manager…"
                                autoComplete="organization-title"
                              />
                              {isInvalid && <FieldError errors={field.state.meta.errors} />}
                            </Field>
                          );
                        }}
                      </form.Field>
                    </div>
                  </FieldGroup>
                </FieldSet>

                <FieldSeparator />

                {/* Company Information */}
                <FieldSet>
                  <FieldLegend>Company Information</FieldLegend>
                  <FieldDescription>Tell us about your organization.</FieldDescription>

                  <FieldGroup>
                    <form.Field
                      name="companyName"
                      validators={{
                        onBlur: createFieldValidator(fieldValidators.companyName),
                      }}
                    >
                      {(field) => {
                        const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                        return (
                          <Field data-invalid={isInvalid}>
                            <FieldLabel htmlFor={field.name}>
                              Company name <span className="text-destructive">*</span>
                            </FieldLabel>
                            <Input
                              id={field.name}
                              name={field.name}
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) => field.handleChange(e.target.value)}
                              aria-invalid={isInvalid}
                              placeholder="Acme Inc."
                              autoComplete="organization"
                            />
                            {isInvalid && <FieldError errors={field.state.meta.errors} />}
                          </Field>
                        );
                      }}
                    </form.Field>

                    <form.Field name="companyWebsite">
                      {(field) => {
                        const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                        return (
                          <Field data-invalid={isInvalid}>
                            <FieldLabel htmlFor={field.name}>
                              Company website <span className="text-muted-foreground">(optional)</span>
                            </FieldLabel>
                            <Input
                              id={field.name}
                              name={field.name}
                              type="url"
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) => field.handleChange(e.target.value)}
                              aria-invalid={isInvalid}
                              placeholder="https://company.com"
                              autoComplete="url"
                            />
                            {isInvalid && <FieldError errors={field.state.meta.errors} />}
                          </Field>
                        );
                      }}
                    </form.Field>

                    <div className="grid gap-6 sm:grid-cols-2">
                      <form.Field
                        name="companySize"
                        validators={{
                          onBlur: createFieldValidator(fieldValidators.companySize),
                        }}
                      >
                        {(field) => {
                          const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                          return (
                            <Field data-invalid={isInvalid}>
                              <FieldLabel htmlFor={field.name}>
                                Company size <span className="text-destructive">*</span>
                              </FieldLabel>
                              <Select
                                name={field.name}
                                value={field.state.value}
                                onValueChange={(v) => {
                                  field.handleChange(v as CompanySize);
                                  field.handleBlur();
                                }}
                              >
                                <SelectTrigger id={field.name} aria-invalid={isInvalid}>
                                  <SelectValue placeholder="Select size…" />
                                </SelectTrigger>
                                <SelectContent>
                                  {COMPANY_SIZES.map((size) => (
                                    <SelectItem key={size.value} value={size.value}>
                                      {size.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {isInvalid && <FieldError errors={field.state.meta.errors} />}
                            </Field>
                          );
                        }}
                      </form.Field>

                      <form.Field
                        name="industry"
                        validators={{
                          onBlur: createFieldValidator(fieldValidators.industry),
                        }}
                      >
                        {(field) => {
                          const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                          return (
                            <Field data-invalid={isInvalid}>
                              <FieldLabel htmlFor={field.name}>
                                Industry <span className="text-destructive">*</span>
                              </FieldLabel>
                              <Select
                                name={field.name}
                                value={field.state.value}
                                onValueChange={(v) => {
                                  field.handleChange(v);
                                  field.handleBlur();
                                }}
                              >
                                <SelectTrigger id={field.name} aria-invalid={isInvalid}>
                                  <SelectValue placeholder="Select industry…" />
                                </SelectTrigger>
                                <SelectContent>
                                  {INDUSTRIES.map((industry) => (
                                    <SelectItem key={industry} value={industry}>
                                      {industry}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {isInvalid && <FieldError errors={field.state.meta.errors} />}
                            </Field>
                          );
                        }}
                      </form.Field>
                    </div>

                    <form.Field
                      name="expectedUsers"
                      validators={{
                        onBlur: createFieldValidator(fieldValidators.expectedUsers),
                      }}
                    >
                      {(field) => {
                        const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                        return (
                          <Field data-invalid={isInvalid}>
                            <FieldLabel htmlFor={field.name}>
                              Expected number of users <span className="text-destructive">*</span>
                            </FieldLabel>
                            <Input
                              id={field.name}
                              name={field.name}
                              type="number"
                              min={1}
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) => field.handleChange(parseInt(e.target.value) || 0)}
                              aria-invalid={isInvalid}
                              placeholder="50"
                            />
                            <FieldDescription>How many team members will be using Flickerify?</FieldDescription>
                            {isInvalid && <FieldError errors={field.state.meta.errors} />}
                          </Field>
                        );
                      }}
                    </form.Field>
                  </FieldGroup>
                </FieldSet>

                <FieldSeparator />

                {/* Requirements */}
                <FieldSet>
                  <FieldLegend>Your Requirements</FieldLegend>
                  <FieldDescription>Help us understand your needs.</FieldDescription>

                  <FieldGroup>
                    <form.Field
                      name="useCase"
                      validators={{
                        onBlur: createFieldValidator(fieldValidators.useCase),
                      }}
                    >
                      {(field) => {
                        const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                        return (
                          <Field data-invalid={isInvalid}>
                            <FieldLabel htmlFor={field.name}>
                              How do you plan to use Flickerify? <span className="text-destructive">*</span>
                            </FieldLabel>
                            <Textarea
                              id={field.name}
                              name={field.name}
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) => field.handleChange(e.target.value)}
                              aria-invalid={isInvalid}
                              placeholder="Describe your use case and what you're looking to achieve…"
                              rows={4}
                              className="min-h-[120px] resize-none"
                            />
                            <FieldDescription>
                              Minimum 20 characters. The more detail, the better we can tailor our proposal.
                            </FieldDescription>
                            {isInvalid && <FieldError errors={field.state.meta.errors} />}
                          </Field>
                        );
                      }}
                    </form.Field>

                    <form.Field name="currentSolution">
                      {(field) => {
                        const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                        return (
                          <Field data-invalid={isInvalid}>
                            <FieldLabel htmlFor={field.name}>
                              Current solution <span className="text-muted-foreground">(optional)</span>
                            </FieldLabel>
                            <Input
                              id={field.name}
                              name={field.name}
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) => field.handleChange(e.target.value)}
                              aria-invalid={isInvalid}
                              placeholder="e.g., Building in-house, using Competitor X…"
                            />
                            {isInvalid && <FieldError errors={field.state.meta.errors} />}
                          </Field>
                        );
                      }}
                    </form.Field>

                    <div className="grid gap-6 sm:grid-cols-2">
                      <form.Field
                        name="timeline"
                        validators={{
                          onBlur: createFieldValidator(fieldValidators.timeline),
                        }}
                      >
                        {(field) => {
                          const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                          return (
                            <Field data-invalid={isInvalid}>
                              <FieldLabel htmlFor={field.name}>
                                When do you need this? <span className="text-destructive">*</span>
                              </FieldLabel>
                              <Select
                                name={field.name}
                                value={field.state.value}
                                onValueChange={(v) => {
                                  field.handleChange(v);
                                  field.handleBlur();
                                }}
                              >
                                <SelectTrigger id={field.name} aria-invalid={isInvalid}>
                                  <SelectValue placeholder="Select timeline…" />
                                </SelectTrigger>
                                <SelectContent>
                                  {TIMELINES.map((t) => (
                                    <SelectItem key={t.value} value={t.value}>
                                      {t.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {isInvalid && <FieldError errors={field.state.meta.errors} />}
                            </Field>
                          );
                        }}
                      </form.Field>

                      <form.Field
                        name="budget"
                        validators={{
                          onBlur: createFieldValidator(fieldValidators.budget),
                        }}
                      >
                        {(field) => {
                          const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                          return (
                            <Field data-invalid={isInvalid}>
                              <FieldLabel htmlFor={field.name}>
                                Budget range <span className="text-destructive">*</span>
                              </FieldLabel>
                              <Select
                                name={field.name}
                                value={field.state.value}
                                onValueChange={(v) => {
                                  field.handleChange(v);
                                  field.handleBlur();
                                }}
                              >
                                <SelectTrigger id={field.name} aria-invalid={isInvalid}>
                                  <SelectValue placeholder="Select budget…" />
                                </SelectTrigger>
                                <SelectContent>
                                  {BUDGETS.map((b) => (
                                    <SelectItem key={b.value} value={b.value}>
                                      {b.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {isInvalid && <FieldError errors={field.state.meta.errors} />}
                            </Field>
                          );
                        }}
                      </form.Field>
                    </div>

                    <form.Field name="additionalRequirements">
                      {(field) => {
                        const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                        return (
                          <Field data-invalid={isInvalid}>
                            <FieldLabel htmlFor={field.name}>
                              Anything else we should know? <span className="text-muted-foreground">(optional)</span>
                            </FieldLabel>
                            <Textarea
                              id={field.name}
                              name={field.name}
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) => field.handleChange(e.target.value)}
                              aria-invalid={isInvalid}
                              placeholder="Security requirements, compliance needs, integrations…"
                              rows={3}
                              className="resize-none"
                            />
                            {isInvalid && <FieldError errors={field.state.meta.errors} />}
                          </Field>
                        );
                      }}
                    </form.Field>
                  </FieldGroup>
                </FieldSet>

                <FieldSeparator />

                {/* Features of Interest */}
                <form.Field
                  name="interestedFeatures"
                  mode="array"
                  validators={{
                    onBlur: createFieldValidator(fieldValidators.interestedFeatures),
                    onChange: createFieldValidator(fieldValidators.interestedFeatures),
                  }}
                >
                  {(field) => {
                    const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                    return (
                      <FieldSet>
                        <FieldLegend>
                          Features of Interest <span className="text-destructive">*</span>
                        </FieldLegend>
                        <FieldDescription>
                          Select the enterprise features that are most important to you.
                        </FieldDescription>

                        <FieldGroup data-slot="checkbox-group">
                          <div className="grid gap-3 sm:grid-cols-2">
                            {ENTERPRISE_FEATURES.map((feature) => {
                              const Icon = feature.icon;
                              const isSelected = field.state.value.includes(feature.id);
                              return (
                                <Field
                                  key={feature.id}
                                  orientation="horizontal"
                                  data-invalid={isInvalid}
                                  className={
                                    isSelected
                                      ? 'rounded-lg border border-primary bg-primary/5 p-3'
                                      : 'rounded-lg border border-border p-3 hover:bg-muted/50'
                                  }
                                >
                                  <Checkbox
                                    id={`feature-${feature.id}`}
                                    name={field.name}
                                    aria-invalid={isInvalid}
                                    checked={isSelected}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        field.pushValue(feature.id);
                                      } else {
                                        const index = field.state.value.indexOf(feature.id);
                                        if (index > -1) {
                                          field.removeValue(index);
                                        }
                                      }
                                      // Mark field as touched to trigger validation
                                      field.handleBlur();
                                    }}
                                  />
                                  <Icon className="h-4 w-4 text-muted-foreground" />
                                  <FieldLabel htmlFor={`feature-${feature.id}`} className="cursor-pointer font-normal">
                                    {feature.label}
                                  </FieldLabel>
                                </Field>
                              );
                            })}
                          </div>
                        </FieldGroup>
                        {isInvalid && <FieldError errors={field.state.meta.errors} />}
                      </FieldSet>
                    );
                  }}
                </form.Field>
              </FieldGroup>
            </form>
          </CardContent>

          <CardFooter className="flex justify-between border-t pt-6">
            <Button type="button" variant="outline" onClick={() => form.reset()}>
              Reset
            </Button>
            <form.Subscribe selector={(state) => [state.isSubmitting, state.isValid]}>
              {([isSubmitting, isValid]) => (
                <Button
                  type="submit"
                  form="enterprise-inquiry-form"
                  disabled={isSubmitting}
                  onClick={() => {
                    // Touch all fields to show validation errors
                    if (!isValid) {
                      Object.keys(form.state.fieldMeta).forEach((fieldName) => {
                        form.validateField(fieldName as keyof typeof form.state.values, 'blur');
                      });
                    }
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <Spinner className="mr-2 h-4 w-4" />
                      Submitting…
                    </>
                  ) : (
                    'Submit Inquiry'
                  )}
                </Button>
              )}
            </form.Subscribe>
          </CardFooter>
        </Card>
      </div>
    </PageShell>
  );
}
