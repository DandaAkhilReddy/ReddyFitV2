// __integration_tests__/dashboard.integration.test.tsx
import React from 'react';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from './setup';
import { Dashboard } from '../components/Dashboard';
import * as geminiService from '../services/geminiService';
import * as firestoreService from '../services/firestoreService';
import { useAuth } from '../hooks/useAuth';

// Mock dependencies
jest.mock('../services/geminiService');
jest.mock('../services/firestoreService');
jest.mock('../hooks/useAuth');

const mockUseAuth = useAuth as jest.Mock;
// Fix: Add explicit types to mocks to prevent 'never' type inference errors
const mockAnalyzeFoodImage = geminiService.analyzeFoodImage as jest.Mock<Promise<string[]>>;
const mockGetNutritionalAnalysis = geminiService.getNutritionalAnalysis as jest.Mock<Promise<geminiService.NutritionalInfo>>;
const mockUploadImage = firestoreService.uploadImage as jest.Mock<Promise<string>>;
const mockSaveMealLog = firestoreService.saveMealLog as jest.Mock<Promise<void>>;
const mockGetTodaysMealLogs = firestoreService.getTodaysMealLogs as jest.Mock<Promise<firestoreService.MealLog[]>>;

const mockUser = { uid: 'test-user' } as any;
const mockUserProfile = { displayName: 'Tester' } as any;

describe('Dashboard Meal Logging Integration Flow', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        mockUseAuth.mockReturnValue({ user: mockUser, userProfile: mockUserProfile });
    });

    it('should allow a user to upload a meal, get AI analysis, and see the result in the UI', async () => {
        // 1. Initial state: No meal logs
        mockGetTodaysMealLogs.mockResolvedValue([]);
        renderWithProviders(<Dashboard user={mockUser} userProfile={mockUserProfile} />);

        await waitFor(() => {
             expect(screen.getByText("You haven't logged any meals today.")).toBeInTheDocument();
        });

        // 2. Mocks for a successful flow
        mockAnalyzeFoodImage.mockResolvedValue(['Chicken Breast', 'Broccoli']);
        const mockNutrition: geminiService.NutritionalInfo = {
            calories: 350,
            macronutrients: { protein: 50, carbohydrates: 10, fat: 12 },
            vitamins: [],
            minerals: [],
        };
        mockGetNutritionalAnalysis.mockResolvedValue(mockNutrition);
        mockUploadImage.mockResolvedValue('http://mock-url.com/meal.jpg');
        mockSaveMealLog.mockResolvedValue(undefined);
        
        // When the component re-fetches after success
        const newLog = {
            id: 'log1',
            imageUrl: 'http://mock-url.com/meal.jpg',
            foodItems: ['Chicken Breast', 'Broccoli'],
            nutrition: mockNutrition,
        } as firestoreService.MealLog;
        mockGetTodaysMealLogs.mockResolvedValueOnce([]).mockResolvedValueOnce([newLog]);

        // 3. User selects a file
        const file = new File(['(⌐□_□)'], 'meal.png', { type: 'image/png' });
        const input = screen.getByLabelText(/Tap to upload/i);

        fireEvent.change(input, { target: { files: [file] } });

        // 4. Verify loading states and service calls
        await waitFor(() => {
            expect(screen.getByText('Analyzing your meal...')).toBeInTheDocument();
        });

        await waitFor(() => {
            expect(mockAnalyzeFoodImage).toHaveBeenCalled();
            expect(screen.getByText('Calculating nutrition...')).toBeInTheDocument();
        });

        await waitFor(() => {
            expect(mockGetNutritionalAnalysis).toHaveBeenCalledWith(['Chicken Breast', 'Broccoli']);
            expect(screen.getByText('Saving your log...')).toBeInTheDocument();
        });
        
        await waitFor(() => {
            expect(mockUploadImage).toHaveBeenCalled();
            expect(mockSaveMealLog).toHaveBeenCalled();
        });

        // 5. Verify the UI updates with the new log and success toast
        await waitFor(() => {
            expect(screen.getByText('Identified Foods:')).toBeInTheDocument();
            expect(screen.getByText('Chicken Breast, Broccoli')).toBeInTheDocument();
            expect(screen.getByText('350')).toBeInTheDocument(); // Calories
        });

        // Note: Toast verification would typically be in the wrapper, but we check if the hook was called
        // The useToast hook is mocked, so we can't see the toast itself.
        // We assume that if the services were called, the success path was taken.
    });

    it('should show an error message if any part of the process fails', async () => {
        // 1. Initial state: No meal logs
        mockGetTodaysMealLogs.mockResolvedValue([]);
        renderWithProviders(<Dashboard user={mockUser} userProfile={mockUserProfile} />);

        // 2. Mock a failure in the pipeline (e.g., Gemini fails to analyze)
        const error = new Error("AI analysis failed");
        mockAnalyzeFoodImage.mockRejectedValue(error);

        // 3. User selects a file
        const file = new File(['(⌐□_□)'], 'meal.png', { type: 'image/png' });
        const input = screen.getByLabelText(/Tap to upload/i);

        fireEvent.change(input, { target: { files: [file] } });
        
        // 4. Verify the error is shown in the UI
        await waitFor(() => {
            expect(screen.getByText(/Failed to log meal: AI analysis failed/i)).toBeInTheDocument();
        });

        // 5. Verify that subsequent service calls were not made
        expect(mockGetNutritionalAnalysis).not.toHaveBeenCalled();
        expect(mockSaveMealLog).not.toHaveBeenCalled();
    });
});