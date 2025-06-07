const API_BASE_URL = 'http://localhost:5001/api'; // Backend runs on port 5001 in Docker

interface RequestOptions extends RequestInit {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body?: any; // Allow any body type for now, will be stringified if object
  authenticated?: boolean;
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { body, authenticated = false, ...customConfig } = options;

  const headers: HeadersInit = {};

  // Only set Content-Type for non-FormData bodies
  if (!(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (authenticated) {
    const token = localStorage.getItem('aceMailAccessToken');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      // Handle cases where token is expected but not found,
      // e.g., redirect to login or throw a specific error.
      // For now, just log and proceed; backend will reject if needed.
      console.warn('Authenticated request made, but no token found in localStorage.');
    }
  }

  const config: RequestInit = {
    ...customConfig,
    headers: {
      ...headers,
      ...customConfig.headers, // Allow overriding headers
    },
  };

  if (body) {
    if (body instanceof FormData) {
      config.body = body; // Don't stringify FormData
    } else {
      config.body = JSON.stringify(body);
    }
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

    if (!response.ok) {
      // Attempt to parse error message from backend if available
      let errorMessage = `API request failed with status ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.msg || errorMessage;
      // eslint-disable-next-line no-empty
      } catch (e) {}
      throw new Error(errorMessage);
    }

    // Handle cases where response might be empty (e.g., 204 No Content)
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
      return await response.json() as T;
    } else {
      // For non-JSON responses or empty responses, resolve with null or handle as needed
      // Casting to T might be problematic if T expects an object and response is empty.
      // Consider returning response directly or a specific type for empty successful responses.
      return null as T; 
    }

  } catch (error) {
    console.error('API request error:', error);
    throw error; // Re-throw the error to be caught by the caller
  }
}

// Specific API call functions can be defined here
export const apiClient = {
  get: <T>(endpoint: string, options: Omit<RequestOptions, 'body' | 'method'> = {}) =>
    request<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, body: any, options: Omit<RequestOptions, 'body' | 'method'> = {}) =>
    request<T>(endpoint, { ...options, method: 'POST', body }),

  put: <T>(endpoint: string, body: any, options: Omit<RequestOptions, 'body' | 'method'> = {}) =>
    request<T>(endpoint, { ...options, method: 'PUT', body }),

  delete: <T>(endpoint: string, options: Omit<RequestOptions, 'body' | 'method'> = {}) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),

  // Example of an authenticated GET request
  getProfile: () => apiClient.get<{ status: string; user: { id: number; email: string } }>('/profile', { authenticated: true }),
  
  // Example for email sync
  syncEmails: (limit?: number, folder?: string) => apiClient.post<any>('/emails/sync', { limit, folder }, { authenticated: true }),

  // Incremental sync for new emails only
  syncNewEmails: (folder?: string) => apiClient.post<any>('/emails/sync-new', { folder }, { authenticated: true }),

  // Example for fetching emails
  getEmails: (page: number = 1, perPage: number = 20, folder: string = 'inbox') => 
    apiClient.get<any>(`/emails?page=${page}&per_page=${perPage}&folder=${folder}`, { authenticated: true }),

  // Get available folders
  getFolders: () => apiClient.get<any>('/folders', { authenticated: true }),

  // Send email
  sendEmail: async (emailData: {
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    body: string;
    is_html: boolean;
    attachments?: File[];
  }): Promise<any> => {
    if (emailData.attachments && emailData.attachments.length > 0) {
      // Use FormData for attachments
      const formData = new FormData();
      formData.append('to', emailData.to);
      if (emailData.cc) formData.append('cc', emailData.cc);
      if (emailData.bcc) formData.append('bcc', emailData.bcc);
      formData.append('subject', emailData.subject);
      formData.append('body', emailData.body);
      formData.append('is_html', emailData.is_html.toString());
      
      emailData.attachments.forEach((file) => {
        formData.append('attachments', file);
      });

      const response = await fetch(`${API_BASE_URL}/emails/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('aceMailAccessToken')}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    } else {
      // Use JSON for emails without attachments
      return apiClient.post<any>('/emails/send', emailData, { authenticated: true });
    }
  },

  // Search emails
  searchEmails: (query: string, folder: string = 'inbox', page: number = 1, perPage: number = 20) =>
    apiClient.get<any>(`/emails/search?q=${encodeURIComponent(query)}&folder=${folder}&page=${page}&per_page=${perPage}`, { authenticated: true }),

  async saveDraft(draftData: {
    to?: string;
    cc?: string;
    bcc?: string;
    subject?: string;
    body?: string;
    is_html?: boolean;
  }): Promise<any> {
    return apiClient.post<any>('/drafts', draftData, { authenticated: true });
  },

  async updateDraft(draftId: number, draftData: {
    to?: string;
    cc?: string;
    bcc?: string;
    subject?: string;
    body?: string;
    is_html?: boolean;
  }): Promise<any> {
    return apiClient.put<any>(`/drafts/${draftId}`, draftData, { authenticated: true });
  },

  async deleteDraft(draftId: number): Promise<any> {
    return apiClient.delete<any>(`/drafts/${draftId}`, { authenticated: true });
  },

  async deleteEmail(emailId: number, permanent = false): Promise<any> {
    return apiClient.post<any>(`/emails/${emailId}/delete`, { permanent }, { authenticated: true });
  },

  async archiveEmail(emailId: number): Promise<any> {
    return apiClient.post<any>(`/emails/${emailId}/archive`, {}, { authenticated: true });
  },

  async restoreEmail(emailId: number): Promise<any> {
    return apiClient.post<any>(`/emails/${emailId}/restore`, {}, { authenticated: true });
  },

  async bulkEmailAction(emailIds: number[], action: 'delete' | 'archive' | 'mark_read' | 'mark_unread' | 'restore'): Promise<any> {
    return apiClient.post<any>('/emails/bulk', { email_ids: emailIds, action }, { authenticated: true });
  },

  // AI Features
  async checkAIStatus(): Promise<{ status: string; ai_enabled: boolean }> {
    return apiClient.get<{ status: string; ai_enabled: boolean }>('/ai/status', { authenticated: true });
  },

  async summarizeEmail(emailId: number): Promise<{ status: string; summary?: string; message?: string }> {
    return apiClient.post<any>('/ai/summarize', { email_id: emailId }, { authenticated: true });
  },

  async extractActionItems(emailId: number): Promise<{ status: string; action_items?: string[]; message?: string }> {
    return apiClient.post<any>('/ai/action-items', { email_id: emailId }, { authenticated: true });
  },

  async composeReply(emailId: number, context?: string): Promise<{ status: string; reply?: string; message?: string }> {
    return apiClient.post<any>('/ai/compose-reply', { email_id: emailId, context }, { authenticated: true });
  },

  async generateContent(contentType: string, emailId?: number): Promise<{ status: string; generated_content?: string; message?: string }> {
    return apiClient.post<any>('/ai/generate-content', { content_type: contentType, email_id: emailId }, { authenticated: true });
  },

  async categorizeEmail(emailId: number): Promise<{ status: string; category?: string; message?: string }> {
    return apiClient.post<any>('/ai/categorize', { email_id: emailId }, { authenticated: true });
  },

  async improveDraft(content: string, type: 'general' | 'formal' | 'casual' | 'concise' | 'grammar' = 'general'): Promise<{ status: string; improved_content?: string; message?: string }> {
    return apiClient.post<any>('/ai/improve-draft', { content, type }, { authenticated: true });
  },

  async askAboutEmail(emailId: number, question: string): Promise<{ status: string; answer?: string; message?: string }> {
    return apiClient.post<any>('/ai/ask', { email_id: emailId, question }, { authenticated: true });
  },

};

// Note: The 'any' types for body and response in post/put/delete and some get calls
// should ideally be replaced with more specific types as your API evolves.
// The generic T in request<T> allows callers to specify expected response type.