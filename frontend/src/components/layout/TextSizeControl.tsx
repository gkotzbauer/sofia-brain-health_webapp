import { useTextSize } from '../../hooks/useTextSize';

interface TextSizeControlProps {
  // Extra class for callers rendering this on a non-default background
  // (e.g. ChatWindow's gradient header uses "on-hero" -- see global.css) --
  // the control is global (backend/hooks/useTextSize.ts persists to
  // localStorage and sets a document-level CSS variable), so it's safe to
  // render in more than one place; they stay in sync automatically.
  className?: string;
}

export function TextSizeControl({ className }: TextSizeControlProps = {}) {
  const { size, setSize, sizes } = useTextSize();

  return (
    <div className={className ? `text-size-control ${className}` : 'text-size-control'} role="group" aria-label="Text size">
      {sizes.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={size === option}
          className={size === option ? 'text-size-btn text-size-btn-active' : 'text-size-btn'}
          onClick={() => setSize(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
