'use client';

import React, { useState } from 'react';
import { WidgetSpec, SheetProfile, AggregationType } from '@unsheet/engine';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface WidgetConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (widget: WidgetSpec) => void;
  initialWidget?: WidgetSpec | null;
  sheetProfile?: SheetProfile | null;
}

export function WidgetConfigModal({
  isOpen,
  onClose,
  onSave,
  initialWidget,
  sheetProfile
}: WidgetConfigModalProps) {
  const [title, setTitle] = useState(initialWidget?.title || 'New Widget');
  const [type, setType] = useState<WidgetSpec['type']>(initialWidget?.type || 'kpi');
  const [measure, setMeasure] = useState(initialWidget?.measure || '');
  const [dimension, setDimension] = useState(initialWidget?.dimension || '');
  const [aggregation, setAggregation] = useState<AggregationType>(initialWidget?.aggregation || 'sum');
  const [w, setW] = useState<number>(initialWidget?.layout?.w || 4);
  const [h, setH] = useState<number>(initialWidget?.layout?.h || 2);
  const [currency, setCurrency] = useState(initialWidget?.formatting?.currency || 'USD');
  const [style, setStyle] = useState(initialWidget?.formatting?.style || 'number');

  React.useEffect(() => {
    if (initialWidget) {
      setTitle(initialWidget.title);
      setType(initialWidget.type);
      setMeasure(initialWidget.measure);
      setDimension(initialWidget.dimension || '');
      setAggregation(initialWidget.aggregation);
      setW(initialWidget.layout.w);
      setH(initialWidget.layout.h);
      setCurrency(initialWidget.formatting?.currency || 'USD');
      setStyle(initialWidget.formatting?.style || 'number');
    } else {
      setTitle('New Widget');
      setType('kpi');
      setMeasure('');
      setDimension('');
      setAggregation('sum');
      setW(4);
      setH(2);
    }
  }, [initialWidget, isOpen]);

  const columns = sheetProfile?.columnProfiles || [];

  const handleSave = () => {
    const widget: WidgetSpec = {
      id: initialWidget?.id || `w-${Math.random().toString(36).substring(2, 9)}`,
      type,
      title,
      measure,
      dimension: type !== 'kpi' ? dimension : undefined,
      aggregation,
      formatting: style !== 'number' ? { style: style as any, currency } : undefined,
      layout: {
        x: initialWidget?.layout?.x || 0,
        y: initialWidget?.layout?.y || 0,
        w: Number(w),
        h: Number(h)
      }
    };
    onSave(widget);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initialWidget ? 'Edit Widget' : 'Add Widget'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Widget Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Total Revenue" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Widget Type</Label>
              <Select value={type} onValueChange={(v: any) => setType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kpi">KPI Card</SelectItem>
                  <SelectItem value="line">Line Chart</SelectItem>
                  <SelectItem value="bar">Bar Chart</SelectItem>
                  <SelectItem value="donut">Donut Chart</SelectItem>
                  <SelectItem value="table">Data Table</SelectItem>
                  <SelectItem value="pivot">Pivot Table</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Aggregation</Label>
              <Select value={aggregation} onValueChange={(v: any) => setAggregation(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sum">Sum</SelectItem>
                  <SelectItem value="avg">Average</SelectItem>
                  <SelectItem value="min">Min</SelectItem>
                  <SelectItem value="max">Max</SelectItem>
                  <SelectItem value="count">Count</SelectItem>
                  <SelectItem value="distinctCount">Distinct Count</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Measure Column</Label>
              <Select value={measure} onValueChange={setMeasure}>
                <SelectTrigger>
                  <SelectValue placeholder="Select column..." />
                </SelectTrigger>
                <SelectContent>
                  {columns.map(c => (
                    <SelectItem key={c.key} value={c.key}>{c.key} ({c.type})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {type !== 'kpi' && (
              <div>
                <Label>Dimension Column</Label>
                <Select value={dimension} onValueChange={setDimension}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select dimension..." />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map(c => (
                      <SelectItem key={c.key} value={c.key}>{c.key} ({c.type})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Grid Width (1..12)</Label>
              <Input type="number" min={1} max={12} value={w} onChange={e => setW(Number(e.target.value))} />
            </div>
            <div>
              <Label>Grid Height (1..8)</Label>
              <Input type="number" min={1} max={8} value={h} onChange={e => setH(Number(e.target.value))} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save Widget</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
