import React, { useState } from 'react';

type Task = { id: string; text: string; done: boolean };

interface TaskListProps {
  tasks: Task[];
  onAddTask: (text: string) => void;
  onToggleTask: (id: string) => void;
  showTasks: boolean;
}

export function TaskList({ tasks, onAddTask, onToggleTask, showTasks }: TaskListProps) {
  if (!showTasks) return null;

  return (
    <>
      <TaskInput onAdd={onAddTask} />
      <ul style={{ marginTop: 16, listStyle: "none", padding: 0 }}>
        {tasks.map((task) => (
          <TaskItem 
            key={task.id} 
            task={task} 
            onToggle={() => onToggleTask(task.id)} 
          />
        ))}
        {tasks.length === 0 && (
          <li style={{ 
            color: "#666", 
            fontStyle: "italic", 
            textAlign: "center", 
            padding: "20px" 
          }}>
            No tasks yet. Add one above! ✨
          </li>
        )}
      </ul>
    </>
  );
}

function TaskItem({ task, onToggle }: { task: Task; onToggle: () => void }) {
  return (
    <li style={{ 
      margin: "8px 0", 
      padding: "8px", 
      background: task.done ? "#f0f0f0" : "white",
      border: "1px solid #ddd",
      borderRadius: "4px"
    }}>
      <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={task.done}
          onChange={onToggle}
          style={{ marginRight: "8px" }}
        />
        <span style={{ 
          textDecoration: task.done ? "line-through" : "none",
          color: task.done ? "#666" : "black"
        }}>
          {task.text}
        </span>
      </label>
    </li>
  );
}

function TaskInput({ onAdd }: { onAdd: (text: string) => void }) {
  const [text, setText] = useState("");
  
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        onAdd(text.trim());
        setText("");
      }}
      style={{ display: "flex", gap: "8px" }}
    >
      <input
        placeholder="Add a new task..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        style={{ 
          flex: 1, 
          padding: "8px", 
          border: "1px solid #ddd", 
          borderRadius: "4px" 
        }}
      />
      <button 
        type="submit"
        disabled={!text.trim()}
        style={{ 
          opacity: text.trim() ? 1 : 0.6,
          cursor: text.trim() ? "pointer" : "not-allowed"
        }}
      >
        ➕ Add
      </button>
    </form>
  );
} 