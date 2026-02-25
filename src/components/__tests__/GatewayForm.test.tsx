/**
 * @jest-environment jsdom
 *
 * GatewayForm Component Tests
 * Tests create/edit modes, token masking, validation, and connection testing
 */

// Mock convex/react first, before any imports
jest.mock('convex/react', () => ({
  useMutation: jest.fn(),
}));

// Mock @/convex/_generated/api
jest.mock('@/convex/_generated/api', () => ({
  api: {
    gateways: {
      createGateway: 'createGateway',
      updateGateway: 'updateGateway',
    },
  },
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Save: () => <div data-testid="save-icon">Save</div>,
  X: () => <div data-testid="x-icon">X</div>,
  Eye: () => <div data-testid="eye-icon">Eye</div>,
  EyeOff: () => <div data-testid="eye-off-icon">EyeOff</div>,
  Check: () => <div data-testid="check-icon">Check</div>,
  AlertCircle: () => <div data-testid="alert-circle-icon">AlertCircle</div>,
  Loader2: () => <div data-testid="loader-icon">Loader</div>,
}));

import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GatewayForm } from '../GatewayForm';
import { Id } from '@/convex/_generated/dataModel';
import { useMutation } from 'convex/react';

describe('GatewayForm Component', () => {
  const mockId = 'business_123' as Id<'workspaces'>;
  const mockOnClose = jest.fn();
  const mockOnSuccess = jest.fn();

  const mockGateway = {
    _id: 'gateway_123' as Id<'gateways'>,
    name: 'Production Gateway',
    url: 'wss://gateway.example.com:443',
    token: 'secret-token-12345',
    workspaceRoot: '/workspace',
    disableDevicePairing: false,
    allowInsecureTls: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useMutation as jest.Mock).mockReturnValue(jest.fn());
  });

  describe('Create Mode (no gateway prop)', () => {
    it('renders create form with empty fields', () => {
      render(
        <GatewayForm
          workspaceId={mockId}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const nameInput = screen.getByPlaceholderText(/Production Gateway/i) as HTMLInputElement;
      const urlInput = screen.getByPlaceholderText(/gateway.example.com/) as HTMLInputElement;
      const tokenInput = screen.getByPlaceholderText(/Leave empty if no auth/) as HTMLInputElement;

      expect(nameInput.value).toBe('');
      expect(urlInput.value).toBe('wss://');
      expect(tokenInput.value).toBe('');
    });

    it('submit button shows "Create Gateway"', () => {
      render(
        <GatewayForm
          workspaceId={mockId}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByRole('button', { name: /Create Gateway/i })).toBeInTheDocument();
    });
  });

  describe('Edit Mode (with gateway prop)', () => {
    it('renders form with pre-populated fields from gateway prop', () => {
      render(
        <GatewayForm
          workspaceId={mockId}
          gateway={mockGateway}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const nameInput = screen.getByDisplayValue('Production Gateway') as HTMLInputElement;
      const urlInput = screen.getByDisplayValue('wss://gateway.example.com:443') as HTMLInputElement;
      const workspaceInput = screen.getByDisplayValue('/workspace') as HTMLInputElement;

      expect(nameInput).toBeInTheDocument();
      expect(urlInput).toBeInTheDocument();
      expect(workspaceInput).toBeInTheDocument();
    });

    it('submit button shows "Save Changes" in edit mode', () => {
      render(
        <GatewayForm
          workspaceId={mockId}
          gateway={mockGateway}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByRole('button', { name: /Save Changes/i })).toBeInTheDocument();
    });
  });

  describe('Token Field Masking', () => {
    it('token input has type="password" by default', () => {
      render(
        <GatewayForm
          workspaceId={mockId}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const tokenInput = screen.getByPlaceholderText(/Leave empty if no auth/) as HTMLInputElement;
      expect(tokenInput.type).toBe('password');
    });

    it('shows Eye/EyeOff toggle button next to token field', () => {
      render(
        <GatewayForm
          workspaceId={mockId}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      // Should have an eye toggle button
      const toggleButton = screen.getByRole('button', { name: /toggle.*token|show.*token/i });
      expect(toggleButton).toBeInTheDocument();
    });

    it('clicking Eye button toggles token field to type="text"', async () => {
      render(
        <GatewayForm
          workspaceId={mockId}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const tokenInput = screen.getByPlaceholderText(/Leave empty if no auth/) as HTMLInputElement;
      const toggleButton = screen.getByRole('button', { name: /toggle.*token|show.*token/i });

      // Initially password
      expect(tokenInput.type).toBe('password');

      // Click to show
      fireEvent.click(toggleButton);
      expect(tokenInput.type).toBe('text');

      // Click to hide
      fireEvent.click(toggleButton);
      expect(tokenInput.type).toBe('password');
    });

    it('in edit mode, shows masked placeholder when token exists but unchanged', () => {
      render(
        <GatewayForm
          workspaceId={mockId}
          gateway={mockGateway}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      // For existing gateway with token, should show masked version
      // This could be via placeholder or aria-label or data attribute
      const tokenInput = screen.getByDisplayValue('••••••••') as HTMLInputElement;
      expect(tokenInput).toBeInTheDocument();
    });
  });

  describe('URL Validation', () => {
    it('rejects URLs not starting with ws:// or wss://', async () => {
      const mockCreate = jest.fn();
      (useMutation as jest.Mock).mockReturnValue(mockCreate);

      render(
        <GatewayForm
          workspaceId={mockId}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      // Fill in form
      const nameInput = screen.getByPlaceholderText(/Production Gateway/i);
      const urlInput = screen.getByPlaceholderText(/gateway.example.com/);

      fireEvent.change(nameInput, { target: { value: 'Test Gateway' } });
      fireEvent.change(urlInput, { target: { value: 'https://invalid.com' } });

      // Submit
      const submitButton = screen.getByRole('button', { name: /Create Gateway/i });
      fireEvent.click(submitButton);

      // Should NOT call mutation (validation should reject it)
      // Give it time to validate
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('accepts valid ws:// URLs', async () => {
      const mockCreate = jest.fn().mockResolvedValue(undefined);
      (useMutation as jest.Mock).mockReturnValue(mockCreate);

      render(
        <GatewayForm
          workspaceId={mockId}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const nameInput = screen.getByPlaceholderText(/Production Gateway/i);
      const urlInput = screen.getByPlaceholderText(/gateway.example.com/);

      fireEvent.change(nameInput, { target: { value: 'Test Gateway' } });
      fireEvent.change(urlInput, { target: { value: 'ws://gateway.local:8080' } });

      const submitButton = screen.getByRole('button', { name: /Create Gateway/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockCreate).toHaveBeenCalled();
      });
    });
  });

  describe('Form Submission', () => {
    it('calls createGateway mutation in create mode', async () => {
      const mockCreate = jest.fn().mockResolvedValue(undefined);
      (useMutation as jest.Mock).mockReturnValue(mockCreate);

      render(
        <GatewayForm
          workspaceId={mockId}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const nameInput = screen.getByPlaceholderText(/Production Gateway/i);
      const urlInput = screen.getByPlaceholderText(/gateway.example.com/);

      fireEvent.change(nameInput, { target: { value: 'My Gateway' } });
      fireEvent.change(urlInput, { target: { value: 'wss://example.com' } });

      const submitButton = screen.getByRole('button', { name: /Create Gateway/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            workspaceId: mockId,
            name: 'My Gateway',
            url: 'wss://example.com',
          })
        );
      });
    });

    it('calls updateGateway mutation in edit mode', async () => {
      const mockUpdate = jest.fn().mockResolvedValue(undefined);
      (useMutation as jest.Mock).mockReturnValue(mockUpdate);

      render(
        <GatewayForm
          workspaceId={mockId}
          gateway={mockGateway}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const nameInput = screen.getByDisplayValue('Production Gateway');
      fireEvent.change(nameInput, { target: { value: 'Updated Gateway' } });

      const submitButton = screen.getByRole('button', { name: /Save Changes/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            gatewayId: mockGateway._id,
            name: 'Updated Gateway',
          })
        );
      });
    });

    it('shows loading spinner during submit', async () => {
      const mockCreate = jest.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );
      (useMutation as jest.Mock).mockReturnValue(mockCreate);

      render(
        <GatewayForm
          workspaceId={mockId}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const nameInput = screen.getByPlaceholderText(/Production Gateway/i);
      const urlInput = screen.getByPlaceholderText(/gateway.example.com/);

      fireEvent.change(nameInput, { target: { value: 'Test Gateway' } });
      fireEvent.change(urlInput, { target: { value: 'wss://example.com' } });

      const submitButton = screen.getByRole('button', { name: /Create Gateway/i }) as HTMLButtonElement;
      fireEvent.click(submitButton);

      // Should be disabled during submit
      expect(submitButton.disabled).toBe(true);

      await waitFor(() => {
        expect(mockCreate).toHaveBeenCalled();
      });
    });

    it('calls onSuccess callback after successful submit', async () => {
      const mockCreate = jest.fn().mockResolvedValue(undefined);
      (useMutation as jest.Mock).mockReturnValue(mockCreate);

      render(
        <GatewayForm
          workspaceId={mockId}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const nameInput = screen.getByPlaceholderText(/Production Gateway/i);
      const urlInput = screen.getByPlaceholderText(/gateway.example.com/);

      fireEvent.change(nameInput, { target: { value: 'Test Gateway' } });
      fireEvent.change(urlInput, { target: { value: 'wss://example.com' } });

      const submitButton = screen.getByRole('button', { name: /Create Gateway/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
        expect(mockOnClose).toHaveBeenCalled();
      });
    });
  });

  describe('Test Connection Button', () => {
    it('renders Test Connection button in the form', () => {
      render(
        <GatewayForm
          workspaceId={mockId}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByRole('button', { name: /Test Connection/i })).toBeInTheDocument();
    });

    it('clicking Test Connection shows loading state', async () => {
      global.fetch = jest.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: async () => ({ success: true, latencyMs: 10 }),
        }), 100))
      );

      render(
        <GatewayForm
          workspaceId={mockId}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const testButton = screen.getByRole('button', { name: /Test Connection/i });
      fireEvent.click(testButton);

      // Should show loading indicator
      await waitFor(() => {
        expect(screen.getByText(/Testing Connection/)).toBeInTheDocument();
      });
    });

    it('displays success badge when connection succeeds', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, latencyMs: 45 }),
      });

      render(
        <GatewayForm
          workspaceId={mockId}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const urlInput = screen.getByPlaceholderText(/gateway.example.com/);
      fireEvent.change(urlInput, { target: { value: 'wss://example.com' } });

      const testButton = screen.getByRole('button', { name: /Test Connection/i });
      fireEvent.click(testButton);

      await waitFor(() => {
        expect(screen.getByText(/Connected.*45/)).toBeInTheDocument();
      });
    });

    it('displays error badge when connection fails', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: false, error: 'Connection refused' }),
      });

      render(
        <GatewayForm
          workspaceId={mockId}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const urlInput = screen.getByPlaceholderText(/gateway.example.com/);
      fireEvent.change(urlInput, { target: { value: 'wss://invalid.local' } });

      const testButton = screen.getByRole('button', { name: /Test Connection/i });
      fireEvent.click(testButton);

      await waitFor(() => {
        expect(screen.getByText(/✗.*Connection refused/)).toBeInTheDocument();
      });
    });
  });

  describe('Name Field Validation', () => {
    it('rejects empty name', async () => {
      const mockCreate = jest.fn();
      (useMutation as jest.Mock).mockReturnValue(mockCreate);

      render(
        <GatewayForm
          workspaceId={mockId}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const urlInput = screen.getByPlaceholderText(/gateway.example.com/);
      fireEvent.change(urlInput, { target: { value: 'wss://example.com' } });

      const submitButton = screen.getByRole('button', { name: /Create Gateway/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Gateway name is required/i)).toBeInTheDocument();
      });
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });
});
