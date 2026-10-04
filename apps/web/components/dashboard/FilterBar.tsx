'use client';

import React from 'react';
import { Filter, X, Search, ChevronDown } from 'lucide-react';
import type { FilterSpec } from '@unsheet/contracts';
import { cn } from '@/lib/utils';

export interface FilterBarProps {
  filters: FilterSpec[];
  activeFilters: Record<string, unknown>;
  onFilterChange: (newFilters: Record<string, unknown>) => void;
  className?: string;
}

/**
 * Global Dashboard Filter Bar.
 * Renders interactive controls for select, multi-select, search, and date-range filters.
 * Propagates state changes to trigger reactive widget query recalculations.
 */
export function FilterBar({
  filters,
  activeFilters,
  onFilterChange,
  className,
}: FilterBarProps) {
  if (filters.length === 0) {
    return null;
  }

  const activeFilterCount = Object.keys(activeFilters).filter((k) => {
    const val = activeFilters[k];
    if (val === undefined || val === '' || val === null) return false;
    if (Array.isArray(val) && val.length === 0) return false;
    return true;
  }).length;

  const handleValueChange = (filterId: string, value: unknown) => {
    const updated = { ...activeFilters };
    if (
      value === undefined ||
      value === '' ||
      value === null ||
      (Array.isArray(value) && value.length === 0)
    ) {
      delete updated[filterId];
    } else {
      updated[filterId] = value;
    }
    onFilterChange(updated);
  };

  const handleClearAll = () => {
    onFilterChange({});
  };

  return (
    <div
      role="search"
      aria-label="Dashboard filters"
      className={cn(
        'rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all',
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-500" aria-hidden="true" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Filters
          </span>
          {activeFilterCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800">
              {activeFilterCount} active
            </span>
          )}
        </div>

        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-1 rounded px-1.5 py-0.5 transition-colors"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Reset filters</span>
          </button>
        )}
      </div>

      <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
        {filters.map((filter) => {
          const currentValue = activeFilters[filter.id];

          // 1. SELECT filter
          if (filter.type === 'select') {
            return (
              <div key={filter.id} className="flex flex-col gap-1.5">
                <label
                  htmlFor={`filter-${filter.id}`}
                  className="text-xs font-semibold text-slate-600"
                >
                  {filter.label}
                </label>
                <div className="relative">
                  <select
                    id={`filter-${filter.id}`}
                    value={typeof currentValue === 'string' || typeof currentValue === 'number' ? String(currentValue) : ''}
                    onChange={(e) =>
                      handleValueChange(
                        filter.id,
                        e.target.value === '' ? undefined : e.target.value
                      )
                    }
                    className="w-full appearance-none rounded-lg border border-slate-200 bg-slate-50/50 py-1.5 pl-3 pr-8 text-xs text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  >
                    <option value="">All {filter.label}</option>
                    {filter.options?.map((opt) => (
                      <option key={String(opt.value)} value={String(opt.value)}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400"
                    aria-hidden="true"
                  />
                </div>
              </div>
            );
          }

          // 2. MULTI-SELECT filter
          if (filter.type === 'multi-select') {
            const selectedVals = Array.isArray(currentValue)
              ? (currentValue as string[])
              : [];

            return (
              <div key={filter.id} className="flex flex-col gap-1.5">
                <label
                  htmlFor={`filter-${filter.id}`}
                  className="text-xs font-semibold text-slate-600"
                >
                  {filter.label}
                </label>
                <div className="relative">
                  <select
                    id={`filter-${filter.id}`}
                    value=""
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) return;
                      const next = selectedVals.includes(val)
                        ? selectedVals.filter((v) => v !== val)
                        : [...selectedVals, val];
                      handleValueChange(filter.id, next.length > 0 ? next : undefined);
                    }}
                    className="w-full appearance-none rounded-lg border border-slate-200 bg-slate-50/50 py-1.5 pl-3 pr-8 text-xs text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  >
                    <option value="">
                      {selectedVals.length > 0
                        ? `${selectedVals.length} selected`
                        : `Select ${filter.label}...`}
                    </option>
                    {filter.options?.map((opt) => (
                      <option
                        key={String(opt.value)}
                        value={String(opt.value)}
                      >
                        {selectedVals.includes(String(opt.value)) ? '✓ ' : ''}
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400"
                    aria-hidden="true"
                  />
                </div>

                {/* Selected chips */}
                {selectedVals.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedVals.map((v) => (
                      <span
                        key={v}
                        className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-700 border border-blue-200/60"
                      >
                        {v}
                        <button
                          type="button"
                          onClick={() => {
                            const next = selectedVals.filter((item) => item !== v);
                            handleValueChange(filter.id, next.length > 0 ? next : undefined);
                          }}
                          className="hover:text-blue-900"
                          aria-label={`Remove ${v}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          // 3. DATE RANGE filter
          if (filter.type === 'date-range') {
            let fromVal = '';
            let toVal = '';
            if (typeof currentValue === 'object' && currentValue !== null) {
              const obj = currentValue as Record<string, unknown>;
              if ('value' in obj && Array.isArray(obj.value)) {
                fromVal = String(obj.value[0] ?? '');
                toVal = String(obj.value[1] ?? '');
              } else if ('from' in obj || 'to' in obj) {
                fromVal = String(obj.from ?? '');
                toVal = String(obj.to ?? '');
              }
            } else if (Array.isArray(currentValue)) {
              fromVal = String(currentValue[0] ?? '');
              toVal = String(currentValue[1] ?? '');
            }

            return (
              <fieldset key={filter.id} className="flex flex-col gap-1.5 border-0 p-0 m-0 min-w-0">
                <legend className="text-xs font-semibold text-slate-600 mb-1">
                  {filter.label}
                </legend>
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <input
                      type="date"
                      value={fromVal}
                      onChange={(e) => {
                        const from = e.target.value;
                        const to = toVal;
                        if (!from && !to) {
                          handleValueChange(filter.id, undefined);
                        } else {
                          handleValueChange(filter.id, {
                            operator: 'between',
                            value: [from || '1970-01-01', to || '2099-12-31'],
                          });
                        }
                      }}
                      aria-label={`${filter.label} start date`}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-2 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <span className="text-xs text-slate-400">to</span>
                  <div className="relative flex-1">
                    <input
                      type="date"
                      value={toVal}
                      onChange={(e) => {
                        const to = e.target.value;
                        const from = fromVal;
                        if (!from && !to) {
                          handleValueChange(filter.id, undefined);
                        } else {
                          handleValueChange(filter.id, {
                            operator: 'between',
                            value: [from || '1970-01-01', to || '2099-12-31'],
                          });
                        }
                      }}
                      aria-label={`${filter.label} end date`}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-2 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>
              </fieldset>
            );
          }

          // 4. SEARCH / TEXT filter
          if (filter.type === 'search') {
            const searchVal =
              typeof currentValue === 'string'
                ? currentValue
                : typeof currentValue === 'object' && currentValue !== null && 'value' in currentValue
                ? String((currentValue as Record<string, unknown>).value ?? '')
                : '';

            return (
              <div key={filter.id} className="flex flex-col gap-1.5">
                <label
                  htmlFor={`filter-${filter.id}`}
                  className="text-xs font-semibold text-slate-600"
                >
                  {filter.label}
                </label>
                <div className="relative">
                  <Search
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id={`filter-${filter.id}`}
                    type="text"
                    value={searchVal}
                    onChange={(e) => {
                      const val = e.target.value;
                      handleValueChange(
                        filter.id,
                        val ? { operator: 'contains', value: val } : undefined
                      );
                    }}
                    placeholder={`Search ${filter.label}...`}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-1.5 pl-8 pr-3 text-xs text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>
              </div>
            );
          }

          // 5. NUMERIC RANGE filter
          if (filter.type === 'numeric-range') {
            let minVal: string | number = '';
            let maxVal: string | number = '';
            if (Array.isArray(currentValue)) {
              minVal = currentValue[0] ?? '';
              maxVal = currentValue[1] ?? '';
            } else if (typeof currentValue === 'object' && currentValue !== null) {
              const obj = currentValue as Record<string, unknown>;
              if ('value' in obj && Array.isArray(obj.value)) {
                minVal = obj.value[0] ?? '';
                maxVal = obj.value[1] ?? '';
              }
            }

            return (
              <fieldset key={filter.id} className="flex flex-col gap-1.5 border-0 p-0 m-0 min-w-0">
                <legend className="text-xs font-semibold text-slate-600 mb-1">
                  {filter.label}
                </legend>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    placeholder="Min"
                    value={minVal}
                    onChange={(e) => {
                      const min = e.target.value !== '' ? Number(e.target.value) : undefined;
                      const max = maxVal !== '' ? Number(maxVal) : undefined;
                      if (min === undefined && max === undefined) {
                        handleValueChange(filter.id, undefined);
                      } else {
                        handleValueChange(filter.id, {
                          operator: 'between',
                          value: [min ?? -1e12, max ?? 1e12],
                        });
                      }
                    }}
                    aria-label={`${filter.label} minimum`}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-2 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <span className="text-xs text-slate-400">-</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={maxVal}
                    onChange={(e) => {
                      const max = e.target.value !== '' ? Number(e.target.value) : undefined;
                      const min = minVal !== '' ? Number(minVal) : undefined;
                      if (min === undefined && max === undefined) {
                        handleValueChange(filter.id, undefined);
                      } else {
                        handleValueChange(filter.id, {
                          operator: 'between',
                          value: [min ?? -1e12, max ?? 1e12],
                        });
                      }
                    }}
                    aria-label={`${filter.label} maximum`}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-2 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </fieldset>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}
