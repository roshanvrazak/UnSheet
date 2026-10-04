'use client';

import React, { useState } from 'react';
import { FilterSpec as GlobalFilter, SheetProfile, SafeIdentifier } from '@unsheet/contracts';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface FilterConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (filter: GlobalFilter) => void;
  sheetProfile?: SheetProfile | null;
}

export function FilterConfigModal({
  isOpen,
  onClose,
  onSave,
  sheetProfile
}: FilterConfigModalProps) {
  const [columnKey, setColumnKey] = useState('');
  const [label, setLabel] = useState('');
  const [filterType, setFilterType] = useState<GlobalFilter['type']>('select');

  const columns = sheetProfile?.columnProfiles || [];

  const handleSave = () => {
    if (!columnKey) return;
    const newFilter: GlobalFilter = {
      id: `filter-${Math.random().toString(36).substring(2, 9)}`,
      columnKey,
      label: label || columnKey,
      type: filterType
    };
    onSave(newFilter);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Global Filter</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Column</Label>
            <Select value={columnKey} onValueChange={v => { setColumnKey(v); if (!label) setLabel(v); }}>
              <SelectTrigger>
                <SelectValue placeholder="Select column..." />
              </SelectTrigger>
              <SelectContent>
                {columns.map((c: { columnKey: SafeIdentifier; inferredType: string }) => (
                  <SelectItem key={c.columnKey} value={c.columnKey}>{c.columnKey} ({c.inferredType})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Filter Label</Label>
            <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Region" />
          </div>

          <div>
            <Label>Filter Type</Label>
            <Select value={filterType} onValueChange={(v: string) => setFilterType(v as GlobalFilter['type'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="select">Dropdown Select</SelectItem>
                <SelectItem value="search">Text Search</SelectItem>
                <SelectItem value="range">Range Slider</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Add Filter</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
