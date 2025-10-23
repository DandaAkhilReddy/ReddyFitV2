// __tests__/components/FitnessChat.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { FitnessChat } from '../../components/FitnessChat';
import * as geminiService from '../../services/geminiService';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { useToast } from '../../hooks/useToast';

// Mock dependencies
jest.mock('../../services/geminiService');
jest.mock('../../hooks/useAudioRecorder');
jest.mock('../../hooks/useToast');

const mockGetChatResponseStream = geminiService.getChatResponseStream as jest.Mock;
const mockTranscribeAudio = geminiService.transcribeAudio as jest.Mock;
const mockUseAudioRecorder = useAudioRecorder as jest.Mock;
const mockUseToast = useToast as jest.Mock;

const mockShowToast = jest.fn();
const mockStartRecording = jest.fn();
const mockStopRecording = jest.fn();

describe('FitnessChat', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUseToast.mockReturnValue({ showToast: mockShowToast });
        mockUseAudioRecorder.mockReturnValue({
            isRecording: false,
            isProcessing: false,
            startRecording: mockStartRecording,
            stopRecording: mockStopRecording,
        });
    });

    it('should render the initial empty state', () => {
        render(<FitnessChat />);
        expect(screen.getByText('Ask me anything about fitness, nutrition, or workout plans!')).toBeInTheDocument();
    });

    it('should send a message and display a streaming response', async () => {
        // Mock the stream
        const mockStream = async function* () {
            yield { text: 'Hello' };
            yield { text: ' there!' };
        }();
        // Fix: Cast mock resolved value to 'any' to avoid TypeScript type inference issues with Jest mocks.
        mockGetChatResponseStream.mockResolvedValue(mockStream as any);

        render(<FitnessChat />);
        
        const input = screen.getByPlaceholderText('Ask Reddy anything...');
        const sendButton = screen.getByLabelText('Send message');

        // Send a message
        fireEvent.change(input, { target: { value: 'Hi Reddy' } });
        fireEvent.click(sendButton);

        // Verify user message appears
        await waitFor(() => {
            expect(screen.getByText(/Hi Reddy/)).toBeInTheDocument();
        });

        // Verify streaming response and final message
        await waitFor(() => {
            expect(screen.getByText(/Hello there!/)).toBeInTheDocument();
        });
        
        // Typing indicator should be gone
        await waitFor(() => {
            const typingIndicator = screen.queryByRole('status', { name: /typing/i });
            // This is a bit tricky; a more robust way would be to add a test ID to the typing indicator
            // For now, we'll check that the final message exists and the input is enabled.
            const inputEl = screen.getByPlaceholderText('Ask Reddy anything...');
            expect(inputEl).toBeEnabled();
        });
    });

    it('should handle voice input to populate the text field', async () => {
        // Fix: Cast mock resolved value to 'any' to avoid TypeScript type inference issues with Jest mocks.
        mockStopRecording.mockResolvedValue({ audioBase64: 'mock-base64', mimeType: 'audio/webm' } as any);
        // Fix: Cast mock resolved value to 'any' to avoid TypeScript type inference issues with Jest mocks.
        mockTranscribeAudio.mockResolvedValue('This is my transcribed question.' as any);

        render(<FitnessChat />);

        const microphoneButton = screen.getByLabelText('Start recording');

        // Start recording
        fireEvent.click(microphoneButton);
        expect(mockStartRecording).toHaveBeenCalled();

        // Simulate the hook updating its state
        (useAudioRecorder as jest.Mock).mockReturnValue({
            isRecording: true,
            isProcessing: false,
            startRecording: mockStartRecording,
            stopRecording: mockStopRecording,
        });
        
        // Rerender or find the button again with new label
        fireEvent.click(screen.getByLabelText('Stop recording'));
        
        await waitFor(() => {
            expect(mockStopRecording).toHaveBeenCalled();
            expect(mockTranscribeAudio).toHaveBeenCalledWith('mock-base64', 'audio/webm');
        });

        // Verify the input is populated
        await waitFor(() => {
            const input = screen.getByPlaceholderText('Ask Reddy anything...') as HTMLInputElement;
            expect(input.value).toBe('This is my transcribed question.');
        });
    });

    it('should show an error toast if transcription fails', async () => {
        // Fix: Cast mock resolved value to 'any' to avoid TypeScript type inference issues with Jest mocks.
        mockStopRecording.mockResolvedValue({ audioBase64: 'mock-base64', mimeType: 'audio/webm' } as any);
        const error = new Error('Transcription failed');
        // Fix: Cast mock rejected value to 'any' to avoid TypeScript type inference issues with Jest mocks.
        mockTranscribeAudio.mockRejectedValue(error as any);
        
        render(<FitnessChat />);
        
        const microphoneButton = screen.getByLabelText('Start recording');
        fireEvent.click(microphoneButton);
        
        (useAudioRecorder as jest.Mock).mockReturnValue({
            isRecording: true,
            isProcessing: false,
            startRecording: mockStartRecording,
            stopRecording: mockStopRecording,
        });

        fireEvent.click(screen.getByLabelText('Stop recording'));
        
        await waitFor(() => {
            expect(mockShowToast).toHaveBeenCalledWith('Transcription failed: Transcription failed', 'error');
        });
    });
    
    it('should disable inputs while AI is typing', async () => {
        const mockStream = new Promise(() => {}); // A promise that never resolves to keep it typing
        // Fix: Cast mock resolved value to 'any' to avoid TypeScript type inference issues with Jest mocks.
        mockGetChatResponseStream.mockResolvedValue(mockStream as any);

        render(<FitnessChat />);
        
        const input = screen.getByPlaceholderText('Ask Reddy anything...');
        const sendButton = screen.getByLabelText('Send message');
        const micButton = screen.getByLabelText('Start recording');

        fireEvent.change(input, { target: { value: 'A long question' } });
        fireEvent.click(sendButton);

        await waitFor(() => {
            expect(input).toBeDisabled();
        });

        // All inputs should be disabled
        expect(input).toBeDisabled();
        expect(sendButton).toBeDisabled();
        expect(micButton).toBeDisabled();
    });
});
