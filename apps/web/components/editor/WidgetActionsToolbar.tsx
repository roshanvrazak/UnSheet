'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Pencil, Copy, Trash2, ArrowUp, ArrowDown } from 'lucide-react';

interface WidgetActionsToolbarProps {
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export function WidgetActionsToolbar({
  onEdit,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown
}: WidgetActionsToolbarProps) {
  return (
    <div className="absolute top-2 right-2 z-20 flex items-center gap-1 bg-background/90 backdrop-blur-sm border rounded-md p-1 shadow-sm opacity-90 hover:opacity-100 transition-opacity">
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit} title="Edit Widget">
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDuplicate} title="Duplicate Widget">
        <Copy className="h-3.5 w-3.5" />
      </Button>
      {onMoveUp && (
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMoveUp} title="Move Up">
          <ArrowUp className="h-3.5 w-3.5" />
        </Button>
      )}
      {onMoveDown && (
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMoveDown} title="Move Down">
          <ArrowDown className="h-3.5 w-3.5" />
        </Button>
      )}
      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete} title="Delete Widget">
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
