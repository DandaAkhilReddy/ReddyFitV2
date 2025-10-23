// __tests__/components/LoginPage.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { LoginPage } from '../../components/LoginPage';
import { useAuth } from '../../hooks/useAuth';
import { ToastProvider } from '../../hooks/useToast';

// Mock dependencies
jest.mock('../../hooks/useAuth');

const mockUseAuth = useAuth as jest.Mock;
const mockSignIn = jest.fn();
const mockSignUp = jest.fn();

const renderLoginPage = () => {
    return render(
        <ToastProvider>
            <LoginPage />
        </ToastProvider>
    );
};

describe('LoginPage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUseAuth.mockReturnValue({
            signIn: mockSignIn,
            signUp: mockSignUp,
            user: null,
            loading: false,
        });
    });

    it('should render the login form by default', () => {
        renderLoginPage();
        expect(screen.getByText('Welcome Back')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
    });

    it('should switch to the sign-up view when "Sign Up" is clicked', () => {
        renderLoginPage();
        fireEvent.click(screen.getByRole('button', { name: /Sign Up/i }));
        expect(screen.getByText('Create Your Account')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Create Account/i })).toBeInTheDocument();
    });

    it('should call the signIn function on form submission in login view', async () => {
        renderLoginPage();
        fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'test@example.com' } });
        fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'password123' } });
        fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

        await waitFor(() => {
            expect(mockSignIn).toHaveBeenCalledWith('test@example.com', 'password123');
        });
    });

    it('should call the signUp function on form submission in sign-up view', async () => {
        renderLoginPage();
        // Switch to sign-up view
        fireEvent.click(screen.getByRole('button', { name: /Sign Up/i }));

        fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'new@example.com' } });
        fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'newpassword' } });
        fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));

        await waitFor(() => {
            expect(mockSignUp).toHaveBeenCalledWith('new@example.com', 'newpassword');
        });
    });

    it('should show a loading state on the button when submitting', async () => {
        // Make the promise hang so we can see the loading state
        mockSignIn.mockImplementation(() => new Promise(() => {})); 
        renderLoginPage();
        fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'test@example.com' } });
        fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'password123' } });
        fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

        await waitFor(() => {
            const button = screen.getByRole('button', { name: /Processing.../i });
            expect(button).toBeInTheDocument();
            expect(button).toBeDisabled();
        });
    });

    it('should not call signIn or signUp if form is invalid', () => {
        renderLoginPage();
        fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));
        
        // Form submission is prevented by the 'required' attribute, so this is a bit tricky to test without complex mocks.
        // We'll just verify the functions were not called.
        expect(mockSignIn).not.toHaveBeenCalled();
        expect(mockSignUp).not.toHaveBeenCalled();
    });
});
