/**
 * Jest Setup File
 * Provides global polyfills for Node.js APIs used in tests
 */

// Mock Convex modules for backend testing
jest.mock('convex/values', () => ({
  ConvexError: class ConvexError extends Error {
    constructor(message) {
      super(message);
      this.name = 'ConvexError';
    }
  },
  v: {
    string: () => ({}),
    id: () => ({}),
    number: () => ({}),
    boolean: () => ({}),
    array: () => ({}),
    union: () => ({}),
    literal: () => ({}),
    optional: () => ({}),
    object: () => ({}),
    any: () => ({}),
  },
}));

jest.mock('convex/server', () => ({
  mutation: (config) => config,
  query: (config) => config,
}));

// Polyfill Request for jsdom environment (needed for API route tests)
if (typeof global.Request === 'undefined') {
  global.Request = class Request {
    constructor(url, init) {
      this.url = url;
      this.method = init?.method || 'GET';
      this.headers = new Map(Object.entries(init?.headers || {}));
      this.body = init?.body;
    }

    get(key) {
      return this.headers.get(key);
    }
  };
}

// Polyfill Response for jsdom environment
if (typeof global.Response === 'undefined') {
  global.Response = class Response {
    constructor(body, init) {
      this.body = body;
      this.status = init?.status || 200;
      this.statusText = init?.statusText || 'OK';
      this.headers = new Map(Object.entries(init?.headers || {}));
    }

    async json() {
      return typeof this.body === 'string' ? JSON.parse(this.body) : this.body;
    }
  };
}
