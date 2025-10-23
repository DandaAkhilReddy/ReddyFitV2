// __integration_tests__/auth.integration.test.tsx
import React from 'react';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import { renderWithProviders } from './setup';
import App from '../App';
import { auth } from '../firebase';
import * as firestoreService from '../services/firestoreService';
import firebase from 'firebase/compat/app';
import '@testing-library/jest-dom';

// Mock the entire firebase dependency for auth
jest.mock('../firebase', () => ({
    auth: {
        onAuthStateChanged: jest.fn(),
        signInWithEmailAndPassword: jest.fn(),
        createUserWithEmailAndPassword: jest.fn(),
        signOut: jest.fn(),
    },
}));

// Mock the services
jest.mock('../services/firestoreService');
jest.mock('../services/geminiService'); // Mock gemini as it's used in dashboard

// FIX: Use jest.MockedFunction for correct typing of mocks.
const mockOnAuthStateChanged = auth.onAuthStateChanged as jest.MockedFunction<typeof auth.onAuthStateChanged>;
const mockSignIn = auth.signInWithEmailAndPassword as jest.MockedFunction<typeof auth.signInWithEmailAndPassword>;
const mockSignUp = auth.createUserWithEmailAndPassword as jest.MockedFunction<typeof auth.createUserWithEmailAndPassword>;
const mockSignOut = auth.signOut as jest.MockedFunction<typeof auth.signOut>;
const mockCreateUserProfile = firestoreService.createUserProfile as jest.MockedFunction<typeof firestoreService.createUserProfile>;
const mockGetUserProfile = firestoreService.getUserProfile as jest.MockedFunction<typeof firestoreService.getUserProfile>;
const mockGetTodaysMealLogs = firestoreService.getTodaysMealLogs as jest.MockedFunction<typeof firestoreService.getTodaysMealLogs>;

describe('Authentication Integration Flow', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Mock getTodaysMealLogs to prevent dashboard from trying to fetch data
        // FIX: Use the correctly typed mock.
        mockGetTodaysMealLogs.mockResolvedValue([]);
    });

    it('should allow a new user to sign up and be redirected to the dashboard', async () => {
        // 1. Start with no user logged in
        let onAuthStateChangedCallback: (user: firebase.User | null) => void = () => {};
        mockOnAuthStateChanged.mockImplementation((callback: (user: firebase.User | null) => void) => {
            onAuthStateChangedCallback = callback;
            callback(null); // Initially no user
            return () => {}; // Unsubscribe function
        });

        renderWithProviders(<App />);

        // 2. User sees the LoginPage
        // Toggle to sign up view
        fireEvent.click(screen.getByRole('button', { name: /Sign Up/i }));
        expect(screen.getByText('Create Your Account')).toBeInTheDocument();
        
        // 3. User fills out the sign-up form
        fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'newuser@example.com' } });
        fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'password123' } });

        // 4. Mocks for successful sign-up
        const mockUser = { uid: 'new-uid', email: 'newuser@example.com' } as firebase.User;
        // FIX: Use correctly typed mocks for resolved values.
        mockSignUp.mockResolvedValue({ user: mockUser } as any);
        mockCreateUserProfile.mockResolvedValue(undefined);
        const mockProfile = { uid: 'new-uid', displayName: 'newuser', points: 0 } as firestoreService.UserProfile;
        mockGetUserProfile.mockResolvedValue(mockProfile);

        // 5. User clicks "Create Account"
        fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));
        
        // 6. Simulate auth state changing after sign-up
        await waitFor(() => {
            expect(mockSignUp).toHaveBeenCalledWith('newuser@example.com', 'password123');
            expect(mockCreateUserProfile).toHaveBeenCalledWith(mockUser);
        });

        act(() => {
             onAuthStateChangedCallback(mockUser);
        });

        // 7. Verify the user is now on the Dashboard
        await waitFor(() => {
            expect(screen.getByText(/Welcome back, newuser/i)).toBeInTheDocument();
            expect(screen.queryByText('Create Your Account')).not.toBeInTheDocument();
        });
    });

    it('should allow an existing user to sign in, sign out, and sign back in', async () => {
        // 1. Start with no user
        let onAuthStateChangedCallback: (user: firebase.User | null) => void = () => {};
        mockOnAuthStateChanged.mockImplementation((callback: (user: firebase.User | null) => void) => {
            onAuthStateChangedCallback = callback;
            callback(null);
            return () => {};
        });

        const { rerender } = renderWithProviders(<App />);

        // 2. User sees LoginPage, fills form
        fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'test@example.com' } });
        fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'password123' } });

        // 3. Mocks for successful sign-in
        const mockUser = { uid: 'test-uid', email: 'test@example.com' } as firebase.User;
        const mockProfile = { uid: 'test-uid', displayName: 'Test User', points: 10 } as firestoreService.UserProfile;
        // FIX: Use correctly typed mocks for resolved values.
        mockSignIn.mockResolvedValue({ user: mockUser } as any);
        mockGetUserProfile.mockResolvedValue(mockProfile);
        
        // 4. User clicks "Sign In"
        fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

        // 5. Simulate auth state change
        act(() => {
            onAuthStateChangedCallback(mockUser);
        });

        // 6. Verify user is on the Dashboard
        await waitFor(() => {
            expect(screen.getByText(/Welcome back, Test User/i)).toBeInTheDocument();
        });

        // --- NOW, TEST SIGN OUT ---
        
        // 7. User navigates to settings and signs out
        fireEvent.click(screen.getByRole('button', { name: /Settings/i }));
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Sign Out/i })).toBeInTheDocument();
        });
        
        // FIX: Use correctly typed mocks for resolved values.
        mockSignOut.mockResolvedValue(undefined);
        fireEvent.click(screen.getByRole('button', { name: /Sign Out/i }));

        // 8. Simulate auth state changing to logged out
        act(() => {
            onAuthStateChangedCallback(null);
        });
        
        // 9. Verify user is back on the LoginPage
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
            expect(screen.queryByText(/Welcome back, Test User/i)).not.toBeInTheDocument();
        });
        
        // --- NOW, TEST SIGNING BACK IN ---
        
        // 10. Rerender to ensure state is clean
        rerender(<App />);
        
        // 11. Fill form and sign in again
        fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'test@example.com' } });
        fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'password123' } });
        fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));
        
        act(() => {
            onAuthStateChangedCallback(mockUser);
        });

        // 12. Verify user is back on the Dashboard
        await waitFor(() => {
            expect(screen.getByText(/Welcome back, Test User/i)).toBeInTheDocument();
        });
    });
});