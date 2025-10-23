// __tests__/setup.ts
import { jest } from '@jest/globals';
import '@testing-library/jest-dom';
import 'fake-indexeddb/auto'; // Mocks indexedDB for dbService tests

// Mock for URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = jest.fn(() => 'mock-object-url');
global.URL.revokeObjectURL = jest.fn();

// Mock for navigator.mediaDevices used in useAudioRecorder
if (!global.navigator.mediaDevices) {
  (global.navigator as any).mediaDevices = {};
}
(global.navigator.mediaDevices as any).getUserMedia = jest.fn().mockImplementation(() =>
  Promise.resolve({
    getTracks: () => [{ stop: jest.fn() }],
  } as unknown as MediaStream),
);

// Mock for MediaRecorder API used in useAudioRecorder
class MockMediaRecorder {
    ondataavailable: ((event: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    onstart: (() => void) | null = null;
    state: 'inactive' | 'recording' | 'paused' = 'inactive';
    mimeType: string;

    constructor(stream: MediaStream, options?: { mimeType: string }) {
        this.mimeType = options?.mimeType || 'audio/webm';
    }

    start() {
        this.state = 'recording';
        this.onstart?.();
        // Simulate data becoming available shortly after starting
        setTimeout(() => {
            if (this.ondataavailable) {
                const blob = new Blob(['mock audio data'], { type: this.mimeType });
                this.ondataavailable({ data: blob });
            }
        }, 10);
    }

    stop() {
        this.state = 'inactive';
        this.onstop?.();
    }

    static isTypeSupported(type: string) {
        return type.startsWith('audio/');
    }
}

global.MediaRecorder = MockMediaRecorder as unknown as typeof MediaRecorder;

// Mock for localStorage used in useUserPreferences
const localStorageMock = (() => {
  let store: { [key: string]: string } = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    length: Object.keys(store).length,
    key: (index: number) => Object.keys(store)[index] || null,
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});


// Mock for matchMedia for responsive component tests if needed
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(), // deprecated
      removeListener: jest.fn(), // deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
});
