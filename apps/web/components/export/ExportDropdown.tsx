'use client';

import React from 'react';
import type { SheetModel, ExportTable } from '@unsheet/contracts';
import { exportToCsv, exportToJson, exportToXlsx } from '@unsheet/engine';
import { Button } from '@/components/ui/button';
import { Download, FileSpreadsheet, FileText, Code } from 'lucide-react';

interface ExportDropdownProps {
  sheet: SheetModel;
  disabled?: boolean;
}

export function ExportDropdown({ sheet, disabled = false }: ExportDropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const triggerDownload = (content: string | Uint8Array, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    const table: ExportTable = {
      sheetName: sheet.name,
      headers: sheet.headers.originalHeaders,
      rows: sheet.rows,
    };
    const csvContent = exportToCsv(table);
    triggerDownload(csvContent, `${sheet.name}.csv`, 'text/csv;charset=utf-8;');
    setIsOpen(false);
  };

  const handleExportXlsx = () => {
    const table: ExportTable = {
      sheetName: sheet.name,
      headers: sheet.headers.originalHeaders,
      rows: sheet.rows,
    };
    const xlsxBytes = exportToXlsx(table);
    triggerDownload(
      xlsxBytes,
      `${sheet.name}.xlsx`,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    setIsOpen(false);
  };

  const handleExportJson = () => {
    const table: ExportTable = {
      sheetName: sheet.name,
      headers: sheet.headers.originalHeaders,
      rows: sheet.rows,
    };
    const jsonContent = exportToJson(table);
    triggerDownload(jsonContent, `${sheet.name}.json`, 'application/json');
    setIsOpen(false);
  };

  React.useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Export options"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2"
      >
        <Download className="h-4 w-4" />
        <span>Export</span>
      </Button>

      {isOpen && (
        <div
          role="menu"
          aria-label="Export options menu"
          className="absolute right-0 mt-2 w-48 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50 py-1"
        >
          <button
            role="menuitem"
            onClick={handleExportCsv}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
          >
            <FileText className="h-4 w-4 text-gray-500" />
            <span>Export CSV</span>
          </button>
          <button
            role="menuitem"
            onClick={handleExportXlsx}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
          >
            <FileSpreadsheet className="h-4 w-4 text-green-600" />
            <span>Export Excel (.xlsx)</span>
          </button>
          <button
            role="menuitem"
            onClick={handleExportJson}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
          >
            <Code className="h-4 w-4 text-blue-600" />
            <span>Export JSON</span>
          </button>
        </div>
      )}
    </div>
  );
}
