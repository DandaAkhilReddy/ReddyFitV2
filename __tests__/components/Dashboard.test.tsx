// __tests__/components/Dashboard.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Dashboard } from '../../components/Dashboard';
import * as geminiService from '../../services/geminiService';
import * as firestoreService from '../../services/firestoreService';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { useUserPreferences } from '../../hooks/useUserPreferences';
import { UserProfile, MealLog } from '../../services/firestoreService';
import { NutritionalInfo } from '../../services/geminiService';

// Mock dependencies
jest.mock('../../services/geminiService');
jest.mock('../../services/firestoreService');
jest.mock('../../hooks/useAuth');
jest.mock('../../hooks/useToast');
jest.mock('../../hooks/useUserPreferences');

const mockUseAuth = useAuth as jest.Mock;
const mockUseToast = useToast as jest.Mock;
const mockUseUserPreferences = useUserPreferences as jest.Mock;

const mockAnalyzeFoodImage = geminiService.analyzeFoodImage as jest.MockedFunction<typeof geminiService.analyzeFoodImage>;
const mockGetNutritionalAnalysis = geminiService.getNutritionalAnalysis as jest.MockedFunction<typeof geminiService.getNutritionalAnalysis>;
const mockUploadImage = firestoreService.uploadImage as jest.MockedFunction<typeof firestoreService.uploadImage>;
const mockSaveMealLog = firestoreService.saveMealLog as jest.MockedFunction<typeof firestoreService.saveMealLog>;
const mockGetTodaysMealLogs = firestoreService.getTodaysMealLogs as jest.MockedFunction<typeof firestoreService.getTodaysMealLogs>;

const mockShowToast = jest.fn();

const mockUser = { uid: 'test-user-123' } as any;
const mockUserProfile: UserProfile = { 
    uid: 'test-user-123',
    email: 'test@example.com',
    displayName: 'Test User',
    points: 7,
    createdAt: {} as any
};
const mockUserPreferences = {
    caloriesGoal: 2500,
    proteinGoal: 150,
    carbsGoal: 300,
    fatGoal: 70
};

// A wrapper to provide all contexts for the component
const renderDashboard = () => {
    return render(
        <Dashboard user={mockUser} userProfile={mockUserProfile} />
    );
};

describe('Dashboard', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUseAuth.mockReturnValue({ user: mockUser, userProfile: mockUserProfile });
        mockUseToast.mockReturnValue({ showToast: mockShowToast });
        mockUseUserPreferences.mockReturnValue(mockUserPreferences);
    });

    it('should render loading state initially and then an empty state if no meals are logged', async () => {
        mockGetTodaysMealLogs.mockResolvedValue([]);
        renderDashboard();

        expect(screen.getByText('Loading your dashboard...')).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByText("You haven't logged any meals today.")).toBeInTheDocument();
        });
    });

    it('should render meal logs and update nutrition totals when data is present', async () => {
        const mockNutrition: NutritionalInfo = {
            calories: 400,
            macronutrients: { protein: 40, carbohydrates: 5, fat: 25 },
            vitamins: [],
            minerals: [],
        };
        const mockLogs: MealLog[] = [
            { id: 'log1', userId: 'test-user-123', imageUrl: 'url1', foodItems: ['Steak', 'Asparagus'], nutrition: mockNutrition, createdAt: {} as any },
        ];
        mockGetTodaysMealLogs.mockResolvedValue(mockLogs);
        
        renderDashboard();

        await waitFor(() => {
            expect(screen.getByText('Steak, Asparagus')).toBeInTheDocument();
            // Check totals
            expect(screen.getByText('400')).toBeInTheDocument(); // Calorie total in tracker
            expect(screen.getByText('40g / 150g')).toBeInTheDocument(); // Protein bar
        });
    });

    it('should handle the full meal upload flow successfully', async () => {
        // Start with no logs
        mockGetTodaysMealLogs.mockResolvedValue([]);
        
        const mockNutrition: NutritionalInfo = {
            calories: 350,
            macronutrients: { protein: 50, carbohydrates: 10, fat: 12 },
            vitamins: [], minerals: []
        };
        const newLog: MealLog = {
            id: 'log2', userId: 'test-user-123', imageUrl: 'http://new-image.com/meal.jpg',
            foodItems: ['Chicken Breast', 'Broccoli'], nutrition: mockNutrition, createdAt: {} as any
        };

        // Mock the entire successful service call chain
        mockAnalyzeFoodImage.mockResolvedValue(['Chicken Breast', 'Broccoli']);
        mockGetNutritionalAnalysis.mockResolvedValue(mockNutrition);
        mockUploadImage.mockResolvedValue('http://new-image.com/meal.jpg');
        mockSaveMealLog.mockResolvedValue(undefined);
        // Mock the refetch to return the new log
        mockGetTodaysMealLogs.mockResolvedValueOnce([]).mockResolvedValueOnce([newLog]);

        renderDashboard();

        const file = new File(['(⌐□_□)'], 'meal.png', { type: 'image/png' });
        const input = screen.getByLabelText(/Tap to upload/i);

        // Simulate file upload
        fireEvent.change(input, { target: { files: [file] } });

        // Wait for all async operations and UI updates
        await waitFor(() => expect(screen.getByText('Analyzing your meal...')).toBeInTheDocument());
        await waitFor(() => expect(screen.getByText('Calculating nutrition...')).toBeInTheDocument());
        await waitFor(() => expect(screen.getByText('Saving your log...')).toBeInTheDocument());
        
        await waitFor(() => {
            // Verify all services were called
            expect(mockAnalyzeFoodImage).toHaveBeenCalled();
            expect(mockGetNutritionalAnalysis).toHaveBeenCalledWith(['Chicken Breast', 'Broccoli']);
            expect(mockUploadImage).toHaveBeenCalledWith(file, mockUser.uid);
            expect(mockSaveMealLog).toHaveBeenCalled();

            // Verify success feedback
            expect(mockShowToast).toHaveBeenCalledWith("Meal logged successfully!", "success");

            // Verify UI has updated
            expect(screen.getByText('Chicken Breast, Broccoli')).toBeInTheDocument();
            expect(screen.getByText('350')).toBeInTheDocument();
        });
    });

    it('should show an error message and toast if AI analysis fails', async () => {
        mockGetTodaysMealLogs.mockResolvedValue([]);
        renderDashboard();

        // Mock a failure
        const error = new Error("AI model is overloaded.");
        mockAnalyzeFoodImage.mockRejectedValue(error);
        
        const file = new File(['(⌐□_□)'], 'meal.png', { type: 'image/png' });
        const input = screen.getByLabelText(/Tap to upload/i);
        fireEvent.change(input, { target: { files: [file] } });

        await waitFor(() => {
            // Verify UI feedback
            expect(screen.getByText(/Failed to log meal: AI model is overloaded./i)).toBeInTheDocument();
            expect(mockShowToast).toHaveBeenCalledWith("Error: AI model is overloaded.", "error");

            // Verify the pipeline was stopped
            expect(mockGetNutritionalAnalysis).not.toHaveBeenCalled();
            expect(mockSaveMealLog).not.toHaveBeenCalled();
        });
    });

    it('should show a toast and not proceed if a non-image file is selected', async () => {
        mockGetTodaysMealLogs.mockResolvedValue([]);
        renderDashboard();

        const file = new File(['some text'], 'document.txt', { type: 'text/plain' });
        const input = screen.getByLabelText(/Tap to upload/i);

        fireEvent.change(input, { target: { files: [file] } });

        await waitFor(() => {
            expect(mockShowToast).toHaveBeenCalledWith("Please select a valid image file.", "error");
        });

        // Verify that no service calls were made
        expect(mockAnalyzeFoodImage).not.toHaveBeenCalled();
    });
});
