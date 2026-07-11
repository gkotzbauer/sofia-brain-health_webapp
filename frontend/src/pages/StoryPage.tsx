import { useChapters } from '../hooks/useChapters';
import { useGoals } from '../hooks/useGoals';
import { ChapterList } from '../components/story/ChapterList';
import { ProgressVisualization } from '../components/progress/ProgressVisualization';

export function StoryPage() {
  const { chapters, isLoading, createChapter } = useChapters();
  const { goals } = useGoals();

  return (
    <div className="story-page">
      <h1>Your story</h1>

      <section aria-label="Your progress">
        <ProgressVisualization goals={goals} chapters={chapters} />
      </section>

      {isLoading ? <p>Loading your chapters...</p> : <ChapterList chapters={chapters} onCreate={createChapter} />}
    </div>
  );
}
