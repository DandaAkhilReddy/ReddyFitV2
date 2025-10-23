// __tests__/hooks/useAuth.test.tsx
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { AuthProvider, useAuth } from '../../hooks/useAuth';
import * as firestoreService from '../../services/firestoreService';
import { auth } from '../../firebase';
import { useToast } from '../../hooks/useToast';
import { UserProfile } from '../../services/firestoreService';
import firebase from 'firebase/compat/app';

// Mock dependencies
jest.mock('../../firebase', () => ({
    auth: {
        onAuthStateChanged: jest.fn(),
        signInWithEmailAndPassword: jest.fn(),
        createUserWithEmailAndPassword: jest.fn(),
        signOut: jest.fn(),
    },
}));

jest.mock('../../services/firestoreService', () => ({
    getUserProfile: jest.fn(),
    createUserProfile: jest.fn(),
}));

jest.mock('../../hooks/useToast', () => ({
    useToast: jest.fn(),
}));

const mockOnAuthStateChanged = auth.onAuthStateChanged as jest.MockedFunction<typeof auth.onAuthStateChanged>;
const mockSignIn = auth.signInWithEmailAndPassword as jest.MockedFunction<typeof auth.signInWithEmailAndPassword>;
const mockSignUp = auth.createUserWithEmailAndPassword as jest.MockedFunction<typeof auth.createUserWithEmailAndPassword>;
const mockSignOut = auth.signOut as jest.MockedFunction<typeof auth.signOut>;
const mockGetUserProfile = firestoreService.getUserProfile as jest.MockedFunction<typeof firestoreService.getUserProfile>;
const mockCreateUserProfile = firestoreService.createUserProfile as jest.MockedFunction<typeof firestoreService.createUserProfile>;
const mockUseToast = useToast as jest.Mock;

const mockShowToast = jest.fn();

// Wrapper component to provide all necessary contexts
const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
);

describe('useAuth', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUseToast.mockReturnValue({ showToast: mockShowToast });
    });

    it('should be in a loading state initially', () => {
        const { result } = renderHook(() => useAuth(), { wrapper });
        expect(result.current.loading).toBe(true);
    });

    it('should set user and profile when auth state changes to logged in', async () => {
        const mockUser = { uid: '123', email: 'test@example.com' } as firebase.User;
        const mockProfile: UserProfile = { uid: '123', email: 'test@example.com', displayName: 'Test User', points: 10, createdAt: {} as any };
        
        mockGetUserProfile.mockResolvedValue(mockProfile);

        let onAuthStateChangedCallback: (user: firebase.User | null) => void;
        mockOnAuthStateChanged.mockImplementation((callback: (user: firebase.User | null) => void) => {
            onAuthStateChangedCallback = callback;
            return () => {}; // Return an unsubscribe function
        });

        const { result } = renderHook(() => useAuth(), { wrapper });
        
        act(() => {
            onAuthStateChangedCallback(mockUser);
        });

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
            expect(result.current.user).toEqual(mockUser);
            expect(result.current.userProfile).toEqual(mockProfile);
        });
    });

    it('should set user to null when auth state changes to logged out', async () => {
        let onAuthStateChangedCallback: (user: firebase.User | null) => void;
        mockOnAuthStateChanged.mockImplementation((callback: (user: firebase.User | null) => void) => {
            onAuthStateChangedCallback = callback;
            return () => {};
        });

        const { result } = renderHook(() => useAuth(), { wrapper });

        act(() => {
            onAuthStateChangedCallback(null);
        });

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
            expect(result.current.user).toBeNull();
            expect(result.current.userProfile).toBeNull();
        });
    });

    it('should sign in a user and show a success toast', async () => {
        const { result } = renderHook(() => useAuth(), { wrapper });

        mockSignIn.mockResolvedValue({ user: { uid: '123' } } as any);

        await act(async () => {
            await result.current.signIn('test@example.com', 'password123');
        });

        expect(mockSignIn).toHaveBeenCalledWith('test@example.com', 'password123');
        expect(mockShowToast).toHaveBeenCalledWith('Successfully signed in!', 'success');
    });

    it('should show an error toast on failed sign in', async () => {
        const { result } = renderHook(() => useAuth(), { wrapper });
        const error = { code: 'auth/invalid-credential', message: 'Invalid credentials' };
        mockSignIn.mockRejectedValue(error);

        await act(async () => {
            await expect(result.current.signIn('test@example.com', 'wrongpassword')).rejects.toEqual(error);
        });

        expect(mockShowToast).toHaveBeenCalledWith('Sign-in failed: Invalid email or password.', 'error');
    });

    it('should sign up a user, create a profile, and show a success toast', async () => {
        const { result } = renderHook(() => useAuth(), { wrapper });
        const mockUser = { uid: '123', email: 'new@example.com' } as firebase.User;
        mockSignUp.mockResolvedValue({ user: mockUser } as any);
        mockCreateUserProfile.mockResolvedValue(undefined);

        await act(async () => {
            await result.current.signUp('new@example.com', 'password123');
        });

        expect(mockSignUp).toHaveBeenCalledWith('new@example.com', 'password123');
        expect(mockCreateUserProfile).toHaveBeenCalledWith(mockUser);
        expect(mockShowToast).toHaveBeenCalledWith('Account created successfully!', 'success');
    });

    it('should show an error toast on failed sign up', async () => {
        const { result } = renderHook(() => useAuth(), { wrapper });
        const error = { code: 'auth/email-already-in-use', message: 'Email in use' };
        mockSignUp.mockRejectedValue(error);

        await act(async () => {
            await expect(result.current.signUp('test@example.com', 'password123')).rejects.toEqual(error);
        });

        expect(mockShowToast).toHaveBeenCalledWith('Sign-up failed: This email is already registered.', 'error');
    });

    it('should sign out a user and show an info toast', async () => {
        const { result } = renderHook(() => useAuth(), { wrapper });
        mockSignOut.mockResolvedValue(undefined);

        await act(async () => {
            await result.current.signOutUser();
        });

        expect(mockSignOut).toHaveBeenCalled();
        expect(mockShowToast).toHaveBeenCalledWith('You have been signed out.', 'info');
    });
});
