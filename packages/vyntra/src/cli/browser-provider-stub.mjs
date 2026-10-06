// What a vitest config imports from @vitest/browser-playwright, -webdriverio or -preview, served to it while vyntra
// loads it: the provider's name and its options, which is what browser mode reads of them.

const provider =
  (name) =>
  (options = {}) => ({ name, options });

export const playwright = provider('playwright');
export const webdriverio = provider('webdriverio');
export const preview = provider('preview');
