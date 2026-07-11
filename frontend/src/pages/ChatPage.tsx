import { ChatWindow } from '../components/chat/ChatWindow';
import { MemoryJournalPanel } from '../components/chat/MemoryJournalPanel';

export function ChatPage() {
  return (
    <div className="chat-page">
      <h1>Your conversation with Sofia</h1>
      <div className="chat-layout">
        <div className="chat-panel">
          <ChatWindow />
        </div>
        <MemoryJournalPanel />
      </div>
    </div>
  );
}
