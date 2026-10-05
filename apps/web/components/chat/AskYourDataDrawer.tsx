'use client';

import React, { useState, useEffect, useRef } from 'react';
import { SheetModel, SheetProfile, WidgetSpec } from '@unsheet/contracts';
import { toLLMColumnProfile, getSheetTableName } from '@unsheet/engine';
import { X, Send, Sparkles, Database, Plus, Check, AlertCircle, ChevronDown, ChevronUp, Bot, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

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
    const measures = cols.filter(
      (c) => c.inferredType === 'number' || c.inferredType === 'currency' || c.semanticRole === 'measure'
    );
    const dimensions = cols.filter(
      (c) => c.inferredType === 'category' || c.inferredType === 'text' || c.semanticRole === 'dimension'
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
        headers: { 'Content-Type': 'application/json' },
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

      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          sender: 'assistant',
          interpretedIntent: data.interpretedIntent,
          sql: data.sql,
          explanation: data.explanation,
          suggestedWidget: data.suggestedWidget,
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
                        <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50 rounded-lg space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-indigo-900 dark:text-indigo-300">
                              Suggested Widget: {msg.suggestedWidget.title} ({msg.suggestedWidget.type.toUpperCase()})
                            </span>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleAddWidgetClick(msg.suggestedWidget!)}
                            disabled={addedWidgetIds[msg.suggestedWidget.id]}
                            className={cn(
                              'w-full text-xs font-medium',
                              addedWidgetIds[msg.suggestedWidget.id]
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                            )}
                          >
                            {addedWidgetIds[msg.suggestedWidget.id] ? (
                              <>
                                <Check className="w-3.5 h-3.5 mr-1.5" />
                                Added to dashboard!
                              </>
                            ) : (
                              <>
                                <Plus className="w-3.5 h-3.5 mr-1.5" />
                                Add to Dashboard
                              </>
                            )}
                          </Button>
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
    </div>
  );
}
