'use client';

import React, { useState, useEffect, useRef } from 'react';
import { SheetModel, SheetProfile, WidgetSpec, QueryResult, ColumnProfile } from '@unsheet/contracts';
import { toLLMColumnProfile, getSheetTableName, executeQueryInMemory, buildWidgetQueryPlan } from '@unsheet/engine';
import { registerSheetTable, executeDuckDBQuery } from '@/lib/query/duckdb';
import { X, Send, Sparkles, Database, Plus, Check, AlertCircle, ChevronDown, ChevronUp, Bot, Loader2, Table as TableIcon, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { getAIHeaders } from '@/lib/llm/client-settings';
import { AISettingsModal } from '@/components/studio/AISettingsModal';

export interface AskYourDataDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sheet: SheetModel;
  profile: SheetProfile;
  onAddWidget: (widget: WidgetSpec) => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  question?: string;
  interpretedIntent?: string;
  sql?: string;
  explanation?: string;
  suggestedWidget?: WidgetSpec;
  queryResult?: QueryResult | undefined;
  error?: string;
  isRateLimit?: boolean;
}

export function AskYourDataDrawer({
  isOpen,
  onClose,
  sheet,
  profile,
  onAddWidget,
}: AskYourDataDrawerProps) {
  const [question, setQuestion] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [addedWidgetIds, setAddedWidgetIds] = useState<Record<string, boolean>>({});
  const [showSqlMap, setShowSqlMap] = useState<Record<string, boolean>>({});
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  const drawerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset conversation when active sheet changes
  useEffect(() => {
    setMessages([]);
    setAddedWidgetIds({});
    setShowSqlMap({});
  }, [sheet.id]);

  // Focus trap & Escape key handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Generate dynamic sample prompt suggestions based on actual profile columns
  const generatePromptSuggestions = () => {
    const cols = profile.columnProfiles;
    const isTemporal = (c: ColumnProfile) => {
      const s = `${c.originalName || ''} ${c.columnKey}`.toLowerCase();
      const temporalWords = ['date', 'time', 'timestamp', 'year', 'month', 'day', 'quarter', 'created', 'updated', 'due', 'closed'];
      const durationWords = ['duration', 'lead_days', 'days_to', 'elapsed', 'latency', 'hours_spent'];
      return (
        c.semanticRole === 'time' ||
        c.inferredType === 'date' ||
        (temporalWords.some((w) => s.includes(w)) && !durationWords.some((w) => s.includes(w)))
      );
    };

    const measures = cols.filter(
      (c) =>
        (c.inferredType === 'number' || c.inferredType === 'currency' || c.semanticRole === 'measure') &&
        !isTemporal(c)
    );
    const dimensions = cols.filter(
      (c) =>
        c.inferredType === 'category' ||
        c.inferredType === 'text' ||
        c.semanticRole === 'dimension' ||
        isTemporal(c)
    );

    const mName = measures[0]?.columnKey;
    const dName = dimensions[0]?.columnKey || cols[0]?.columnKey;

    const suggestions: string[] = [];
    if (mName && dName && mName !== dName) {
      suggestions.push(`Total ${mName} by ${dName}`);
      suggestions.push(`Top 5 ${dName} by ${mName}`);
      suggestions.push(`Average ${mName}`);
    } else if (mName) {
      suggestions.push(`Total ${mName}`);
      suggestions.push(`Average ${mName}`);
    } else if (dName) {
      suggestions.push(`Count records by ${dName}`);
    }
    suggestions.push(`Show all records in ${sheet.name}`);
    return suggestions.slice(0, 4);
  };

  const samplePrompts = generatePromptSuggestions();

  const handleAsk = async (queryText: string) => {
    if (!queryText.trim() || isSearching) return;

    const userMsgId = `msg_${Date.now()}_user`;
    const assistantMsgId = `msg_${Date.now()}_asst`;

    const newMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      question: queryText,
    };

    setMessages((prev) => [...prev, newMsg]);
    setQuestion('');
    setIsSearching(true);

    try {
      const llmProfiles = profile.columnProfiles.map(toLLMColumnProfile);
      const tableName = getSheetTableName(sheet);
      const res = await fetch('/api/query/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAIHeaders(),
        },
        body: JSON.stringify({
          question: queryText,
          sheetName: tableName,
          profiles: llmProfiles,
        }),
      });

      if (res.status === 429) {
        setMessages((prev) => [
          ...prev,
          {
            id: assistantMsgId,
            sender: 'assistant',
            error: 'Rate limit exceeded (429). Please wait a moment before trying again.',
            isRateLimit: true,
          },
        ]);
        setIsSearching(false);
        return;
      }

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to query data.');
      }

      let executionResult: QueryResult | undefined;

      // 1. Instant in-memory execution via @unsheet/engine
      const plan = data.queryPlan || (data.suggestedWidget ? buildWidgetQueryPlan(sheet, data.suggestedWidget) : undefined);
      if (plan) {
        try {
          executionResult = executeQueryInMemory(plan, sheet);
        } catch (memErr) {
          console.warn('In-memory plan execution failed:', memErr);
        }
      }

      // 2. DuckDB in-browser execution fallback if no plan or empty rows
      if (!executionResult || executionResult.rows.length === 0) {
        try {
          await registerSheetTable(sheet);
          executionResult = await executeDuckDBQuery(data.sql);
        } catch (dbErr) {
          console.warn('In-browser DuckDB execution of generated SQL failed:', dbErr);
        }
      }

      // 3. Conversational natural-language analyst summary
      let conversationalNarrative = data.explanation || '';
      if (executionResult && executionResult.rows.length > 0) {
        const rowCount = executionResult.rowCount;
        const cols = executionResult.columns;

        if (rowCount === 1 && cols.length === 1) {
          const colName = cols[0]!.name;
          const val = executionResult.rows[0]![colName];
          const formattedVal = typeof val === 'number' ? Number(val).toLocaleString() : String(val ?? '');
          conversationalNarrative = `Based on **${sheet.name}**, the total ${colName.replace(/_/g, ' ')} is **${formattedVal}**.`;
        } else if (rowCount > 1 && cols.length >= 2) {
          const dimCol = cols[0]!.name;
          const valCol = cols[1]!.name;
          const topRow = executionResult.rows[0]!;
          const topDim = String(topRow[dimCol] ?? '');
          const topVal = typeof topRow[valCol] === 'number' ? Number(topRow[valCol]).toLocaleString() : String(topRow[valCol] ?? '');

          if (rowCount <= 5) {
            const breakdown = executionResult.rows
              .slice(0, 3)
              .map((r) => `**${r[dimCol]}** (${typeof r[valCol] === 'number' ? Number(r[valCol]).toLocaleString() : r[valCol]})`)
              .join(', ');
            conversationalNarrative = `Here is the breakdown for **${sheet.name}**: ${breakdown}. **${topDim}** leads with **${topVal}**.`;
          } else {
            conversationalNarrative = `Analyzed **${rowCount}** categories in **${sheet.name}**. **${topDim}** is highest with **${topVal}**.`;
          }
        } else if (rowCount > 0) {
          conversationalNarrative = `Found **${rowCount}** matching records in **${sheet.name}**.`;
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          sender: 'assistant',
          interpretedIntent: data.interpretedIntent,
          sql: data.sql,
          explanation: conversationalNarrative,
          suggestedWidget: data.suggestedWidget,
          queryResult: executionResult,
        },
      ]);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error occurred';
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          sender: 'assistant',
          error: errMsg,
        },
      ]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleViewOnCanvas = (widgetId: string) => {
    onClose();
    setTimeout(() => {
      const el = document.getElementById(`widget-${widgetId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-4', 'ring-indigo-500/50', 'transition-all', 'duration-500');
        setTimeout(() => {
          el.classList.remove('ring-4', 'ring-indigo-500/50');
        }, 2000);
      }
    }, 150);
  };

  const handleAddWidgetClick = (widget: WidgetSpec) => {
    onAddWidget(widget);
    setAddedWidgetIds((prev) => ({ ...prev, [widget.id]: true }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex justify-end transition-opacity animate-in fade-in duration-200">
      <div
        ref={drawerRef}
        role="dialog"
        aria-label="Ask Your Data"
        aria-modal="true"
        className="w-full max-w-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 h-full shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-950/60 rounded-lg text-indigo-600 dark:text-indigo-400">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Ask Your Data</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Query your spreadsheet using natural language (client-side privacy preserved)
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSettingsOpen(true)}
              className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              aria-label="AI Settings"
              title="Configure Grok / OpenAI API Key"
            >
              <Settings className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              aria-label="Close drawer"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content / Message History */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && (
            <div className="text-center py-12 space-y-4">
              <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-medium text-slate-900 dark:text-slate-100">What would you like to know?</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  Click a suggestion below or type your question to query <span className="font-semibold text-indigo-600 dark:text-indigo-400">{sheet.name}</span>.
                </p>
              </div>

              <div className="pt-4 flex flex-wrap gap-2 justify-center">
                {samplePrompts.map((promptText, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleAsk(promptText)}
                    className="text-xs font-medium px-3.5 py-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left shadow-xs"
                  >
                    ✨ {promptText}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={cn('flex flex-col space-y-2', msg.sender === 'user' ? 'items-end' : 'items-start')}>
              {msg.sender === 'user' ? (
                <div className="bg-indigo-600 text-white px-4 py-2.5 rounded-2xl rounded-tr-none max-w-[85%] text-sm shadow-sm">
                  {msg.question}
                </div>
              ) : (
                <div className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 p-4 rounded-2xl rounded-tl-none max-w-[90%] space-y-3 text-sm shadow-sm">
                  {msg.error ? (
                    <div className="flex items-center space-x-2 text-red-600 dark:text-red-400 font-medium">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{msg.error}</span>
                    </div>
                  ) : (
                    <>
                      {msg.interpretedIntent && (
                        <div className="font-medium text-indigo-600 dark:text-indigo-400 flex items-center space-x-1.5">
                          <Sparkles className="w-4 h-4 shrink-0" />
                          <span>{msg.interpretedIntent}</span>
                        </div>
                      )}

                      {msg.explanation && (
                        <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed">
                          {msg.explanation}
                        </p>
                      )}

                      {msg.queryResult && (
                        <div className="space-y-2">
                          {msg.queryResult.rowCount === 1 && msg.queryResult.columns.length === 1 ? (
                            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-xs">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                {msg.queryResult.columns[0]?.name}
                              </div>
                              <div className="text-2xl font-bold font-mono text-indigo-600 dark:text-indigo-400 mt-0.5">
                                {String(msg.queryResult.rows[0]?.[msg.queryResult.columns[0]?.name ?? ''] ?? '-')}
                              </div>
                            </div>
                          ) : msg.queryResult.rowCount > 0 ? (
                            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
                              <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                                <span className="flex items-center gap-1.5">
                                  <TableIcon className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>Result ({msg.queryResult.rowCount} {msg.queryResult.rowCount === 1 ? 'row' : 'rows'})</span>
                                </span>
                                <span className="font-mono text-[10px] text-slate-600 dark:text-slate-400">{msg.queryResult.executionTimeMs}ms</span>
                              </div>
                              <div className="max-h-48 overflow-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[10px] uppercase font-bold sticky top-0">
                                    <tr>
                                      {msg.queryResult.columns.map((c) => (
                                        <th key={c.name} className="px-3 py-1.5 border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">
                                          {c.name}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                                    {msg.queryResult.rows.slice(0, 10).map((row, rIdx) => (
                                      <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                        {msg.queryResult!.columns.map((c) => (
                                          <td key={c.name} className="px-3 py-1.5 text-slate-800 dark:text-slate-200 whitespace-nowrap">
                                            {String(row[c.name] ?? '-')}
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ) : (
                            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-xs text-slate-600 dark:text-slate-400">
                              Query returned 0 matching records.
                            </div>
                          )}
                        </div>
                      )}

                      {msg.sql && (
                        <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-900">
                          <button
                            onClick={() => setShowSqlMap((prev) => ({ ...prev, [msg.id]: !prev[msg.id] }))}
                            aria-expanded={Boolean(showSqlMap[msg.id])}
                            aria-label="Toggle SQL query preview"
                            className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <span className="flex items-center space-x-1">
                              <Database className="w-3.5 h-3.5" />
                              <span>Generated Safe SQL Query</span>
                            </span>
                            {showSqlMap[msg.id] ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                          {showSqlMap[msg.id] && (
                            <div className="p-3 bg-slate-950 text-slate-200 text-xs font-mono overflow-x-auto">
                              <pre><code>{msg.sql}</code></pre>
                            </div>
                          )}
                        </div>
                      )}

                      {msg.suggestedWidget && (
                        <div className="p-3.5 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/60 rounded-xl space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-indigo-950 dark:text-indigo-200">
                              Suggested Widget: {msg.suggestedWidget.title} ({msg.suggestedWidget.type.toUpperCase()})
                            </span>
                          </div>

                          {addedWidgetIds[msg.suggestedWidget.id] ? (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 py-1.5 px-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center justify-center text-xs font-medium text-emerald-700 dark:text-emerald-300">
                                <Check className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                                <span>Added to dashboard!</span>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => handleViewOnCanvas(msg.suggestedWidget!.id)}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs shrink-0"
                              >
                                View on Canvas →
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleAddWidgetClick(msg.suggestedWidget!)}
                                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium shadow-xs"
                              >
                                <Plus className="w-3.5 h-3.5 mr-1.5" />
                                Add to Dashboard
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  handleAddWidgetClick(msg.suggestedWidget!);
                                  handleViewOnCanvas(msg.suggestedWidget!.id);
                                }}
                                className="text-xs border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 shrink-0"
                              >
                                Add & Jump →
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ))}

          {isSearching && (
            <div className="flex items-start space-x-2">
              <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-2xl rounded-tl-none flex items-center space-x-2 text-slate-500 text-sm">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                <span>Analyzing data and generating query...</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer / Input */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAsk(question);
            }}
            className="flex items-center space-x-2"
          >
            <Input
              ref={inputRef}
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a question about your data..."
              disabled={isSearching}
              className="flex-1 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 border border-slate-300 dark:border-slate-700 text-sm"
            />
            <Button
              type="submit"
              disabled={isSearching || !question.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
            >
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span className="ml-1.5 hidden sm:inline">Ask</span>
            </Button>
          </form>
        </div>
      </div>

      <AISettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
