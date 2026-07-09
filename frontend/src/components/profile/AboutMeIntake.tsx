import { useEffect, useState } from 'react';
import { BEST_LIFE_ELEMENTS, CONCERN_CATEGORIES, CONFIDENCE_LEVELS, ConfidenceLevel } from '../../constants/aboutMeOptions';
import { AboutMe } from '../../api/client';

interface AboutMeIntakeProps {
  aboutMe?: AboutMe;
  onSave: (data: Partial<AboutMe>) => Promise<unknown>;
  isSaving: boolean;
}

function ToggleGroup({
  label,
  options,
  selected,
  onToggle
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (option: string) => void;
}) {
  return (
    <fieldset className="toggle-group">
      <legend>{label}</legend>
      <div className="toggle-group-options" role="group" aria-label={label}>
        {options.map((option) => {
          const isSelected = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              aria-pressed={isSelected}
              className={isSelected ? 'toggle-chip toggle-chip-selected' : 'toggle-chip'}
              onClick={() => onToggle(option)}
            >
              {option}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function AboutMeIntake({ aboutMe, onSave, isSaving }: AboutMeIntakeProps) {
  const [bestLifeElements, setBestLifeElements] = useState<string[]>([]);
  const [concerns, setConcerns] = useState<string[]>([]);
  const [confidenceLevel, setConfidenceLevel] = useState<ConfidenceLevel | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    setBestLifeElements(aboutMe?.best_life_elements || []);
    setConcerns(aboutMe?.concerns || []);
    setConfidenceLevel((aboutMe?.confidence_level as ConfidenceLevel) || null);
  }, [aboutMe]);

  function toggle(list: string[], setList: (next: string[]) => void, option: string) {
    setList(list.includes(option) ? list.filter((item) => item !== option) : [...list, option]);
  }

  async function handleSubmit() {
    setSavedMessage(null);
    await onSave({
      bestLifeElements,
      concerns,
      confidenceLevel: confidenceLevel || undefined,
      userDefinedNextSteps: aboutMe?.user_defined_next_steps || []
    });
    setSavedMessage('Saved. Sofia will use this to shape your conversations.');
  }

  return (
    <div className="about-me-intake">
      <p className="section-intro">
        This is what Sofia uses to understand what matters most to you -- share as much or as little as feels right, and
        change it any time.
      </p>

      <ToggleGroup
        label="What makes life meaningful to you?"
        options={BEST_LIFE_ELEMENTS}
        selected={bestLifeElements}
        onToggle={(option) => toggle(bestLifeElements, setBestLifeElements, option)}
      />

      <ToggleGroup
        label="What's on your mind or worrying you?"
        options={CONCERN_CATEGORIES}
        selected={concerns}
        onToggle={(option) => toggle(concerns, setConcerns, option)}
      />

      <ToggleGroup
        label="How confident do you feel about handling these day to day?"
        options={CONFIDENCE_LEVELS as unknown as string[]}
        selected={confidenceLevel ? [confidenceLevel] : []}
        onToggle={(option) => setConfidenceLevel(option as ConfidenceLevel)}
      />

      <button type="button" onClick={handleSubmit} disabled={isSaving} className="save-button">
        {isSaving ? 'Saving...' : 'Save About Me'}
      </button>
      {savedMessage && (
        <p className="save-confirmation" role="status">
          {savedMessage}
        </p>
      )}
    </div>
  );
}
