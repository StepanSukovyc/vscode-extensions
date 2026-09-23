export interface ClickUpAttachment {
  id: string;
  parent_id?: string;
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
  attachments?: ClickUpAttachment[];
  comment?: unknown;
  comment_text?: string;
  date?: string;
  id?: string;
  reply_count?: number;
  replies?: ClickUpComment[];
  user?: ClickUpUser;
  [key: string]: unknown;
}

export interface ClickUpTaskDependency {
  depends_on?: string;
  task_id?: string;
  [key: string]: unknown;
}

export interface ClickUpTaskReference {
  custom_id?: string | null;
  id: string;
  name?: string;
  url?: string;
  [key: string]: unknown;
}

export interface ClickUpTaskDetail {
  attachments?: ClickUpAttachment[];
  custom_id?: string | null;
  date_updated?: string;
  dependencies?: ClickUpTaskDependency[];
  description?: string;
  id: string;
  markdown_description?: string;
  name: string;
  parent?: string | null;
  subtasks?: ClickUpTaskReference[];
  text_content?: string;
  top_level_parent?: string | null;
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
