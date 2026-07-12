import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  FilePenLine,
  ListChecks,
  Plus,
  RotateCcw,
  Save,
  Square,
  Trash2,
  WalletCards,
} from 'lucide-react';
import { Badge, Button, Card, Input } from '../components';

interface StudyNote {
  readonly body: string;
  readonly id: string;
  readonly title: string;
  readonly updatedAt: string;
}

interface StudyTask {
  readonly done: boolean;
  readonly id: string;
  readonly label: string;
}

interface Flashcard {
  readonly answer: string;
  readonly id: string;
  readonly prompt: string;
}

const NOTES_KEY = 'smartstudy_study_notes';
const TASKS_KEY = 'smartstudy_study_tasks';
const FLASHCARDS_KEY = 'smartstudy_flashcards';
const DEFAULT_SECONDS = 25 * 60;

export const StudyToolsPage: React.FC = () => {
  const [notes, setNotes] = useStoredState<StudyNote[]>(NOTES_KEY, []);
  const [tasks, setTasks] = useStoredState<StudyTask[]>(TASKS_KEY, []);
  const [flashcards, setFlashcards] = useStoredState<Flashcard[]>(FLASHCARDS_KEY, []);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [taskLabel, setTaskLabel] = useState('');
  const [flashPrompt, setFlashPrompt] = useState('');
  const [flashAnswer, setFlashAnswer] = useState('');
  const [flippedCardId, setFlippedCardId] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_SECONDS);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  useEffect(() => {
    if (!isTimerRunning) return;

    const timer = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          setIsTimerRunning(false);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isTimerRunning]);

  const completedTasks = tasks.filter((task) => task.done).length;
  const taskProgress = tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0;
  const sortedNotes = useMemo(
    () =>
      [...notes].sort(
        (left, right) =>
          new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
      ),
    [notes],
  );

  const saveNote = () => {
    const title = noteTitle.trim();
    const body = noteBody.trim();

    if (!title && !body) return;

    const nextNote: StudyNote = {
      body,
      id: crypto.randomUUID(),
      title: title || 'Untitled note',
      updatedAt: new Date().toISOString(),
    };

    setNotes((current) => [nextNote, ...current].slice(0, 12));
    setNoteTitle('');
    setNoteBody('');
  };

  const addTask = () => {
    const label = taskLabel.trim();
    if (!label) return;

    setTasks((current) => [
      ...current,
      {
        done: false,
        id: crypto.randomUUID(),
        label,
      },
    ]);
    setTaskLabel('');
  };

  const addFlashcard = () => {
    const prompt = flashPrompt.trim();
    const answer = flashAnswer.trim();

    if (!prompt || !answer) return;

    setFlashcards((current) => [
      {
        answer,
        id: crypto.randomUUID(),
        prompt,
      },
      ...current,
    ].slice(0, 18));
    setFlashPrompt('');
    setFlashAnswer('');
  };

  const setTimerMinutes = (minutes: number) => {
    setIsTimerRunning(false);
    setSecondsLeft(minutes * 60);
  };

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="border-l-4 border-l-[#0073BB] p-5">
            <div className="flex items-center justify-between text-[#707882]">
              <span className="text-xs font-semibold uppercase">Notes</span>
              <FilePenLine className="h-5 w-5 text-[#0073BB]" />
            </div>
            <p className="mt-4 text-3xl font-extrabold text-[#181C1E]">{notes.length}</p>
          </Card>

          <Card className="border-l-4 border-l-[#2E7D32] p-5">
            <div className="flex items-center justify-between text-[#707882]">
              <span className="text-xs font-semibold uppercase">Tasks</span>
              <ListChecks className="h-5 w-5 text-[#2E7D32]" />
            </div>
            <p className="mt-4 text-3xl font-extrabold text-[#181C1E]">{taskProgress}%</p>
          </Card>

          <Card className="border-l-4 border-l-[#8A2BE2] p-5">
            <div className="flex items-center justify-between text-[#707882]">
              <span className="text-xs font-semibold uppercase">Cards</span>
              <WalletCards className="h-5 w-5 text-[#8A2BE2]" />
            </div>
            <p className="mt-4 text-3xl font-extrabold text-[#181C1E]">{flashcards.length}</p>
          </Card>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="space-y-5 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FilePenLine className="h-5 w-5 text-[#0073BB]" />
                <h2 className="text-lg font-bold text-[#181C1E]">Study Notes</h2>
              </div>
              <Badge variant="neutral" size="sm">Local</Badge>
            </div>

            <Input
              label="Title"
              value={noteTitle}
              onChange={(event) => setNoteTitle(event.target.value)}
              placeholder="Chapter 1 summary"
            />
            <textarea
              value={noteBody}
              onChange={(event) => setNoteBody(event.target.value)}
              placeholder="Key points, formulas, reminders..."
              className="min-h-[160px] w-full resize-none rounded-xl border border-[#E0E3E5] bg-[#F4F7F9] px-4 py-3 text-sm text-[#181C1E] placeholder-[#707882] focus:outline-none focus:ring-2 focus:ring-[#0073BB]"
            />
            <Button
              variant="primary"
              leftIcon={<Save size={16} />}
              onClick={saveNote}
              disabled={!noteTitle.trim() && !noteBody.trim()}
            >
              Save note
            </Button>
          </Card>

          <Card className="space-y-5 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListChecks className="h-5 w-5 text-[#2E7D32]" />
                <h2 className="text-lg font-bold text-[#181C1E]">Study Checklist</h2>
              </div>
              <Badge variant={taskProgress === 100 && tasks.length > 0 ? 'success' : 'warning'} size="sm">
                {completedTasks}/{tasks.length}
              </Badge>
            </div>

            <div className="flex gap-2">
              <input
                value={taskLabel}
                onChange={(event) => setTaskLabel(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') addTask();
                }}
                placeholder="Read pages 1-10"
                className="min-w-0 flex-1 rounded-xl border border-[#E0E3E5] bg-[#F4F7F9] px-4 py-2.5 text-sm text-[#181C1E] placeholder-[#707882] focus:outline-none focus:ring-2 focus:ring-[#0073BB]"
              />
              <Button variant="secondary" leftIcon={<Plus size={16} />} onClick={addTask} disabled={!taskLabel.trim()}>
                Add
              </Button>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-[#E0E3E5]">
              <div
                className="h-full rounded-full bg-[#2E7D32] transition-all duration-300"
                style={{ width: `${taskProgress}%` }}
              />
            </div>

            <div className="space-y-2">
              {tasks.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[#C0C7D2] p-4 text-sm text-[#707882]">
                  No tasks yet.
                </p>
              ) : (
                tasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-3 rounded-xl border border-[#E0E3E5] bg-white px-3 py-2.5">
                    <button
                      onClick={() =>
                        setTasks((current) =>
                          current.map((item) =>
                            item.id === task.id ? { ...item, done: !item.done } : item,
                          ),
                        )
                      }
                      className="text-[#2E7D32]"
                      title={task.done ? 'Mark active' : 'Mark done'}
                    >
                      {task.done ? <CheckCircle2 size={18} /> : <Square size={18} />}
                    </button>
                    <span className={`min-w-0 flex-1 truncate text-sm ${task.done ? 'text-[#707882] line-through' : 'text-[#181C1E]'}`}>
                      {task.label}
                    </span>
                    <button
                      onClick={() => setTasks((current) => current.filter((item) => item.id !== task.id))}
                      className="rounded-lg p-1 text-[#707882] hover:bg-[#FCEEEE] hover:text-[#BA1A1A]"
                      title="Delete task"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </Card>
        </section>

        <Card className="space-y-5 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <WalletCards className="h-5 w-5 text-[#8A2BE2]" />
              <h2 className="text-lg font-bold text-[#181C1E]">Flashcards</h2>
            </div>
            <Badge variant="ai" size="sm">Practice</Badge>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto]">
            <input
              value={flashPrompt}
              onChange={(event) => setFlashPrompt(event.target.value)}
              placeholder="Term or question"
              className="rounded-xl border border-[#E0E3E5] bg-[#F4F7F9] px-4 py-2.5 text-sm text-[#181C1E] placeholder-[#707882] focus:outline-none focus:ring-2 focus:ring-[#0073BB]"
            />
            <input
              value={flashAnswer}
              onChange={(event) => setFlashAnswer(event.target.value)}
              placeholder="Answer"
              className="rounded-xl border border-[#E0E3E5] bg-[#F4F7F9] px-4 py-2.5 text-sm text-[#181C1E] placeholder-[#707882] focus:outline-none focus:ring-2 focus:ring-[#0073BB]"
            />
            <Button variant="ai" leftIcon={<Plus size={16} />} onClick={addFlashcard} disabled={!flashPrompt.trim() || !flashAnswer.trim()}>
              Add
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {flashcards.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#C0C7D2] p-4 text-sm text-[#707882] md:col-span-2">
                No flashcards yet.
              </p>
            ) : (
              flashcards.map((card) => {
                const isFlipped = flippedCardId === card.id;

                return (
                  <button
                    key={card.id}
                    onClick={() => setFlippedCardId(isFlipped ? '' : card.id)}
                    className="min-h-[118px] rounded-xl border border-[#E0E3E5] bg-white p-4 text-left shadow-sm transition-all hover:border-[#8A2BE2]/50"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-bold uppercase text-[#8A2BE2]">
                        {isFlipped ? 'Answer' : 'Prompt'}
                      </span>
                      <RotateCcw className="h-4 w-4 text-[#707882]" />
                    </div>
                    <p className="line-clamp-3 text-sm font-semibold leading-relaxed text-[#181C1E]">
                      {isFlipped ? card.answer : card.prompt}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </Card>
      </div>

      <aside className="space-y-6">
        <Card className="space-y-5 p-6">
          <div className="flex items-center gap-2">
            <Clock3 className="h-5 w-5 text-[#0073BB]" />
            <h2 className="text-lg font-bold text-[#181C1E]">Focus Timer</h2>
          </div>

          <div className="rounded-2xl bg-[#F4F7F9] p-6 text-center">
            <p className="font-mono text-5xl font-extrabold text-[#232F3E]">{formatSeconds(secondsLeft)}</p>
            <p className="mt-2 text-xs font-medium text-[#707882]">{isTimerRunning ? 'Running' : 'Paused'}</p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[25, 15, 5].map((minutes) => (
              <button
                key={minutes}
                onClick={() => setTimerMinutes(minutes)}
                className="rounded-xl border border-[#E0E3E5] bg-white px-3 py-2 text-xs font-bold text-[#404751] hover:border-[#0073BB] hover:text-[#0073BB]"
              >
                {minutes}m
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={isTimerRunning ? 'outline' : 'primary'}
              onClick={() => setIsTimerRunning((current) => !current)}
              disabled={secondsLeft === 0}
            >
              {isTimerRunning ? 'Pause' : 'Start'}
            </Button>
            <Button variant="ghost" leftIcon={<RotateCcw size={16} />} onClick={() => setTimerMinutes(25)}>
              Reset
            </Button>
          </div>
        </Card>

        <Card className="space-y-3 p-6">
          <div className="flex items-center gap-2">
            <FilePenLine className="h-5 w-5 text-[#0073BB]" />
            <h2 className="text-lg font-bold text-[#181C1E]">Recent Notes</h2>
          </div>
          {sortedNotes.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#C0C7D2] p-4 text-sm text-[#707882]">
              No saved notes.
            </p>
          ) : (
            sortedNotes.slice(0, 6).map((note) => (
              <div key={note.id} className="rounded-xl border border-[#E0E3E5] bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <button
                    onClick={() => {
                      setNoteTitle(note.title);
                      setNoteBody(note.body);
                    }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate text-sm font-bold text-[#181C1E]">{note.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#707882]">{note.body || 'Empty note'}</p>
                  </button>
                  <button
                    onClick={() => setNotes((current) => current.filter((item) => item.id !== note.id))}
                    className="rounded-lg p-1 text-[#707882] hover:bg-[#FCEEEE] hover:text-[#BA1A1A]"
                    title="Delete note"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))
          )}
        </Card>
      </aside>
    </div>
  );
};

function useStoredState<T>(
  key: string,
  fallback: T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => readStoredValue(key, fallback));

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
}

function readStoredValue<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function formatSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
