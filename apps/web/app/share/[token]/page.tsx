'use client';

import React, { useState, useEffect } from 'react';
import type { DashboardSpec, SheetModel } from '@unsheet/contracts';
import { DashboardRenderer } from '@/components/dashboard/DashboardRenderer';
import { ExportDropdown } from '@/components/export/ExportDropdown';
import { ShieldAlert, Loader2 } from 'lucide-react';

interface SharedPageProps {
  params: Promise<{ token: string }>;
}

export default function SharedDashboardPage({ params }: SharedPageProps) {
  const resolvedParams = React.use(params instanceof Promise ? params : Promise.resolve(params));
  const token = resolvedParams.token;

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);
  const [shareData, setShareData] = useState<{
    title: string;
    spec: DashboardSpec;
    allowExport: boolean;
    dataSnapshot?: Record<string, unknown>[];
  } | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function fetchShareData() {
      try {
        const res = await fetch(token.startsWith('http') ? token : `/api/share/${token}`);
        if (!res.ok) {
          if (isMounted) setError(true);
          return;
        }
        const data = await res.json();
        if (isMounted) {
          setShareData(data);
        }
      } catch {
        if (isMounted) setError(true);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    fetchShareData();
    return () => {
      isMounted = false;
    };
  }, [token]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-sm font-medium text-gray-600">Loading shared dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !shareData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg text-center space-y-4 border border-gray-100">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard Unavailable</h1>
          <p className="text-sm text-gray-500">
            This shared dashboard does not exist, has expired, or was revoked.
          </p>
        </div>
      </div>
    );
  }

  // Construct mock SheetModel if dataSnapshot exists
  let sheetModel: SheetModel | undefined;
  if (shareData.dataSnapshot && shareData.dataSnapshot.length > 0) {
    const firstRow = shareData.dataSnapshot[0] || {};
    const originalHeaders = Object.keys(firstRow);
    const sanitizedKeys = originalHeaders.map(h => h.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
    const rows = shareData.dataSnapshot.map(row => {
      const newRow: Record<string, unknown> = {};
      originalHeaders.forEach((orig, idx) => {
        newRow[sanitizedKeys[idx]!] = row[orig] !== undefined ? row[orig] : row[sanitizedKeys[idx]!];
      });
      return newRow;
    });

    sheetModel = {
      id: 'shared',
      name: shareData.title,
      headers: {
        detectedRowIndex: 0,
        confidence: 1.0,
        originalHeaders,
        sanitizedKeys,
      },
      columns: originalHeaders.map((orig, idx) => ({
        key: sanitizedKeys[idx]!,
        originalName: orig,
        columnIndex: idx,
      })),
      rows,
      rowCount: rows.length,
      columnCount: originalHeaders.length,
    };
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Banner */}
      <header className="bg-indigo-900 text-white px-6 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <span className="rounded-md bg-indigo-800 px-2.5 py-1 text-xs font-medium tracking-wide uppercase">
            Shared Dashboard (Read-Only)
          </span>
          <h1 className="text-sm font-semibold truncate max-w-md">{shareData.title}</h1>
        </div>

        {shareData.allowExport && sheetModel && (
          <div className="bg-white/10 rounded-md">
            <ExportDropdown sheet={sheetModel} />
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        <DashboardRenderer spec={shareData.spec} sheet={sheetModel} />
      </main>
    </div>
  );
}
