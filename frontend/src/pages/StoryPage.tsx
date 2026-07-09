import { useChapters } from '../hooks/useChapters';
import { ChapterList } from '../components/story/ChapterList';

export function StoryPage() {
  const { chapters, isLoading, createChapter } = useChapters();

  return (
    <div className="story-page">
      <h1>Your story</h1>
      {isLoading ? <p>Loading your chapters...</p> : <ChapterList chapters={chapters} onCreate={createChapter} />}
    </div>
  );
}
