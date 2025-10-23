import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { auth } from '../firebase';
import * as firestoreService from '../services/firestoreService';
import type { UserProfile } from '../services/firestoreService';
import { useToast } from './useToast';

interface AuthContextType {
    user: firebase.User | null;
    userProfile: UserProfile | null;
    loading: boolean;
    signIn: (email: string, pass: string) => Promise<void>;
    signUp: (email: string, pass: string) => Promise<void>;
    signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<firebase.User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const { showToast } = useToast();

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                try {
                    const profile = await firestoreService.getUserProfile(currentUser.uid);
                    setUserProfile(profile);
                } catch (e) {
                    console.error("Failed to fetch user profile:", e);
                    setUserProfile(null);
                }
            } else {
                setUserProfile(null);
            }
            setLoading(false);
        });
        
        return () => unsubscribe();
    }, []);

    const signIn = useCallback(async (email: string, pass: string) => {
        try {
            await auth.signInWithEmailAndPassword(email, pass);
            // onAuthStateChanged will handle fetching the profile
            showToast("Successfully signed in!", "success");
        } catch (error: any) {
            console.error("Error signing in: ", error);
            const message = error.code === 'auth/invalid-credential' ? 'Invalid email or password.' : error.message;
            showToast(`Sign-in failed: ${message}`, "error");
            throw error;
        }
    }, [showToast]);

    const signUp = useCallback(async (email: string, pass: string) => {
        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, pass);
            if (userCredential.user) {
                // Create a user profile document in Firestore
                await firestoreService.createUserProfile(userCredential.user);
                // The onAuthStateChanged listener will then pick up the new user and fetch the profile.
            }
            showToast("Account created successfully!", "success");
        } catch (error: any) {
            console.error("Error signing up: ", error);
            const message = error.code === 'auth/email-already-in-use' ? 'This email is already registered.' : error.message;
            showToast(`Sign-up failed: ${message}`, "error");
            throw error;
        }
    }, [showToast]);


    const signOutUser = useCallback(async () => {
        try {
            await auth.signOut();
            showToast("You have been signed out.", "info");
        } catch (error: any) {
            console.error("Error signing out: ", error);
            showToast(`Sign-out failed: ${error.message}`, "error");
        }
    }, [showToast]);

    const value = { user, userProfile, loading, signIn, signUp, signOutUser };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};