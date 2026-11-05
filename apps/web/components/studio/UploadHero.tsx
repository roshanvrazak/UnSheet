'use client';

import React, { useRef, useState } from 'react';
import { UploadCloud, FileSpreadsheet, ShieldCheck, ArrowUpRight, Check, Layers, BarChart3, Truck, Table2 } from 'lucide-react';
import { SAMPLE_WORKBOOKS, type SampleWorkbookMeta } from '@/lib/sample-workbooks';
import { cn } from '@/lib/utils';

export interface UploadHeroProps {
  onFileUpload: (file: File) => void;
  onSelectSample: (sample: SampleWorkbookMeta) => void;
  activeSampleId?: string | undefined;
  isProcessing: boolean;
  showUpload?: boolean;
  fileInputRef?: React.RefObject<HTMLInputElement | null> | undefined;
}
const sampleIcons = [BarChart3, Layers, Truck, Table2];
const sampleTones = ['sample-tone-0', 'sample-tone-1', 'sample-tone-2', 'sample-tone-3'];

export function UploadHero({ onFileUpload, onSelectSample, activeSampleId, isProcessing, fileInputRef, showUpload = true }: UploadHeroProps) {
  const [isDragging, setIsDragging] = useState(false);
  const internalInputRef = useRef<HTMLInputElement>(null);
  const resolvedInputRef = fileInputRef || internalInputRef;

  return (
    <div className={cn('dataset-panel', !showUpload && 'is-compact')}>
      <div className="dataset-intro" hidden={!showUpload}>
        <div className="dataset-copy">
          <span className="eyebrow"><span className="status-dot" />YOUR NEXT INSIGHT STARTS HERE</span>
          <h2>Any spreadsheet.<br /> <span>Instant dashboard.</span></h2>
          <p>A little less spreadsheet.<br className="hidden xl:block" /> A lot more clarity.</p>
          <span className="dataset-privacy"><ShieldCheck size={14} aria-hidden="true" />Your files stay on your device.</span>
        </div>
        <div
          className={cn('upload-zone', isDragging && 'is-dragging', isProcessing && 'is-processing')}
          onDragOver={(event) => { event.preventDefault(); if (!isProcessing) setIsDragging(true); }}
          onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragging(false); }}
          onDrop={(event) => { event.preventDefault(); setIsDragging(false); const file = event.dataTransfer.files[0]; if (file && !isProcessing) onFileUpload(file); }}
        >
          <input ref={resolvedInputRef} type="file" accept=".xlsx,.xls,.csv,.tsv" data-testid="file-upload-input" aria-label="Choose a spreadsheet" className="hidden" disabled={isProcessing}
            onClick={(event) => { event.currentTarget.value = ''; }}
            onChange={(event) => { const file = event.target.files?.[0]; if (file) onFileUpload(file); event.target.value = ''; }} />
          <span className="upload-icon"><UploadCloud size={24} strokeWidth={1.6} aria-hidden="true" /></span>
          <div>
            <h3>{isProcessing ? 'Reading your spreadsheet…' : 'Drop your spreadsheet here'}</h3>
            <p>or <button type="button" className="browse-link" onClick={() => resolvedInputRef.current?.click()} disabled={isProcessing}>Browse files</button> to get started</p>
          </div>
          <div className="upload-formats"><span>.xlsx</span><span>.xls</span><span>.csv</span><span>.tsv</span><span className="format-limit">Up to 10 MB</span></div>
          <span className="sr-only">Supports spreadsheet files up to 10MB. Zero server upload. 100% In-Browser: your raw workbook stays on your device. AI receives capped samples when used.</span>
        </div>
      </div>
      <div className="sample-section">
        <div className="sample-caption"><span>Just exploring?</span><span>Try a sample dataset <ArrowUpRight size={13} aria-hidden="true" /></span></div>
        <div className="sample-grid">
          {SAMPLE_WORKBOOKS.map((sample, index) => {
            const selected = activeSampleId === sample.id;
            const Icon = sampleIcons[index] || FileSpreadsheet;
            return (
              <button key={sample.id} type="button" onClick={() => onSelectSample(sample)} disabled={isProcessing} aria-pressed={selected} className={cn('sample-card', selected && 'is-selected')} title={sample.description}>
                <span className={cn('sample-icon', sampleTones[index])}><Icon size={18} strokeWidth={1.7} aria-hidden="true" /></span>
                <span className="sample-text"><strong>{sample.name}</strong><span>{sample.domain}</span></span>
                <span className="sample-state">{selected ? <Check size={15} aria-label="Selected" /> : <ArrowUpRight size={15} aria-hidden="true" />}</span>
                <span className="sr-only">{sample.badge} {sample.filename}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
