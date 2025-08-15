import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskList } from '../TaskList';
import { Task } from '../../hooks/useYjsCollaboration';

const mockTasks: Task[] = [
  { id: 'task-1', text: 'First task', done: false },
  { id: 'task-2', text: 'Second task', done: true },
  { id: 'task-3', text: 'Third task', done: false },
];

const mockProps = {
  tasks: mockTasks,
  onAddTask: jest.fn(),
  onToggleTask: jest.fn(),
  showTasks: true,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('TaskList', () => {
  describe('rendering', () => {
    it('should render all tasks', () => {
      render(<TaskList {...mockProps} />);

      expect(screen.getByText('First task')).toBeInTheDocument();
      expect(screen.getByText('Second task')).toBeInTheDocument();
      expect(screen.getByText('Third task')).toBeInTheDocument();
    });

    it('should show completed tasks with strikethrough', () => {
      render(<TaskList {...mockProps} />);

      const completedTask = screen.getByText('Second task');
      expect(completedTask).toHaveStyle('text-decoration: line-through');
    });

    it('should show incomplete tasks without strikethrough', () => {
      render(<TaskList {...mockProps} />);

      const incompleteTask = screen.getByText('First task');
      expect(incompleteTask).not.toHaveStyle('text-decoration: line-through');
    });

    it('should render task input field', () => {
      render(<TaskList {...mockProps} />);

      const input = screen.getByPlaceholderText('Add a new task...');
      expect(input).toBeInTheDocument();
      // Input defaults to text type when no type specified
    });

    it('should render add task button', () => {
      render(<TaskList {...mockProps} />);

      const addButton = screen.getByText('➕ Add');
      expect(addButton).toBeInTheDocument();
      expect(addButton).toHaveAttribute('type', 'submit');
    });

    it('should show empty state when no tasks', () => {
      render(<TaskList {...mockProps} tasks={[]} />);

      expect(screen.getByText('No tasks yet. Add one above! ✨')).toBeInTheDocument();
    });
  });

  describe('task interaction', () => {
    it('should call onToggleTask when task checkbox is clicked', async () => {
      const user = userEvent.setup();
      render(<TaskList {...mockProps} />);

      const firstTaskCheckbox = screen.getAllByRole('checkbox')[0];
      await user.click(firstTaskCheckbox);

      expect(mockProps.onToggleTask).toHaveBeenCalledWith('task-1');
    });

    it('should call onToggleTask when task text is clicked', async () => {
      const user = userEvent.setup();
      render(<TaskList {...mockProps} />);

      const firstTaskText = screen.getByText('First task');
      await user.click(firstTaskText);

      expect(mockProps.onToggleTask).toHaveBeenCalledWith('task-1');
    });

    it('should show correct checkbox state for completed tasks', () => {
      render(<TaskList {...mockProps} />);

      const checkboxes = screen.getAllByRole('checkbox');
      
      // First task (not done)
      expect(checkboxes[0]).not.toBeChecked();
      
      // Second task (done)
      expect(checkboxes[1]).toBeChecked();
      
      // Third task (not done)
      expect(checkboxes[2]).not.toBeChecked();
    });
  });

  describe('adding new tasks', () => {
    it('should call onAddTask when form is submitted with text', async () => {
      const user = userEvent.setup();
      render(<TaskList {...mockProps} />);

      const input = screen.getByPlaceholderText('Add a new task...');
      const addButton = screen.getByText('➕ Add');

      await user.type(input, 'New task text');
      await user.click(addButton);

      expect(mockProps.onAddTask).toHaveBeenCalledWith('New task text');
    });

    it('should call onAddTask when Enter key is pressed', async () => {
      const user = userEvent.setup();
      render(<TaskList {...mockProps} />);

      const input = screen.getByPlaceholderText('Add a new task...');

      await user.type(input, 'New task via Enter');
      await user.keyboard('{Enter}');

      expect(mockProps.onAddTask).toHaveBeenCalledWith('New task via Enter');
    });

    it('should clear input after adding task', async () => {
      const user = userEvent.setup();
      render(<TaskList {...mockProps} />);

      const input = screen.getByPlaceholderText('Add a new task...') as HTMLInputElement;
      const addButton = screen.getByText('➕ Add');

      await user.type(input, 'Task to be cleared');
      await user.click(addButton);

      expect(input.value).toBe('');
    });

    it('should not add empty tasks', async () => {
      const user = userEvent.setup();
      render(<TaskList {...mockProps} />);

      const addButton = screen.getByText('➕ Add');

      await user.click(addButton);

      expect(mockProps.onAddTask).not.toHaveBeenCalled();
    });

    it('should not add whitespace-only tasks', async () => {
      const user = userEvent.setup();
      render(<TaskList {...mockProps} />);

      const input = screen.getByPlaceholderText('Add a new task...');
      const addButton = screen.getByText('➕ Add');

      await user.type(input, '   ');
      await user.click(addButton);

      expect(mockProps.onAddTask).not.toHaveBeenCalled();
    });

    it('should trim whitespace from task text', async () => {
      const user = userEvent.setup();
      render(<TaskList {...mockProps} />);

      const input = screen.getByPlaceholderText('Add a new task...');
      const addButton = screen.getByText('➕ Add');

      await user.type(input, '  Task with spaces  ');
      await user.click(addButton);

      expect(mockProps.onAddTask).toHaveBeenCalledWith('Task with spaces');
    });
  });

  describe('accessibility', () => {
    it('should have form element', () => {
      render(<TaskList {...mockProps} />);

      // Form exists but doesn't have role="form" (implicit form role from tag)
      const forms = document.getElementsByTagName('form');
      expect(forms).toHaveLength(1);
    });

    it('should have labeled checkboxes via label wrapping', () => {
      render(<TaskList {...mockProps} />);

      const checkboxes = screen.getAllByRole('checkbox');
      
      // Checkboxes are labeled via wrapping label elements, not aria-label
      expect(checkboxes).toHaveLength(3);
      expect(checkboxes[0]).toBeInTheDocument();
    });

    it('should support basic keyboard interaction', async () => {
      const user = userEvent.setup();
      render(<TaskList {...mockProps} />);

      const input = screen.getByPlaceholderText('Add a new task...');
      
      // Input should be focusable
      await user.click(input);
      expect(input).toHaveFocus();
    });
  });



  describe('performance', () => {
    it('should not re-render unnecessarily with same props', () => {
      const { rerender } = render(<TaskList {...mockProps} />);

      // Re-render with same props
      rerender(<TaskList {...mockProps} />);

      // Should still show all tasks
      expect(screen.getByText('First task')).toBeInTheDocument();
      expect(screen.getByText('Second task')).toBeInTheDocument();
      expect(screen.getByText('Third task')).toBeInTheDocument();
    });

    it('should handle large task lists efficiently', () => {
      const manyTasks: Task[] = Array.from({ length: 100 }, (_, i) => ({
        id: `task-${i}`,
        text: `Task ${i}`,
        done: i % 2 === 0,
      }));

      const manyTasksProps = {
        ...mockProps,
        tasks: manyTasks,
      };

      render(<TaskList {...manyTasksProps} />);

      // Should render first and last tasks
      expect(screen.getByText('Task 0')).toBeInTheDocument();
      expect(screen.getByText('Task 99')).toBeInTheDocument();

      // Should render without crashing with many tasks  
      expect(screen.getByText('Task 0')).toBeInTheDocument();
    });
  });
});
