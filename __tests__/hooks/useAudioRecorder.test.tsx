// __tests__/hooks/useAudioRecorder.test.tsx
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { useToast } from '../../hooks/useToast';
import React from 'react';

// Mock dependencies
jest.mock('../../hooks/useToast');

const mockUseToast = useToast as jest.Mock;
const mockShowToast = jest.fn();

const mockGetUserMedia = navigator.mediaDevices.getUserMedia as jest.Mock;

describe('useAudioRecorder', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUseToast.mockReturnValue({ showToast: mockShowToast });
    });

    it('should initialize with correct default state', () => {
        const { result } = renderHook(() => useAudioRecorder());
        expect(result.current.isRecording).toBe(false);
        expect(result.current.isProcessing).toBe(false);
    });

    it('should start recording successfully', async () => {
        // Fix: Cast mock resolved value to 'any' to avoid TypeScript type inference issues with Jest mocks.
        mockGetUserMedia.mockResolvedValue({
            getTracks: () => [{ stop: jest.fn() }],
        } as any);

        const { result } = renderHook(() => useAudioRecorder());

        await act(async () => {
            result.current.startRecording();
        });
        
        await waitFor(() => {
            expect(result.current.isRecording).toBe(true);
        });
    });

    it('should handle microphone permission denial', async () => {
        const error = new Error("Permission denied");
        // Fix: Cast mock rejected value to 'any' to avoid TypeScript type inference issues with Jest mocks.
        mockGetUserMedia.mockRejectedValue(error as any);

        const { result } = renderHook(() => useAudioRecorder());

        await act(async () => {
            result.current.startRecording();
        });

        expect(result.current.isRecording).toBe(false);
        expect(mockShowToast).toHaveBeenCalledWith("Microphone access denied. Please enable it in your browser settings.", "error");
    });

    it('should stop recording and process audio data successfully', async () => {
        // Fix: Cast mock resolved value to 'any' to avoid TypeScript type inference issues with Jest mocks.
        mockGetUserMedia.mockResolvedValue({
            getTracks: () => [{ stop: jest.fn() }],
        } as any);
        
        const { result } = renderHook(() => useAudioRecorder());

        // Start recording first
        await act(async () => {
            result.current.startRecording();
        });
        
        await waitFor(() => {
            expect(result.current.isRecording).toBe(true);
        });

        // Then stop
        let processedData;
        await act(async () => {
            processedData = await result.current.stopRecording();
        });

        expect(result.current.isRecording).toBe(false);
        expect(result.current.isProcessing).toBe(false);
        expect(processedData).toBeDefined();
        // The base64 of 'mock audio data'
        expect(processedData?.audioBase64).toBe('bW9jayBhdWRpbyBkYXRh');
    });
    
    it('should handle errors during audio processing', async () => {
        // Mock FileReader to fail
        const readAsDataURLSpy = jest.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function (this: FileReader) {
            if (this.onerror) {
                const errorEvent = { target: { error: new DOMException('Mock read error') } } as ProgressEvent<FileReader>;
                (this.onerror as any)(errorEvent);
            }
        });

        // Fix: Cast mock resolved value to 'any' to avoid TypeScript type inference issues with Jest mocks.
        mockGetUserMedia.mockResolvedValue({
            getTracks: () => [{ stop: jest.fn() }],
        } as any);
        
        const { result } = renderHook(() => useAudioRecorder());

        await act(async () => {
            result.current.startRecording();
        });
        
        await waitFor(() => expect(result.current.isRecording).toBe(true));

        let processedData;
        await act(async () => {
            processedData = await result.current.stopRecording();
        });

        expect(processedData).toBeNull();
        expect(mockShowToast).toHaveBeenCalledWith('Failed to process audio data.', 'error');
        
        readAsDataURLSpy.mockRestore(); // Clean up spy
    });
});
