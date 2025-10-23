import React, { useState, useRef, useEffect } from 'react';
import { useToast } from '../hooks/useToast';
import { getChatResponseStream, transcribeAudio } from '../services/geminiService';
import { renderMarkdown } from '../utils/helpers';
import { SendIcon, MicrophoneIcon, AudioWaveIcon } from './shared/icons';
import { useAudioRecorder } from '../hooks/useAudioRecorder';

interface Message {
    role: 'user' | 'model';
    parts: { text: string }[];
}

export const FitnessChat: React.FC = () => {
    const { showToast } = useToast();
    const { isRecording, isProcessing, startRecording, stopRecording } = useAudioRecorder();
    const [history, setHistory] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        chatContainerRef.current?.scrollTo(0, chatContainerRef.current.scrollHeight);
    }, [history, isTyping]);

    const handleSendMessage = async (messageText: string) => {
        if (!messageText.trim()) return;

        const newUserMessage: Message = { role: 'user', parts: [{ text: messageText }] };
        const updatedHistory = [...history, newUserMessage];
        setHistory(updatedHistory);
        setInputValue('');
        setIsTyping(true);

        try {
            const stream = await getChatResponseStream(updatedHistory);
            let fullResponse = '';
            let firstChunk = true;

            for await (const chunk of stream) {
                const chunkText = chunk.text;
                fullResponse += chunkText;
                
                if (firstChunk) {
                    setHistory(prev => [...prev, { role: 'model', parts: [{ text: fullResponse }] }]);
                    firstChunk = false;
                } else {
                    setHistory(prev => {
                        const newHistory = [...prev];
                        newHistory[newHistory.length - 1].parts[0].text = fullResponse;
                        return newHistory;
                    });
                }
            }
        } catch (error: any) {
            showToast(`Error: ${error.message}`, 'error');
            // Optional: remove the user's message if the stream fails to start
            setHistory(prev => {
                if (prev[prev.length -1].role === 'user') {
                    return prev.slice(0, -1);
                }
                return prev;
            });
        } finally {
            setIsTyping(false);
        }
    };

    const handleVoiceInput = async () => {
        if (isRecording) {
            const audioData = await stopRecording();
            if (audioData) {
                try {
                    const transcription = await transcribeAudio(audioData.audioBase64, audioData.mimeType);
                    setInputValue(transcription);
                } catch (e: any) {
                    showToast(`Transcription failed: ${e.message}`, 'error');
                }
            }
        } else {
            startRecording();
        }
    };

    return (
        <div className="flex flex-col h-full" style={{height: 'calc(100vh - 8rem)'}}>
            <header className="text-center">
                <h1 className="text-2xl font-bold text-slate-100">AI Fitness Chat</h1>
                <p className="text-sm text-slate-400">Your personal AI coach, Reddy!</p>
            </header>

            <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                {history.length === 0 && (
                     <div className="text-center text-slate-500 pt-10">
                        <p>Ask me anything about fitness, nutrition, or workout plans!</p>
                        <p className="text-xs mt-2">e.g., "What's a good alternative to squats?"</p>
                    </div>
                )}
                {history.map((msg, index) => (
                    <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs md:max-w-md lg:max-w-lg p-3 rounded-2xl ${
                            msg.role === 'user' 
                            ? 'bg-amber-600 text-white rounded-br-lg' 
                            : 'bg-slate-700 text-slate-200 rounded-bl-lg'
                        }`}>
                            <div className="prose prose-invert prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.parts[0].text) }} />
                        </div>
                    </div>
                ))}
                {isTyping && (
                    <div className="flex justify-start">
                        <div className="bg-slate-700 text-slate-200 p-3 rounded-lg">
                           <div className="flex items-center gap-2">
                               <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
                               <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse [animation-delay:0.1s]"></div>
                               <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse [animation-delay:0.2s]"></div>
                           </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="p-2 bg-slate-900 border-t border-slate-700/50">
                <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(inputValue); }} className="flex items-center gap-2">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder={isRecording ? "Listening..." : "Ask Reddy anything..."}
                        className="flex-1 bg-slate-800 border border-slate-600 text-white text-sm rounded-lg focus:ring-amber-500 focus:border-amber-500 p-3"
                        disabled={isTyping || isRecording || isProcessing}
                    />
                     <button
                        type="button"
                        onClick={handleVoiceInput}
                        disabled={isTyping || isProcessing}
                        className={`p-3 rounded-lg transition-colors flex-shrink-0 ${
                            isRecording 
                                ? 'bg-red-600 text-white animate-pulse'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                        aria-label={isRecording ? "Stop recording" : "Start recording"}
                    >
                        {isProcessing ? <div className="w-6 h-6 border-2 border-slate-400 border-t-white rounded-full animate-spin"></div> : isRecording ? <AudioWaveIcon className="w-6 h-6" /> : <MicrophoneIcon className="w-6 h-6" />}
                    </button>
                    <button
                        type="submit"
                        disabled={!inputValue || isTyping || isRecording || isProcessing}
                        className="p-3 bg-amber-600 text-white rounded-lg disabled:bg-amber-800/50 disabled:cursor-not-allowed hover:bg-amber-700 transition-colors"
                        aria-label="Send message"
                    >
                        <SendIcon className="w-6 h-6" />
                    </button>
                </form>
            </div>
        </div>
    );
};