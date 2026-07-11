import axios from 'axios';
import {
  api,
  setTokens,
  setStoredUser,
  clearAuth,
  getRefreshToken,
  getCognitoAuthToken,
  getCognitoAuthUser,
} from './api';
export * from './api';
import {
  AuthResponse,
  Document,
  DocumentDownloadUrlResponse,
  PresignedUploadResponse,
  Conversation,
  Message,
  Summary,
  SummaryType,
  Quiz,
  Exam,
  ExamAttempt,
  TutorRequest,
  TutorResponse,
} from '../types';

export const authService = {
  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/login', { email, password });
    setTokens(response.data.tokens.accessToken, response.data.tokens.refreshToken);
    setStoredUser(response.data.user);
    return response.data;
  },

  async register(email: string, password: string, name?: string): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/register', {
      email,
      password,
      ...(name ? { fullName: name } : {}),
    });
    setTokens(response.data.tokens.accessToken, response.data.tokens.refreshToken);
    setStoredUser(response.data.user);
    return response.data;
  },

  async logout() {
    const refreshToken = getRefreshToken();

    try {
      if (refreshToken) {
        await api.post('/auth/logout', { refreshToken });
      }
    } finally {
      clearAuth();
    }
  },
};

export const documentService = {
  async listDocuments(): Promise<Document[]> {
    const response = await api.get<{ documents: Document[] }>('/documents');
    return response.data.documents || [];
  },

  async uploadDocument(file: File, title?: string): Promise<Document> {
    const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new Error(`File is too large. Maximum size is 50MB. Your file: ${(file.size / 1024 / 1024).toFixed(1)}MB`);
    }

    if (file.type !== 'application/pdf') {
      throw new Error('Only PDF files are supported.');
    }

    const docTitle = title || file.name.replace(/\.[^/.]+$/, '');
    if (!getCognitoAuthToken() && !getCognitoAuthUser()) {
      throw new Error('Your sign-in session is still loading. Please refresh the page and try again.');
    }

    const presignedResp = await api.post<PresignedUploadResponse>('/documents/upload-url', {
      title: docTitle,
      contentType: file.type,
      sizeBytes: file.size,
    });

    const uploadHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(presignedResp.data.upload.headers || {})) {
      uploadHeaders[key.toLowerCase()] = value;
    }
    uploadHeaders['content-type'] = file.type;
    delete uploadHeaders['content-length'];
    delete uploadHeaders['Content-Length'];

    const uploadResp = await fetch(presignedResp.data.upload.url, {
      method: 'PUT',
      body: file,
      headers: uploadHeaders,
    });

    if (!uploadResp.ok) {
      throw new Error(`Storage upload failed: ${uploadResp.status} ${uploadResp.statusText}`);
    }

    try {
      const completeResp = await api.post<{ document: Document }>(`/documents/${presignedResp.data.document.id}/complete`, {});
      return completeResp.data.document;
    } catch (error) {
      throw normalizeApiError(error, 'Completing the upload failed. Please try again.');
    }
  },

  async getDocument(id: string): Promise<Document> {
    const response = await api.get<{ document: Document }>(`/documents/${id}`);
    return response.data.document;
  },

  async completeDocument(id: string): Promise<Document> {
    const response = await api.post<{ document: Document }>(`/documents/${id}/complete`, {});
    return response.data.document;
  },

  async getDownloadUrl(id: string): Promise<string> {
    const response = await api.get<DocumentDownloadUrlResponse>(`/documents/${id}/download-url`);
    return response.data.url;
  },

  async downloadDocumentFile(id: string, _title: string): Promise<void> {
    try {
      const url = await this.getDownloadUrl(id);
      const opened = window.open(url, '_blank', 'noopener,noreferrer');
      if (!opened) {
        window.location.assign(url);
      }
    } catch (error) {
      throw normalizeApiError(error, 'Downloading the PDF failed. Please try again.');
    }
  },

  async deleteDocument(id: string): Promise<void> {
    await api.delete(`/documents/${id}`);
  },
};

export const chatService = {
  async listConversations(_documentId?: string): Promise<Conversation[]> {
    return [];
  },

  async createConversation(title: string, documentId?: string): Promise<Conversation> {
    if (!documentId) throw new Error('documentId is required to create a conversation');
    const response = await api.post<{ conversation: Conversation }>('/chat/conversations', { title, documentId });
    return response.data.conversation;
  },

  async sendMessage(conversationId: string, content: string): Promise<Message> {
    const response = await api.post<{ assistantMessage?: Message; userMessage?: Message }>(
      `/chat/conversations/${conversationId}/messages`,
      { content }
    );
    return response.data.assistantMessage || (response.data as unknown as Message);
  },
};

export const summaryService = {
  async getSummary(documentId: string, type: SummaryType = 'FULL', chapterRef?: string): Promise<Summary> {
    const scope = type === 'FULL' ? 'full' : 'chapter';
    const url = `/documents/${documentId}/summary?scope=${scope}${chapterRef ? `&chapterRef=${encodeURIComponent(chapterRef)}` : ''}`;
    const response = await api.get<{ summary: Summary }>(url);
    return response.data.summary;
  },

  async generateSummary(documentId: string, scope: 'full' | 'chapter' = 'full', chapterRef?: string, forceRefresh = false): Promise<Summary> {
    const body: { scope: string; forceRefresh: boolean; chapterRef?: string } = { scope, forceRefresh };
    if (chapterRef) body.chapterRef = chapterRef;
    const response = await api.post<{ summary: Summary }>(`/documents/${documentId}/summary`, body);
    return response.data.summary;
  },
};

export const quizService = {
  async generateQuiz(documentId: string, _title?: string, numQuestions: number = 5): Promise<Quiz> {
    const response = await api.post<{ quiz: Quiz }>(`/documents/${documentId}/quizzes`, { numQuestions });
    return response.data.quiz;
  },

  async listQuizzes(documentId: string): Promise<Quiz[]> {
    const response = await api.get<{ quizzes: Quiz[] }>(`/documents/${documentId}/quizzes`);
    return response.data.quizzes || [];
  },

  async getQuiz(quizId: string): Promise<Quiz> {
    const response = await api.get<{ quiz: Quiz }>(`/quizzes/${quizId}`);
    return response.data.quiz;
  },
};

export const examService = {
  async generateExam(documentId: string, numQuestions: number = 10, timeLimitMinutes?: number): Promise<Exam> {
    const response = await api.post<{ exam: Exam }>(`/documents/${documentId}/exams`, { numQuestions, timeLimitMinutes });
    return response.data.exam;
  },

  async listExams(documentId: string): Promise<Exam[]> {
    const response = await api.get<{ exams: Exam[] }>(`/documents/${documentId}/exams`);
    return response.data.exams || [];
  },

  async getExam(examId: string, mode: 'take' | 'review' | 'grade' = 'take'): Promise<Exam> {
    const response = await api.get<{ exam: Exam }>(`/exams/${examId}?mode=${mode}`);
    return response.data.exam;
  },

  async submitAttempt(examId: string, answers: readonly { question_id: string; selected_answer: string }[]): Promise<ExamAttempt> {
    const response = await api.post<{ attempt: ExamAttempt }>(`/exams/${examId}/submit`, { answers });
    return response.data.attempt;
  },

  async submitQuizAttempt(quizId: string, answers: readonly { question_id: string; selected_answer: string }[]): Promise<ExamAttempt> {
    const response = await api.post<{ attempt: ExamAttempt }>(`/quizzes/${quizId}/submit`, { answers });
    return response.data.attempt;
  },

  async getAttempt(attemptId: string): Promise<ExamAttempt> {
    const response = await api.get<{ attempt: ExamAttempt }>(`/exam-attempts/${attemptId}`);
    return response.data.attempt;
  },

  async listAttempts(examId: string): Promise<ExamAttempt[]> {
    const response = await api.get<{ attempts: ExamAttempt[] }>(`/exams/${examId}/attempts`);
    return response.data.attempts || [];
  },
};

export const tutorService = {
  async askTutor(request: TutorRequest): Promise<TutorResponse> {
    const body: { question: string; documentId?: string; topic?: string } = {
      question: request.question,
    };
    if (request.documentId) body.documentId = request.documentId;
    const response = await api.post<TutorResponse>('/tutor/ask', body);
    return response.data;
  },
};

function normalizeApiError(error: unknown, fallbackMessage: string): Error {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: { message?: string } } | undefined;
    const message = data?.error?.message;
    if (message) {
      return new Error(message);
    }
  }

  return error instanceof Error ? error : new Error(fallbackMessage);
}
