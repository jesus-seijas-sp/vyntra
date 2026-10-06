const { browserOptions } = require('../src/browser/runner');
const { capabilitiesOf } = require('../src/browser/providers/webdriverio');

describe('browserOptions', () => {
  it('reads vitest 2 (name), 3 (instances, providerOptions) and 4 (provider factories) configs', () => {
    expect(browserOptions({ browser: { name: 'firefox', provider: 'playwright' } })).toMatchObject({
      provider: 'playwright',
      name: 'firefox',
      headless: true,
    });
    expect(
      browserOptions({
        browser: {
          provider: 'webdriverio',
          headless: false,
          providerOptions: { logLevel: 'warn' },
          instances: [{ browser: 'firefox', capabilities: { acceptInsecureCerts: true } }],
        },
      })
    ).toMatchObject({
      provider: 'webdriverio',
      name: 'firefox',
      headless: false,
      providerOptions: { logLevel: 'warn', capabilities: { acceptInsecureCerts: true } },
    });
    const factory = { name: 'webdriverio', options: { capabilities: { 'goog:chromeOptions': { args: ['lang=es'] } } } };
    expect(browserOptions({ browser: { provider: factory, instances: [{ browser: 'chrome' }] } })).toMatchObject({
      provider: 'webdriverio',
      name: 'chrome',
      providerOptions: factory.options,
    });
    expect(browserOptions({ browser: { provider: { name: 'webdriverio', options: {} } } }).name).toBe('chrome');
  });

  it('says which providers it runs', () => {
    expect(() => browserOptions({ browser: { provider: 'puppeteer' } })).toThrow(
      'browser.provider puppeteer: vyntra runs browser mode on Playwright or WebdriverIO'
    );
  });
});

describe('WebdriverIO capabilities', () => {
  const options = (more) => ({ headless: true, explicitHeadless: false, providerOptions: {}, ...more });

  it("adds the browser's headless arguments to the project's own", () => {
    expect(
      capabilitiesOf(
        'chrome',
        options({ providerOptions: { capabilities: { 'goog:chromeOptions': { args: ['lang=es'], binary: '/c' } } } })
      )
    ).toEqual({
      browserName: 'chrome',
      'goog:chromeOptions': { args: ['lang=es', 'headless=new', 'disable-gpu'], binary: '/c' },
    });
    expect(capabilitiesOf('edge', options())).toEqual({
      browserName: 'MicrosoftEdge',
      'ms:edgeOptions': { args: ['--headless'] },
    });
    expect(capabilitiesOf('firefox', options({ headless: false }))).toEqual({ browserName: 'firefox' });
  });

  it('runs Safari with a window, which it needs, unless headless was asked for', () => {
    expect(capabilitiesOf('safari', options())).toEqual({ browserName: 'safari' });
    expect(() => capabilitiesOf('safari', options({ explicitHeadless: true }))).toThrow('Safari has no headless mode');
  });
});
