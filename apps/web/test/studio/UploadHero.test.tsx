// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UploadHero } from '../../components/studio/UploadHero';
import { SAMPLE_WORKBOOKS } from '../../lib/sample-workbooks';

describe('UploadHero Component', () => {
  it('renders modern upload dropzone, format pills, and security guarantees', () => {
    render(
      <UploadHero
        onFileUpload={vi.fn()}
        onSelectSample={vi.fn()}
        isProcessing={false}
      />
    );

    expect(screen.getByText('Drop your spreadsheet here')).toBeDefined();
    expect(screen.getByText(/files up to 50MB/i)).toBeDefined();
    expect(screen.getByText('.xlsx')).toBeDefined();
    expect(screen.getByText(/100% In-Browser/i)).toBeDefined();
    expect(screen.getByText('Browse files')).toBeDefined();
  });

  it('renders all pre-loaded sample workbooks and triggers onSelectSample', () => {
    const handleSelectSample = vi.fn();
    render(
      <UploadHero
        onFileUpload={vi.fn()}
        onSelectSample={handleSelectSample}
        activeSampleId="project-pipeline"
        isProcessing={false}
      />
    );

    for (const sample of SAMPLE_WORKBOOKS) {
      expect(screen.getByText(sample.name)).toBeDefined();
    }

    const firstSample = SAMPLE_WORKBOOKS[0]!;
    const btn = screen.getByText(firstSample.name);
    fireEvent.click(btn);

    expect(handleSelectSample).toHaveBeenCalledWith(firstSample);
  });

  it('triggers onFileUpload when a file is selected via input', () => {
    const handleFileUpload = vi.fn();
    render(
      <UploadHero
        onFileUpload={handleFileUpload}
        onSelectSample={vi.fn()}
        isProcessing={false}
      />
    );

    const input = screen.getByTestId('studio-file-upload-input');
    const dummyFile = new File(['col1,col2\n1,2'], 'test.csv', { type: 'text/csv' });

    fireEvent.change(input, { target: { files: [dummyFile] } });
    expect(handleFileUpload).toHaveBeenCalledWith(dummyFile);
  });
});
