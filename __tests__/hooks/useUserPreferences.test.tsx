// __tests__/hooks/useUserPreferences.test.tsx
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { UserPreferencesProvider, useUserPreferences } from '../../hooks/useUserPreferences';
import React from 'react';

// From setup.ts, localStorage is already mocked. We can spy on it.
const setItemSpy = jest.spyOn(window.localStorage, 'setItem');

// Wrapper component to provide the context
const wrapper = ({ children }: { children: React.ReactNode }) => (
    <UserPreferencesProvider>{children}</UserPreferencesProvider>
);

describe('useUserPreferences', () => {

    beforeEach(() => {
        // Clear mocks and localStorage before each test
        setItemSpy.mockClear();
        window.localStorage.clear();
    });
    
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should return default preferences when localStorage is empty', () => {
        const { result } = renderHook(() => useUserPreferences(), { wrapper });

        expect(result.current.fitnessLevel).toBe('Intermediate');
        expect(result.current.goal).toBe('Build Muscle');
        expect(result.current.caloriesGoal).toBe(2500);
        expect(result.current.proteinGoal).toBe(150);
        expect(result.current.carbsGoal).toBe(300);
        expect(result.current.fatGoal).toBe(70);
    });

    it('should load preferences from localStorage if they exist', () => {
        const storedPrefs = {
            fitnessLevel: 'Advanced',
            goal: 'Lose Fat',
            caloriesGoal: 2000,
            proteinGoal: 180,
            carbsGoal: 150,
            fatGoal: 60,
        };
        window.localStorage.setItem('reddyfit-user-preferences-v2', JSON.stringify(storedPrefs));

        const { result } = renderHook(() => useUserPreferences(), { wrapper });

        expect(result.current.fitnessLevel).toBe('Advanced');
        expect(result.current.goal).toBe('Lose Fat');
        expect(result.current.caloriesGoal).toBe(2000);
        expect(result.current.proteinGoal).toBe(180);
    });

    it('should fall back to defaults if localStorage data is malformed', () => {
        window.localStorage.setItem('reddyfit-user-preferences-v2', 'this is not json');
        const { result } = renderHook(() => useUserPreferences(), { wrapper });
        expect(result.current.fitnessLevel).toBe('Intermediate');
        expect(result.current.goal).toBe('Build Muscle');
    });

    it('should update fitnessLevel and persist to localStorage', () => {
        const { result } = renderHook(() => useUserPreferences(), { wrapper });

        act(() => {
            result.current.setFitnessLevel('Beginner');
        });

        expect(result.current.fitnessLevel).toBe('Beginner');
        expect(setItemSpy).toHaveBeenCalledWith(
            'reddyfit-user-preferences-v2',
            expect.stringContaining('"fitnessLevel":"Beginner"')
        );
    });

    it('should update goal and persist to localStorage', () => {
        const { result } = renderHook(() => useUserPreferences(), { wrapper });

        act(() => {
            result.current.setGoal('Improve Endurance');
        });

        expect(result.current.goal).toBe('Improve Endurance');
        expect(setItemSpy).toHaveBeenCalledWith(
            'reddyfit-user-preferences-v2',
            expect.stringContaining('"goal":"Improve Endurance"')
        );
    });

    it('should update caloriesGoal and persist to localStorage', () => {
        const { result } = renderHook(() => useUserPreferences(), { wrapper });

        act(() => {
            result.current.setCaloriesGoal(2800);
        });

        expect(result.current.caloriesGoal).toBe(2800);
        expect(setItemSpy).toHaveBeenCalledWith(
            'reddyfit-user-preferences-v2',
            expect.stringContaining('"caloriesGoal":2800')
        );
    });

    it('should update proteinGoal and persist to localStorage', () => {
        const { result } = renderHook(() => useUserPreferences(), { wrapper });

        act(() => {
            result.current.setProteinGoal(160);
        });

        expect(result.current.proteinGoal).toBe(160);
        expect(setItemSpy).toHaveBeenCalledWith(
            'reddyfit-user-preferences-v2',
            expect.stringContaining('"proteinGoal":160')
        );
    });
    
    it('should update carbsGoal and fatGoal and persist to localStorage', () => {
        const { result } = renderHook(() => useUserPreferences(), { wrapper });

        act(() => {
            result.current.setCarbsGoal(350);
        });
        expect(result.current.carbsGoal).toBe(350);
        expect(setItemSpy).toHaveBeenCalledWith(
            'reddyfit-user-preferences-v2',
            expect.stringContaining('"carbsGoal":350')
        );

        act(() => {
            result.current.setFatGoal(80);
        });
        expect(result.current.fatGoal).toBe(80);
        expect(setItemSpy).toHaveBeenCalledWith(
            'reddyfit-user-preferences-v2',
            expect.stringContaining('"fatGoal":80')
        );
    });
});
