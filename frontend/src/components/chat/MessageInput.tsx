import { FormEvent, KeyboardEvent, useState } from 'react';

interface MessageInputProps {
  onSend: (message: string) => Promise<unknown>;
  disabled?: boolean;
}

export function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [value, setValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit() {
    const trimmed = value.trim();
    if (!trimmed || isSubmitting || disabled) return;
    setIsSubmitting(true);
    try {
      await onSend(trimmed);
      setValue('');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void submit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  }

  return (
    <form className="message-input" onSubmit={handleSubmit}>
      <label htmlFor="chat-message" className="visually-hidden">
        Message to Sofia
      </label>
      <textarea
        id="chat-message"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Share what's on your mind..."
        rows={2}
        disabled={disabled || isSubmitting}
      />
      <button type="submit" disabled={disabled || isSubmitting || !value.trim()}>
        Send
      </button>
    </form>
  );
}
