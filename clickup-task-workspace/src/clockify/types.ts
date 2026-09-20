export interface ClockifyEntity {
  archived?: boolean;
  id: string;
  name: string;
}

export interface ClockifyTimeEntry {
  description?: string;
  id: string;
  projectId?: string;
  tagIds?: string[];
  timeInterval?: {
    end?: string;
    start?: string;
  };
}

export interface ClockifyUser {
  activeWorkspace?: string;
  id: string;
}

export interface CreateClockifyTimeEntry {
  description: string;
  end: string;
  projectId: string;
  start: string;
  tagIds: string[];
}