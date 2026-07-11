import { useEffect, useRef, useState } from 'react';
import { ApplyExtractionPayload, DocumentExtractionCandidates } from '../../api/client';
import { useDocumentExtraction } from '../../hooks/useDocumentExtraction';
import { DocumentReviewItem } from './DocumentReviewItem';

interface EditableItem {
  value: string;
  accepted: boolean;
  sourceExcerpt: string;
  secondary?: string;
  context?: string;
  confidence?: string;
}

interface DocumentReviewModalProps {
  documentId: string;
  candidates: DocumentExtractionCandidates;
  onClose: () => void;
}

function toItems(list: Array<{ source_excerpt: string }> | undefined, valueOf: (item: any) => string, extra?: (item: any) => Partial<EditableItem>): EditableItem[] {
  return (list || []).map((item) => ({
    value: valueOf(item),
    accepted: false,
    sourceExcerpt: item.source_excerpt,
    ...(extra ? extra(item) : {})
  }));
}

function updateAt(items: EditableItem[], index: number, patch: Partial<EditableItem>): EditableItem[] {
  return items.map((item, i) => (i === index ? { ...item, ...patch } : item));
}

// Modeled on sofia-enhanced-narrative.html's document-review pattern: every
// candidate the extraction assistant proposed (backend routes/documents.js
// POST /:documentId/extract) is shown for the person to accept, edit, or
// reject -- nothing is pre-checked, and only what's explicitly accepted
// gets saved via POST /:documentId/apply-extraction. Uses a native <dialog>
// for a real focus trap and Escape-to-close instead of hand-rolling one.
export function DocumentReviewModal({ documentId, candidates, onClose }: DocumentReviewModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { applyExtraction, isApplying, applyError } = useDocumentExtraction();

  const [bestLifeElements, setBestLifeElements] = useState<EditableItem[]>(() =>
    toItems(candidates.best_life_elements, (c) => c.text)
  );
  const [concerns, setConcerns] = useState<EditableItem[]>(() => toItems(candidates.concerns, (c) => c.text));
  const [confidenceLevel, setConfidenceLevel] = useState<EditableItem | null>(() =>
    candidates.confidence_level
      ? { value: candidates.confidence_level.value, accepted: false, sourceExcerpt: candidates.confidence_level.source_excerpt }
      : null
  );
  const [values, setValues] = useState<EditableItem[]>(() =>
    toItems(candidates.values, (c) => c.value_text, (c) => ({ secondary: c.importance || 'high' }))
  );
  const [concernsDetailed, setConcernsDetailed] = useState<EditableItem[]>(() =>
    toItems(candidates.concerns_detailed, (c) => c.concern, (c) => ({ secondary: c.severity || 'moderate', context: c.context || '' }))
  );
  const [educationTopics, setEducationTopics] = useState<EditableItem[]>(() =>
    toItems(candidates.education_topics, (c) => c.topic, (c) => ({ secondary: c.engagement || 'moderate' }))
  );
  const [goals, setGoals] = useState<EditableItem[]>(() => toItems(candidates.goals, (c) => c.goal, () => ({ confidence: '' })));

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    const handleClose = () => onClose();
    dialog.addEventListener('close', handleClose);
    // Deliberately does NOT call dialog.close() here -- that would fire the
    // native 'close' event (see handleClose above) and call onClose() as a
    // *side effect of unmounting*, not a real user-initiated close. Under
    // React 18 StrictMode's dev-only double-invoke of effects, that turned
    // a normal mount into "open, then immediately close itself" every
    // time. Removing the DOM node (which unmounting already does) is
    // sufficient cleanup on its own.
    return () => {
      dialog.removeEventListener('close', handleClose);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleBackdropClick(event: React.MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) dialogRef.current?.close();
  }

  const totalCandidates =
    bestLifeElements.length +
    concerns.length +
    (confidenceLevel ? 1 : 0) +
    values.length +
    concernsDetailed.length +
    educationTopics.length +
    goals.length;

  async function handleSave() {
    const payload: ApplyExtractionPayload = {};

    const acceptedBestLife = bestLifeElements.filter((item) => item.accepted && item.value.trim());
    if (acceptedBestLife.length) payload.bestLifeElements = acceptedBestLife.map((item) => item.value.trim());

    const acceptedConcerns = concerns.filter((item) => item.accepted && item.value.trim());
    if (acceptedConcerns.length) payload.concerns = acceptedConcerns.map((item) => item.value.trim());

    if (confidenceLevel?.accepted && confidenceLevel.value.trim()) {
      payload.confidenceLevel = confidenceLevel.value.trim();
    }

    const acceptedValues = values.filter((item) => item.accepted && item.value.trim());
    if (acceptedValues.length) {
      payload.values = acceptedValues.map((item) => ({ valueText: item.value.trim(), importance: item.secondary }));
    }

    const acceptedConcernsDetailed = concernsDetailed.filter((item) => item.accepted && item.value.trim());
    if (acceptedConcernsDetailed.length) {
      payload.concernsDetailed = acceptedConcernsDetailed.map((item) => ({
        concern: item.value.trim(),
        severity: item.secondary,
        context: item.context
      }));
    }

    const acceptedEducationTopics = educationTopics.filter((item) => item.accepted && item.value.trim());
    if (acceptedEducationTopics.length) {
      payload.educationTopics = acceptedEducationTopics.map((item) => ({ topic: item.value.trim(), engagement: item.secondary }));
    }

    // Goals keep the confidence gate: a candidate can't be accepted without
    // the person confirming a confidence value (see the matching backend
    // check in routes/documents.js apply-extraction).
    const acceptedGoals = goals.filter((item) => item.accepted && item.value.trim() && item.confidence);
    if (acceptedGoals.length) {
      payload.goals = acceptedGoals.map((item) => ({ goal: item.value.trim(), confidence: Number(item.confidence) }));
    }

    await applyExtraction({ documentId, payload });
    dialogRef.current?.close();
  }

  return (
    <dialog ref={dialogRef} className="document-review-dialog" aria-labelledby="document-review-heading" onClick={handleBackdropClick}>
      <div className="document-review-content">
        <h2 id="document-review-heading">What Sofia found in your document</h2>
        <p className="section-intro">
          Review each item below. Nothing is saved unless you check it -- you can also edit the wording before saving.
        </p>

        {totalCandidates === 0 && <p className="chat-status">Nothing stood out to add to your profile from this document.</p>}

        {bestLifeElements.length > 0 && (
          <section aria-labelledby="review-best-life-heading">
            <h3 id="review-best-life-heading">What makes life meaningful</h3>
            {bestLifeElements.map((item, index) => (
              <DocumentReviewItem
                key={`best-life-${index}`}
                id={`best-life-${index}`}
                label="Best-life element"
                value={item.value}
                sourceExcerpt={item.sourceExcerpt}
                accepted={item.accepted}
                onValueChange={(value) => setBestLifeElements((items) => updateAt(items, index, { value }))}
                onAcceptedChange={(accepted) => setBestLifeElements((items) => updateAt(items, index, { accepted }))}
              />
            ))}
          </section>
        )}

        {concerns.length > 0 && (
          <section aria-labelledby="review-concerns-heading">
            <h3 id="review-concerns-heading">Concerns</h3>
            {concerns.map((item, index) => (
              <DocumentReviewItem
                key={`concern-${index}`}
                id={`concern-${index}`}
                label="Concern"
                value={item.value}
                sourceExcerpt={item.sourceExcerpt}
                accepted={item.accepted}
                onValueChange={(value) => setConcerns((items) => updateAt(items, index, { value }))}
                onAcceptedChange={(accepted) => setConcerns((items) => updateAt(items, index, { accepted }))}
              />
            ))}
          </section>
        )}

        {confidenceLevel && (
          <section aria-labelledby="review-confidence-heading">
            <h3 id="review-confidence-heading">Confidence level</h3>
            <DocumentReviewItem
              id="confidence-level"
              label="Confidence level"
              value={confidenceLevel.value}
              sourceExcerpt={confidenceLevel.sourceExcerpt}
              accepted={confidenceLevel.accepted}
              onValueChange={(value) => setConfidenceLevel((current) => (current ? { ...current, value } : current))}
              onAcceptedChange={(accepted) => setConfidenceLevel((current) => (current ? { ...current, accepted } : current))}
            />
          </section>
        )}

        {values.length > 0 && (
          <section aria-labelledby="review-values-heading">
            <h3 id="review-values-heading">Values</h3>
            {values.map((item, index) => (
              <DocumentReviewItem
                key={`value-${index}`}
                id={`value-${index}`}
                label="Value"
                value={item.value}
                sourceExcerpt={item.sourceExcerpt}
                accepted={item.accepted}
                onValueChange={(value) => setValues((items) => updateAt(items, index, { value }))}
                onAcceptedChange={(accepted) => setValues((items) => updateAt(items, index, { accepted }))}
              >
                <label className="review-item-field">
                  Importance
                  <select
                    value={item.secondary}
                    onChange={(event) => setValues((items) => updateAt(items, index, { secondary: event.target.value }))}
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </label>
              </DocumentReviewItem>
            ))}
          </section>
        )}

        {concernsDetailed.length > 0 && (
          <section aria-labelledby="review-concerns-detailed-heading">
            <h3 id="review-concerns-detailed-heading">More about your concerns</h3>
            {concernsDetailed.map((item, index) => (
              <DocumentReviewItem
                key={`concern-detailed-${index}`}
                id={`concern-detailed-${index}`}
                label="Concern (detailed)"
                value={item.value}
                sourceExcerpt={item.sourceExcerpt}
                accepted={item.accepted}
                onValueChange={(value) => setConcernsDetailed((items) => updateAt(items, index, { value }))}
                onAcceptedChange={(accepted) => setConcernsDetailed((items) => updateAt(items, index, { accepted }))}
              >
                <label className="review-item-field">
                  Severity
                  <select
                    value={item.secondary}
                    onChange={(event) => setConcernsDetailed((items) => updateAt(items, index, { secondary: event.target.value }))}
                  >
                    <option value="mild">Mild</option>
                    <option value="moderate">Moderate</option>
                    <option value="severe">Severe</option>
                  </select>
                </label>
              </DocumentReviewItem>
            ))}
          </section>
        )}

        {educationTopics.length > 0 && (
          <section aria-labelledby="review-education-heading">
            <h3 id="review-education-heading">Topics to learn about</h3>
            {educationTopics.map((item, index) => (
              <DocumentReviewItem
                key={`education-${index}`}
                id={`education-${index}`}
                label="Learning topic"
                value={item.value}
                sourceExcerpt={item.sourceExcerpt}
                accepted={item.accepted}
                onValueChange={(value) => setEducationTopics((items) => updateAt(items, index, { value }))}
                onAcceptedChange={(accepted) => setEducationTopics((items) => updateAt(items, index, { accepted }))}
              >
                <label className="review-item-field">
                  Interest
                  <select
                    value={item.secondary}
                    onChange={(event) => setEducationTopics((items) => updateAt(items, index, { secondary: event.target.value }))}
                  >
                    <option value="low">Low</option>
                    <option value="moderate">Moderate</option>
                    <option value="high">High</option>
                  </select>
                </label>
              </DocumentReviewItem>
            ))}
          </section>
        )}

        {goals.length > 0 && (
          <section aria-labelledby="review-goals-heading">
            <h3 id="review-goals-heading">Possible goals</h3>
            {goals.map((item, index) => (
              <DocumentReviewItem
                key={`goal-${index}`}
                id={`goal-${index}`}
                label="Goal"
                value={item.value}
                sourceExcerpt={item.sourceExcerpt}
                accepted={item.accepted}
                disableAccept={!item.confidence}
                disabledReason="Set how confident you feel about this goal before adding it -- same as when Sofia proposes a goal in conversation."
                onValueChange={(value) => setGoals((items) => updateAt(items, index, { value }))}
                onAcceptedChange={(accepted) => setGoals((items) => updateAt(items, index, { accepted }))}
              >
                <label className="review-item-field">
                  How confident do you feel about this (1-10)?
                  <select
                    value={item.confidence}
                    onChange={(event) =>
                      setGoals((items) =>
                        updateAt(items, index, {
                          confidence: event.target.value,
                          accepted: event.target.value ? items[index].accepted : false
                        })
                      )
                    }
                  >
                    <option value="">Not set</option>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              </DocumentReviewItem>
            ))}
          </section>
        )}

        {applyError && (
          <p className="form-error" role="alert">
            {applyError}
          </p>
        )}

        <div className="document-review-actions">
          <button type="button" className="button-secondary" onClick={() => dialogRef.current?.close()} disabled={isApplying}>
            Skip / decide later
          </button>
          <button type="button" className="button-primary" onClick={handleSave} disabled={isApplying || totalCandidates === 0}>
            {isApplying ? 'Saving...' : 'Save selected'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
