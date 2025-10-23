// __tests__/components/shared/shared.components.test.tsx
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, jest } from '@jest/globals';

import { Loader } from '../../../components/shared/Loader';
import { ErrorMessage } from '../../../components/shared/ErrorMessage';
import { ProgressBar } from '../../../components/shared/ProgressBar';
import { ToastContainer } from '../../../components/shared/Toast';
import { ToastProvider, useToast } from '../../../hooks/useToast';
import * as Icons from '../../../components/shared/icons';

describe('Shared Components', () => {

    describe('Loader', () => {
        it('should render the default text', () => {
            render(<Loader />);
            expect(screen.getByText('Analyzing...')).toBeInTheDocument();
        });

        it('should render custom text and subtext', () => {
            render(<Loader text="Loading Data" subtext="Please wait a moment." />);
            expect(screen.getByText('Loading Data')).toBeInTheDocument();
            expect(screen.getByText('Please wait a moment.')).toBeInTheDocument();
        });
    });

    describe('ErrorMessage', () => {
        it('should render the error message', () => {
            render(<ErrorMessage error="Something went wrong." />);
            expect(screen.getByText('Something went wrong.')).toBeInTheDocument();
        });

        it('should render a retry button if onRetry is provided', () => {
            const onRetry = jest.fn();
            render(<ErrorMessage error="Network error." onRetry={onRetry} />);
            const retryButton = screen.getByRole('button', { name: /Try Again/i });
            expect(retryButton).toBeInTheDocument();
            fireEvent.click(retryButton);
            expect(onRetry).toHaveBeenCalled();
        });

        it('should not render a retry button if onRetry is not provided', () => {
            render(<ErrorMessage error="Static error." />);
            expect(screen.queryByRole('button', { name: /Try Again/i })).not.toBeInTheDocument();
        });
    });

    describe('ProgressBar', () => {
        it('should render with the correct width based on progress', () => {
            const { container } = render(<ProgressBar progress={75} />);
            const progressBar = container.querySelector('div[style="width: 75%;"]');
            expect(progressBar).toBeInTheDocument();
        });

        it('should clamp progress to 0 if a negative number is passed', () => {
            const { container } = render(<ProgressBar progress={-50} />);
            const progressBar = container.querySelector('div[style="width: 0%;"]');
            expect(progressBar).toBeInTheDocument();
        });

        it('should clamp progress to 100 if a number greater than 100 is passed', () => {
            const { container } = render(<ProgressBar progress={150} />);
            const progressBar = container.querySelector('div[style="width: 100%;"]');
            expect(progressBar).toBeInTheDocument();
        });
    });
    
    describe('ToastContainer and Toast', () => {
        it('should display a toast when showToast is called', () => {
            const TestComponent = () => {
                const { showToast } = useToast();
                return <button onClick={() => showToast('Success!', 'success')}>Show Toast</button>;
            };
    
            render(
                <ToastProvider>
                    <ToastContainer />
                    <TestComponent />
                </ToastProvider>
            );
    
            fireEvent.click(screen.getByRole('button', { name: 'Show Toast' }));
    
            expect(screen.getByText('Success!')).toBeInTheDocument();
        });
    });
    
    describe('Icons', () => {
         it('should render all icons without crashing', () => {
            // This is a simple smoke test to ensure all icon components are valid React components
            Object.values(Icons).forEach((IconComponent) => {
                // Some items in an export might not be components, so we check
                if (typeof IconComponent === 'function' && /^[A-Z]/.test(IconComponent.name)) {
                    render(<IconComponent />);
                }
            });
        });
    });
});
