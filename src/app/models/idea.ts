export interface IdeaAttachment {
  type: 'image' | 'audio';
  url: string;
  mimeType: string;
  size: number;
}

export interface IdeaSubmission {
  id?: string;
  employeeName: string;
  ideaText: string;
  createdAt: string;
  createdAtISO: string;
  userId?: string | null;
  audioUrl?: string;
  attachments?: IdeaAttachment[];
}
