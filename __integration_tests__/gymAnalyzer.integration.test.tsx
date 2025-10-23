// __integration_tests__/gymAnalyzer.integration.test.tsx
import React from 'react';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from './setup';
import { GymAnalyzer } from '../components/GymAnalyzer';
import * as frameExtractor from '../utils/frameExtractor';
import * as geminiService from '../services/geminiService';
import * as firestoreService from '../services/firestoreService';
import { useAuth } from '../hooks/useAuth';
import '@testing-library/jest-dom';

// Mock dependencies
jest.mock('../utils/frameExtractor');
jest.mock('../services/geminiService');
jest.mock('../services/firestoreService');
jest.mock('../hooks/useAuth');

const mockUseAuth = useAuth as jest.Mock;
// FIX: Use jest.MockedFunction for correct typing of mocks.
const mockExtractFrames = frameExtractor.extractFramesFromVideo as jest.MockedFunction<typeof frameExtractor.extractFramesFromVideo>;
const mockAnalyzeVideo = geminiService.analyzeVideoWithFrames as jest.MockedFunction<typeof geminiService.analyzeVideoWithFrames>;
const mockGeneratePlan = geminiService.generateWorkoutPlan as jest.MockedFunction<typeof geminiService.generateWorkoutPlan>;
const mockExerciseExists = firestoreService.exerciseExists as jest.MockedFunction<typeof firestoreService.exerciseExists>;
const mockSaveCommunityExercise = firestoreService.saveCommunityExercise as jest.MockedFunction<typeof firestoreService.saveCommunityExercise>;
const mockFindYouTubeVideo = geminiService.findYouTubeVideoForExercise as jest.MockedFunction<typeof geminiService.findYouTubeVideoForExercise>;
const mockGetCommunityExercises = firestoreService.getCommunityExercises as jest.MockedFunction<typeof firestoreService.getCommunityExercises>;

const mockUser = { uid: 'test-user' } as any;

describe('Gym Analyzer Integration Flow', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUseAuth.mockReturnValue({ user: mockUser });
        // Default mocks for a clean slate
        // FIX: Use the correctly typed mock.
        mockGetCommunityExercises.mockResolvedValue([]);
    });

    it('should handle the full flow: video upload, new equipment discovery (RAG), and plan generation', async () => {
        renderWithProviders(<GymAnalyzer user={mockUser} />);
        
        // 1. User uploads a video
        // FIX: Use the correctly typed mock.
        mockExtractFrames.mockResolvedValue(['frame1', 'frame2']);
        const file = new File(['video'], 'gym.mp4', { type: 'video/mp4' });
        const input = screen.getByLabelText(/Tap to upload/i);
        fireEvent.change(input, { target: { files: [file] } });

        // 2. User clicks Analyze
        fireEvent.click(screen.getByRole('button', { name: /Analyze Equipment/i }));

        await waitFor(() => {
            expect(screen.getByText('Step 1/2: Extracting Frames')).toBeInTheDocument();
        });
        
        await waitFor(() => {
            expect(mockExtractFrames).toHaveBeenCalled();
            expect(screen.getByText('Step 2/2: AI Analysis')).toBeInTheDocument();
        });

        // 3. AI analysis returns a "new" item
        const analysisResult = `
            ### Equipment Identified
            - Dumbbells
            - Sissy Squat Machine
            ### Potential Exercises
            - Dumbbell Curl
            - Sissy Squat
        `;
        // FIX: Use the correctly typed mock.
        mockAnalyzeVideo.mockResolvedValue(analysisResult);
        // Mock the RAG check
        mockExerciseExists.mockImplementation(async (name: string) => {
            if (name.toLowerCase().includes('sissy squat')) {
                return false; // This is the new item
            }
            return true;
        });
        
        await waitFor(() => {
            expect(mockAnalyzeVideo).toHaveBeenCalled();
        });

        // 4. Verify the New Equipment Modal appears for the "Sissy Squat Machine"
        await waitFor(() => {
            expect(screen.getByText('New Equipment Detected!')).toBeInTheDocument();
            expect(screen.getByText(/Sissy Squat Machine/i)).toBeInTheDocument();
        });
        
        // 5. User confirms adding the new equipment
        // FIX: Use correctly typed mocks.
        mockFindYouTubeVideo.mockResolvedValue('http://youtube.com/sissy-squat');
        mockSaveCommunityExercise.mockResolvedValue(undefined);
        fireEvent.click(screen.getByRole('button', { name: /Yes, Add It!/i }));

        await waitFor(() => {
            expect(mockFindYouTubeVideo).toHaveBeenCalledWith('Sissy Squat Machine');
            expect(mockSaveCommunityExercise).toHaveBeenCalled();
        });

        // Modal should disappear
        await waitFor(() => {
            expect(screen.queryByText('New Equipment Detected!')).not.toBeInTheDocument();
        });

        // 6. Analysis and "Generate Plan" button are now visible
        expect(screen.getByText(/Equipment Identified/)).toBeInTheDocument();
        const generateButton = screen.getByRole('button', { name: /Generate My Workout Plan/i });
        expect(generateButton).toBeInTheDocument();

        // 7. User clicks to generate the plan
        const mockPlan: geminiService.WorkoutPlan = [{ day: 'Day 1', exercises: [{ name: 'Sissy Squat', sets: '3', reps: '12' }] }];
        // FIX: Use the correctly typed mock.
        mockGeneratePlan.mockResolvedValue(mockPlan);

        fireEvent.click(generateButton);

        // 8. Verify the workout plan is displayed
        await waitFor(() => {
            expect(mockGeneratePlan).toHaveBeenCalledWith(
                'Dumbbells, Sissy Squat Machine', // Correct equipment list
                expect.any(String),
                expect.any(String),
                expect.any(Function),
                false
            );
        });
        
        await waitFor(() => {
            expect(screen.getByText('Your Workout Plan')).toBeInTheDocument();
            expect(screen.getByText('Sissy Squat')).toBeInTheDocument();
        });
    });

    it('should show an error message if video analysis fails', async () => {
         renderWithProviders(<GymAnalyzer user={mockUser} />);
        
        // 1. User uploads a video
        // FIX: Use the correctly typed mock.
        mockExtractFrames.mockResolvedValue(['frame1', 'frame2']);
        const file = new File(['video'], 'gym.mp4', { type: 'video/mp4' });
        const input = screen.getByLabelText(/Tap to upload/i);
        fireEvent.change(input, { target: { files: [file] } });

        // 2. User clicks Analyze
        fireEvent.click(screen.getByRole('button', { name: /Analyze Equipment/i }));
        
        // 3. Mock the failure
        const error = new Error("Model is overloaded");
        // FIX: Use the correctly typed mock.
        mockAnalyzeVideo.mockRejectedValue(error);
        
        // 4. Verify the error message is displayed
        await waitFor(() => {
            expect(screen.getByText(/Analysis failed: Model is overloaded/i)).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument();
        });
    });
});