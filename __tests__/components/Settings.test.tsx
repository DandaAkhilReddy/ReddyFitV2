// __tests__/components/Settings.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Settings } from '../../components/Settings';
import { useAuth } from '../../hooks/useAuth';
import { useUserPreferences } from '../../hooks/useUserPreferences';
import * as dbService from '../../database/dbService';
import { useToast } from '../../hooks/useToast';

// Mock dependencies
jest.mock('../../hooks/useAuth');
jest.mock('../../hooks/useUserPreferences');
jest.mock('../../database/dbService');
jest.mock('../../hooks/useToast');

const mockUseAuth = useAuth as jest.Mock;
const mockUseUserPreferences = useUserPreferences as jest.Mock;
const mockUseToast = useToast as jest.Mock;
const mockClearAllData = dbService.clearAllData as jest.Mock;

const mockSignOutUser = jest.fn();
const mockSetFitnessLevel = jest.fn();
const mockSetGoal = jest.fn();
const mockShowToast = jest.fn();

const mockUser = { uid: 'test-user', email: 'test@example.com' } as any;
const mockUserProfile = { displayName: 'Test User' } as any;
const mockUserPreferences = {
    fitnessLevel: 'Intermediate',
    goal: 'Build Muscle',
    caloriesGoal: 2500,
    proteinGoal: 150,
    carbsGoal: 300,
    fatGoal: 70,
    setFitnessLevel: mockSetFitnessLevel,
    setGoal: mockSetGoal,
    setCaloriesGoal: jest.fn(),
    setProteinGoal: jest.fn(),
    setCarbsGoal: jest.fn(),
    setFatGoal: jest.fn(),
};

const renderSettings = () => {
    return render(<Settings />);
};

describe('Settings', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUseAuth.mockReturnValue({
            user: mockUser,
            userProfile: mockUserProfile,
            signOutUser: mockSignOutUser,
        });
        mockUseUserPreferences.mockReturnValue(mockUserPreferences);
        mockUseToast.mockReturnValue({ showToast: mockShowToast });
    });

    it('should render user profile information correctly', () => {
        renderSettings();
        expect(screen.getByText('Test User')).toBeInTheDocument();
        expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });

    it('should display the current user preferences in form fields', () => {
        renderSettings();
        const fitnessLevelSelect = screen.getByLabelText('Your Fitness Level') as HTMLSelectElement;
        const goalSelect = screen.getByLabelText('Your Primary Goal') as HTMLSelectElement;

        expect(fitnessLevelSelect.value).toBe('Intermediate');
        expect(goalSelect.value).toBe('Build Muscle');
    });

    it('should call setFitnessLevel when the fitness level select is changed', () => {
        renderSettings();
        const fitnessLevelSelect = screen.getByLabelText('Your Fitness Level');
        fireEvent.change(fitnessLevelSelect, { target: { value: 'Advanced' } });

        expect(mockSetFitnessLevel).toHaveBeenCalledWith('Advanced');
    });

    it('should call signOutUser when the sign out button is clicked', () => {
        renderSettings();
        const signOutButton = screen.getByTitle('Sign Out');
        fireEvent.click(signOutButton);

        expect(mockSignOutUser).toHaveBeenCalled();
    });

    it('should call dbService.clearAllData when "Clear Cached App Data" is clicked and confirmed', async () => {
        // Mock window.confirm
        window.confirm = jest.fn(() => true);
        // Fix: Cast mock resolved value to 'any' to avoid TypeScript type inference issues with Jest mocks.
        mockClearAllData.mockResolvedValue(undefined as any);
        
        renderSettings();
        const clearDataButton = screen.getByRole('button', { name: /Clear Cached App Data/i });
        fireEvent.click(clearDataButton);

        expect(window.confirm).toHaveBeenCalled();
        
        await waitFor(() => {
            expect(mockClearAllData).toHaveBeenCalled();
            expect(mockShowToast).toHaveBeenCalledWith("Application data has been cleared successfully.", "success");
        });
    });
});
