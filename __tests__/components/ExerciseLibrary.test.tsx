// __tests__/components/ExerciseLibrary.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ExerciseLibrary } from '../../components/ExerciseLibrary';
import * as firestoreService from '../../services/firestoreService';
import { exercises as baseExercises } from '../../data/exercises';

// Mock dependencies
jest.mock('../../services/firestoreService');

const mockGetCommunityExercises = firestoreService.getCommunityExercises as jest.MockedFunction<typeof firestoreService.getCommunityExercises>;

describe('ExerciseLibrary', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Mock the community exercises fetch
        mockGetCommunityExercises.mockResolvedValue([
            {
                id: 'community_pull_up',
                name: 'Community Pull-up',
                muscle_groups: ['Back'],
                equipment: 'Pull-up Bar',
                difficulty: 'Advanced',
                description: 'A community version.',
                image_url: 'http://example.com/community.jpg'
            }
        ]);
    });

    it('should render a loading state initially', () => {
        render(<ExerciseLibrary />);
        expect(screen.getByText('Loading exercises...')).toBeInTheDocument();
    });

    it('should render the list of exercises after loading', async () => {
        render(<ExerciseLibrary />);
        await waitFor(() => {
            // Should show exercises from both base and community
            expect(screen.getByText('Barbell Squat')).toBeInTheDocument();
            expect(screen.getByText('Community Pull-up')).toBeInTheDocument();
        });
    });

    it('should filter exercises by search term', async () => {
        render(<ExerciseLibrary />);
        await waitFor(() => expect(screen.getByText('Barbell Squat')).toBeInTheDocument());

        const searchInput = screen.getByPlaceholderText('Search exercises...');
        fireEvent.change(searchInput, { target: { value: 'Squat' } });

        expect(screen.getByText('Barbell Squat')).toBeInTheDocument();
        expect(screen.queryByText('Conventional Deadlift')).not.toBeInTheDocument();
    });

    it('should filter exercises by muscle group', async () => {
        render(<ExerciseLibrary />);
        await waitFor(() => expect(screen.getByText('Barbell Squat')).toBeInTheDocument());

        const muscleFilter = screen.getByRole('combobox', { name: /muscles/i });
        fireEvent.change(muscleFilter, { target: { value: 'Chest' } });

        expect(screen.getByText('Barbell Bench Press')).toBeInTheDocument();
        expect(screen.queryByText('Barbell Squat')).not.toBeInTheDocument();
    });
    
    it('should filter exercises by difficulty', async () => {
        render(<ExerciseLibrary />);
        await waitFor(() => expect(screen.getByText('Barbell Squat')).toBeInTheDocument());

        const difficultyFilter = screen.getByRole('combobox', { name: /difficulties/i });
        fireEvent.change(difficultyFilter, { target: { value: 'Beginner' } });

        expect(screen.getByText('Leg Press')).toBeInTheDocument();
        expect(screen.queryByText('Barbell Squat')).not.toBeInTheDocument();
    });
    
    it('should filter exercises by equipment', async () => {
        render(<ExerciseLibrary />);
        await waitFor(() => expect(screen.getByText('Barbell Squat')).toBeInTheDocument());

        const equipmentFilter = screen.getByRole('combobox', { name: /equipment/i });
        fireEvent.change(equipmentFilter, { target: { value: 'Bodyweight' } });

        expect(screen.getByText('Plank')).toBeInTheDocument();
        expect(screen.queryByText('Barbell Squat')).not.toBeInTheDocument();
    });

    it('should show a "no exercises found" message when filters result in an empty list', async () => {
        render(<ExerciseLibrary />);
        await waitFor(() => expect(screen.getByText('Barbell Squat')).toBeInTheDocument());
        
        const searchInput = screen.getByPlaceholderText('Search exercises...');
        fireEvent.change(searchInput, { target: { value: 'nonexistent exercise' } });
        
        expect(screen.getByText('No Exercises Found')).toBeInTheDocument();
    });

    it('should open and close the exercise details modal', async () => {
        render(<ExerciseLibrary />);
        await waitFor(() => expect(screen.getByText('Barbell Squat')).toBeInTheDocument());

        // Open modal
        fireEvent.click(screen.getByText('Barbell Squat'));

        await waitFor(() => {
            // Use a more specific query for the modal title
            expect(screen.getByRole('heading', { name: 'Barbell Squat', level: 2 })).toBeInTheDocument();
            expect(screen.getByText('How to Perform')).toBeInTheDocument();
        });

        // Close modal by clicking the close button
        fireEvent.click(screen.getByLabelText('Close'));
        
        await waitFor(() => {
            expect(screen.queryByText('How to Perform')).not.toBeInTheDocument();
        });
    });
});
