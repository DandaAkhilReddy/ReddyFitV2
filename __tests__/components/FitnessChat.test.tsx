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
        // @ts-ignore - Fix: Cast mock stream to 'any' to resolve TypeScript type inference issue.
        mockGetChatResponseStream.mockResolvedValue(mockStream as any);

        render(<FitnessChat />);
        
        const input = screen.getByPlaceholderText('Ask Reddy anything...');
        const sendButton = screen.getByLabelText('Send message');

        // Send a message
        fireEvent.change(input, { target: { value: 'Hi Reddy' } });
        fireEvent.click(sendButton);

        // Verify user message appears
        await waitFor(() => {
            expect(screen.getByText('Hi Reddy')).toBeInTheDocument();
        });

        // Verify typing indicator and streaming response
        await waitFor(() => expect(screen.queryByTestId('typing-indicator')).not.toBeInTheDocument()); // Use a more reliable way if possible
        
        await waitFor(() => {
            expect(screen.getByText('Hello there!')).toBeInTheDocument();
        });
        
        // Typing indicator should be gone
        await waitFor(() => expect(screen.queryByTestId('typing-indicator')).not.toBeInTheDocument()); // Use a more reliable way if possible
    });

    it('should handle voice input to populate the text field', async () => {
        // Mock the return value of stopRecording
        // @ts-ignore - Fix: Cast mock object to 'any' to resolve TypeScript type inference issue.
        mockStopRecording.mockResolvedValue({ audioBase64: 'mock-base64', mimeType: 'audio/webm' } as any);
        // @ts-ignore - Fix: Cast mock string to 'any' to resolve TypeScript type inference issue.
        mockTranscribeAudio.mockResolvedValue('This is my transcribed question.' as any);

        render(<FitnessChat />);

        const microphoneButton = screen.getByLabelText('Start recording');

        // Start recording
        fireEvent.click(microphoneButton);
        expect(mockStartRecording).toHaveBeenCalled();

        // Simulate the hook updating its state
        jest.spyOn(require('../../hooks/useAudioRecorder'), 'useAudioRecorder').mockReturnValue({
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
        // @ts-ignore - Fix: Cast mock object to 'any' to resolve TypeScript type inference issue.
        mockStopRecording.mockResolvedValue({ audioBase64: 'mock-base64', mimeType: 'audio/webm' } as any);
        const error = new Error('Transcription failed');
        // @ts-ignore - Fix: Cast mock error to 'any' to resolve TypeScript type inference issue.
        mockTranscribeAudio.mockRejectedValue(error as any);
        
        render(<FitnessChat />);
        
        const microphoneButton = screen.getByLabelText('Start recording');
        fireEvent.click(microphoneButton);
        
        jest.spyOn(require('../../hooks/useAudioRecorder'), 'useAudioRecorder').mockReturnValue({
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
        // @ts-ignore - Fix: Cast mock promise to 'any' to resolve TypeScript type inference issue.
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