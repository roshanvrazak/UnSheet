'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Key,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Eye,
  EyeOff,
  Server,
  Cpu,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  getClientAISettings,
  saveClientAISettings,
  ClientAISettings,
} from '@/lib/llm/client-settings';

export interface AISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AISettingsModal({ isOpen, onClose }: AISettingsModalProps) {
  const [provider, setProvider] = useState<'grok' | 'openai' | 'custom'>('grok');
  const [apiKey, setApiKey] = useState<string>('');
  const [model, setModel] = useState<string>('grok-2-mini');
  const [baseUrl, setBaseUrl] = useState<string>('');
  const [showKey, setShowKey] = useState<boolean>(false);

  const [testing, setTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [serverStatus, setServerStatus] = useState<{
    configured: boolean;
    providerName: string | null;
    modelName: string | null;
  } | null>(null);

  // Load stored settings on open
  useEffect(() => {
    if (isOpen) {
      const stored = getClientAISettings();
      setProvider(stored.provider);
      setApiKey(stored.apiKey);
      setModel(stored.model);
      setBaseUrl(stored.baseUrl || '');
      setTestResult(null);

      // Check if server already has environment keys
      fetch('/api/llm/test')
        .then((res) => res.json())
        .then((data) => {
          if (data && data.configured) {
            setServerStatus(data);
          } else {
            setServerStatus(null);
          }
        })
        .catch(() => setServerStatus(null));
    }
  }, [isOpen]);

  // Handle provider switch defaults
  const handleProviderChange = (newProvider: 'grok' | 'openai' | 'custom') => {
    setProvider(newProvider);
    setTestResult(null);
    if (newProvider === 'grok') {
      setModel('grok-2-mini');
    } else if (newProvider === 'openai') {
      setModel('gpt-4o-mini');
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (apiKey.trim()) {
        headers['x-api-key'] = apiKey.trim();
        headers['x-api-provider'] = provider;
        headers['x-api-model'] = model.trim();
        if (baseUrl.trim()) {
          headers['x-api-base-url'] = baseUrl.trim();
        }
      }

      const res = await fetch('/api/llm/test', {
        method: 'POST',
        headers,
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({
          success: true,
          message: data.message || `Successfully connected to ${data.providerName || provider}!`,
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Connection test failed.',
        });
      }
    } catch (err: unknown) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Network error testing connection.',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    const newSettings: ClientAISettings = {
      provider,
      apiKey: apiKey.trim(),
      model: model.trim() || (provider === 'grok' ? 'grok-2-mini' : 'gpt-4o-mini'),
      ...(baseUrl.trim() ? { baseUrl: baseUrl.trim() } : {}),
    };
    saveClientAISettings(newSettings);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-settings-title"
        className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 id="ai-settings-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">
                AI Provider Settings
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure your Grok or OpenAI key for Ask AI & Refine
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 flex-1 overflow-y-auto max-h-[75vh]">
          {/* Server Env Status Banner */}
          {serverStatus?.configured && !apiKey && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl flex items-start space-x-2.5 text-xs text-emerald-800 dark:text-emerald-300">
              <Server className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Active Server Key:</span> {serverStatus.providerName} ({serverStatus.modelName}) is active via environment variables. You can enter an override below or use the server key.
              </div>
            </div>
          )}

          {/* Provider Selector Tabs */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Choose Provider
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleProviderChange('grok')}
                className={`py-2 px-3 text-xs font-semibold rounded-xl border flex flex-col items-center gap-1 transition-all ${
                  provider === 'grok'
                    ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <span className="text-sm font-bold">xAI (Grok)</span>
                <span className="text-[10px] opacity-75">grok-2-mini</span>
              </button>

              <button
                type="button"
                onClick={() => handleProviderChange('openai')}
                className={`py-2 px-3 text-xs font-semibold rounded-xl border flex flex-col items-center gap-1 transition-all ${
                  provider === 'openai'
                    ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <span className="text-sm font-bold">OpenAI</span>
                <span className="text-[10px] opacity-75">gpt-4o-mini</span>
              </button>

              <button
                type="button"
                onClick={() => handleProviderChange('custom')}
                className={`py-2 px-3 text-xs font-semibold rounded-xl border flex flex-col items-center gap-1 transition-all ${
                  provider === 'custom'
                    ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <span className="text-sm font-bold">Custom</span>
                <span className="text-[10px] opacity-75">OpenAI-comp.</span>
              </button>
            </div>
          </div>

          {/* API Key Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {provider === 'grok' ? 'xAI / Grok API Key' : provider === 'openai' ? 'OpenAI API Key' : 'API Key'}
              </label>
              {provider === 'grok' && (
                <a
                  href="https://console.x.ai/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                >
                  <span>Get Grok Key</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Key className="w-4 h-4" />
              </div>
              <Input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setTestResult(null);
                }}
                placeholder={provider === 'grok' ? 'xai-...' : 'sk-...'}
                className="pl-9 pr-10 text-xs font-mono bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                aria-label={showKey ? 'Hide API key' : 'Show API key'}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Saved securely in your browser session. Sent directly to your own server endpoint.
            </p>
          </div>

          {/* Model Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5" />
              <span>Model Selection</span>
            </label>
            {provider === 'grok' ? (
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="grok-2-mini">grok-2-mini (Recommended - Fast & Accurate)</option>
                <option value="grok-2">grok-2 (High Precision Reasoning)</option>
                <option value="grok-beta">grok-beta</option>
              </select>
            ) : provider === 'openai' ? (
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="gpt-4o-mini">gpt-4o-mini (Fast & Recommended)</option>
                <option value="gpt-4o">gpt-4o (Full Capability)</option>
              </select>
            ) : (
              <Input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Model ID (e.g. llama3, mistral)"
                className="text-xs font-mono"
              />
            )}
          </div>

          {/* Custom Base URL (if custom) */}
          {provider === 'custom' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Base URL
              </label>
              <Input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.openai.com/v1"
                className="text-xs font-mono"
              />
            </div>
          )}

          {/* Test Connection Banner */}
          {testResult && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start space-x-2 ${
                testResult.success
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed">{testResult.message}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTestConnection}
            disabled={testing || (!apiKey.trim() && !serverStatus?.configured)}
            className="text-xs h-9 border-slate-300 dark:border-slate-700"
          >
            {testing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                Testing...
              </>
            ) : (
              'Test Connection'
            )}
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-xs h-9"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9 px-4 font-semibold shadow-xs"
            >
              Save & Apply
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
