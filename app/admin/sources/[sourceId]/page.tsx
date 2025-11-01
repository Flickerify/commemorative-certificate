'use client';

import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LocationCombobox } from '@/components/admin/LocationCombobox';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldLabel, FieldError, FieldDescription, FieldGroup, FieldContent } from '@/components/ui/field';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { ENTITY_TYPES, LANGUAGES } from '@/convex/schema';
import { Id } from '@/convex/_generated/dataModel';
import { useForm } from '@tanstack/react-form';
import { z } from 'zod';
import { useEffect } from 'react';

type EntityType = (typeof ENTITY_TYPES)[keyof typeof ENTITY_TYPES];
type LanguageType = (typeof LANGUAGES)[keyof typeof LANGUAGES];

type FormValues = {
  url: string;
  name: string;
  entityType: string;
  locationId: string;
  lang: string;
  enabled: boolean;
  notes: string;
};

const formSchema = z.object({
  url: z.url('Please enter a valid URL').min(1, 'URL is required'),
  name: z.string(),
  entityType: z.string().refine((val) => val === '' || Object.values(ENTITY_TYPES).includes(val as EntityType), {
    message: 'Invalid entity type',
  }),
  locationId: z.string(),
  lang: z.string().refine((val) => val === '' || Object.values(LANGUAGES).includes(val as LanguageType), {
    message: 'Invalid language',
  }),
  enabled: z.boolean(),
  notes: z.string(),
});

export default function EditSourcePage() {
  const router = useRouter();
  const params = useParams();
  const sourceId = params.sourceId as Id<'sources'>;

  const source = useQuery(api.sources.query.getSource, { sourceId });
  const updateSource = useMutation(api.sources.mutation.updateSource);

  const form = useForm({
    defaultValues: source
      ? {
          url: source.url,
          name: source.name ?? '',
          entityType: source.entityType ?? '',
          locationId: source.locationId ?? '',
          lang: source.lang ?? '',
          enabled: source.enabled,
          notes: source.notes ?? '',
        }
      : ({
          url: '',
          name: '',
          entityType: '',
          locationId: '',
          lang: '',
          enabled: true,
          notes: '',
        } as FormValues),
    validators: {
      onSubmit: formSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        await updateSource({
          sourceId,
          url: value.url.trim(),
          name: value.name?.trim() || undefined,
          entityType: (value.entityType && value.entityType !== '' ? value.entityType : undefined) as
            | (typeof ENTITY_TYPES)[keyof typeof ENTITY_TYPES]
            | undefined,
          locationId:
            value.locationId && value.locationId !== ''
              ? (value.locationId as Id<'locations'>)
              : value.locationId === ''
                ? null
                : undefined,
          lang: (value.lang && value.lang !== '' ? value.lang : undefined) as
            | (typeof LANGUAGES)[keyof typeof LANGUAGES]
            | undefined,
          enabled: value.enabled,
          notes: value.notes?.trim() || undefined,
        });
        router.push('/admin/sources');
      } catch (err) {
        throw new Error(err instanceof Error ? err.message : 'Failed to update source');
      }
    },
  });

  // Update form when source data loads
  useEffect(() => {
    if (source) {
      form.reset({
        url: source.url,
        name: source.name || '',
        entityType: source.entityType ?? '',
        locationId: source.locationId ?? '',
        lang: source.lang ?? '',
        enabled: source.enabled,
        notes: source.notes || '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source?._id]);

  if (source === undefined) {
    return (
      <div className="space-y-8">
        <div className="text-center py-8">Loading...</div>
      </div>
    );
  }

  if (source === null) {
    return (
      <div className="space-y-8">
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">Source not found</p>
          <Link href="/admin/sources">
            <Button variant="outline">Back to Sources</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold mb-2">Edit Source</h2>
        <p className="text-muted-foreground">Update source information</p>
      </div>

      {source.docCount > 0 && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-md">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            This source has {source.docCount} document{source.docCount !== 1 ? 's' : ''} and {source.eventCount} event
            {source.eventCount !== 1 ? 's' : ''} associated with it.
          </p>
        </div>
      )}

      <form
        key={`form-${source._id}`}
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className="max-w-2xl space-y-6"
      >
        <FieldGroup>
          <form.Field
            name="url"
            children={(field) => {
              const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>
                    URL <span className="text-red-500">*</span>
                  </FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="url"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    aria-invalid={isInvalid}
                    placeholder="https://example.com/events"
                    autoComplete="off"
                  />
                  <FieldDescription>Enter the URL of the event source</FieldDescription>
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              );
            }}
          />

          <form.Field
            name="name"
            children={(field) => {
              const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="text"
                    value={field.state.value || ''}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    aria-invalid={isInvalid}
                    placeholder="Municipality Name"
                    autoComplete="off"
                  />
                  <FieldDescription>Optional name for this source</FieldDescription>
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              );
            }}
          />

          <form.Field
            name="entityType"
            children={(field) => {
              const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field orientation="responsive" data-invalid={isInvalid}>
                  <FieldContent>
                    <FieldLabel htmlFor={`${field.name}-select`}>Entity Type</FieldLabel>
                    <FieldDescription>Type of entity providing this source</FieldDescription>
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </FieldContent>
                  <Select
                    key={`entityType-${source._id}-${source.entityType || 'none'}`}
                    name={field.name}
                    value={
                      field.state.value && field.state.value !== '' ? field.state.value : source.entityType || undefined
                    }
                    onValueChange={(value) => field.handleChange(value)}
                  >
                    <SelectTrigger id={`${field.name}-select`} aria-invalid={isInvalid} className="w-full">
                      <SelectValue placeholder="Select type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ENTITY_TYPES).map(([key, value]) => (
                        <SelectItem key={key} value={value}>
                          {key.charAt(0) + key.slice(1).toLowerCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              );
            }}
          />

          <form.Field
            name="locationId"
            children={(field) => {
              const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field orientation="responsive" data-invalid={isInvalid}>
                  <FieldContent>
                    <FieldLabel htmlFor={`${field.name}-combobox`}>Location</FieldLabel>
                    <FieldDescription>
                      Optional location for this source. Search by name, postal code, or region.
                    </FieldDescription>
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </FieldContent>
                  <LocationCombobox
                    id={`${field.name}-combobox`}
                    value={field.state.value || undefined}
                    onValueChange={(value) => field.handleChange(value || '')}
                    aria-invalid={isInvalid}
                    country="CH"
                    placeholder="Select location..."
                  />
                </Field>
              );
            }}
          />

          <form.Field
            name="lang"
            children={(field) => {
              const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field orientation="responsive" data-invalid={isInvalid}>
                  <FieldContent>
                    <FieldLabel htmlFor={`${field.name}-select`}>Language</FieldLabel>
                    <FieldDescription>Primary language of this source</FieldDescription>
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </FieldContent>
                  <Select
                    key={`lang-${source._id}-${source.lang || 'none'}`}
                    name={field.name}
                    value={field.state.value && field.state.value !== '' ? field.state.value : source.lang || undefined}
                    onValueChange={(value) => field.handleChange(value)}
                  >
                    <SelectTrigger id={`${field.name}-select`} aria-invalid={isInvalid} className="w-full">
                      <SelectValue placeholder="Select language..." />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(LANGUAGES).map(([key, value]) => (
                        <SelectItem key={key} value={value}>
                          {key}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              );
            }}
          />

          <form.Field
            name="enabled"
            children={(field) => {
              const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field orientation="horizontal" data-invalid={isInvalid}>
                  <FieldContent>
                    <FieldLabel htmlFor={field.name}>Enabled</FieldLabel>
                    <FieldDescription>Enable or disable this source</FieldDescription>
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </FieldContent>
                  <Checkbox
                    id={field.name}
                    name={field.name}
                    checked={field.state.value}
                    onCheckedChange={(checked) => field.handleChange(checked === true)}
                    aria-invalid={isInvalid}
                  />
                </Field>
              );
            }}
          />

          <form.Field
            name="notes"
            children={(field) => {
              const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>Notes</FieldLabel>
                  <Textarea
                    id={field.name}
                    name={field.name}
                    value={field.state.value || ''}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    aria-invalid={isInvalid}
                    placeholder="Additional notes about this source..."
                    rows={4}
                    className="min-h-[100px]"
                  />
                  <FieldDescription>Optional additional notes about this source</FieldDescription>
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              );
            }}
          />
        </FieldGroup>

        <div className="flex gap-2">
          <Button type="submit" disabled={form.state.isSubmitting}>
            {form.state.isSubmitting ? 'Updating...' : 'Update Source'}
          </Button>
          <Link href="/admin/sources">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
