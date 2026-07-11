const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:10000/api';
const TOKEN_KEY = 'sofia_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined)
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      if (body?.error) message = body.error;
    } catch {
      // Response had no JSON body -- keep the generic message.
    }
    throw new Error(message);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

// Separate from request() because the browser must set its own
// multipart/form-data Content-Type (with boundary) -- explicitly setting it
// ourselves would omit the boundary and break the upload.
async function uploadFile<T>(path: string, file: File): Promise<T> {
  const token = getToken();
  const formData = new FormData();
  formData.append('document', file);

  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${path}`, { method: 'POST', headers, body: formData });

  if (!response.ok) {
    let message = `Upload failed (${response.status})`;
    try {
      const body = await response.json();
      if (body?.error) message = body.error;
    } catch {
      // Response had no JSON body -- keep the generic message.
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export interface SofiaUser {
  id: string;
  name: string;
  email: string;
  age: string | null;
  role: 'user' | 'clinician' | 'admin';
}

export interface AuthResponse {
  token: string;
  user: SofiaUser;
}

export interface ConversationTurn {
  role: 'user' | 'assistant' | 'clinician';
  content: string;
  timestamp: string;
  authorName?: string;
  isOpening?: boolean;
  storyMoment?: boolean;
}

export interface PendingConfirmation {
  type: 'goal' | 'chapter';
  payload: Record<string, unknown>;
}

export interface ConversationState {
  entryPoint: string | null;
  carePhase: string;
  educationTier: string | null;
  adaptivePattern: string | null;
  contextCapped?: boolean;
  contextWindowSize?: number;
  pendingConfirmation: PendingConfirmation | null;
  pivotHistory: Array<{ type: string; turnIndex: number }>;
  safetyFlags: Array<{ turnIndex: number; source: string; triggerType: string | null; severity: string }>;
  turnCount: number;
  lastTurnAt: string;
  profilePromptedAt?: number | null;
}

export interface SofiaSession {
  id: string;
  conversation_log: ConversationTurn[];
  state: ConversationState;
  [key: string]: unknown;
}

export interface SofiaSessionSummary {
  id: string;
  session_date: string;
  duration_minutes: number | null;
  main_topics: string[] | null;
  mood: string | null;
}

export interface ChatTurnResponse {
  reply: string;
  state: ConversationState;
  safety: { riskLevel: string; clinicianNotified: boolean; safetyEventId: string | null };
}

export interface Goal {
  id: string;
  goal: string;
  confidence: number | null;
  status: 'active' | 'completed' | 'paused' | 'abandoned';
  user_note: string | null;
  [key: string]: unknown;
}

export interface AboutMe {
  best_life_elements: string[];
  concerns: string[];
  confidence_level: string | null;
  user_defined_next_steps: string[];
  [key: string]: unknown;
}

export interface StoryChapter {
  id: string;
  title: string;
  moment: string | null;
  mood_arc: string[] | null;
  choices: string | null;
  learning: string | null;
  [key: string]: unknown;
}

export interface DocumentUploadRecord {
  id: string;
  filename: string;
  file_type: string;
  file_size: number;
  upload_timestamp: string;
  extracted_count: number;
  [key: string]: unknown;
}

export interface DocumentUploadResult {
  success: boolean;
  document: DocumentUploadRecord;
  extractedText: string;
  message: string;
}

// Candidate profile fields the extraction assistant proposed from a
// document -- each grounded in a source_excerpt, never auto-written (see
// backend routes/documents.js POST /:documentId/extract and
// /apply-extraction). Field shapes intentionally mirror what each existing
// create endpoint (values/concerns/educationTopics/goals) already expects.
export interface ExtractionCandidateText {
  text: string;
  source_excerpt: string;
}
export interface ExtractionCandidateConfidence {
  value: string;
  source_excerpt: string;
}
export interface ExtractionCandidateValue {
  value_text: string;
  importance?: string;
  source_excerpt: string;
}
export interface ExtractionCandidateConcernDetailed {
  concern: string;
  severity?: string;
  context?: string;
  source_excerpt: string;
}
export interface ExtractionCandidateEducationTopic {
  topic: string;
  engagement?: string;
  source_excerpt: string;
}
export interface ExtractionCandidateGoal {
  goal: string;
  source_excerpt: string;
}

export interface DocumentExtractionCandidates {
  best_life_elements?: ExtractionCandidateText[];
  concerns?: ExtractionCandidateText[];
  confidence_level?: ExtractionCandidateConfidence | null;
  values?: ExtractionCandidateValue[];
  concerns_detailed?: ExtractionCandidateConcernDetailed[];
  education_topics?: ExtractionCandidateEducationTopic[];
  goals?: ExtractionCandidateGoal[];
}

export interface DocumentExtractionResult {
  documentId: string;
  candidates: DocumentExtractionCandidates;
}

export interface ApplyExtractionPayload {
  bestLifeElements?: string[];
  concerns?: string[];
  confidenceLevel?: string;
  values?: Array<{ valueText: string; importance?: string }>;
  concernsDetailed?: Array<{ concern: string; severity?: string; context?: string }>;
  educationTopics?: Array<{ topic: string; engagement?: string }>;
  goals?: Array<{ goal: string; confidence: number }>;
}

export interface ApplyExtractionResult {
  appliedCount: number;
  applied: Record<string, unknown>;
}

export interface ValueItem {
  id: string;
  value_text: string;
  importance: 'high' | 'medium' | 'low' | string;
  user_note: string | null;
  [key: string]: unknown;
}

export interface ConcernItem {
  id: string;
  concern: string;
  severity: 'high' | 'moderate' | 'low' | string;
  context: string | null;
  user_note: string | null;
  [key: string]: unknown;
}

export interface EducationTopicItem {
  id: string;
  topic: string;
  engagement: 'high' | 'moderate' | 'low' | string;
  user_note: string | null;
  [key: string]: unknown;
}

export interface ClinicalAlert {
  id: string;
  user_id: string;
  user_name: string;
  session_id: string | null;
  alert_type: 'safety_trigger' | 'context_cap' | string;
  priority: 'low' | 'moderate' | 'high' | 'critical';
  message: string;
  context: string | null;
  acknowledged: boolean;
  created_at: string;
  [key: string]: unknown;
}

export const api = {
  register: (data: { name: string; email: string; password: string; age?: string }) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  login: (data: { email: string; password: string }) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),

  createSession: () => request<SofiaSession>('/sessions', { method: 'POST' }),
  listSessions: () => request<SofiaSessionSummary[]>('/sessions'),
  getSession: (sessionId: string) => request<SofiaSession>(`/sessions/${sessionId}`),

  sendMessage: (sessionId: string, message: string) =>
    request<ChatTurnResponse>('/chat', { method: 'POST', body: JSON.stringify({ sessionId, message }) }),

  getProfile: () =>
    request<{ user: SofiaUser; aboutMe: AboutMe; storyChapters: StoryChapter[]; goals: Goal[] }>('/users/profile'),
  updateAboutMe: (data: Partial<AboutMe>) =>
    request<AboutMe>('/users/about-me', { method: 'PUT', body: JSON.stringify(data) }),
  deleteAccount: (password: string) =>
    request<{ success: boolean; message: string }>('/users/me', { method: 'DELETE', body: JSON.stringify({ password }) }),

  listValues: () => request<ValueItem[]>('/values'),
  createValue: (data: { valueText: string; importance?: string }) =>
    request<ValueItem>('/values', { method: 'POST', body: JSON.stringify(data) }),
  updateValue: (valueId: string, data: Partial<{ valueText: string; importance: string; userNote: string }>) =>
    request<ValueItem>(`/values/${valueId}`, { method: 'PUT', body: JSON.stringify(data) }),

  listConcerns: () => request<ConcernItem[]>('/concerns'),
  createConcern: (data: { concern: string; severity?: string; context?: string }) =>
    request<ConcernItem>('/concerns', { method: 'POST', body: JSON.stringify(data) }),
  updateConcern: (concernId: string, data: Partial<{ concern: string; severity: string; context: string; userNote: string }>) =>
    request<ConcernItem>(`/concerns/${concernId}`, { method: 'PUT', body: JSON.stringify(data) }),

  listEducationTopics: () => request<EducationTopicItem[]>('/education-topics'),
  createEducationTopic: (data: { topic: string; engagement?: string }) =>
    request<EducationTopicItem>('/education-topics', { method: 'POST', body: JSON.stringify(data) }),
  updateEducationTopic: (topicId: string, data: Partial<{ topic: string; engagement: string; userNote: string }>) =>
    request<EducationTopicItem>(`/education-topics/${topicId}`, { method: 'PUT', body: JSON.stringify(data) }),

  listGoals: () => request<Goal[]>('/goals'),
  createGoal: (data: { goal: string; confidence: number; linkedBestLifeElements?: string[] }) =>
    request<Goal>('/goals', { method: 'POST', body: JSON.stringify(data) }),
  updateGoal: (goalId: string, data: Partial<{ goal: string; confidence: number; status: Goal['status']; userNote: string }>) =>
    request<Goal>(`/goals/${goalId}`, { method: 'PUT', body: JSON.stringify(data) }),
  recordGoalProgress: (goalId: string, data: { progressNote: string; confidenceUpdate?: number }) =>
    request<unknown>(`/goals/${goalId}/progress`, { method: 'POST', body: JSON.stringify(data) }),

  createChapter: (data: {
    title: string;
    moment: string;
    moodArc: string[];
    choices: string;
    learning: string;
    linkedBestLifeElements?: string[];
  }) => request<StoryChapter>('/story-chapters', { method: 'POST', body: JSON.stringify(data) }),

  uploadDocument: (file: File) => uploadFile<DocumentUploadResult>('/documents/upload', file),
  listDocumentUploads: () => request<DocumentUploadRecord[]>('/documents/document-uploads'),
  extractDocument: (documentId: string) =>
    request<DocumentExtractionResult>(`/documents/${documentId}/extract`, { method: 'POST' }),
  applyDocumentExtraction: (documentId: string, payload: ApplyExtractionPayload) =>
    request<ApplyExtractionResult>(`/documents/${documentId}/apply-extraction`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  listPendingClinicalAlerts: () => request<ClinicalAlert[]>('/admin/clinical-alerts/pending'),
  acknowledgeClinicalAlert: (alertId: string) =>
    request<ClinicalAlert>(`/admin/clinical-alerts/${alertId}/acknowledge`, { method: 'PUT' }),

  getClinicianSession: (sessionId: string) => request<SofiaSession & { user_name: string }>(`/admin/sessions/${sessionId}`),
  sendClinicianMessage: (sessionId: string, message: string) =>
    request<SofiaSession>(`/admin/sessions/${sessionId}/messages`, { method: 'POST', body: JSON.stringify({ message }) })
};
