'use client';

import React, { Component, type ReactNode } from 'react';
import { ErrorCardWidget } from './widgets/ErrorCardWidget';

export interface WidgetErrorBoundaryProps {
  widgetId?: string | undefined;
  widgetTitle?: string | undefined;
  children: ReactNode;
  fallback?: ReactNode | undefined;
}

interface WidgetErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Total Error Boundary wrapping each dashboard widget.
 * Guarantees that if a widget throws during render or query execution,
 * only that single widget is replaced by ErrorCardWidget, and the rest of the dashboard
 * continues operating without crashing the page.
 */
export class WidgetErrorBoundary extends Component<
  WidgetErrorBoundaryProps,
  WidgetErrorBoundaryState
> {
  constructor(props: WidgetErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): WidgetErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error locally in development for debugging
    if (process.env.NODE_ENV === 'development') {
      console.error(
        `[WidgetErrorBoundary] Caught error in widget "${this.props.widgetId}":`,
        error,
        errorInfo
      );
    }
  }

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorCardWidget
          title={this.props.widgetTitle || 'Widget Render Failed'}
          error={this.state.error}
          widgetId={this.props.widgetId}
        />
      );
    }

    return this.props.children;
  }
}
