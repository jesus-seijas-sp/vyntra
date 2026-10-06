import { defineConfig } from 'vitest/config';
import { webdriverio } from '@vitest/browser-webdriverio';

export default defineConfig({
  test: {
    include: ['**/*.test.js'],
    browser: { enabled: true, provider: webdriverio(), instances: [{ browser: 'chrome' }] },
  },
});
