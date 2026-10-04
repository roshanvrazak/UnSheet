'use client';

import React, { useState } from 'react';
import { DriftReport, SheetProfile, DashboardSpec } from '@unsheet/contracts';
import { applyRemappings } from '@unsheet/engine';
import { SafeIdentifier } from '@unsheet/contracts';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

interface DriftResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  driftReport: DriftReport | null;
  templateSpec: DashboardSpec;
  newSheetProfile: SheetProfile;
  onApplyRemappings: (updatedSpec: DashboardSpec) => void;
}

export function DriftResolutionModal({
  isOpen,
  onClose,
  driftReport,
  templateSpec,
  newSheetProfile,
  onApplyRemappings
}: DriftResolutionModalProps) {
  const [remappings, setRemappings] = useState<Record<string, string>>({});

  if (!driftReport) return null;

  const handleSelectMapping = (missingCol: string, newCol: string) => {
    setRemappings(prev => ({ ...prev, [missingCol]: newCol }));
  };

  const handleApply = () => {
    const finalRemappings: Record<string, string> = { ...driftReport.suggestedRemappings, ...remappings };
    const updatedSpec = applyRemappings(templateSpec, finalRemappings);
    onApplyRemappings(updatedSpec);
    onClose();
  };

  const availableColumns = newSheetProfile.columnProfiles.map((c: { columnKey: SafeIdentifier }) => c.columnKey);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Schema Drift Detected
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border">
            <div>
              <span className="text-sm font-medium">Match Confidence Score</span>
              <p className="text-xs text-muted-foreground">Overall schema similarity check</p>
            </div>
            <div className="text-lg font-bold">
              {Math.round(driftReport.confidenceScore * 100)}%
            </div>
          </div>

          {driftReport.breakingChanges && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Breaking changes detected: some template columns are missing in the new sheet profile.
            </div>
          )}

          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">Matched Columns</h4>
            <div className="space-y-1">
              {driftReport.matchedColumns.map((col: string) => (
                <div key={col} className="flex items-center justify-between text-sm py-1 px-2 rounded bg-muted/20">
                  <span className="font-medium">{col}</span>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                </div>
              ))}
            </div>
          </div>

          {driftReport.missingColumns.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground">Missing Columns & Remappings</h4>
              <div className="space-y-2">
                {driftReport.missingColumns.map((col: string) => (
                  <div key={col} className="flex items-center justify-between text-sm py-1.5 px-2 rounded border gap-4">
                    <span className="font-medium text-destructive">{col}</span>
                    <Select
                      value={remappings[col] || driftReport.suggestedRemappings[col] || ''}
                      onValueChange={v => handleSelectMapping(col, v)}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Map to new column..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableColumns.map((ac: string) => (
                          <SelectItem key={ac} value={ac}>{ac}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleApply}>Apply & Remap Dashboard</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
