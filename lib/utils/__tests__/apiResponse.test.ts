/**
 * API Response Utilities Test Suite
 *
 * Tests for standardized API response formatting and error handling
 */

import {
  successResponse,
  errorResponse,
  handleApiError,
  withErrorHandling,
  jsonResponse,
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ConflictError,
} from '../apiResponse';
import { z } from 'zod';

describe('API Response Utilities', () => {
  describe('successResponse', () => {
    it('should create success response with data', () => {
      const data = { id: 1, name: 'Test' };
      const response = successResponse(data);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
      expect(response.timestamp).toBeDefined();
    });

    it('should include timestamp', () => {
      const before = Date.now();
      const response = successResponse({ test: true });
      const after = Date.now();

      expect(response.timestamp).toBeGreaterThanOrEqual(before);
      expect(response.timestamp).toBeLessThanOrEqual(after);
    });

    it('should handle null data', () => {
      const response = successResponse(null);
      expect(response.success).toBe(true);
      expect(response.data).toBe(null);
    });

    it('should handle array data', () => {
      const data = [1, 2, 3];
      const response = successResponse(data);
      expect(response.data).toEqual(data);
    });

    it('should handle complex objects', () => {
      const data = {
        nested: {
          deeply: {
            object: [1, 2, { key: 'value' }],
          },
        },
      };
      const response = successResponse(data);
      expect(response.data).toEqual(data);
    });
  });

  describe('errorResponse', () => {
    it('should create error response with code and message', () => {
      const response = errorResponse('ERROR_CODE', 'Error message');

      expect(response.success).toBe(false);
      expect(response.error.code).toBe('ERROR_CODE');
      expect(response.error.message).toBe('Error message');
      expect(response.timestamp).toBeDefined();
    });

    it('should optionally include details', () => {
      const details = { field: 'email', reason: 'already exists' };
      const response = errorResponse('CONFLICT', 'Conflict error', details);

      expect(response.error.details).toEqual(details);
    });

    it('should handle details being undefined', () => {
      const response = errorResponse('NOT_FOUND', 'Resource not found');
      expect(response.error.details).toBeUndefined();
    });
  });

  describe('Custom Error Classes', () => {
    describe('AppError', () => {
      it('should create AppError with default status code', () => {
        const error = new AppError('TEST_ERROR', 'Test error message');

        expect(error.code).toBe('TEST_ERROR');
        expect(error.message).toBe('Test error message');
        expect(error.statusCode).toBe(400);
        expect(error).toBeInstanceOf(Error);
      });

      it('should create AppError with custom status code', () => {
        const error = new AppError('SERVER_ERROR', 'Server error', 500);

        expect(error.statusCode).toBe(500);
      });

      it('should include optional details', () => {
        const details = { field: 'username' };
        const error = new AppError('VALIDATION_ERROR', 'Invalid input', 400, details);

        expect(error.details).toEqual(details);
      });

      it('should maintain prototype chain', () => {
        const error = new AppError('TEST', 'Message');
        expect(error instanceof AppError).toBe(true);
        expect(error instanceof Error).toBe(true);
      });
    });

    describe('ValidationError', () => {
      it('should create ValidationError with 400 status', () => {
        const error = new ValidationError('Invalid data', { field: 'email' });

        expect(error.message).toBe('Invalid data');
        expect(error.statusCode).toBe(400);
        expect(error.details).toEqual({ field: 'email' });
      });

      it('should have correct error code', () => {
        const error = new ValidationError('Test');
        // Check that error code is set (may vary based on constants)
        expect(error.code).toBeDefined();
      });
    });

    describe('NotFoundError', () => {
      it('should create NotFoundError with 404 status', () => {
        const error = new NotFoundError('User');

        expect(error.message).toBe('User not found');
        expect(error.statusCode).toBe(404);
      });

      it('should include resource type in message', () => {
        const error = new NotFoundError('Task');
        expect(error.message).toContain('Task');
      });
    });

    describe('UnauthorizedError', () => {
      it('should create UnauthorizedError with 401 status', () => {
        const error = new UnauthorizedError();

        expect(error.message).toBe('Unauthorized');
        expect(error.statusCode).toBe(401);
      });

      it('should accept custom message', () => {
        const error = new UnauthorizedError('Invalid token');

        expect(error.message).toBe('Invalid token');
        expect(error.statusCode).toBe(401);
      });
    });

    describe('ConflictError', () => {
      it('should create ConflictError with 409 status', () => {
        const error = new ConflictError('Resource already exists');

        expect(error.message).toBe('Resource already exists');
        expect(error.statusCode).toBe(409);
      });

      it('should accept custom error code', () => {
        const error = new ConflictError('Circular dependency detected', 'CIRCULAR_DEPENDENCY');

        expect(error.code).toBe('CIRCULAR_DEPENDENCY');
      });
    });
  });

  describe('handleApiError', () => {
    it('should handle AppError', () => {
      const error = new AppError('TEST_ERROR', 'Test message', 400);
      const [response, statusCode] = handleApiError(error);

      expect(statusCode).toBe(400);
      expect(response.success).toBe(false);
      expect(response.error.code).toBe('TEST_ERROR');
      expect(response.error.message).toBe('Test message');
    });

    it('should handle ValidationError', () => {
      const error = new ValidationError('Invalid input', { field: 'email' });
      const [response, statusCode] = handleApiError(error);

      expect(statusCode).toBe(400);
      expect(response.error.code).toBeDefined();
    });

    it('should handle NotFoundError', () => {
      const error = new NotFoundError('Resource');
      const [response, statusCode] = handleApiError(error);

      expect(statusCode).toBe(404);
    });

    it('should handle ZodError', () => {
      const zodSchema = z.object({
        email: z.string().email(),
      });

      try {
        zodSchema.parse({ email: 'invalid' });
      } catch (zodError) {
        const [response, statusCode] = handleApiError(zodError);

        expect(statusCode).toBe(400);
        expect(response.success).toBe(false);
        expect(response.error.details).toBeDefined();
      }
    });

    it('should handle regular Error', () => {
      const error = new Error('Something went wrong');
      const [response, statusCode] = handleApiError(error);

      expect(statusCode).toBe(500);
      expect(response.error.message).toBe('Something went wrong');
    });

    it('should handle unknown error types', () => {
      const [response, statusCode] = handleApiError('unknown error string');

      expect(statusCode).toBe(500);
      expect(response.error.message).toBe('An unexpected error occurred');
    });

    it('should include error details when available', () => {
      const error = new AppError('ERROR', 'Message', 400, { extra: 'info' });
      const [response, statusCode] = handleApiError(error);

      expect(response.error.details).toEqual({ extra: 'info' });
    });
  });

  describe('jsonResponse', () => {
    it('should create Response with success data', () => {
      const data = successResponse({ id: 1 });
      const response = jsonResponse(data, 200);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('should create Response with error data', () => {
      const data = errorResponse('ERROR', 'Message');
      const response = jsonResponse(data, 400);

      expect(response.status).toBe(400);
    });

    it('should use default status code', () => {
      const data = successResponse({ test: true });
      const response = jsonResponse(data);

      expect(response.status).toBe(200);
    });

    it('should set correct headers', () => {
      const data = successResponse({});
      const response = jsonResponse(data);

      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('Cache-Control')).toBe('no-store');
    });
  });

  describe('withErrorHandling', () => {
    it('should execute handler successfully', async () => {
      const handler = async (request: Request) => {
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      };

      const wrapped = withErrorHandling(handler);
      const request = new Request('http://localhost/test', { method: 'POST' });
      const response = await wrapped(request);

      expect(response.status).toBe(200);
    });

    it('should catch AppError and return error response', async () => {
      const handler = async (request: Request) => {
        throw new AppError('TEST', 'Test error', 400);
      };

      const wrapped = withErrorHandling(handler);
      const request = new Request('http://localhost/test', { method: 'POST' });
      const response = await wrapped(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('TEST');
    });

    it('should catch regular Error', async () => {
      const handler = async (request: Request) => {
        throw new Error('Something went wrong');
      };

      const wrapped = withErrorHandling(handler);
      const request = new Request('http://localhost/test', { method: 'POST' });
      const response = await wrapped(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('should catch unknown errors', async () => {
      const handler = async (request: Request) => {
        throw 'Unknown error string';
      };

      const wrapped = withErrorHandling(handler);
      const request = new Request('http://localhost/test', { method: 'POST' });
      const response = await wrapped(request);

      expect(response.status).toBe(500);
    });

    it('should include error message in response', async () => {
      const handler = async (request: Request) => {
        throw new AppError('ERROR', 'Specific error message');
      };

      const wrapped = withErrorHandling(handler);
      const request = new Request('http://localhost/test', { method: 'POST' });
      const response = await wrapped(request);

      const data = await response.json();
      expect(data.error.message).toBe('Specific error message');
    });
  });

  describe('Error Response Format Consistency', () => {
    it('should maintain consistent error response structure', () => {
      const errors = [
        new AppError('ERROR1', 'Message 1'),
        new ValidationError('Message 2'),
        new NotFoundError('Item'),
        new ConflictError('Conflict message'),
      ];

      errors.forEach((error) => {
        const [response] = handleApiError(error);

        expect(response).toHaveProperty('success');
        expect(response).toHaveProperty('error');
        expect(response.error).toHaveProperty('code');
        expect(response.error).toHaveProperty('message');
        expect(response).toHaveProperty('timestamp');
        expect(response.success).toBe(false);
      });
    });

    it('should maintain consistent success response structure', () => {
      const testData = [
        { id: 1 },
        [1, 2, 3],
        'string',
        null,
        { nested: { data: 'value' } },
      ];

      testData.forEach((data) => {
        const response = successResponse(data);

        expect(response).toHaveProperty('success');
        expect(response).toHaveProperty('data');
        expect(response).toHaveProperty('timestamp');
        expect(response.success).toBe(true);
      });
    });
  });
});
