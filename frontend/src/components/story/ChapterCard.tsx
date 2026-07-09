import { StoryChapter } from '../../api/client';

export function ChapterCard({ chapter }: { chapter: StoryChapter }) {
  return (
    <article className="chapter-card">
      <h3>{chapter.title}</h3>
      {chapter.mood_arc && chapter.mood_arc.length > 0 && (
        <p className="chapter-mood-arc" aria-label="Emotional journey">
          {chapter.mood_arc.join(' → ')}
        </p>
      )}
      {chapter.moment && <p>{chapter.moment}</p>}
      {chapter.learning && (
        <p className="chapter-learning">
          <strong>What I learned: </strong>
          {chapter.learning}
        </p>
      )}
    </article>
  );
}
