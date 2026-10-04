'use client';

import React, { useState } from 'react';
import { DashboardSpec, Template } from '@unsheet/contracts';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { saveLocalTemplate, exportTemplateJson } from '@/lib/template/storage';

interface TemplateSaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  dashboardSpec: DashboardSpec;
}

export function TemplateSaveModal({
  isOpen,
  onClose,
  dashboardSpec
}: TemplateSaveModalProps) {
  const [name, setName] = useState(dashboardSpec.title || 'My Dashboard Template');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [tagsInput, setTagsInput] = useState('custom, dashboard');

  const handleSaveLocal = () => {
    const template: Template = {
      id: `template-${Date.now()}`,
      name,
      description,
      category: category as Template['category'],
      tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
      fingerprint: {
        hash: '0000000000000000000000000000000000000000000000000000000000000000',
        version: '1.0',
        columnCount: dashboardSpec.widgets.length,
        columns: dashboardSpec.widgets.map(() => ({ key: 'col1', name: 'Column 1', inferredType: 'number' as const, required: true }))
      },
      isBuiltIn: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      spec: dashboardSpec
    };
    saveLocalTemplate(template);
    onClose();
  };

  const handleDownloadJson = () => {
    const template: Template = {
      id: `template-${Date.now()}`,
      name,
      description,
      category: category as Template['category'],
      tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
      fingerprint: {
        hash: '0000000000000000000000000000000000000000000000000000000000000000',
        version: '1.0',
        columnCount: dashboardSpec.widgets.length,
        columns: dashboardSpec.widgets.map(() => ({ key: 'col1', name: 'Column 1', inferredType: 'number' as const, required: true }))
      },
      isBuiltIn: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      spec: dashboardSpec
    };
    const jsonStr = exportTemplateJson(template);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}.unsheet.json`;
    a.click();
    URL.revokeObjectURL(url);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Save Dashboard as Template</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Template Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe what this template is for..." />
          </div>
          <div>
            <Label>Category</Label>
            <Input value={category} onChange={e => setCategory(e.target.value)} placeholder="saas, finance, operations, custom" />
          </div>
          <div>
            <Label>Tags (comma separated)</Label>
            <Input value={tagsInput} onChange={e => setTagsInput(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={handleDownloadJson}>Download .unsheet.json</Button>
          <Button onClick={handleSaveLocal}>Save to Local Library</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
