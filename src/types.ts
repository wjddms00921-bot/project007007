export type NameDisplayMode = 'full' | 'masked' | 'first_only' | 'initials';

export interface ClassInfo {
  id: string; // e.g. "cls_2026_3_1"
  schoolYear: number;
  grade: number;
  classNum: number;
  className?: string;
  classPasswordHash: string; // SHA-256
  createdAt: number;
  updatedAt?: number;
}

export interface StudentInfo {
  studentKey: string; // `${schoolYear}_${grade}_${classNum}_${studentNumber}`
  classId: string;
  schoolYear: number;
  grade: number;
  classNum: number;
  studentNumber: number;
  studentName: string;
  personalPasswordHash?: string;
  isPasswordSet: boolean;
  isPasswordResetRequired: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface DailyTopic {
  id: string;
  classId?: string; // empty means all classes
  title: string;
  description: string;
  category: string; // e.g. '생활문', '독서감상문', '설명문', '주장하는 글', '일기', '상상글'
  gradeLevel?: number; // 1-6
  minCharacters: number; // default 150
  tips?: string[];
  isPublished: boolean;
  createdAt: number;
  updatedAt?: number;
}

export interface AIFeedbackData {
  goodPoints: string[];
  improvementPoints: string[];
  reasoning: string;
  priorityFix: string;
  thinkingQuestion: string;
}

export interface SpellingCorrection {
  id: string;
  original: string;
  corrected: string;
  reason: string;
  type: '맞춤법' | '띄어쓰기' | '문장부호' | '오타';
}

export interface SelfAssessmentData {
  rubricAnswers: {
    question: string;
    score: number; // 1-5
  }[];
  satisfactionRating: number; // 1-5
  pridePoint: string;
  futureEffort: string;
}

export interface WritingRecord {
  recordId: string;
  studentKey: string;
  classId: string;
  studentName: string;
  topicId: string;
  topicTitle: string;
  minCharacters: number;
  
  // Step data
  planning: {
    mindmapKeywords?: string[];
    outlineBeginning?: string;
    outlineMiddle?: string;
    outlineEnd?: string;
    characterOrSetting?: string;
    notes?: string;
  };
  draft: string;
  aiFeedback: AIFeedbackData | null;
  revisionGoal: string;
  revisedWriting: string;
  selfAssessment: SelfAssessmentData | null;
  beforeProofreading: string;
  afterProofreading: string;
  spellingCorrections?: SpellingCorrection[];
  finalWriting: string;
  
  currentStep: number; // 1 to 9
  status: 'in_progress' | 'submitted';
  favorite: boolean;
  xpGranted: {
    planning?: boolean;
    draft?: boolean;
    feedback?: boolean;
    revisionGoal?: boolean;
    revision?: boolean;
    selfAssessment?: boolean;
    proofreading?: boolean;
    finalSubmit?: boolean;
  };
  
  // Teacher & Assessment
  teacherAssessment?: string;
  teacherMemo?: string;

  createdAt: number;
  updatedAt: number;
  submittedAt?: number;
}

export interface StudentGrowth {
  studentKey: string;
  studentName?: string;
  totalXP: number;
  writerLevel?: number;
  todayXP: number;
  todayXPDate: string; // YYYY-MM-DD
  completedWritingCount: number;
  revisionCount: number;
  writingDays: string[]; // ['2026-08-31', ...]
  lastWritingDate?: string;
  selfAssessmentCount?: number;
  proofreadCount?: number;
  earnedBadges: {
    badgeId: string;
    earnedAt: number;
  }[];
  selectedCharacter: {
    avatarId: string;
    accessoryId: string;
    customTitle?: string;
  };
  unlockedItems?: string[];
  updatedAt: number;
}

export interface StudentBook {
  bookId: string;
  studentKey: string;
  studentName: string;
  classId: string;
  schoolYear: number;
  grade: number;
  classNum: number;
  bookTitle: string;
  subtitle: string;
  coverColor: string;
  coverMotif: string;
  selectedWritingIds: string[];
  writingsContent: {
    recordId: string;
    title: string;
    content: string;
    createdAt: number;
  }[];
  foreword: string;
  authorBio: string;
  createdAt: number;
  updatedAt: number;
}

export interface SystemSettings {
  adminPasswordHash?: string;
  initialized: boolean;
  defaultNameDisplay: NameDisplayMode;
  siteTitle?: string;
  updatedAt?: number;
}

export interface WriterLevelMeta {
  level: number;
  title: string;
  minXP: number;
  badge: string;
  color: string;
}

export const WRITER_LEVELS: WriterLevelMeta[] = [
  { level: 1, title: '글씨앗', minXP: 0, badge: '🌱', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  { level: 2, title: '글새싹', minXP: 50, badge: '🌿', color: 'text-green-600 bg-green-50 border-green-200' },
  { level: 3, title: '이야기 탐험가', minXP: 120, badge: '🧭', color: 'text-teal-600 bg-teal-50 border-teal-200' },
  { level: 4, title: '생각 작가', minXP: 220, badge: '💡', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { level: 5, title: '표현 작가', minXP: 350, badge: '🎨', color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  { level: 6, title: '성장 작가', minXP: 520, badge: '🚀', color: 'text-violet-600 bg-violet-50 border-violet-200' },
  { level: 7, title: '멋진 작가', minXP: 750, badge: '⭐', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { level: 8, title: '이야기 장인', minXP: 1020, badge: '📜', color: 'text-orange-600 bg-orange-50 border-orange-200' },
  { level: 9, title: '글쓰기 전문가', minXP: 1350, badge: '👑', color: 'text-rose-600 bg-rose-50 border-rose-200' },
  { level: 10, title: '우리 반 대작가', minXP: 1750, badge: '🏆', color: 'text-yellow-600 bg-yellow-50 border-yellow-300' },
];

export const BADGE_DEFINITIONS = [
  { id: 'first_piece', title: '첫 작품 탄생', description: '첫 번째 글쓰기 작품을 완성하여 제출했습니다.', icon: '🎉', condition: '완성 1편' },
  { id: 'start_revision', title: '고쳐쓰기 첫걸음', description: 'AI 피드백을 보고 처음으로 고쳐쓰기를 완료했습니다.', icon: '✏️', condition: '고쳐쓰기 1회' },
  { id: 'ten_pieces', title: '열 편의 작가', description: '무려 10편의 글쓰기를 성실하게 완성했습니다.', icon: '📚', condition: '완성 10편' },
  { id: 'twenty_pieces', title: '스무 편의 작가', description: '20편의 작품을 완성한 대단한 작가입니다.', icon: '🏅', condition: '완성 20편' },
  { id: 'steady_writer', title: '꾸준한 글 작가', description: '서로 다른 3일 이상 꾸준히 글을 썼습니다.', icon: '🗓️', condition: '3일 글쓰기' },
  { id: 'reflection_expert', title: '돌아보기 달인', description: '자기평가를 5회 이상 꼼꼼히 작성했습니다.', icon: '🔍', condition: '자기평가 5회' },
  { id: 'sentence_master', title: '문장 다듬기 명수', description: '맞춤법·띄어쓰기 점검을 5회 이상 거쳤습니다.', icon: '✨', condition: '맞춤법 점검 5회' },
  { id: 'my_book_complete', title: '나만의 책 출판', description: '내가 쓴 글들을 모아 멋진 첫 책을 출판했습니다.', icon: '📖', condition: '책 제작 1권' },
];

export const AVATAR_LIST = [
  { id: 'sprout', name: '새싹 요정', icon: '🌱', requiredLevel: 1 },
  { id: 'cat', name: '꼬마 고양이', icon: '🐱', requiredLevel: 1 },
  { id: 'dog', name: '호기심 강아지', icon: '🐶', requiredLevel: 1 },
  { id: 'bear', name: '다정한 곰돌이', icon: '🐻', requiredLevel: 1 },
  { id: 'rabbit', name: '생각 토끼', icon: '🐰', requiredLevel: 2 },
  { id: 'fox', name: '지혜 여우', icon: '🦊', requiredLevel: 3 },
  { id: 'owl', name: '글쓰기 부엉이', icon: '🦉', requiredLevel: 4 },
  { id: 'lion', name: '용감한 사자', icon: '🦁', requiredLevel: 5 },
  { id: 'dragon', name: '상상 드래곤', icon: '🐉', requiredLevel: 7 },
  { id: 'unicorn', name: '마법 유니콘', icon: '🦄', requiredLevel: 9 },
];

export const ACCESSORY_LIST = [
  { id: 'none', name: '착용 안 함', icon: '', requiredLevel: 1 },
  { id: 'pencil', name: '황금 연필', icon: '✏️', requiredLevel: 1 },
  { id: 'glasses', name: '돋보기 안경', icon: '👓', requiredLevel: 2 },
  { id: 'book', name: '마법 이야기책', icon: '📖', requiredLevel: 3 },
  { id: 'feather', name: '깃털 펜', icon: '🪶', requiredLevel: 4 },
  { id: 'crown', name: '빛나는 왕관', icon: '👑', requiredLevel: 6 },
  { id: 'star_wand', name: '별빛 요술봉', icon: '🪄', requiredLevel: 8 },
];

export const COVER_COLORS = [
  'from-amber-500 to-orange-600',
  'from-emerald-600 to-teal-700',
  'from-blue-600 to-indigo-700',
  'from-purple-600 to-pink-600',
  'from-rose-500 to-red-600',
  'from-stone-700 to-stone-900',
];

export const COVER_MOTIFS = ['📖', '⭐', '🌱', '🚀', '🎨', '🏰', '🌈', '🦁', '🦉', '✨'];
