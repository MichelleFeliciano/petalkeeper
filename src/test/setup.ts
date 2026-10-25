import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';

beforeEach(() => {
  localStorage.setItem('petalkeeper.toured', '1');
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});
window.scrollTo = () => {};
