'use client';

import React, { useState } from 'react';
import { WidgetSpec, SheetProfile, AggregationFunction, SafeIdentifier } from '@unsheet/contracts';
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
  const [measure, setMeasure] = useState(
    initialWidget?.type === 'kpi' ? initialWidget.measure :
    initialWidget?.type === 'line' ? initialWidget.measures?.[0] || '' :
    initialWidget?.type === 'bar' ? initialWidget.measures?.[0] || '' :
    initialWidget?.type === 'donut' ? initialWidget.measure :
    initialWidget?.type === 'table' ? initialWidget.columns?.[0]?.columnKey || '' :
    initialWidget?.type === 'pivot' ? initialWidget.measures?.[0]?.columnKey || '' : ''
  );
  const [dimension, setDimension] = useState(
    initialWidget?.type === 'line' ? initialWidget.timeDimension :
    initialWidget?.type === 'bar' ? initialWidget.dimension :
    initialWidget?.type === 'donut' ? initialWidget.dimension :
    initialWidget?.type === 'pivot' ? initialWidget.rowDimensions?.[0] || '' : ''
  );
  const [aggregation, setAggregation] = useState<AggregationFunction>(
    initialWidget?.type === 'kpi' ? initialWidget.aggregation :
    initialWidget?.type === 'line' ? initialWidget.aggregation :
    initialWidget?.type === 'bar' ? initialWidget.aggregation :
    initialWidget?.type === 'donut' ? initialWidget.aggregation :
    initialWidget?.type === 'pivot' ? initialWidget.measures?.[0]?.aggregation || 'sum' : 'sum'
  );
  const [w, setW] = useState<number>(initialWidget?.grid?.w || 4);
  const [h, setH] = useState<number>(initialWidget?.grid?.h || 2);
  const [currency, setCurrency] = useState(
    initialWidget?.type === 'kpi' ? initialWidget.format?.currency || 'USD' : 'USD'
  );

  React.useEffect(() => {
    if (initialWidget) {
      setTitle(initialWidget.title);
      setType(initialWidget.type);
      setMeasure(
        initialWidget.type === 'kpi' ? initialWidget.measure :
        initialWidget.type === 'line' ? initialWidget.measures?.[0] || '' :
        initialWidget.type === 'bar' ? initialWidget.measures?.[0] || '' :
        initialWidget.type === 'donut' ? initialWidget.measure :
        initialWidget.type === 'table' ? initialWidget.columns?.[0]?.columnKey || '' :
        initialWidget.type === 'pivot' ? initialWidget.measures?.[0]?.columnKey || '' : ''
      );
      setDimension(
        initialWidget.type === 'line' ? initialWidget.timeDimension :
        initialWidget.type === 'bar' ? initialWidget.dimension :
        initialWidget.type === 'donut' ? initialWidget.dimension :
        initialWidget.type === 'pivot' ? initialWidget.rowDimensions?.[0] || '' : ''
      );
      setAggregation(
        initialWidget.type === 'kpi' ? initialWidget.aggregation :
        initialWidget.type === 'line' ? initialWidget.aggregation :
        initialWidget.type === 'bar' ? initialWidget.aggregation :
        initialWidget.type === 'donut' ? initialWidget.aggregation :
        initialWidget.type === 'pivot' ? initialWidget.measures?.[0]?.aggregation || 'sum' : 'sum'
      );
      setW(initialWidget.grid.w);
      setH(initialWidget.grid.h);
      if (initialWidget.type === 'kpi') {
        setCurrency(initialWidget.format?.currency || 'USD');
      }
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
    const id = initialWidget?.id || `w-${Math.random().toString(36).substring(2, 9)}`;
    const clampedW = Math.min(12, Math.max(1, Number(w) || 4));
    const rawX = initialWidget?.grid?.x ?? 0;
    const clampedX = Math.min(12 - clampedW, Math.max(0, rawX));
    const grid = {
      x: clampedX,
      y: initialWidget?.grid?.y || 0,
      w: clampedW,
      h: Number(h) || 2
    };

    let widget: WidgetSpec;
    if (type === 'kpi') {
      widget = {
        id,
        type: 'kpi',
        title,
        measure,
        aggregation,
        format: currency ? { currency } : undefined,
        grid
      };
    } else if (type === 'line') {
      widget = {
        id,
        type: 'line',
        title,
        timeDimension: dimension || 'date',
        measures: [measure || 'value'],
        aggregation,
        grid
      };
    } else if (type === 'bar') {
      widget = {
        id,
        type: 'bar',
        title,
        dimension: dimension || 'category',
        measures: [measure || 'value'],
        aggregation,
        grid
      };
    } else if (type === 'donut') {
      widget = {
        id,
        type: 'donut',
        title,
        dimension: dimension || 'category',
        measure: measure || 'value',
        aggregation,
        grid
      };
    } else if (type === 'table') {
      widget = {
        id,
        type: 'table',
        title,
        columns: [{ columnKey: measure || 'column', header: title }],
        grid
      };
    } else {
      widget = {
        id,
        type: 'pivot',
        title,
        rowDimensions: [dimension || 'category'],
        measures: [{ columnKey: measure || 'value', aggregation }],
        grid
      };
    }

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
              <Select value={type} onValueChange={(v: string) => setType(v as WidgetSpec['type'])}>
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
              <Select value={aggregation} onValueChange={(v: string) => setAggregation(v as AggregationFunction)}>
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
                  {columns.map((c: { columnKey: SafeIdentifier; inferredType: string }) => (
                    <SelectItem key={c.columnKey} value={c.columnKey}>{c.columnKey} ({c.inferredType})</SelectItem>
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
                    {columns.map((c: { columnKey: SafeIdentifier; inferredType: string }) => (
                      <SelectItem key={c.columnKey} value={c.columnKey}>{c.columnKey} ({c.inferredType})</SelectItem>
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
