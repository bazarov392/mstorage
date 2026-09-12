import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        projects: [
            {
                test: {
                    name: 'unit',
                    environment: 'node',
                    include: ['tests/**/*.unit.test.ts'],
                    restoreMocks: true,
                    unstubGlobals: true,
                },
            },
            {
                test: {
                    include: ['tests/**/*.browser.test.ts'],
                    // Web Storage is shared within an origin. Keep suites sequential.
                    fileParallelism: false,
                    browser: {
                        enabled: true,
                        headless: true,
                        provider: playwright(),
                        instances: [
                            { browser: 'chromium', name: 'chromium' },
                            { browser: 'firefox', name: 'firefox' },
                            {
                                browser: 'webkit',
                                name: 'webkit',
                                // WebKit OPFS needs an on-disk profile. Suites clean up their own scopes.
                                provider: playwright({
                                    persistentContext:
                                        './node_modules/.cache/vitest-webkit',
                                }),
                            },
                        ],
                    },
                },
            },
        ],
    },
});
