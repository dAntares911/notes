export interface Note {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  color: string;
  zIndex: number;
  priority: number; // 1-5, where 1 is highest priority (top)
}

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export type NoteColor = "yellow" | "pink" | "blue" | "green" | "orange";

export type NoteSize = "small" | "medium" | "large";

export type NotePriority = 1 | 2 | 3 | 4 | 5;
