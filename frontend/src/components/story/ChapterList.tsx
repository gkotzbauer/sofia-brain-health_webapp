import { useState } from 'react';
import { StoryChapter } from '../../api/client';
import { ChapterCard } from './ChapterCard';
import { ChapterForm } from './ChapterForm';

interface ChapterListProps {
  chapters: StoryChapter[];
  onCreate: (data: { title: string; moment: string; moodArc: string[]; choices: string; learning: string }) => Promise<unknown>;
}

export function ChapterList({ chapters, onCreate }: ChapterListProps) {
  const [isWriting, setIsWriting] = useState(false);

  async function handleSave(data: Parameters<ChapterListProps['onCreate']>[0]) {
    await onCreate(data);
    setIsWriting(false);
  }

  return (
    <div className="chapter-list">
      {!isWriting && (
        <button type="button" onClick={() => setIsWriting(true)}>
          Write a new chapter
        </button>
      )}
      {isWriting && <ChapterForm onSave={handleSave} onCancel={() => setIsWriting(false)} />}

      {chapters.length === 0 ? (
        <p className="empty-state">No chapters yet -- your story starts whenever you're ready to write it.</p>
      ) : (
        chapters.map((chapter) => <ChapterCard key={chapter.id} chapter={chapter} />)
      )}
    </div>
  );
}
