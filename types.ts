
export interface Phrase {
  id: string;
  chinese: string;
  english: string;
  consecutiveCorrect: number; // 'x' in the algorithm
  consecutiveWrong: number;
  totalReviews: number;
  lastReviewedAt?: number;
  note?: string;
}

export interface DeckStats {
  totalStudyTimeSeconds: number;
  totalReviewCount: number;
}

export interface DeckSessionLog {
  id: string;
  timestamp: number;
  mode: 'STUDY' | 'EXAM';
  durationSeconds: number;
  reviewCount: number;
  correctCount: number;
  wrongCount: number;
}

export interface Deck {
  id: string;
  name: string;
  phrases: Phrase[];
  queue: string[]; // Array of Phrase IDs representing the study order
  stats?: DeckStats; // New: Milestones per deck
  sessionHistory?: DeckSessionLog[]; // New: Historical logs
}

export interface ActivityLog {
  deckId: string;
  deckName: string;
  mode: 'STUDY' | 'EXAM';
  count: number;
  correct: number;
  timestamp: number;
}

export interface DailyStats {
  date: string; // YYYY-MM-DD (Asia/Shanghai)
  reviewCount: number;
  correctCount: number; 
  wrongCount: number;   
  reviewedPhraseIds: string[]; // To track distinct phrases studied today
  studyTimeSeconds: number;
  activities?: ActivityLog[]; // New: Granular session logs
}

export interface GlobalStats {
  totalReviewCount: number;
  totalPhrasesCount: number; 
  totalStudyTimeSeconds: number;
  daily: DailyStats;
}

export interface BackupData {
  version: number;
  timestamp: number;
  decks: Deck[];
  stats: GlobalStats;
}

export enum AppView {
  DASHBOARD = 'DASHBOARD',
  STUDY = 'STUDY',
  IMPORT = 'IMPORT',
  EDIT_DECK = 'EDIT_DECK',
  EXAM_SETUP = 'EXAM_SETUP',
  EXAM_SESSION = 'EXAM_SESSION',
}

export enum CardState {
  HIDDEN = 'HIDDEN',       // Only Chinese shown
  VERIFYING = 'VERIFYING', // Clicked "Know", showing English + Correct/Incorrect buttons
  MISSED = 'MISSED',       // Clicked "Don't Know", showing English + Next button
  REVIEWED = 'REVIEWED',   // Clicked Correct/Incorrect, showing result + Next button
}

export interface StudySessionResult {
  phraseId: string;
  correct: boolean;
}
