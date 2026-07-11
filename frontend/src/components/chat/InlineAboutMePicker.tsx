import { useState } from 'react';
import { InlinePicker } from '../../api/client';
import { useProfile } from '../../hooks/useProfile';
import { BEST_LIFE_ELEMENTS, CONCERN_CATEGORIES, CONFIDENCE_LEVELS, ConfidenceLevel } from '../../constants/aboutMeOptions';

interface InlineAboutMePickerProps {
  picker: InlinePicker;
  onSubmit: (summaryMessage: string) => void;
  disabled?: boolean;
}

const LABELS: Record<InlinePicker['type'], string> = {
  best_life_elements: 'What makes life meaningful to you',
  concerns: "What's on your mind or worrying you",
  confidence_level: 'How confident do you feel about handling these day to day'
};

// The About Me onboarding picker, but shown INLINE in the chat transcript
// rather than only on the separate Profile page -- modeled directly on
// sofia-fixed(4).html's showAboutMeOptions/toggleAboutMeSelection/
// processAboutMeSelections sequence (chip multi-select, then "Continue").
// Reuses the exact same option vocabulary and save endpoint the standalone
// Profile page uses (AboutMeIntake.tsx / useProfile), so answering here and
// answering on the Profile page are the same data, not two systems.
export function InlineAboutMePicker({ picker, onSubmit, disabled }: InlineAboutMePickerProps) {
  const { profile, updateAboutMe, isSaving } = useProfile();
  const [selected, setSelected] = useState<string[]>([]);

  const options = picker.type === 'best_life_elements' ? BEST_LIFE_ELEMENTS : picker.type === 'concerns' ? CONCERN_CATEGORIES : CONFIDENCE_LEVELS;
  const isSingleSelect = picker.type === 'confidence_level';

  function toggle(option: string) {
    if (isSingleSelect) {
      setSelected([option]);
      return;
    }
    setSelected((current) => (current.includes(option) ? current.filter((item) => item !== option) : [...current, option]));
  }

  async function handleContinue() {
    if (selected.length === 0) {
      onSubmit('Skip for now');
      return;
    }

    const aboutMe = profile?.aboutMe;
    if (picker.type === 'confidence_level') {
      await updateAboutMe({
        bestLifeElements: aboutMe?.best_life_elements || [],
        concerns: aboutMe?.concerns || [],
        confidenceLevel: selected[0] as ConfidenceLevel,
        userDefinedNextSteps: aboutMe?.user_defined_next_steps || []
      });
    } else {
      const existing = picker.type === 'best_life_elements' ? aboutMe?.best_life_elements || [] : aboutMe?.concerns || [];
      const merged = [...existing, ...selected.filter((item) => !existing.includes(item))];
      await updateAboutMe({
        bestLifeElements: picker.type === 'best_life_elements' ? merged : aboutMe?.best_life_elements || [],
        concerns: picker.type === 'concerns' ? merged : aboutMe?.concerns || [],
        confidenceLevel: aboutMe?.confidence_level || undefined,
        userDefinedNextSteps: aboutMe?.user_defined_next_steps || []
      });
    }

    onSubmit(`I chose: ${selected.join(', ')}`);
  }

  return (
    <div className="inline-picker card">
      <p className="inline-picker-prompt">{picker.prompt}</p>
      <fieldset className="toggle-group">
        <legend>{LABELS[picker.type]}</legend>
        <div className="toggle-group-options" role="group" aria-label={LABELS[picker.type]}>
          {options.map((option) => {
            const isSelected = selected.includes(option);
            return (
              <button
                key={option}
                type="button"
                aria-pressed={isSelected}
                className={isSelected ? 'toggle-chip toggle-chip-selected' : 'toggle-chip'}
                onClick={() => toggle(option)}
                disabled={disabled || isSaving}
              >
                {option}
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="inline-picker-actions">
        <button type="button" className="button-secondary" onClick={() => onSubmit('Skip for now')} disabled={disabled || isSaving}>
          Skip for now
        </button>
        <button type="button" className="button-primary" onClick={handleContinue} disabled={disabled || isSaving}>
          {isSaving ? 'Saving...' : 'Continue →'}
        </button>
      </div>
    </div>
  );
}
