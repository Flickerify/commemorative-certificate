'use client';

import * as React from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Id } from '@/convex/_generated/dataModel';

interface Location {
  _id: Id<'locations'>;
  country: string;
  region?: string;
  subRegion?: string;
  postalCode?: string;
  externalId?: string;
}

interface LocationComboboxProps {
  'value'?: string;
  'onValueChange': (value: string | undefined) => void;
  'country'?: string;
  'disabled'?: boolean;
  'placeholder'?: string;
  'id'?: string;
  'aria-invalid'?: boolean;
}

export function LocationCombobox({
  value,
  onValueChange,
  country = 'CH',
  disabled,
  placeholder = 'Select location...',
  id,
  'aria-invalid': ariaInvalid,
}: LocationComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const locations = useQuery(api.locations.query.searchLocations, {
    search: debouncedSearch,
    country,
    limit: 100,
  });

  // Fetch the selected location separately if it's not in the search results
  const selectedLocationFromQuery = useQuery(
    api.locations.query.getLocationById,
    value && value !== '' ? { locationId: value as Id<'locations'> } : 'skip',
  );

  const selectedLocation = React.useMemo(() => {
    if (!value || value === '') return null;
    // First try to find in search results
    if (locations) {
      const found = locations.find((loc) => loc._id === value);
      if (found) return found;
    }
    // Fall back to the separate query
    return selectedLocationFromQuery || null;
  }, [value, locations, selectedLocationFromQuery]);

  const displayValue = selectedLocation
    ? selectedLocation.subRegion || selectedLocation.region || selectedLocation.country
    : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={ariaInvalid}
          disabled={disabled}
          id={id}
          className={cn(
            'w-full justify-between',
            !value && 'text-muted-foreground',
            ariaInvalid && 'border-destructive',
          )}
        >
          <span className="truncate">{displayValue}</span>
          <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search locations..." value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>No locations found.</CommandEmpty>
            <CommandGroup>
              {locations?.map((location) => {
                const locationName = location.subRegion || location.region || location.country;
                const locationDetails = [location.postalCode, location.region, location.country]
                  .filter(Boolean)
                  .join(', ');
                // Use searchable text as value for Command component filtering/navigation
                // Include location name, postal code, region, country for searchability
                const searchableValue = [locationName, location.postalCode, location.region, location.country]
                  .filter(Boolean)
                  .join(' ');

                return (
                  <CommandItem
                    key={location._id}
                    value={searchableValue}
                    onSelect={() => {
                      // Use closure to capture location._id directly
                      onValueChange(value === location._id ? undefined : location._id);
                      setOpen(false);
                      setSearch('');
                    }}
                  >
                    <CheckIcon className={cn('mr-2 h-4 w-4', value === location._id ? 'opacity-100' : 'opacity-0')} />
                    <div className="flex flex-col">
                      <span>{locationName}</span>
                      {locationDetails && <span className="text-xs text-muted-foreground">{locationDetails}</span>}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
