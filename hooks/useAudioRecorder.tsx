import { useState, useRef, useCallback } from 'react';
import { useToast } from './useToast';

interface AudioRecorderControls {
    isRecording: boolean;
    isProcessing: boolean;
    startRecording: () => void;
    stopRecording: () => Promise<{ audioBase64: string; mimeType: string } | null>;
}

export const useAudioRecorder = (): AudioRecorderControls => {
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const { showToast } = useToast();
    const streamRef = useRef<MediaStream | null>(null);

    const stopRecording = useCallback((): Promise<{ audioBase64: string; mimeType: string } | null> => {
        return new Promise((resolve) => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                setIsProcessing(true);
                mediaRecorderRef.current.onstop = () => {
                    const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
                    const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
                    
                    const reader = new FileReader();
                    reader.readAsDataURL(audioBlob);
                    reader.onloadend = () => {
                        const base64String = reader.result as string;
                        const audioBase64 = base64String.split(',')[1];
                        audioChunksRef.current = [];
                        setIsProcessing(false);
                        // Stop all tracks to release microphone
                        streamRef.current?.getTracks().forEach(track => track.stop());
                        streamRef.current = null;
                        resolve({ audioBase64, mimeType });
                    };
                    reader.onerror = () => {
                        showToast("Failed to process audio data.", "error");
                        setIsProcessing(false);
                        resolve(null);
                    };
                };
                mediaRecorderRef.current.stop();
                setIsRecording(false);
            } else {
                resolve(null);
            }
        });
    }, [showToast]);
    
    const startRecording = useCallback(async () => {
        if (isRecording) {
            console.warn("Recording is already in progress.");
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            // Prefer audio/webm if available
            const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
                ? { mimeType: 'audio/webm;codecs=opus' }
                : {};
            const recorder = new MediaRecorder(stream, options);
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };
            
            recorder.onstart = () => {
                setIsRecording(true);
            };

            recorder.start();
        } catch (error) {
            console.error("Error accessing microphone:", error);
            showToast("Microphone access denied. Please enable it in your browser settings.", "error");
        }
    }, [isRecording, showToast]);

    return { isRecording, isProcessing, startRecording, stopRecording };
};