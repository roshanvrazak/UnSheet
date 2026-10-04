'use client';

import React, { useState, useEffect } from 'react';
import { Template, DashboardSpec } from '@unsheet/engine';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { loadLocalTemplates, deleteLocalTemplate, importTemplateJson } from '@/lib/template/storage';
import { Trash2, Download, Upload, Check } from 'lucide-react';

interface TemplateLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (spec: DashboardSpec) => void;
}

export function TemplateLibraryModal({
  isOpen,
  onClose,
  onSelectTemplate
}: TemplateLibraryModalProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTemplates(loadLocalTemplates());
    }
  }, [isOpen]);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteLocalTemplate(id);
    setTemplates(loadLocalTemplates());
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = event => {
      try {
        const content = event.target?.result as string;
        const imported = importTemplateJson(content);
        if (imported && imported.spec) {
          setTemplates(loadLocalTemplates());
          setSelectedId(imported.id);
        }
      } catch (err) {
        alert('Failed to parse template JSON file.');
      }
    };
    reader.readAsText(file);
  };

  const selectedTemplate = templates.find(t => t.id === selectedId);

  const handleApply = () => {
    if (selectedTemplate) {
      onSelectTemplate(selectedTemplate.spec);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex justify-between items-center">
            <span>Template Library</span>
            <div className="flex items-center gap-2">
              <label className="cursor-pointer">
                <Button variant="outline" size="sm" asChild>
                  <span><Upload className="h-4 w-4 mr-1" /> Import JSON</span>
                </Button>
                <input type="file" accept=".json,.unsheet.json" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-4 flex-1 overflow-y-auto py-2">
          <div className="col-span-1 border-r pr-2 space-y-2">
            {templates.map(t => (
              <div
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                className={`p-3 rounded-lg border cursor-pointer transition-colors flex justify-between items-start ${
                  selectedId === t.id ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
                }`}
              >
                <div>
                  <h4 className="font-medium text-sm">{t.name}</h4>
                  <span className="text-xs text-muted-foreground uppercase">{t.category}</span>
                </div>
                {!t.id.startsWith('template-saas') && !t.id.startsWith('template-fin') && !t.id.startsWith('template-ops') && (
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={e => handleDelete(t.id, e)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <div className="col-span-2 pl-2 flex flex-col justify-between">
            {selectedTemplate ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">{selectedTemplate.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{selectedTemplate.description}</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {selectedTemplate.tags?.map(tag => (
                    <span key={tag} className="px-2 py-0.5 bg-secondary text-secondary-foreground rounded-full text-xs">
                      #{tag}
                    </span>
                  ))}
                </div>
                <div className="border rounded-md p-3 bg-muted/20">
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Widgets included ({selectedTemplate.spec.widgets.length})</h4>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {selectedTemplate.spec.widgets.map(w => (
                      <div key={w.id} className="text-xs flex justify-between items-center py-1 border-b last:border-0">
                        <span className="font-medium">{w.title}</span>
                        <span className="text-muted-foreground uppercase">{w.type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Select a template to preview
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!selectedTemplate} onClick={handleApply}>Load Template</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
