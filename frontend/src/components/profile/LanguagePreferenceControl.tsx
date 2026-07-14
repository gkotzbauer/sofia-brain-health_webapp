import { useEffect, useState } from 'react';

interface LanguagePreferenceControlProps {
  preferredLanguage?: string | null;
  onSave: (preferredLanguage: string) => Promise<unknown>;
  isSaving: boolean;
}

// Optional, freeform -- not a language picker/translation feature (Sofia's
// UI is English-only today). This just lets Sofia know what to adapt --
// e.g. a preferred language for simpler phrasing, or a note like "English,
// but please keep it simple" -- see backend/utils/systemPrompt.js's "This
// person, right now" section.
export function LanguagePreferenceControl({ preferredLanguage, onSave, isSaving }: LanguagePreferenceControlProps) {
  const [value, setValue] = useState(preferredLanguage || '');
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    setValue(preferredLanguage || '');
  }, [preferredLanguage]);

  async function handleSave() {
    setSavedMessage(null);
    await onSave(value.trim());
    setSavedMessage('Saved.');
  }

  return (
    <div className="profile-detail-form profile-detail-form-stacked">
      <label htmlFor="preferred-language-input">
        Is there a language or way of explaining things that works best for you?
      </label>
      <div className="profile-detail-form-row">
        <input
          id="preferred-language-input"
          type="text"
          value={value}
          placeholder="e.g. Spanish, or English -- but keep it simple"
          onChange={(event) => setValue(event.target.value)}
        />
        <button type="button" className="button-secondary" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
      {savedMessage && (
        <p className="save-confirmation" role="status">
          {savedMessage}
        </p>
      )}
    </div>
  );
}
