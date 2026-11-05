import React from 'react';
import { CheckCircle2, ChevronDown } from 'lucide-react';
import type { PipelineTiming } from '@/app/page';

export function PipelineStatus({ timing }: { timing: PipelineTiming }) {
  const steps = [
    ['1. Parse', timing.parseMs], ['2. Normalise', timing.normaliseMs], ['3. Profile', timing.profileMs], ['4. SpecGen', timing.specGenMs], ['5. Render', timing.renderMs],
  ] as const;
  return (
    <details className="pipeline-status" role="region" aria-label="Engine pipeline status">
      <summary><CheckCircle2 size={15} aria-hidden="true" /><span>Engine Pipeline</span><span className="pipeline-ready">Dashboard ready</span><span className="pipeline-total">{timing.totalMs}ms total</span><ChevronDown size={14} aria-hidden="true" /></summary>
      <div className="pipeline-steps">{steps.map(([label, ms]) => <span key={label}><CheckCircle2 size={13} aria-hidden="true" /><strong>{label}</strong><span>{ms}ms</span></span>)}</div>
    </details>
  );
}
