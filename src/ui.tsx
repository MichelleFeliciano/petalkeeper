import { createContext, useContext, useState, type ReactNode } from 'react';
import { TaskForm } from './components/TaskForm';
import { Modal } from './components/Modal';
import { useStore } from './store';
import type { Task } from './lib/types';

interface UI {
  openForm: (task?: Task, defaults?: Partial<Task>) => void;
  askDelete: (task: Task, date: string) => void;
}

const Ctx = createContext<UI | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [form, setForm] = useState<{ task?: Task; defaults?: Partial<Task> } | null>(null);
  const [del, setDel] = useState<{ task: Task; date: string } | null>(null);
  const { deleteTask, deleteOccurrence } = useStore();

  return (
    <Ctx.Provider value={{ openForm: (task, defaults) => setForm({ task, defaults }), askDelete: (task, date) => setDel({ task, date }) }}>
      {children}
      {form && <TaskForm task={form.task} defaults={form.defaults} onClose={() => setForm(null)} />}
      {del && (
        <Modal title="Remove this?" onClose={() => setDel(null)}>
          <p>
            <strong>{del.task.title}</strong>
            {del.task.recurrence ? ' repeats. What would you like to remove?' : ' will be removed for good.'}
          </p>
          <div className="actions">
            <button className="btn" onClick={() => setDel(null)}>
              Keep it
            </button>
            {del.task.recurrence && (
              <button
                className="btn"
                onClick={() => {
                  deleteOccurrence(del.task.id, del.date);
                  setDel(null);
                }}
              >
                Just this day
              </button>
            )}
            <button
              className="btn danger"
              onClick={() => {
                deleteTask(del.task.id);
                setDel(null);
              }}
            >
              {del.task.recurrence ? 'The whole series' : 'Delete'}
            </button>
          </div>
        </Modal>
      )}
    </Ctx.Provider>
  );
}

export function useUI(): UI {
  const c = useContext(Ctx);
  if (!c) throw new Error('useUI outside UIProvider');
  return c;
}
