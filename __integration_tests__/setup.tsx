// __integration_tests__/setup.tsx
import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { ToastProvider } from '../hooks/useToast';
import { AuthProvider } from '../hooks/useAuth';
import { UserPreferencesProvider } from '../hooks/useUserPreferences';
// Fix: Import jest-dom to extend Jest's `expect` with DOM matchers like .toBeInTheDocument()
import '@testing-library/jest-dom';

const AllTheProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ToastProvider>
      <AuthProvider>
        <UserPreferencesProvider>{children}</UserPreferencesProvider>
      </AuthProvider>
    </ToastProvider>
  );
};

const customRender = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) => render(ui, { wrapper: AllTheProviders, ...options });

// re-export everything
export * from '@testing-library/react';

// override render method
export { customRender as renderWithProviders };