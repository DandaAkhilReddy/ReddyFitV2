// __tests__/hooks/useToast.test.tsx
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from '@jest/globals';
import { ToastProvider, useToast } from '../../hooks/useToast';
import React from 'react';

// Wrapper component to provide the ToastContext
const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ToastProvider>{children}</ToastProvider>
);

describe('useToast', () => {
    it('should start with an empty array of toasts', () => {
        const { result } = renderHook(() => useToast(), { wrapper });
        expect(result.current.toasts).toEqual([]);
    });

    it('should add a toast when showToast is called', () => {
        const { result } = renderHook(() => useToast(), { wrapper });

        act(() => {
            result.current.showToast('Test success message', 'success');
        });

        expect(result.current.toasts).toHaveLength(1);
        expect(result.current.toasts[0].message).toBe('Test success message');
        expect(result.current.toasts[0].type).toBe('success');
    });

    it('should remove a toast when removeToast is called', () => {
        const { result } = renderHook(() => useToast(), { wrapper });
        let toastId: number;

        act(() => {
            result.current.showToast('Another message', 'error');
        });

        toastId = result.current.toasts[0].id;
        expect(result.current.toasts).toHaveLength(1);

        act(() => {
            result.current.removeToast(toastId);
        });

        expect(result.current.toasts).toHaveLength(0);
    });
});
