// __tests__/hooks/useAudioRecorder.test.tsx
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { useToast } from '../../hooks/useToast';
import React from 'react';

// Mock dependencies
jest.mock('../../hooks/useToast', () => ({
    useToast: jest.fn(),
}));

// FIX: Use jest.Mock<any> to satisfy TypeScript compiler
const mockUseToast = useToast as jest.Mock<any>;
const mockShowToast = jest.fn();

// We need a wrapper to provide the ToastContext, even though it's mocked
const wrapper = ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
);

// FIX: Use jest.Mock<any> to satisfy TypeScript compiler
const mockGetUserMedia = navigator.mediaDevices.getUserMedia as jest.Mock<any>;

describe('useAudioRecorder', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUseToast.mockReturnValue({ showToast: mockShowToast });
    });

    it('should initialize with correct default state', () => {
        const { result } = renderHook(() => useAudioRecorder(), { wrapper });
        expect(result.current.isRecording).toBe(false);
        expect(result.current.isProcessing).toBe(false);
    });

    it('should start recording successfully', async () => {
        mockGetUserMedia.mockResolvedValue({
            getTracks: () => [{ stop: jest.fn() }],
        } as unknown as MediaStream);

        const { result } = renderHook(() => useAudioRecorder(), { wrapper });

        await act(async () => {
            result.current.startRecording();
        });
        
        // Let the asynchronous start process complete
        await waitFor(() => {
            expect(result.current.isRecording).toBe(true);
        });
    });

    it('should handle microphone permission denial', async () => {
        const error = new Error("Permission denied");
        mockGetUserMedia.mockRejectedValue(error);

        const { result } = renderHook(() => useAudioRecorder(), { wrapper });

        await act(async () => {
            result.current.startRecording();
        });

        expect(result.current.isRecording).toBe(false);
        expect(mockShowToast).toHaveBeenCalledWith("Microphone access denied. Please enable it in your browser settings.", "error");
    });

    it('should stop recording and process audio data successfully', async () => {
        mockGetUserMedia.mockResolvedValue({
            getTracks: () => [{ stop: jest.fn() }],
        } as unknown as MediaStream);
        
        const { result } = renderHook(() => useAudioRecorder(), { wrapper });

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
                // We need to trigger the onerror callback, but it expects a ProgressEvent
                // For simplicity in a test, a simple object will suffice if the handler doesn't use event properties.
                const errorEvent = { target: { error: new DOMException('Mock read error') } } as ProgressEvent<FileReader>;
                (this.onerror as any)(errorEvent);
            }
        });

        mockGetUserMedia.mockResolvedValue({
            getTracks: () => [{ stop: jest.fn() }],
        } as unknown as MediaStream);
        
        const { result } = renderHook(() => useAudioRecorder(), { wrapper });

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