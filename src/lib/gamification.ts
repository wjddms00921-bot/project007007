import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { StudentGrowth, WRITER_LEVELS, WriterLevelMeta } from '../types';

export const STEP_XP_MAP: Record<string, number> = {
  planning: 1,
  draft: 2,
  feedback: 1,
  revisionGoal: 1,
  revision: 2,
  selfAssessment: 1,
  proofreading: 1,
  finalSubmit: 1,
};

export const DAILY_MAX_XP = 10;

export function getTodayDateStr(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function calculateLevel(totalXP: number): { currentLevel: WriterLevelMeta; nextLevel: WriterLevelMeta | null; progressPercent: number; xpForNext: number } {
  let currentLevel = WRITER_LEVELS[0];
  let nextLevel: WriterLevelMeta | null = WRITER_LEVELS[1];

  for (let i = 0; i < WRITER_LEVELS.length; i++) {
    if (totalXP >= WRITER_LEVELS[i].minXP) {
      currentLevel = WRITER_LEVELS[i];
      nextLevel = i < WRITER_LEVELS.length - 1 ? WRITER_LEVELS[i + 1] : null;
    }
  }

  if (!nextLevel) {
    return {
      currentLevel,
      nextLevel: null,
      progressPercent: 100,
      xpForNext: 0,
    };
  }

  const currentLevelMin = currentLevel.minXP;
  const nextLevelMin = nextLevel.minXP;
  const xpEarnedInLevel = totalXP - currentLevelMin;
  const xpNeededForLevel = nextLevelMin - currentLevelMin;
  const progressPercent = Math.min(100, Math.max(0, Math.round((xpEarnedInLevel / xpNeededForLevel) * 100)));
  const xpForNext = Math.max(0, nextLevelMin - totalXP);

  return {
    currentLevel,
    nextLevel,
    progressPercent,
    xpForNext,
  };
}

export async function getOrCreateStudentGrowth(studentKey: string, studentName?: string): Promise<StudentGrowth> {
  const growthRef = doc(db, 'studentGrowth', studentKey);
  const snap = await getDoc(growthRef);

  if (snap.exists()) {
    const data = snap.data() as StudentGrowth;
    const { currentLevel } = calculateLevel(data.totalXP || 0);
    if (data.writerLevel !== currentLevel.level) {
      await updateDoc(growthRef, { writerLevel: currentLevel.level });
      data.writerLevel = currentLevel.level;
    }
    return data;
  }

  const todayStr = getTodayDateStr();
  const initialGrowth: StudentGrowth = {
    studentKey,
    studentName: studentName || '학생',
    totalXP: 0,
    writerLevel: 1,
    todayXP: 0,
    todayXPDate: todayStr,
    completedWritingCount: 0,
    revisionCount: 0,
    writingDays: [todayStr],
    lastWritingDate: todayStr,
    selfAssessmentCount: 0,
    proofreadCount: 0,
    earnedBadges: [],
    selectedCharacter: {
      avatarId: 'sprout',
      accessoryId: 'none',
      customTitle: '성장하는 글씨앗',
    },
    unlockedItems: ['sprout', 'cat', 'dog', 'bear', 'none', 'pencil'],
    updatedAt: Date.now(),
  };

  await setDoc(growthRef, initialGrowth);
  return initialGrowth;
}

export interface GrantXPResult {
  granted: boolean;
  xpAwarded: number;
  newTotalXP: number;
  newLevel: number;
  leveledUp: boolean;
  newBadges: string[];
  reason?: string;
}

export async function awardStepXP(
  studentKey: string,
  stepKey: string,
  extraCounters?: {
    completedWriting?: boolean;
    revisionCompleted?: boolean;
    selfAssessmentCompleted?: boolean;
    proofreadCompleted?: boolean;
    bookCompleted?: boolean;
  }
): Promise<GrantXPResult> {
  const baseXP = STEP_XP_MAP[stepKey] || 0;
  const todayStr = getTodayDateStr();

  const growthRef = doc(db, 'studentGrowth', studentKey);
  const snap = await getDoc(growthRef);
  let currentGrowth: StudentGrowth;

  if (snap.exists()) {
    currentGrowth = snap.data() as StudentGrowth;
  } else {
    currentGrowth = await getOrCreateStudentGrowth(studentKey);
  }

  // Calculate daily XP limit
  let todayXP = currentGrowth.todayXPDate === todayStr ? (currentGrowth.todayXP || 0) : 0;
  const availableDailyXP = Math.max(0, DAILY_MAX_XP - todayXP);
  const xpToAward = Math.min(baseXP, availableDailyXP);

  const prevTotalXP = currentGrowth.totalXP || 0;
  const newTotalXP = prevTotalXP + xpToAward;
  const newTodayXP = todayXP + xpToAward;

  const prevLevel = currentGrowth.writerLevel || 1;
  const { currentLevel: calculatedLevel } = calculateLevel(newTotalXP);
  const newLevel = calculatedLevel.level;
  const leveledUp = newLevel > prevLevel;

  // Counters
  const completedWritingCount = (currentGrowth.completedWritingCount || 0) + (extraCounters?.completedWriting ? 1 : 0);
  const revisionCount = (currentGrowth.revisionCount || 0) + (extraCounters?.revisionCompleted ? 1 : 0);
  const selfAssessmentCount = (currentGrowth.selfAssessmentCount || 0) + (extraCounters?.selfAssessmentCompleted ? 1 : 0);
  const proofreadCount = (currentGrowth.proofreadCount || 0) + (extraCounters?.proofreadCompleted ? 1 : 0);

  const writingDaysSet = new Set(currentGrowth.writingDays || []);
  writingDaysSet.add(todayStr);
  const writingDays = Array.from(writingDaysSet);

  // Check Badges
  const earnedBadges = [...(currentGrowth.earnedBadges || [])];
  const existingBadgeIds = new Set(earnedBadges.map(b => b.badgeId));
  const newBadges: string[] = [];

  const checkAndAwardBadge = (badgeId: string, conditionMet: boolean) => {
    if (conditionMet && !existingBadgeIds.has(badgeId)) {
      earnedBadges.push({ badgeId, earnedAt: Date.now() });
      existingBadgeIds.add(badgeId);
      newBadges.push(badgeId);
    }
  };

  checkAndAwardBadge('first_piece', completedWritingCount >= 1);
  checkAndAwardBadge('start_revision', revisionCount >= 1);
  checkAndAwardBadge('ten_pieces', completedWritingCount >= 10);
  checkAndAwardBadge('twenty_pieces', completedWritingCount >= 20);
  checkAndAwardBadge('steady_writer', writingDays.length >= 3);
  checkAndAwardBadge('reflection_expert', selfAssessmentCount >= 5);
  checkAndAwardBadge('sentence_master', proofreadCount >= 5);
  if (extraCounters?.bookCompleted) {
    checkAndAwardBadge('my_book_complete', true);
  }

  // Update growth doc
  const updatedData: Partial<StudentGrowth> = {
    totalXP: newTotalXP,
    writerLevel: newLevel,
    todayXP: newTodayXP,
    todayXPDate: todayStr,
    completedWritingCount,
    revisionCount,
    selfAssessmentCount,
    proofreadCount,
    writingDays,
    lastWritingDate: todayStr,
    earnedBadges,
    updatedAt: Date.now(),
  };

  await updateDoc(growthRef, updatedData);

  return {
    granted: true,
    xpAwarded: xpToAward,
    newTotalXP,
    newLevel,
    leveledUp,
    newBadges,
  };
}
