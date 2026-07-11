import { ChatWindow } from '../components/chat/ChatWindow';
import { MemoryJournalPanel } from '../components/chat/MemoryJournalPanel';
import { FeedbackPanel } from '../components/chat/FeedbackPanel';

export function ChatPage() {
  return (
    <div className="chat-page">
      <div className="chat-layout">
        <div className="chat-panel">
          <ChatWindow />
        </div>
        <MemoryJournalPanel />
        <FeedbackPanel />
      </div>
      <p className="safety-indicator" role="status">
        <span aria-hidden="true">🛡️</span> Your conversation is monitored for safety
      </p>
    </div>
  );
}
