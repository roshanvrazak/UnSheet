'use client';

import React, { useState } from 'react';
import { FileSpreadsheet, ShieldCheck, UploadCloud, Share2, PanelLeft, ChevronRight, Settings2 } from 'lucide-react';
import { type SampleWorkbookMeta } from '@/lib/sample-workbooks';
import { AISettingsModal } from '@/components/studio/AISettingsModal';

export interface StudioNavbarProps {
  workbookName?: string | undefined;
  activeSheetName?: string | undefined;
  rowCount?: number | undefined;
  colCount?: number | undefined;
  onUploadClick: () => void;
  onShareClick: () => void;
  isInspectorOpen: boolean;
  onToggleInspector: () => void;
  activeSampleId?: string | undefined;
  onSelectSample?: ((sample: SampleWorkbookMeta) => void) | undefined;
}

export function StudioNavbar({ workbookName, activeSheetName, onUploadClick, onShareClick, isInspectorOpen, onToggleInspector }: StudioNavbarProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  return (
    <>
      <header className="studio-nav">
        <div className="studio-brand">
          <span className="studio-mark"><FileSpreadsheet size={20} aria-hidden="true" /></span>
          <span>Unsheet<span className="brand-period">.</span></span>
        </div>
        <div className="nav-breadcrumb" aria-label="Current workbook">
          <span className="nav-divider" />
          <span>Workspace</span>
          <ChevronRight size={14} aria-hidden="true" />
          <span title={workbookName}>{workbookName || 'Studio'}</span>
          {activeSheetName && <span className="sr-only">{activeSheetName}</span>}
        </div>
        <span className="privacy-pill"><ShieldCheck size={14} aria-hidden="true" /><span>In-Browser Privacy</span></span>
        <nav className="nav-actions" aria-label="Workspace controls">
          {workbookName && <button type="button" className="icon-action lg:hidden" aria-label="Toggle sheet and field inspector" aria-expanded={isInspectorOpen} onClick={onToggleInspector}><PanelLeft size={18} aria-hidden="true" /></button>}
          <button type="button" className="nav-action" aria-label="Configure AI Provider" onClick={() => setIsSettingsOpen(true)}><Settings2 size={16} aria-hidden="true" /><span>AI Settings</span></button>
          <button type="button" className="nav-action" aria-label="New File" onClick={onUploadClick}><UploadCloud size={16} aria-hidden="true" /><span>New File</span></button>
          <button type="button" className="nav-action nav-share" aria-label="Share Dashboard" onClick={onShareClick} disabled={!workbookName}><Share2 size={15} aria-hidden="true" /><span>Share</span></button>
        </nav>
      </header>
      <AISettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  );
}
