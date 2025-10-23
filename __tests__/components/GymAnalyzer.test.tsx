// __tests__/components/GymAnalyzer.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { GymAnalyzer } from '../../components/GymAnalyzer';
import * as frameExtractor from '../../utils/frameExtractor';
import * as geminiService from '../../services/geminiService';
import * as firestoreService from '../../services/firestoreService';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { useUserPreferences } from '../../hooks/useUserPreferences';

// Mock dependencies
jest.mock('../../utils/frameExtractor');
jest.mock('../../services/geminiService');
jest.mock('../../services/firestoreService');
jest.mock('../../hooks/useAuth');
jest.mock('../../hooks/useToast');
jest.mock('../../hooks/useUserPreferences');

const mockUseAuth = useAuth as jest.Mock;
const mockUseToast = useToast as jest.Mock;
const mockUseUserPreferences = useUserPreferences as jest.Mock;

const mockExtractFrames = frameExtractor.extractFramesFromVideo as jest.MockedFunction<typeof frameExtractor.extractFramesFromVideo>;
const mockAnalyzeVideo = geminiService.analyzeVideoWithFrames as jest.MockedFunction<typeof geminiService.analyzeVideoWithFrames>;
const mockGeneratePlan = geminiService.generateWorkoutPlan as jest.MockedFunction<typeof geminiService.generateWorkoutPlan>;
const mockExerciseExists = firestoreService.exerciseExists as jest.MockedFunction<typeof firestoreService.exerciseExists>;
const mockSaveCommunityExercise = firestoreService.saveCommunityExercise as jest.MockedFunction<typeof firestoreService.saveCommunityExercise>;
const mockFindYouTubeVideo = geminiService.findYouTubeVideoForExercise as jest.MockedFunction<typeof geminiService.findYouTubeVideoForExercise>;
const mockGetCommunityExercises = firestoreService.getCommunityExercises as jest.MockedFunction<typeof firestoreService.getCommunityExercises>;

const mockShowToast = jest.fn();
const mockUser = { uid: 'test-user' } as any;

const renderGymAnalyzer = () => {
    return render(<GymAnalyzer user={mockUser} />);
};

describe('GymAnalyzer', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUseAuth.mockReturnValue({ user: mockUser });
        mockUseToast.mockReturnValue({ showToast: mockShowToast });
        mockUseUserPreferences.mockReturnValue({ fitnessLevel: 'Intermediate', goal: 'Build Muscle' });
        mockGetCommunityExercises.mockResolvedValue([]);
    });

    it('should render the initial upload prompt', () => {
        renderGymAnalyzer();
        expect(screen.getByText('Tap to upload')).toBeInTheDocument();
    });

    it('should handle video file selection', () => {
        renderGymAnalyzer();
        const file = new File(['video content'], 'gym.mp4', { type: 'video/mp4' });
        const input = screen.getByLabelText(/Tap to upload/i);
        fireEvent.change(input, { target: { files: [file] } });

        expect(screen.getByRole('button', { name: /Analyze Equipment/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Change Video/i })).toBeInTheDocument();
    });

    it('should run the full analysis and plan generation "happy path"', async () => {
        mockExtractFrames.mockResolvedValue(['frame1']);
        mockAnalyzeVideo.mockResolvedValue('### Equipment Identified\n- Dumbbells');
        mockExerciseExists.mockResolvedValue(true); // Equipment already exists
        const mockPlan = [{ day: 'Day 1', exercises: [{ name: 'Dumbbell Curl', sets: '3', reps: '12' }] }];
        mockGeneratePlan.mockResolvedValue(mockPlan);

        renderGymAnalyzer();
        
        // 1. Upload file and click analyze
        const file = new File(['video'], 'gym.mp4', { type: 'video/mp4' });
        fireEvent.change(screen.getByLabelText(/Tap to upload/i), { target: { files: [file] } });
        fireEvent.click(screen.getByRole('button', { name: /Analyze Equipment/i }));

        // 2. Wait for analysis to complete
        await waitFor(() => {
            expect(mockAnalyzeVideo).toHaveBeenCalled();
            expect(screen.getByText(/Equipment Identified/)).toBeInTheDocument();
        });

        // 3. Click generate plan
        fireEvent.click(screen.getByRole('button', { name: /Generate My Workout Plan/i }));

        // 4. Wait for plan to be displayed
        await waitFor(() => {
            expect(mockGeneratePlan).toHaveBeenCalledWith('Dumbbells', 'Intermediate', 'Build Muscle', expect.any(Function), false);
            expect(screen.getByText('Your Workout Plan')).toBeInTheDocument();
            expect(screen.getByText('Dumbbell Curl')).toBeInTheDocument();
        });
    });

    it('should trigger the RAG flow for new equipment discovery', async () => {
        mockExtractFrames.mockResolvedValue(['frame1']);
        mockAnalyzeVideo.mockResolvedValue('### Equipment Identified\n- New Machine');
        mockExerciseExists.mockResolvedValue(false); // New equipment!
        mockFindYouTubeVideo.mockResolvedValue('http://youtube.com/new-machine');
        mockSaveCommunityExercise.mockResolvedValue(undefined);

        renderGymAnalyzer();
        
        const file = new File(['video'], 'gym.mp4', { type: 'video/mp4' });
        fireEvent.change(screen.getByLabelText(/Tap to upload/i), { target: { files: [file] } });
        fireEvent.click(screen.getByRole('button', { name: /Analyze Equipment/i }));
        
        // Wait for modal to appear
        await waitFor(() => {
            expect(screen.getByText('New Equipment Detected!')).toBeInTheDocument();
            expect(screen.getByText('New Machine')).toBeInTheDocument();
        });

        // Click "Yes, Add It!"
        fireEvent.click(screen.getByRole('button', { name: /Yes, Add It!/i }));
        
        await waitFor(() => {
            expect(mockFindYouTubeVideo).toHaveBeenCalledWith('New Machine');
            expect(mockSaveCommunityExercise).toHaveBeenCalled();
            expect(mockShowToast).toHaveBeenCalledWith('"New Machine" added to the library! You earned 1 point!', 'success');
        });

        // Modal should be gone
        expect(screen.queryByText('New Equipment Detected!')).not.toBeInTheDocument();
    });
    
    it('should handle failure during frame extraction', async () => {
        mockExtractFrames.mockRejectedValue(new Error('Corrupt file'));
        renderGymAnalyzer();
        
        const file = new File(['video'], 'gym.mp4', { type: 'video/mp4' });
        fireEvent.change(screen.getByLabelText(/Tap to upload/i), { target: { files: [file] } });
        fireEvent.click(screen.getByRole('button', { name: /Analyze Equipment/i }));

        await waitFor(() => {
            expect(screen.getByText(/Could not process the video file/i)).toBeInTheDocument();
        });
    });

    it('should handle failure during AI analysis', async () => {
        mockExtractFrames.mockResolvedValue(['frame1']);
        mockAnalyzeVideo.mockRejectedValue(new Error('API failed'));
        renderGymAnalyzer();

        const file = new File(['video'], 'gym.mp4', { type: 'video/mp4' });
        fireEvent.change(screen.getByLabelText(/Tap to upload/i), { target: { files: [file] } });
        fireEvent.click(screen.getByRole('button', { name: /Analyze Equipment/i }));

        await waitFor(() => {
            expect(screen.getByText(/Analysis failed: API failed/i)).toBeInTheDocument();
        });
    });
    
    it('should handle failure during plan generation', async () => {
        mockExtractFrames.mockResolvedValue(['frame1']);
        mockAnalyzeVideo.mockResolvedValue('### Equipment Identified\n- Dumbbells');
        mockExerciseExists.mockResolvedValue(true);
        mockGeneratePlan.mockRejectedValue(new Error('Plan generation failed'));

        renderGymAnalyzer();

        const file = new File(['video'], 'gym.mp4', { type: 'video/mp4' });
        fireEvent.change(screen.getByLabelText(/Tap to upload/i), { target: { files: [file] } });
        fireEvent.click(screen.getByRole('button', { name: /Analyze Equipment/i }));

        await waitFor(() => screen.getByRole('button', { name: /Generate My Workout Plan/i }));
        fireEvent.click(screen.getByRole('button', { name: /Generate My Workout Plan/i }));

        await waitFor(() => {
            expect(screen.getByText(/The workout plan could not be generated./i)).toBeInTheDocument();
        });
    });
    
    it('should allow refining analysis', async () => {
        mockExtractFrames.mockResolvedValue(['frame1']);
        mockAnalyzeVideo.mockResolvedValue('### Equipment Identified\n- Dumbbells');
        mockExerciseExists.mockResolvedValue(true);
        
        renderGymAnalyzer();
        
        // Run initial analysis
        const file = new File(['video'], 'gym.mp4', { type: 'video/mp4' });
        fireEvent.change(screen.getByLabelText(/Tap to upload/i), { target: { files: [file] } });
        fireEvent.click(screen.getByRole('button', { name: /Analyze Equipment/i }));
        await waitFor(() => expect(screen.getByText(/Equipment Identified/)).toBeInTheDocument());

        // Click refine and enter prompt
        fireEvent.click(screen.getByRole('button', { name: 'Refine Analysis' }));
        fireEvent.change(screen.getByPlaceholderText('e.g., focus more on free weights'), { target: { value: 'look for barbells' } });

        // Submit refinement
        mockAnalyzeVideo.mockResolvedValueOnce('### Equipment Identified\n- Barbells');
        fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

        await waitFor(() => {
            // Check that analyzeVideo was called a second time with a refined prompt
            expect(mockAnalyzeVideo).toHaveBeenCalledTimes(2);

            const secondCallPrompt = mockAnalyzeVideo.mock.calls[1][0];
            expect(secondCallPrompt).toContain('look for barbells');
            
            // Check that UI updated
            expect(screen.getByText(/Barbells/)).toBeInTheDocument();
            expect(screen.queryByText(/Dumbbells/)).not.toBeInTheDocument();
        });
    });

    it('should allow regenerating a plan', async () => {
        mockExtractFrames.mockResolvedValue(['frame1']);
        mockAnalyzeVideo.mockResolvedValue('### Equipment Identified\n- Dumbbells');
        mockExerciseExists.mockResolvedValue(true);
        const mockPlan1 = [{ day: 'Day 1', exercises: [{ name: 'Dumbbell Curl', sets: '3', reps: '12' }] }];
        const mockPlan2 = [{ day: 'Day 1', exercises: [{ name: 'Dumbbell Press', sets: '4', reps: '10' }] }];
        mockGeneratePlan.mockResolvedValueOnce(mockPlan1).mockResolvedValueOnce(mockPlan2);
        
        renderGymAnalyzer();

        // Initial flow to get a plan
        const file = new File(['video'], 'gym.mp4', { type: 'video/mp4' });
        fireEvent.change(screen.getByLabelText(/Tap to upload/i), { target: { files: [file] } });
        fireEvent.click(screen.getByRole('button', { name: /Analyze Equipment/i }));
        await waitFor(() => screen.getByRole('button', { name: /Generate My Workout Plan/i }));
        fireEvent.click(screen.getByRole('button', { name: /Generate My Workout Plan/i }));
        await waitFor(() => expect(screen.getByText('Dumbbell Curl')).toBeInTheDocument());

        // Click regenerate
        fireEvent.click(screen.getByRole('button', { name: 'New Plan' }));

        await waitFor(() => {
            // Verify generatePlan was called again with isRegeneration = true
            expect(mockGeneratePlan).toHaveBeenCalledWith('Dumbbells', 'Intermediate', 'Build Muscle', expect.any(Function), true);
            // Verify UI shows the new plan
            expect(screen.getByText('Dumbbell Press')).toBeInTheDocument();
            expect(screen.queryByText('Dumbbell Curl')).not.toBeInTheDocument();
        });
    });
});
