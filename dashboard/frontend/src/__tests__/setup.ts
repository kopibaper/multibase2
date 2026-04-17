import '@testing-library/jest-dom';

// Mock import.meta.env for Vite
Object.defineProperty(globalThis, 'import', {
  value: {
    meta: {
      env: {
        VITE_API_URL: 'http://localhost:3001',
        MODE: 'test',
        DEV: true,
      },
    },
  },
  writable: true,
});
