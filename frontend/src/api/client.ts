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
  preferred_language?: string | null;
  total_sessions?: number;
}

export interface AuthResponse {
  token: string;
  user: SofiaUser;
}

export interface InlinePicker {
  type: 'best_life_elements' | 'concerns' | 'confidence_level';
  prompt: string;
}

export interface ConversationTurn {
  role: 'user' | 'assistant' | 'clinician';
  content: string;
  timestamp: string;
  authorName?: string;
  isOpening?: boolean;
  storyMoment?: boolean;
  quickReplies?: string[] | null;
  inlinePicker?: InlinePicker | null;
}

export interface PendingConfirmation {
  type: 'goal' | 'chapter' | 'value' | 'concern' | 'education_topic';
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
  quickReplies?: string[] | null;
  inlinePicker?: InlinePicker | null;
  storyMoment?: boolean;
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
  cultural_context?: string | null;
  risk_domains_covered?: string[];
  communication_pattern?: string | null;
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

// Mirrors backend/utils/llm/clinicalReportExtractionSchema.js -- candidate
// structured data extracted from a clinician-authored document (e.g. a
// post-diagnostic letter), distinct from the self-reported wellness
// candidates above. Every fact carries a source_excerpt and nothing here
// is ever pre-accepted; see ClinicalReportReviewModal.
export interface ClinicalReportClinician {
  name: string;
  role?: string;
}
export interface ClinicalReportAssessmentInfo {
  assessment_date?: string | null;
  report_date?: string | null;
  clinicians?: ClinicalReportClinician[];
  clinic_name?: string | null;
}
export interface ClinicalReportDiagnosis {
  stated_diagnosis: string;
  icd_or_read_code?: string | null;
  status?: string | null;
  source_excerpt: string;
}
export interface ClinicalReportFamilyHistory {
  father?: string | null;
  mother?: string | null;
  other?: string | null;
}
export interface ClinicalReportBackground {
  symptom_duration?: string | null;
  previous_occupation?: string | null;
  employment_status?: string | null;
  family_history?: ClinicalReportFamilyHistory | null;
  caregiving_history?: string | null;
  source_excerpt: string;
}
export interface ClinicalReportTextItem {
  text: string;
  source_excerpt: string;
}
export interface ClinicalReportSymptoms {
  cognitive?: ClinicalReportTextItem[];
  physical?: ClinicalReportTextItem[];
  sleep?: ClinicalReportTextItem[];
  mood_or_behavioral?: ClinicalReportTextItem[];
}
export interface ClinicalReportSubscore {
  domain: string;
  score: string;
}
export interface ClinicalReportAssessmentResult {
  test_name: string;
  score: string;
  subscores?: ClinicalReportSubscore[];
  interpretation?: string | null;
  date?: string | null;
  source_excerpt: string;
}
export interface ClinicalReportImagingOrLab {
  type: string;
  date?: string | null;
  findings: string;
  source_excerpt: string;
}
export interface ClinicalReportSafetyRiskNotes {
  concerns_identified: boolean;
  details?: string | null;
  source_excerpt: string;
}
export interface ClinicalReportCarePlanItem {
  item: string;
  category?: string | null;
  target_date?: string | null;
  source_excerpt: string;
}
export interface ClinicalReportNextReview {
  date?: string | null;
  details?: string | null;
}
export interface ClinicalReportSupportResource {
  name: string;
  description?: string | null;
  phone?: string | null;
  website?: string | null;
  source_excerpt: string;
}

export interface ClinicalReportCandidates {
  document_type?: string | null;
  assessment_info?: ClinicalReportAssessmentInfo | null;
  diagnosis?: ClinicalReportDiagnosis | null;
  patient_background?: ClinicalReportBackground | null;
  current_symptoms?: ClinicalReportSymptoms | null;
  assessment_results?: ClinicalReportAssessmentResult[];
  imaging_or_labs?: ClinicalReportImagingOrLab[];
  clinical_observations?: ClinicalReportTextItem[];
  safety_risk_notes?: ClinicalReportSafetyRiskNotes | null;
  care_plan?: ClinicalReportCarePlanItem[];
  next_review?: ClinicalReportNextReview | null;
  support_resources?: ClinicalReportSupportResource[];
}

export interface ClinicalReportExtractionResult {
  documentId: string;
  candidates: ClinicalReportCandidates;
}

export interface ApplyClinicalReportResult {
  clinicalReport: { id: string; report_date: string | null; assessment_date: string | null; applied_at: string; report_data: ClinicalReportCandidates };
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

export interface FeedbackItem {
  id: string;
  feedback_text: string;
  challenges_text?: string | null;
  improvements_text?: string | null;
  created_at: string;
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

// Mirrors backend/utils/studySurveyQuestions.js -- the canonical 16-
// question feasibility study instrument, served from the backend so
// question wording lives in exactly one place.
export type SurveyScale = 'likelihood' | 'agreement' | 'confidence' | 'open';
export type SurveySection = 'feasibility' | 'quality_of_life' | 'confidence_capability' | 'adaptability';

export interface StudySurveyQuestion {
  key: string;
  section: SurveySection;
  nptConstruct: string | null;
  scale: SurveyScale;
  text: string;
}

export interface StudySurveyQuestionsResult {
  surveyVersion: string;
  questions: StudySurveyQuestion[];
}

export interface StudySurveyResponse {
  id: string;
  user_id: string;
  submission_id: string;
  survey_version: string;
  question_key: string;
  rating: number | null;
  explanation: string | null;
  created_at: string;
}

export interface StudySurveyAnswerInput {
  questionKey: string;
  rating?: number;
  explanation?: string;
}

export interface StudySurveySummaryRow {
  questionKey: string;
  ratedCount: number;
  averageRating: number | null;
  responseCount: number;
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
  updateLanguagePreference: (preferredLanguage: string) =>
    request<{ id: string; preferred_language: string | null }>('/users/language-preference', {
      method: 'PUT',
      body: JSON.stringify({ preferredLanguage })
    }),
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
  extractClinicalReport: (documentId: string) =>
    request<ClinicalReportExtractionResult>(`/documents/${documentId}/extract-clinical-report`, { method: 'POST' }),
  applyClinicalReport: (documentId: string, report: ClinicalReportCandidates) =>
    request<ApplyClinicalReportResult>(`/documents/${documentId}/apply-clinical-report`, {
      method: 'POST',
      body: JSON.stringify({ report })
    }),

  submitFeedback: (data: { sessionId?: string; feedbackText: string; challengesText?: string; improvementsText?: string }) =>
    request<FeedbackItem>('/feedback', { method: 'POST', body: JSON.stringify(data) }),

  listPendingClinicalAlerts: () => request<ClinicalAlert[]>('/admin/clinical-alerts/pending'),
  acknowledgeClinicalAlert: (alertId: string) =>
    request<ClinicalAlert>(`/admin/clinical-alerts/${alertId}/acknowledge`, { method: 'PUT' }),

  getClinicianSession: (sessionId: string) => request<SofiaSession & { user_name: string }>(`/admin/sessions/${sessionId}`),
  sendClinicianMessage: (sessionId: string, message: string) =>
    request<SofiaSession>(`/admin/sessions/${sessionId}/messages`, { method: 'POST', body: JSON.stringify({ message }) }),

  getStudySurveyQuestions: () => request<StudySurveyQuestionsResult>('/study-survey/questions'),
  submitStudySurveyResponses: (responses: StudySurveyAnswerInput[]) =>
    request<{ submissionId: string; responses: StudySurveyResponse[] }>('/study-survey/responses', {
      method: 'POST',
      body: JSON.stringify({ responses })
    }),
  getMyStudySurveyResponses: () => request<StudySurveyResponse[]>('/study-survey/responses/mine'),
  getStudySurveySummary: () => request<StudySurveySummaryRow[]>('/study-survey/responses/summary')
};
