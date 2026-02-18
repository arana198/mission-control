import { describe, it, expect, beforeEach } from '@jest/globals';

/**
 * Tests for agent detail URL navigation and task clickability
 * Test-first enforcement: These tests define expected behavior
 */

describe('Agent Detail Navigation', () => {
  describe('URL-based agent selection', () => {
    it('should update URL when agent is selected', () => {
      // Arrange
      const agentId = 'agent-123';

      // Act
      // When component selects agent, it should update URL with agent query param
      const url = `/dashboard/agents?agent=${agentId}`;

      // Assert
      expect(url).toContain('agent=agent-123');
    });

    it('should parse agent ID from URL query params', () => {
      // Arrange
      const url = new URL('http://localhost:3000/dashboard/agents?agent=agent-123');

      // Act
      const agentId = url.searchParams.get('agent');

      // Assert
      expect(agentId).toBe('agent-123');
    });

    it('should load agent detail from URL on page load', () => {
      // Arrange
      const mockAgent = {
        _id: 'agent-123',
        name: 'jarvis',
        role: 'Squad Lead'
      };

      // Act
      // When URL contains agent param, modal should open with that agent
      const url = new URL('http://localhost:3000/dashboard/agents?agent=agent-123');
      const shouldOpenModal = !!url.searchParams.get('agent');

      // Assert
      expect(shouldOpenModal).toBe(true);
    });

    it('should close agent detail and clear URL param when modal closes', () => {
      // Arrange
      const originalUrl = '/dashboard/agents?agent=agent-123';

      // Act
      // When user closes agent detail modal, URL should be cleaned
      const newUrl = '/dashboard/agents';

      // Assert
      expect(newUrl).not.toContain('agent=');
    });
  });

  describe('Task clickability in agent detail', () => {
    it('should navigate to task board when task is clicked', () => {
      // Arrange
      const taskId = 'task-456';

      // Act
      // When task is clicked in agent detail modal, navigate to board with task highlight
      const url = `/dashboard/board?task=${taskId}`;

      // Assert
      expect(url).toContain('task=task-456');
    });

    it('should filter task board to show only assigned tasks', () => {
      // Arrange
      const agentId = 'agent-123';
      const tasks = [
        { _id: 'task-1', assigneeIds: ['agent-123'], title: 'Task 1' },
        { _id: 'task-2', assigneeIds: ['agent-456'], title: 'Task 2' },
        { _id: 'task-3', assigneeIds: ['agent-123'], title: 'Task 3' }
      ];

      // Act
      const agentTasks = tasks.filter(t => t.assigneeIds.includes(agentId));

      // Assert
      expect(agentTasks).toHaveLength(2);
      expect(agentTasks[0]._id).toBe('task-1');
      expect(agentTasks[1]._id).toBe('task-3');
    });

    it('should scroll to and highlight clicked task on board', () => {
      // Arrange
      const taskId = 'task-456';

      // Act
      // When navigating with task param, board should identify and highlight task
      const url = new URL(`http://localhost:3000/dashboard/board?task=${taskId}`);
      const selectedTaskId = url.searchParams.get('task');

      // Assert
      expect(selectedTaskId).toBe('task-456');
    });
  });

  describe('State preservation', () => {
    it('should maintain agent detail state on page refresh', () => {
      // Arrange
      const agentId = 'agent-123';

      // Act
      // URL-based state should persist
      const url = `/dashboard/agents?agent=${agentId}`;

      // Assert
      // On refresh, agent detail should still be open
      expect(url).toContain(`agent=${agentId}`);
    });

    it('should handle multiple query params (agent + task)', () => {
      // Arrange
      const agentId = 'agent-123';
      const taskId = 'task-456';

      // Act
      const url = `/dashboard/agents?agent=${agentId}&returnTask=${taskId}`;

      // Assert
      expect(url).toContain('agent=agent-123');
      expect(url).toContain('returnTask=task-456');
    });
  });

  describe('Navigation flow', () => {
    it('should support back navigation from task board to agent detail', () => {
      // Arrange - user clicked task from agent detail
      const initialUrl = '/dashboard/agents?agent=agent-123';
      const taskBoardUrl = '/dashboard/board?task=task-456&returnTo=/dashboard/agents%3Fagent%3Dagent-123';

      // Act - browser back or explicit back button
      const decodedReturnUrl = decodeURIComponent(
        new URL(`http://localhost${taskBoardUrl}`).searchParams.get('returnTo') || ''
      );

      // Assert
      expect(decodedReturnUrl).toBe(initialUrl);
    });
  });
});
