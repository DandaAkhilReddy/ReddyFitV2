// __tests__/services/geminiService.test.ts
import { describe, it, expect, jest, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';

import { GoogleGenAI } from '@google/genai';
import {
    analyzeVideoWithFrames,
    generateWorkoutPlan,
    getGroundedAnswer,
    analyzePose,
    editImage,
    getChatResponseStream,
    getQuickChatResponse,
    analyzeFoodImage,
    getNutritionalAnalysis,
    findYouTubeVideoForExercise,
    transcribeAudio,
    getQuickResponse
} from '../../services/geminiService';
import { ApiKeyError } from '../../utils/errors';

// Mock the entire @google/genai library
jest.mock('@google/genai', () => {
    const mockGenerateContent = jest.fn();
    const mockSendMessageStream = jest.fn();
    const mockChat = {
        sendMessageStream: mockSendMessageStream,
    };
    const mockChats = {
        create: jest.fn(() => mockChat),
    };
    const mockModels = {
        generateContent: mockGenerateContent,
    };
    const mockGoogleGenAI = jest.fn(() => ({
        models: mockModels,
        chats: mockChats,
    }));

    return {
        GoogleGenAI: mockGoogleGenAI,
        Type: {
            STRING: 'STRING',
            NUMBER: 'NUMBER',
            OBJECT: 'OBJECT',
            ARRAY: 'ARRAY',
        },
        Modality: {
            IMAGE: 'IMAGE',
        }
    };
});

const mockGenAIInstance = (GoogleGenAI as jest.Mock).mock.results[0].value;
const mockGenerateContent = (mockGenAIInstance as any).models.generateContent;
const mockSendMessageStream = (mockGenAIInstance as any).chats.create().sendMessageStream;

describe('geminiService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.API_KEY = 'test-api-key';
    });

    afterEach(() => {
        delete process.env.API_KEY;
    });
    
    beforeAll(() => {
        jest.useFakeTimers();
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    describe('analyzeVideoWithFrames', () => {
        it('should return analysis text on successful API call', async () => {
            mockGenerateContent.mockResolvedValue({ text: 'Analysis successful' });
            const result = await analyzeVideoWithFrames('prompt', ['frame1']);
            expect(result).toBe('Analysis successful');
            expect(mockGenerateContent).toHaveBeenCalledTimes(1);
        });

        it('should throw ApiKeyError for invalid API key message', async () => {
            mockGenerateContent.mockRejectedValue(new Error('API key not valid'));
            await expect(analyzeVideoWithFrames('prompt', ['frame1'])).rejects.toThrow(ApiKeyError);
        });

        it('should retry on 503 error and succeed on the second attempt', async () => {
            const onProgress = jest.fn();
            mockGenerateContent
                .mockRejectedValueOnce(new Error('503 overloaded'))
                .mockResolvedValueOnce({ text: 'Success on retry' });
            
            const promise = analyzeVideoWithFrames('prompt', ['frame1'], onProgress);
            
            await jest.advanceTimersByTimeAsync(2000);
            
            const result = await promise;
            
            expect(result).toBe('Success on retry');
            expect(mockGenerateContent).toHaveBeenCalledTimes(2);
            expect(onProgress).toHaveBeenCalledWith(1, 3);
        });

        it('should throw a user-friendly error after max retries on 503 errors', async () => {
            mockGenerateContent.mockRejectedValue(new Error('503 unavailable'));
            
            const promise = analyzeVideoWithFrames('prompt', ['frame1']);
            
            await jest.advanceTimersByTimeAsync(2000);
            await jest.advanceTimersByTimeAsync(4000);

            await expect(promise).rejects.toThrow('The AI model is currently overloaded. We tried several times without success. Please try again in a few moments.');
            expect(mockGenerateContent).toHaveBeenCalledTimes(3);
        });
        
        it('should throw a generic error for non-retryable failures', async () => {
            mockGenerateContent.mockRejectedValue(new Error('Some other error'));
            await expect(analyzeVideoWithFrames('prompt', ['frame1'])).rejects.toThrow('Failed to get analysis from Gemini API: Some other error');
        });
    });

    describe('generateWorkoutPlan', () => {
        it('should return a parsed workout plan on success', async () => {
            const mockPlan = [{ day: 'Day 1', exercises: [] }];
            mockGenerateContent.mockResolvedValue({ text: JSON.stringify(mockPlan) });

            const result = await generateWorkoutPlan('dumbbells', 'Beginner', 'Build Muscle');
            expect(result).toEqual(mockPlan);
        });

        it('should include regeneration instructions in the prompt when requested', async () => {
            mockGenerateContent.mockResolvedValue({ text: '[]' });
            await generateWorkoutPlan('barbell', 'Advanced', 'Lose Fat', undefined, true);
            const prompt = mockGenerateContent.mock.calls[0][0].contents.parts[0].text;
            expect(prompt).toContain('Please create a DIFFERENT variation of the workout plan');
        });

        it('should throw an error if JSON parsing fails', async () => {
            mockGenerateContent.mockResolvedValue({ text: 'this is not json' });
            await expect(generateWorkoutPlan('kettlebell', 'Intermediate', 'Improve Endurance')).rejects.toThrow();
        });
    });

    describe('getGroundedAnswer', () => {
        it('should return text and sources on success', async () => {
            const mockResponse = {
                text: 'The answer is 42.',
                candidates: [{ groundingMetadata: { groundingChunks: [{ web: { uri: 'http://example.com' } }] } }]
            };
            mockGenerateContent.mockResolvedValue(mockResponse);
            const result = await getGroundedAnswer('What is the meaning of life?');
            expect(result.text).toBe('The answer is 42.');
            expect(result.sources).toHaveLength(1);
        });

        it('should throw a specific error for safety blocks', async () => {
            mockGenerateContent.mockResolvedValue({ text: '', candidates: [{ finishReason: 'SAFETY' }] });
            await expect(getGroundedAnswer('A risky question')).rejects.toThrow('The question could not be answered due to safety filters. Please try rephrasing your question.');
        });
    });

    describe('analyzePose', () => {
        it('should return text analysis on success', async () => {
            mockGenerateContent.mockResolvedValue({ text: 'Your form is great!' });
            const result = await analyzePose('Is my back straight?', 'base64image', 'image/jpeg');
            expect(result).toBe('Your form is great!');
        });
    });

    describe('editImage', () => {
        it('should return base64 data of the edited image on success', async () => {
            const mockResponse = {
                candidates: [{ content: { parts: [{ inlineData: { data: 'editedBase64' } }] } }]
            };
            mockGenerateContent.mockResolvedValue(mockResponse);
            const result = await editImage('Add a hat', 'base64image', 'image/png');
            expect(result).toBe('editedBase64');
        });
        
        it('should throw if no image is returned', async () => {
            mockGenerateContent.mockResolvedValue({ candidates: [{ content: { parts: [{ text: 'I cannot do that.' }] } }] });
            await expect(editImage('A prompt', 'base64', 'image/jpeg')).rejects.toThrow('The AI did not return an edited image.');
        });
    });

    describe('getChatResponseStream', () => {
        it('should create a chat and return a message stream', async () => {
            const mockStream = async function* () { yield { text: 'Hello' }; }();
            mockSendMessageStream.mockReturnValue(mockStream);
            
            const history = [{ role: 'user', parts: [{ text: 'Hi' }] }];
            const result = await getChatResponseStream(history);

            expect(result).toBe(mockStream);
        });
    });
    
    describe('getQuickChatResponse', () => {
        it('should return a quick text response on success', async () => {
            mockGenerateContent.mockResolvedValue({ text: 'A quick reply.' });
            const result = await getQuickChatResponse('A quick question');
            expect(result).toBe('A quick reply.');
            expect(mockGenerateContent).toHaveBeenCalledWith(expect.objectContaining({ model: 'gemini-flash-lite-latest' }));
        });

        it('should fail silently and return an empty string on error', async () => {
            mockGenerateContent.mockRejectedValue(new Error('Model failed'));
            const result = await getQuickChatResponse('A quick question');
            expect(result).toBe('');
        });
    });

    describe('analyzeFoodImage', () => {
        it('should return an array of food items on success', async () => {
            const mockFoods = ['eggs', 'bacon'];
            mockGenerateContent.mockResolvedValue({ text: JSON.stringify(mockFoods) });
            const result = await analyzeFoodImage('base64', 'image/jpeg');
            expect(result).toEqual(mockFoods);
        });
    });

    describe('getNutritionalAnalysis', () => {
        it('should return a full nutritional info object on success', async () => {
            const mockNutrition = { calories: 500, macronutrients: { protein: 25, carbohydrates: 1, fat: 45 }, vitamins: [], minerals: [] };
            mockGenerateContent.mockResolvedValue({ text: JSON.stringify(mockNutrition) });
            const result = await getNutritionalAnalysis(['eggs', 'bacon']);
            expect(result).toEqual(mockNutrition);
        });
    });

    describe('findYouTubeVideoForExercise', () => {
        it('should extract and return a valid YouTube URL', async () => {
            mockGenerateContent.mockResolvedValue({ text: 'Here is the video: https://www.youtube.com/watch?v=xyz123' });
            const result = await findYouTubeVideoForExercise('bicep curl');
            expect(result).toBe('https://www.youtube.com/watch?v=xyz123');
        });

        it('should return null if no URL is found in the response', async () => {
            mockGenerateContent.mockResolvedValue({ text: 'Sorry, I could not find a video.' });
            const result = await findYouTubeVideoForExercise('unknown exercise');
            expect(result).toBeNull();
        });

        it('should return null on API error', async () => {
            mockGenerateContent.mockRejectedValue(new Error('API failed'));
            const result = await findYouTubeVideoForExercise('anything');
            expect(result).toBeNull();
        });
    });
    
    describe('transcribeAudio', () => {
        it('should return transcribed text on success', async () => {
            mockGenerateContent.mockResolvedValue({ text: 'This is a transcription.' });
            const result = await transcribeAudio('base64audio', 'audio/webm');
            expect(result).toBe('This is a transcription.');
        });
    });
    
    describe('getQuickResponse', () => {
        it('should return a text response on success', async () => {
            mockGenerateContent.mockResolvedValue({ text: 'Quick answer.' });
            const result = await getQuickResponse('A question');
            expect(result).toBe('Quick answer.');
            expect(mockGenerateContent).toHaveBeenCalledWith(expect.objectContaining({ model: 'gemini-flash-lite-latest' }));
        });
    });
});
