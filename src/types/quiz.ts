
export interface Question {
  question: string;
  type: 'single' | 'multiple' | 'text';
  options?: string[];
  correct: number | number[] | string;
  timeLimit?: number; // in seconds, default 60
}

export interface QuizSection {
  name: string;
  questions: Question[];
}

export interface QuizData {
  sections: QuizSection[];
  defaultTimeLimit?: number;
}

export interface Player {
  id: string;
  name: string;
  scores: Record<string, number>; // section name -> score
  totalScore: number;
  answers: Record<string, any>; // question id -> answer
  joinedAt: number;
}

export interface GameSession {
  id: string;
  adminId: string;
  quizData: QuizData;
  players: Record<string, Player>;
  currentQuestion: number;
  gameState: GameState;
  startedAt?: number;
  endedAt?: number;
}

export type GameState = 'setup' | 'waiting' | 'admin' | 'playing' | 'results';
