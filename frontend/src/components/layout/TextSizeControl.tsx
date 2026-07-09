import { useTextSize } from '../../hooks/useTextSize';

export function TextSizeControl() {
  const { size, setSize, sizes } = useTextSize();

  return (
    <div className="text-size-control" role="group" aria-label="Text size">
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
