'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { DashboardSpec, SheetModel, WorkbookModel } from '@unsheet/contracts';
import {
  parseWorkbook,
  normaliseWorkbook,
  profileSheet,
  generateDashboardSpec,
} from '@unsheet/engine';
import {
  SAMPLE_WORKBOOKS,
  getSampleWorkbookBytes,
  type SampleWorkbookMeta,
} from '@/lib/sample-workbooks';
import { DashboardRenderer } from '@/components/dashboard/DashboardRenderer';
import { AskYourDataDrawer } from '@/components/chat/AskYourDataDrawer';
import { SpecRefineBar } from '@/components/chat/SpecRefineBar';
import { ShareModal } from '@/components/share/ShareModal';
import { StudioNavbar } from '@/components/studio/StudioNavbar';
import { UploadHero } from '@/components/studio/UploadHero';
import { FieldInspector } from '@/components/studio/FieldInspector';
import { FloatingCommandBar } from '@/components/studio/FloatingCommandBar';
import {
  AlertCircle,
  Clock,
  CheckCircle2,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export interface PipelineTiming {
  parseMs: number;
  normaliseMs: number;
  profileMs: number;
  specGenMs: number;
  renderMs: number;
  totalMs: number;
}

export default function HomePage() {
  const [activeSampleId, setActiveSampleId] = useState<string>('project-pipeline');
  const [workbook, setWorkbook] = useState<WorkbookModel | null>(null);
  const [activeSheetIndex, setActiveSheetIndex] = useState<number>(0);
  const [spec, setSpec] = useState<DashboardSpec | null>(null);
  const [timing, setTiming] = useState<PipelineTiming | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAskDrawerOpen, setIsAskDrawerOpen] = useState<boolean>(false);
  const [isSpecRefineOpen, setIsSpecRefineOpen] = useState<boolean>(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(true);
  const [isHeroExpanded, setIsHeroExpanded] = useState<boolean>(true);

  // Field selection state
  const [selectedColumnKeys, setSelectedColumnKeys] = useState<Set<string>>(new Set());
  const [isFieldsDirty, setIsFieldsDirty] = useState<boolean>(false);

  const pipelineRunId = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Executes the full Unsheet pipeline from raw bytes:
   * Parse -> Normalise -> Profile -> SpecGen -> Render
   */
  const processSpreadsheetBytes = async (
    bytes: Uint8Array,
    filename: string,
    sampleId?: string
  ) => {
    const currentRun = ++pipelineRunId.current;
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const overallStart = performance.now();

      // Step 1: Parse
      const t0 = performance.now();
      const rawWorkbook = await parseWorkbook(bytes, { filename, calculateHash: false });
      const parseMs = Math.round((performance.now() - t0) * 10) / 10;

      // Step 2: Normalise
      const t1 = performance.now();
      const normalisedWorkbook = normaliseWorkbook(rawWorkbook);
      const normaliseMs = Math.round((performance.now() - t1) * 10) / 10;

      if (normalisedWorkbook.sheets.length === 0) {
        throw new Error('Workbook contains no readable sheets with tabular data.');
      }

      // Step 3: Profile Active Sheet (default to sheet with most tabular data)
      let bestSheetIndex = 0;
      let maxRows = -1;
      for (let i = 0; i < normalisedWorkbook.sheets.length; i++) {
        const s = normalisedWorkbook.sheets[i]!;
        if (s.rowCount > maxRows) {
          maxRows = s.rowCount;
          bestSheetIndex = i;
        }
      }
      const sheetIndex = bestSheetIndex;
      const targetSheet = normalisedWorkbook.sheets[sheetIndex]!;
      const t2 = performance.now();
      const profile = profileSheet(targetSheet);
      const profileMs = Math.round((performance.now() - t2) * 10) / 10;

      // Step 4: Spec Generation
      const t3 = performance.now();
      const dashboardSpec = generateDashboardSpec(profile, {
        title: `${targetSheet.name} Dashboard`,
      });
      const specGenMs = Math.round((performance.now() - t3) * 10) / 10;

      const t4 = performance.now();
      const renderMs = Math.round((performance.now() - t4) * 10) / 10;
      const totalMs = Math.round((performance.now() - overallStart) * 10) / 10;

      if (currentRun !== pipelineRunId.current) return;

      setWorkbook(normalisedWorkbook);
      setActiveSheetIndex(sheetIndex);
      setSpec(dashboardSpec);
      setTiming({
        parseMs,
        normaliseMs,
        profileMs,
        specGenMs,
        renderMs,
        totalMs,
      });

      // Initialize selected fields with all profiled columns
      const allKeys = new Set(profile.columnProfiles.map((c) => c.columnKey));
      setSelectedColumnKeys(allKeys);
      setIsFieldsDirty(false);

      if (sampleId) {
        setActiveSampleId(sampleId);
      } else {
        setActiveSampleId('');
      }
    } catch (err) {
      if (currentRun !== pipelineRunId.current) return;
      console.error('[Unsheet Pipeline Error]:', err);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Failed to process spreadsheet file.'
      );
    } finally {
      if (currentRun === pipelineRunId.current) {
        setIsProcessing(false);
      }
    }
  };

  /**
   * Switch active sheet in the currently loaded workbook
   */
  const handleSheetSwitch = (index: number) => {
    if (!workbook || !workbook.sheets[index]) return;
    setActiveSheetIndex(index);

    try {
      const targetSheet = workbook.sheets[index]!;
      const t0 = performance.now();
      const profile = profileSheet(targetSheet);
      const profileMs = Math.round((performance.now() - t0) * 10) / 10;

      const t1 = performance.now();
      const dashboardSpec = generateDashboardSpec(profile, {
        title: `${targetSheet.name} Dashboard`,
      });
      const specGenMs = Math.round((performance.now() - t1) * 10) / 10;

      setSpec(dashboardSpec);
      setTiming((prev) =>
        prev
          ? {
              ...prev,
              profileMs,
              specGenMs,
              totalMs: Math.round((prev.parseMs + prev.normaliseMs + profileMs + specGenMs) * 10) / 10,
            }
          : null
      );

      const allKeys = new Set(profile.columnProfiles.map((c) => c.columnKey));
      setSelectedColumnKeys(allKeys);
      setIsFieldsDirty(false);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to profile worksheet.'
      );
    }
  };

  /**
   * Load a pre-configured sample workbook
   */
  const handleLoadSample = (sample: SampleWorkbookMeta) => {
    const { bytes, meta } = getSampleWorkbookBytes(sample.id);
    processSpreadsheetBytes(bytes, meta.filename, meta.id);
  };

  /**
   * Handle user file drop or selection
   */
  const handleFileUpload = async (file: File) => {
    try {
      let bytes: Uint8Array;
      const lower = file.name.toLowerCase();
      if ((lower.endsWith('.csv') || lower.endsWith('.tsv')) && typeof file.text === 'function') {
        const text = await file.text();
        bytes = new TextEncoder().encode(text);
      } else if (typeof file.arrayBuffer === 'function') {
        const arrayBuffer = await file.arrayBuffer();
        bytes = new Uint8Array(arrayBuffer);
      } else if (typeof file.text === 'function') {
        const text = await file.text();
        bytes = new TextEncoder().encode(text);
      } else {
        throw new Error('Unable to read uploaded file format in this browser');
      }
      await processSpreadsheetBytes(bytes, file.name);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Error reading uploaded file');
    }
  };

  // Load default sample on mount
  useEffect(() => {
    const defaultSample = SAMPLE_WORKBOOKS[0];
    if (defaultSample) {
      handleLoadSample(defaultSample);
    }
  }, []);

  const activeSheet: SheetModel | null =
    workbook && workbook.sheets[activeSheetIndex]
      ? workbook.sheets[activeSheetIndex]!
      : null;

  const currentProfile = useMemo(() => {
    if (!activeSheet) {
      return {
        sheetId: 'default',
        sheetName: 'default',
        rowCount: 0,
        columnCount: 0,
        columnProfiles: [],
        recommendedDimensions: [],
        recommendedMeasures: [],
      };
    }
    return profileSheet(activeSheet);
  }, [activeSheet]);

  // Field selection actions
  const handleToggleColumn = (columnKey: string) => {
    setSelectedColumnKeys((prev) => {
      const next = new Set(prev);
      if (next.has(columnKey)) {
        next.delete(columnKey);
      } else {
        next.add(columnKey);
      }
      return next;
    });
    setIsFieldsDirty(true);
  };

  const handleSelectAllFields = () => {
    setSelectedColumnKeys(new Set(currentProfile.columnProfiles.map((c) => c.columnKey)));
    setIsFieldsDirty(true);
  };

  const handleClearAllFields = () => {
    setSelectedColumnKeys(new Set());
    setIsFieldsDirty(true);
  };

  const handleApplyFields = () => {
    if (!activeSheet || selectedColumnKeys.size === 0) return;

    try {
      const filteredProfiles = currentProfile.columnProfiles.filter((c) =>
        selectedColumnKeys.has(c.columnKey)
      );

      const filteredSheetProfile = {
        ...currentProfile,
        columnProfiles: filteredProfiles,
      };

      const newSpec = generateDashboardSpec(filteredSheetProfile, {
        title: `${activeSheet.name} Dashboard`,
      });

      setSpec(newSpec);
      setIsFieldsDirty(false);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to regenerate dashboard spec with selected fields.'
      );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 flex flex-col font-sans">
      {/* 1. Glassmorphic Studio Top Navigation */}
      <StudioNavbar
        workbookName={workbook?.filename}
        activeSheetName={activeSheet?.name}
        rowCount={activeSheet?.rowCount}
        colCount={activeSheet?.columnCount}
        onUploadClick={() => fileInputRef.current?.click()}
        onShareClick={() => setIsShareModalOpen(true)}
        isInspectorOpen={isInspectorOpen}
        onToggleInspector={() => setIsInspectorOpen((prev) => !prev)}
        activeSampleId={activeSampleId}
        onSelectSample={handleLoadSample}
      />

      {/* 2. Main Studio Workspace Layout */}
      <div className="flex-1 flex w-full relative">
        {/* Left Side Inspector (Sheets & Field Selector) */}
        {workbook && activeSheet && (
          <FieldInspector
            isOpen={isInspectorOpen}
            onClose={() => setIsInspectorOpen(false)}
            sheets={workbook.sheets}
            activeSheetIndex={activeSheetIndex}
            onSelectSheet={handleSheetSwitch}
            columnProfiles={currentProfile.columnProfiles}
            selectedColumnKeys={selectedColumnKeys}
            onToggleColumn={handleToggleColumn}
            onSelectAll={handleSelectAllFields}
            onClearAll={handleClearAllFields}
            onApplyFields={handleApplyFields}
            isDirty={isFieldsDirty}
            pipelineTiming={timing}
          />
        )}

        {/* Center Dashboard Canvas */}
        <main className="flex-1 min-w-0 bg-dot-grid flex flex-col p-4 sm:p-6 lg:p-8 space-y-6 pb-28">
          {/* Error Banner */}
          {errorMessage && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50/90 backdrop-blur-xs p-4 text-rose-800 shadow-xs animate-in fade-in"
            >
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold">Failed to load workbook</h3>
                <p className="mt-1 text-xs text-rose-700">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Quick-toggle Hero Ingestion Card */}
          <section className="space-y-3">
            {workbook && (
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Datasets & Ingestion
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    ({workbook.filename})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsHeroExpanded((prev) => !prev)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  <span>{isHeroExpanded ? 'Collapse' : 'Switch dataset / Upload'}</span>
                  {isHeroExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}

            {(!workbook || isHeroExpanded) && (
              <UploadHero
                onFileUpload={handleFileUpload}
                onSelectSample={handleLoadSample}
                activeSampleId={activeSampleId}
                isProcessing={isProcessing}
                fileInputRef={fileInputRef}
              />
            )}
          </section>

          {/* Collapsible Pipeline Timing Bar */}
          {timing && workbook && (
            <section
              role="region"
              aria-label="Engine pipeline status"
              className="rounded-xl border border-slate-200/80 bg-white/90 backdrop-blur-xs p-3.5 shadow-xs"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-indigo-600" aria-hidden="true" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Engine Pipeline
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200/80">
                    <CheckCircle2 className="h-3 w-3" />
                    {timing.totalMs}ms Total
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs">
                    <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded px-2 py-0.5">
                      <span className="font-semibold text-slate-700">1. Parse</span>
                      <span className="font-mono text-[10px] text-slate-500">{timing.parseMs}ms</span>
                    </div>
                    <ArrowRight className="h-3 w-3 text-slate-300 hidden sm:block" />

                    <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded px-2 py-0.5">
                      <span className="font-semibold text-slate-700">2. Normalise</span>
                      <span className="font-mono text-[10px] text-slate-500">{timing.normaliseMs}ms</span>
                    </div>
                    <ArrowRight className="h-3 w-3 text-slate-300 hidden sm:block" />

                    <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded px-2 py-0.5">
                      <span className="font-semibold text-slate-700">3. Profile</span>
                      <span className="font-mono text-[10px] text-slate-500">{timing.profileMs}ms</span>
                    </div>
                    <ArrowRight className="h-3 w-3 text-slate-300 hidden sm:block" />

                    <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded px-2 py-0.5">
                      <span className="font-semibold text-slate-700">4. SpecGen</span>
                      <span className="font-mono text-[10px] text-slate-500">{timing.specGenMs}ms</span>
                    </div>
                    <ArrowRight className="h-3 w-3 text-slate-300 hidden sm:block" />

                    <div className="flex items-center gap-1 bg-indigo-50 border border-indigo-200 rounded px-2 py-0.5 text-indigo-700">
                      <span className="font-bold">5. Render</span>
                      <span className="font-mono text-[10px] font-semibold">{timing.renderMs}ms</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* AI Spec Refine Bar */}
          {isSpecRefineOpen && spec && (
            <SpecRefineBar
              currentSpec={spec}
              profile={currentProfile}
              onSpecUpdate={setSpec}
            />
          )}

          {/* Rendered Dashboard Canvas */}
          {isProcessing ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-xs">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-600 border-r-transparent mb-4"></div>
              <h3 className="text-base font-bold text-slate-800">
                Profiling spreadsheet & generating dashboard spec...
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Inferring data types, computing semantic roles, creating responsive grid layout
              </p>
            </div>
          ) : spec && activeSheet ? (
            <section className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
              <DashboardRenderer
                key={`${workbook?.id || 'wb'}_${activeSheet.id}_${spec.id}`}
                spec={spec}
                sheet={activeSheet}
              />
            </section>
          ) : null}
        </main>
      </div>

      {/* 3. Floating Island Action Dock */}
      {activeSheet && (
        <FloatingCommandBar
          onAskClick={() => setIsAskDrawerOpen(true)}
          onRefineClick={() => setIsSpecRefineOpen((prev) => !prev)}
          isRefineOpen={isSpecRefineOpen}
          sheet={activeSheet}
          onShareClick={() => setIsShareModalOpen(true)}
          onToggleInspector={() => setIsInspectorOpen((prev) => !prev)}
          isInspectorOpen={isInspectorOpen}
        />
      )}

      {/* 4. Natural Language Analytical Drawer */}
      {activeSheet && (
        <AskYourDataDrawer
          isOpen={isAskDrawerOpen}
          onClose={() => setIsAskDrawerOpen(false)}
          sheet={activeSheet}
          profile={currentProfile}
          onAddWidget={(widget) => {
            setSpec((prev) => {
              if (!prev) return prev;
              const maxY = prev.widgets.reduce((max, w) => Math.max(max, w.grid.y + w.grid.h), 0);
              const positionedWidget = {
                ...widget,
                grid: { ...widget.grid, y: maxY },
              };
              return { ...prev, widgets: [...prev.widgets, positionedWidget] };
            });
          }}
        />
      )}

      {/* 5. Snapshot Share Modal */}
      {spec && activeSheet && (
        <ShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          sheet={activeSheet}
          spec={spec}
        />
      )}
    </div>
  );
}
