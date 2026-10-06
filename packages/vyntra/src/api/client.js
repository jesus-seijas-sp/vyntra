// The `api` fixture: an HTTP client over Node's fetch for API tests. JSON in and out by default, a base URL, headers
// and cookies kept for the test, and every exchange recorded so a failing test's page shows what was sent and
// what came back.

// Node's own, taken as vyntra loads: a document environment (happy-dom, jsdom) replaces the globals with its own.
const { fetch, FormData, Blob, URLSearchParams, AbortSignal, performance } = globalThis;

const MAX_BODY = 4_000;
const SECRET_HEADERS = new Set(['authorization', 'cookie', 'set-cookie', 'proxy-authorization', 'x-api-key']);

const truncate = (text) => (text.length > MAX_BODY ? `${text.slice(0, MAX_BODY)}… (${text.length} characters)` : text);

const redact = (headers) =>
  Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [
      name,
      SECRET_HEADERS.has(name.toLowerCase()) ? '[redacted]' : value,
    ])
  );

const isJson = (contentType) => /[/+]json\b/i.test(contentType ?? '');

// What a body is sent as: strings, binary data and forms as they are, anything else as JSON.
function encode(body) {
  if (body === undefined) {
    return { body: undefined, type: null };
  }
  const raw =
    typeof body === 'string' ||
    body instanceof URLSearchParams ||
    body instanceof FormData ||
    body instanceof Blob ||
    body instanceof ArrayBuffer ||
    ArrayBuffer.isView(body);
  return raw ? { body, type: null } : { body: JSON.stringify(body), type: 'application/json' };
}

const describeBody = (body) => {
  if (body === undefined) {
    return undefined;
  }
  return typeof body === 'string' ? truncate(body) : `(${body.constructor?.name ?? typeof body})`;
};

// A path from the base URL: joined to its path ("http://host/api" and "/users" make "http://host/api/users"),
// which is what an API test means; an absolute URL stays as it is.
function resolveUrl(path, baseURL, query) {
  let url;
  if (/^[a-z][a-z\d+.-]*:/i.test(path)) {
    url = new URL(path);
  } else if (!baseURL) {
    throw new Error(`api: "${path}" is not a full URL, and there is no baseURL (set use.baseURL, or a server)`);
  } else {
    const base = new URL(baseURL);
    const [pathname, search = ''] = path.split('?');
    base.pathname = `${base.pathname.replace(/\/$/, '')}/${pathname.replace(/^\//, '')}`;
    base.search = search;
    url = base;
  }
  Object.entries(query ?? {}).forEach(([key, value]) => {
    [value].flat().forEach((one) => url.searchParams.append(key, String(one)));
  });
  return url;
}

// Cookies the server set, sent back on the next requests of the test.
function storeCookies(jar, response) {
  (response.headers.getSetCookie?.() ?? []).forEach((line) => {
    const [pair, ...attributes] = line.split(';');
    const index = pair.indexOf('=');
    const name = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    const expired = attributes.some((attribute) => {
      const [key, setting = ''] = attribute.split('=').map((part) => part.trim());
      return (
        (key.toLowerCase() === 'max-age' && Number(setting) <= 0) ||
        (key.toLowerCase() === 'expires' && Date.parse(setting) < Date.now())
      );
    });
    if (expired) {
      jar.delete(name);
    } else if (name) {
      jar.set(name, value);
    }
  });
}

class ApiClient {
  // record(exchange): where the exchanges go; signal: aborted when the test ends.
  constructor({ baseURL, headers = {}, record = () => {}, signal } = {}) {
    this.baseURL = baseURL;
    this.headers = { ...headers };
    this.cookies = new Map();
    this.record = record;
    this.signal = signal;
  }

  async request(method, path, { body, headers = {}, query, timeout } = {}) {
    const url = resolveUrl(path, this.baseURL, query);
    const encoded = encode(body);
    const sent = { ...this.headers, ...headers };
    const names = new Set(Object.keys(sent).map((name) => name.toLowerCase()));
    if (encoded.type && !names.has('content-type')) {
      sent['content-type'] = encoded.type;
    }
    if (!names.has('accept')) {
      sent.accept = 'application/json, */*';
    }
    if (this.cookies.size > 0 && !names.has('cookie')) {
      sent.cookie = [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
    }
    const request = { method, url: url.href, headers: redact(sent), body: describeBody(encoded.body) };
    const signals = [this.signal, timeout ? AbortSignal.timeout(timeout) : null].filter(Boolean);
    const start = performance.now();
    let response;
    try {
      response = await fetch(url, {
        method,
        headers: sent,
        body: encoded.body,
        redirect: 'manual',
        signal: signals.length > 0 ? AbortSignal.any(signals) : undefined,
      });
    } catch (error) {
      this.record({ request, error: error.cause?.message ?? error.message });
      throw new Error(`api: ${method} ${url.href} failed: ${error.cause?.message ?? error.message}`, { cause: error });
    }
    storeCookies(this.cookies, response);
    const text = await response.text();
    const contentType = response.headers.get('content-type');
    let parsed = text;
    if (isJson(contentType) && text !== '') {
      try {
        parsed = JSON.parse(text);
      } catch {
        // Not the JSON it claims to be: kept as text, for the test to see.
      }
    }
    const result = {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: response.headers,
      body: parsed,
      text,
      url: url.href,
      method,
      duration: performance.now() - start,
    };
    Object.defineProperty(result, 'isApiResponse', { value: true });
    this.record({
      request,
      response: {
        status: response.status,
        headers: redact(Object.fromEntries(response.headers)),
        body: truncate(text),
      },
      duration: Math.round(result.duration),
    });
    return result;
  }

  get(path, options) {
    return this.request('GET', path, options);
  }

  head(path, options) {
    return this.request('HEAD', path, options);
  }

  delete(path, options) {
    return this.request('DELETE', path, options);
  }

  post(path, body, options) {
    return this.request('POST', path, { ...options, body });
  }

  put(path, body, options) {
    return this.request('PUT', path, { ...options, body });
  }

  patch(path, body, options) {
    return this.request('PATCH', path, { ...options, body });
  }
}

module.exports = { ApiClient, resolveUrl };
