'use client';

import React, { useState, useEffect } from 'react';
import type { DashboardSpec, SheetModel } from '@unsheet/contracts';
import { Button } from '@/components/ui/button';
import { Copy, Check, AlertTriangle, X } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  spec: DashboardSpec;
  sheet: SheetModel;
}

export function ShareModal({ isOpen, onClose, spec, sheet }: ShareModalProps) {
  const [expiresInHours, setExpiresInHours] = useState<number | undefined>(168); // Default 7 Days (7 * 24 = 168)
  const [allowExport, setAllowExport] = useState<boolean>(false);
  const [includeDataSnapshot, setIncludeDataSnapshot] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setShareUrl(null);
      setErrorMessage(null);
      setCopied(false);
      setIsSubmitting(false);
      setAllowExport(false);
      setIncludeDataSnapshot(false);
      setExpiresInHours(168);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCreateShareLink = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const dataSnapshot = includeDataSnapshot ? sheet.rows.slice(0, 10000) : undefined;
      const payload = {
        title: spec.title,
        spec,
        allowExport,
        expiresInHours,
        includeDataSnapshot,
        dataSnapshot,
      };

      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to create share link (${res.status})`);
      }

      const data = await res.json();
      setShareUrl(data.shareUrl);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div
      role="dialog"
      aria-label="Share Dashboard"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
    >
      <div className="relative w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b pb-4">
          <h2 className="text-xl font-semibold text-gray-900">Share Dashboard</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Close share modal"
            className="h-8 w-8 p-0 rounded-full"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {errorMessage && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {!shareUrl ? (
          <div className="space-y-5">
            {/* Expiry Selection */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Link Expiry</label>
              <select
                value={expiresInHours ?? ''}
                onChange={(e) =>
                  setExpiresInHours(e.target.value ? Number(e.target.value) : undefined)
                }
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value={24}>24 Hours</option>
                <option value={168}>7 Days</option>
                <option value={720}>30 Days</option>
                <option value="">No Expiration</option>
              </select>
            </div>

            {/* Allow Export Toggle */}
            <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
              <div className="space-y-0.5">
                <label className="text-sm font-medium text-gray-900">Allow Export</label>
                <p className="text-xs text-gray-500">Allow viewers to export underlying data as CSV, XLSX, or JSON.</p>
              </div>
              <input
                type="checkbox"
                checked={allowExport}
                onChange={(e) => setAllowExport(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
            </div>

            {/* Include Data Snapshot Toggle */}
            <div className="space-y-2 rounded-lg border border-gray-200 p-3 bg-gray-50/50">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium text-gray-900">Include Data Snapshot</label>
                  <p className="text-xs text-gray-500">Embed sheet data directly with the shared link.</p>
                </div>
                <input
                  type="checkbox"
                  checked={includeDataSnapshot}
                  onChange={(e) => setIncludeDataSnapshot(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              </div>
              {includeDataSnapshot && (
                <div className="mt-2 flex items-start gap-2 rounded-md bg-amber-50 p-2.5 text-xs text-amber-800 border border-amber-200">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-600" />
                  <span>
                    Notice: When enabled, up to 10,000 rows of the current sheet are stored with the link. Leave unchecked for spec-only sharing.
                  </span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleCreateShareLink} disabled={isSubmitting}>
                {isSubmitting ? 'Generating...' : 'Create Share Link'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Shareable Link</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-800 shadow-sm focus:outline-none"
                />
                <Button onClick={handleCopyLink} className="flex items-center gap-1.5 flex-shrink-0">
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 text-green-200" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      <span>Copy Link</span>
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-500">Anyone with this link can view the shared dashboard.</p>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button onClick={onClose}>Done</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
