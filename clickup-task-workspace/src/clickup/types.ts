export interface ClickUpAttachment {
  id: string;
  title?: string;
  url: string;
  url_w_host?: string;
  url_w_query?: string;
  mimetype?: string;
  size?: number;
  [key: string]: unknown;
}

export interface ClickUpUser {
  email?: string;
  id?: number;
  username?: string;
  [key: string]: unknown;
}

export interface ClickUpComment {
  comment?: unknown;
  comment_text?: string;
  date?: string;
  id?: string;
  user?: ClickUpUser;
  [key: string]: unknown;
}

export interface ClickUpTaskDetail {
  attachments?: ClickUpAttachment[];
  custom_id?: string | null;
  date_updated?: string;
  description?: string;
  id: string;
  markdown_description?: string;
  name: string;
  text_content?: string;
  url?: string;
  [key: string]: unknown;
}

export interface ClickUpCommentsResponse {
  comments?: ClickUpComment[];
}

export interface ClickUpTaskUpdate {
  markdown_content?: string;
  status?: string;
}
