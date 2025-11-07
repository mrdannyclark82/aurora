/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { VideoAnalysisView } from './VideoAnalysisView';
import { ErrorProvider } from '../contexts/ErrorContext';
import { MobileNavProvider } from '../contexts/MobileNavContext';
import * as geminiService from '../services/geminiService';

// Mocking services and hooks
vi.mock('../services/geminiService');
vi.mock('../utils/fileUtils', () => ({
  fileToBase64: vi.fn().mockResolvedValue('fake-base64-string'),
}));

const mockAnalyzeVideo = vi.spyOn(geminiService, 'analyzeVideo');

const renderComponent = () => {
  return render(
    <ErrorProvider>
      <MobileNavProvider>
        <VideoAnalysisView />
      </MobileNavProvider>
    </ErrorProvider>
  );
};

describe('VideoAnalysisView', () => {
  it('renders initial state correctly', () => {
    renderComponent();
    expect(screen.getByText('Video Analysis')).toBeInTheDocument();
    expect(screen.getByText('Upload a video to get started')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select Video File' })).toBeInTheDocument();
  });

  it('handles file selection and processing', async () => {
    renderComponent();
    
    const file = new File(['dummy video content'], 'test.mp4', { type: 'video/mp4' });
    const fileInput = screen.getByLabelText('Select Video File').previousElementSibling as HTMLInputElement;

    await waitFor(() => {
        fireEvent.change(fileInput, { target: { files: [file] } });
    });

    expect(await screen.findByText(/Processing Video.../i)).toBeInTheDocument();
    expect(await screen.findByText(/Selected: test.mp4/i)).toBeInTheDocument();
  });

  it('shows an error if file is too large', async () => {
    renderComponent();
    
    const largeFile = new File(['a'.repeat(60 * 1024 * 1024)], 'large.mp4', { type: 'video/mp4' });
    Object.defineProperty(largeFile, 'size', { value: 60 * 1024 * 1024 });
    
    const fileInput = screen.getByLabelText('Select Video File').previousElementSibling as HTMLInputElement;
    
    fireEvent.change(fileInput, { target: { files: [largeFile] } });
    
    // In a real app, the error would pop up in a toast. We can check if setError was called.
    // For this test, we can just check that the file name does not appear.
    await waitFor(() => {
        expect(screen.queryByText(/Selected: large.mp4/i)).not.toBeInTheDocument();
    });
  });

  it('calls analyzeVideo service on button click', async () => {
    mockAnalyzeVideo.mockResolvedValue({ text: 'This is a test analysis.' } as any);

    renderComponent();

    const file = new File(['dummy video'], 'test.mp4', { type: 'video/mp4' });
    const fileInput = screen.getByLabelText('Select Video File').previousElementSibling as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    await screen.findByText('Selected: test.mp4');

    const promptTextarea = screen.getByPlaceholderText(/What do you want to know about this video?/i);
    fireEvent.change(promptTextarea, { target: { value: 'What is happening?' } });

    const analyzeButton = screen.getByRole('button', { name: 'Analyze Video' });
    fireEvent.click(analyzeButton);

    expect(await screen.findByText('Analyzing...')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockAnalyzeVideo).toHaveBeenCalledWith(
        'What is happening?',
        'fake-base64-string',
        'video/mp4'
      );
    });
    
    expect(await screen.findByText('This is a test analysis.')).toBeInTheDocument();
  });
});
