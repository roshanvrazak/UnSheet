'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { DashboardSpec, SheetModel, WorkbookModel, SheetProfile } from '@unsheet/contracts';
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
import { PipelineStatus } from '@/components/studio/PipelineStatus';
import {
  AlertCircle,
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
  const [isHeroExpanded, setIsHeroExpanded] = useState<boolean>(false);

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
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('File exceeds the maximum allowed size of 10MB.');
      }
      let bytes: Uint8Array;
      if (typeof file.arrayBuffer === 'function') {
        bytes = new Uint8Array(await file.arrayBuffer());
      } else if (typeof file.text === 'function') {
        bytes = new TextEncoder().encode(await file.text());
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
    setIsInspectorOpen(window.matchMedia('(min-width: 1024px)').matches);
    const defaultSample = SAMPLE_WORKBOOKS[0];
    if (defaultSample) {
      handleLoadSample(defaultSample);
    }
  }, []);

  const activeSheet: SheetModel | null =
    workbook && workbook.sheets[activeSheetIndex]
      ? workbook.sheets[activeSheetIndex]!
      : null;

  const currentProfile = useMemo<SheetProfile>(() => {
    if (!activeSheet) {
      return {
        sheetId: 'default',
        sheetName: 'default',
        rowCount: 0,
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
        recommendedMeasures: currentProfile.recommendedMeasures.filter((key) => selectedColumnKeys.has(key)),
        recommendedDimensions: currentProfile.recommendedDimensions.filter((key) => selectedColumnKeys.has(key)),
        recommendedTimeColumn: currentProfile.recommendedTimeColumn && selectedColumnKeys.has(currentProfile.recommendedTimeColumn) ? currentProfile.recommendedTimeColumn : undefined,
        primaryKeyCandidate: currentProfile.primaryKeyCandidate && selectedColumnKeys.has(currentProfile.primaryKeyCandidate) ? currentProfile.primaryKeyCandidate : undefined,
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
    <div className="studio-shell">
      <a href="#main-content" className="skip-link">Skip to dashboard</a>
      {/* Workspace navigation */}
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
      <div className="studio-layout">
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
        <main id="main-content" className="studio-main">

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
          <section id="datasets" className="dataset-section" aria-label="Datasets and upload">
            {workbook && (
              <div className="dataset-section-heading">
                <div className="flex items-center gap-2">
                  <span className="eyebrow">
                    YOUR DATA, CONNECTED
                  </span>
                  <span className="dataset-filename">
                    {workbook.filename}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsHeroExpanded((prev) => !prev)}
                  aria-expanded={isHeroExpanded}
                  className="dataset-collapse"
                >
                  <span>{isHeroExpanded ? 'Collapse' : 'Switch dataset / Upload'}</span>
                  {isHeroExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}

            <div>
              <UploadHero
                onFileUpload={handleFileUpload}
                onSelectSample={handleLoadSample}
                activeSampleId={activeSampleId}
                isProcessing={isProcessing}
                fileInputRef={fileInputRef}
                showUpload={!workbook || isHeroExpanded}
              />
            </div>
          </section>

          {timing && workbook && <PipelineStatus timing={timing} />}

          {/* AI Spec Refine Bar */}
          {isSpecRefineOpen && spec && (
            <SpecRefineBar
              key={`${workbook?.id}_${activeSheet?.id}`}
              currentSpec={spec}
              profile={currentProfile}
              onSpecUpdate={setSpec}
            />
          )}

          {/* Rendered Dashboard Canvas */}
          {isProcessing ? (
            <div role="status" aria-live="polite" className="processing-panel">
              <div className="processing-spinner"></div>
              <h3 className="text-base font-bold text-slate-800">
                Profiling spreadsheet & generating dashboard spec...
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Inferring data types, computing semantic roles, creating responsive grid layout
              </p>
            </div>
          ) : spec && activeSheet ? (
            <section id="dashboard" className="dashboard-canvas" aria-label="Dashboard canvas">
              <DashboardRenderer
                key={`${workbook?.id || 'wb'}_${activeSheet.id}_${spec.id}`}
                spec={spec}
                sheet={activeSheet}
              />
            </section>
          ) : null}
        </main>
      </div>

      {/* 4. Natural Language Analytical Drawer */}
      {activeSheet && (
        <AskYourDataDrawer
          key={`${workbook?.id}_${activeSheet.id}`}
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
