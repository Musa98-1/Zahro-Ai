
export interface Question {
  id: number;
  question: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  explanation: string;
}

export interface Certificate {
  id: string;
  date: string;
  expiryDate: string;
  fileName: string;
  score: number;
  total: number;
  grade: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C';
}

export interface QuizState {
  questions: Question[];
  currentQuestionIndex: number;
  score: number;
  isFinished: boolean;
  timeLeft: number; // soniyalarda
  userAnswers: { [key: number]: 'A' | 'B' | 'C' | 'D' | null };
  originalFileBase64?: string;
  originalFileName?: string;
  originalMimeType?: string;
  usedQuestionTexts: string[];
}
