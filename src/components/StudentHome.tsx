import React, { useState, useEffect } from 'react';
import { PenTool, BookOpen, Library, Award, Sparkles, Flame, Clock, CheckCircle2, ChevronRight, Bookmark, ArrowRight, RefreshCw, KeyRound } from 'lucide-react';
import { StudentInfo, StudentGrowth, WritingRecord, DailyTopic, BADGE_DEFINITIONS, AVATAR_LIST, ACCESSORY_LIST } from '../types';
import { calculateLevel, DAILY_MAX_XP, getTodayDateStr } from '../lib/gamification';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface StudentHomeProps {
  student: StudentInfo;
  studentGrowth: StudentGrowth | null;
  onNavigate: (view: string, extraData?: any) => void;
  onOpenChangePassword: () => void;
}

export const StudentHome: React.FC<StudentHomeProps> = ({
  student,
  studentGrowth,
  onNavigate,
  onOpenChangePassword,
}) => {
  const [recentWritings, setRecentWritings] = useState<WritingRecord[]>([]);
  const [inProgressWriting, setInProgressWriting] = useState<WritingRecord | null>(null);
  const [todayTopic, setTodayTopic] = useState<DailyTopic | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const levelInfo = studentGrowth ? calculateLevel(studentGrowth.totalXP) : null;
  const todayStr = getTodayDateStr();
  const todayXP = studentGrowth?.todayXPDate === todayStr ? (studentGrowth.todayXP || 0) : 0;

  // Character preview
  const currentAvatar = AVATAR_LIST.find(a => a.id === studentGrowth?.selectedCharacter?.avatarId) || AVATAR_LIST[0];
  const currentAccessory = ACCESSORY_LIST.find(a => a.id === studentGrowth?.selectedCharacter?.accessoryId) || ACCESSORY_LIST[0];

  useEffect(() => {
    loadDashboardData();
  }, [student.studentKey]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Load recent writings for this student
      const writingsQuery = query(
        collection(db, 'writingRecords'),
        where('studentKey', '==', student.studentKey),
        orderBy('updatedAt', 'desc'),
        limit(5)
      );
      const writingsSnap = await getDocs(writingsQuery);
      const records: WritingRecord[] = [];
      let foundInProgress: WritingRecord | null = null;

      writingsSnap.forEach((doc) => {
        const data = doc.data() as WritingRecord;
        records.push(data);
        if (data.status === 'in_progress' && !foundInProgress) {
          foundInProgress = data;
        }
      });

      setRecentWritings(records);
      setInProgressWriting(foundInProgress);

      // 2. Load daily topic
      const topicsQuery = query(
        collection(db, 'dailyTopics'),
        where('isPublished', '==', true),
        orderBy('createdAt', 'desc'),
        limit(3)
      );
      const topicsSnap = await getDocs(topicsQuery);
      if (!topicsSnap.empty) {
        setTodayTopic(topicsSnap.docs[0].data() as DailyTopic);
      }
    } catch (err: any) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getRecentEarnedBadges = () => {
    if (!studentGrowth?.earnedBadges || studentGrowth.earnedBadges.length === 0) {
      return [];
    }
    const sorted = [...studentGrowth.earnedBadges].sort((a, b) => b.earnedAt - a.earnedAt).slice(0, 4);
    return sorted.map((b) => {
      const def = BADGE_DEFINITIONS.find((d) => d.id === b.badgeId);
      return def ? { ...def, earnedAt: b.earnedAt } : null;
    }).filter(Boolean);
  };

  const recentBadges = getRecentEarnedBadges();

  // Calculate current active writing step for the mission stepper
  const activeStep = inProgressWriting?.currentStep || (recentWritings.length > 0 && recentWritings[0].status === 'submitted' ? 8 : 1);
  const missionProgressPercent = inProgressWriting ? Math.round((inProgressWriting.currentStep / 8) * 100) : 0;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* 1. Today's Mission Process Tracker (Vibrant Palette Spec) */}
      <section className="bg-white rounded-3xl p-6 sm:p-7 shadow-sm border-2 border-[#EEEEEE]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-6">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl sm:text-3xl">🎯</span>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-[#4D4D4D]">
                오늘의 글쓰기 미션 {inProgressWriting ? `• "${inProgressWriting.topicTitle}"` : todayTopic ? `• "${todayTopic.title}"` : ''}
              </h2>
              <p className="text-xs text-[#888888]">생각부터 퇴고까지 8단계를 거치며 글이 쑥쑥 자라납니다.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-[#6BCB77] bg-green-50 px-3 py-1 rounded-full border border-green-200">
              진행률 {inProgressWriting ? `${missionProgressPercent}%` : '대기 중'}
            </span>
            {inProgressWriting ? (
              <button
                id="btn-resume-mission-step"
                onClick={() => onNavigate('writing-flow', { recordId: inProgressWriting.recordId })}
                className="px-4 py-1.5 bg-[#FF6B6B] hover:opacity-90 active:scale-95 text-white font-bold text-xs rounded-full shadow-xs transition-all"
              >
                이어서 쓰기 &gt;
              </button>
            ) : (
              <button
                id="btn-start-mission-step"
                onClick={() => onNavigate('writing-flow', { topic: todayTopic })}
                className="px-4 py-1.5 bg-[#6BCB77] hover:opacity-90 active:scale-95 text-white font-bold text-xs rounded-full shadow-xs transition-all"
              >
                미션 시작 &gt;
              </button>
            )}
          </div>
        </div>

        {/* Stepper visual bar */}
        <div className="flex items-center justify-between overflow-x-auto py-2 px-1">
          {[
            { id: 1, label: '주제', icon: '📖' },
            { id: 2, label: '계획', icon: '💡' },
            { id: 3, label: '초고', icon: '✍️' },
            { id: 4, label: 'AI 피드백', icon: '🤖' },
            { id: 5, label: '수정목표', icon: '🎯' },
            { id: 6, label: '고쳐쓰기', icon: '✨' },
            { id: 7, label: '자기평가', icon: '⭐' },
            { id: 8, label: '맞춤법', icon: '🔍' },
          ].map((st, idx) => {
            const isCompleted = inProgressWriting ? inProgressWriting.currentStep > st.id : false;
            const isCurrent = inProgressWriting ? inProgressWriting.currentStep === st.id : st.id === 1;

            return (
              <React.Fragment key={st.id}>
                <div className="flex flex-col items-center gap-1.5 shrink-0">
                  <div
                    className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-bold text-sm sm:text-base transition-all shadow-sm ${
                      isCompleted
                        ? 'bg-[#6BCB77] text-white'
                        : isCurrent
                        ? 'bg-[#4D96FF] text-white shadow-md ring-4 ring-[#4D96FF]/20 animate-pulse'
                        : 'bg-[#EEEEEE] text-[#888888] opacity-60'
                    }`}
                  >
                    {isCompleted ? '✓' : st.icon}
                  </div>
                  <span
                    className={`text-[11px] sm:text-xs font-bold ${
                      isCurrent
                        ? 'text-[#4D96FF]'
                        : isCompleted
                        ? 'text-[#4D4D4D]'
                        : 'text-[#888888]'
                    }`}
                  >
                    {st.label}
                  </span>
                </div>
                {idx < 7 && (
                  <div
                    className={`h-1 flex-1 mx-1 sm:mx-2 rounded-full min-w-4 ${
                      inProgressWriting && inProgressWriting.currentStep > idx + 1
                        ? 'bg-[#6BCB77]'
                        : 'bg-[#EEEEEE]'
                    }`}
                  ></div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </section>

      {/* 2. Quick Action Grid (Vibrant Palette Buttons) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <button
          id="quick-btn-new-writing"
          onClick={() => onNavigate('new-writing')}
          className="p-4 bg-[#FF6B6B] text-white rounded-2xl shadow-md hover:opacity-90 active:scale-95 transition-all text-left flex flex-col justify-between"
        >
          <span className="text-2xl mb-2">✍️</span>
          <div>
            <div className="font-black text-sm">새 글 쓰기</div>
            <div className="text-[11px] text-white/80 mt-0.5 font-medium">새 주제 시작</div>
          </div>
        </button>

        <button
          id="quick-btn-resume"
          onClick={() => {
            if (inProgressWriting) {
              onNavigate('writing-flow', { recordId: inProgressWriting.recordId });
            } else {
              onNavigate('new-writing');
            }
          }}
          className="p-4 bg-white text-[#4D4D4D] border-2 border-[#EEEEEE] hover:border-[#FFD93D] hover:bg-amber-50/40 rounded-2xl shadow-xs active:scale-95 transition-all text-left flex flex-col justify-between"
        >
          <span className="text-2xl mb-2">⏳</span>
          <div>
            <div className="font-black text-sm">이어 쓰기</div>
            <div className="text-[11px] text-[#888888] mt-0.5">작성 중인 글</div>
          </div>
        </button>

        <button
          id="quick-btn-my-writings"
          onClick={() => onNavigate('my-writings')}
          className="p-4 bg-white text-[#4D4D4D] border-2 border-[#EEEEEE] hover:border-[#4D96FF] hover:bg-blue-50/40 rounded-2xl shadow-xs active:scale-95 transition-all text-left flex flex-col justify-between"
        >
          <span className="text-2xl mb-2">📂</span>
          <div>
            <div className="font-black text-sm">나의 글</div>
            <div className="text-[11px] text-[#888888] mt-0.5">작품 모음집</div>
          </div>
        </button>

        <button
          id="quick-btn-bookshelf"
          onClick={() => onNavigate('bookshelf')}
          className="p-4 bg-white text-[#4D4D4D] border-2 border-[#EEEEEE] hover:border-[#6BCB77] hover:bg-green-50/40 rounded-2xl shadow-xs active:scale-95 transition-all text-left flex flex-col justify-between"
        >
          <span className="text-2xl mb-2">📚</span>
          <div>
            <div className="font-black text-sm">나의 책장</div>
            <div className="text-[11px] text-[#888888] mt-0.5">출판된 책들</div>
          </div>
        </button>

        <button
          id="quick-btn-growth"
          onClick={() => onNavigate('growth')}
          className="p-4 bg-white text-[#4D4D4D] border-2 border-[#EEEEEE] hover:border-[#FFD93D] hover:bg-yellow-50/40 rounded-2xl shadow-xs active:scale-95 transition-all text-left flex flex-col justify-between"
        >
          <span className="text-2xl mb-2">🌱</span>
          <div>
            <div className="font-black text-sm">나의 성장</div>
            <div className="text-[11px] text-[#888888] mt-0.5">레벨 &amp; 배지</div>
          </div>
        </button>

        <button
          id="quick-btn-create-book"
          onClick={() => onNavigate('book-creator')}
          className="p-4 bg-white text-[#4D4D4D] border-2 border-[#EEEEEE] hover:border-purple-300 hover:bg-purple-50/40 rounded-2xl shadow-xs active:scale-95 transition-all text-left flex flex-col justify-between"
        >
          <span className="text-2xl mb-2">📖</span>
          <div>
            <div className="font-black text-sm">내 책 만들기</div>
            <div className="text-[11px] text-[#888888] mt-0.5">책 출판 &amp; 인쇄</div>
          </div>
        </button>
      </div>

      {/* 3. Main Dashboard Grid (Recent Works + Badges / Character) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Recent Works with Vibrant Left Borders */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border-2 border-[#EEEEEE] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-[#4D4D4D] flex items-center gap-2">
                <span>📑</span> 최근 작품
              </h2>
              <button
                onClick={() => onNavigate('my-writings')}
                className="text-xs font-bold text-[#4D96FF] hover:underline"
              >
                전체보기 &gt;
              </button>
            </div>

            {recentWritings.length === 0 ? (
              <div className="py-12 text-center text-[#888888] space-y-2">
                <div className="text-4xl">✍️</div>
                <p className="text-sm font-bold text-[#4D4D4D]">아직 작성한 글이 없습니다.</p>
                <p className="text-xs">첫 번째 글쓰기 미션을 시작해 볼까요?</p>
                <button
                  onClick={() => onNavigate('new-writing')}
                  className="mt-3 px-5 py-2.5 bg-[#FF6B6B] text-white font-bold text-xs rounded-2xl shadow-md hover:opacity-90 transition-all"
                >
                  새 글 쓰기 시작
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {recentWritings.slice(0, 3).map((rec, index) => {
                  const borderTheme =
                    rec.status === 'in_progress'
                      ? 'border-l-8 border-orange-400 bg-orange-50/70 text-orange-950'
                      : index % 2 === 0
                      ? 'border-l-8 border-green-400 bg-green-50/70 text-green-950'
                      : 'border-l-8 border-blue-400 bg-blue-50/70 text-blue-950';

                  const badgeEmoji =
                    rec.status === 'in_progress' ? '🔥' : index % 2 === 0 ? '🚀' : '✨';

                  return (
                    <div
                      key={rec.recordId}
                      onClick={() => {
                        if (rec.status === 'in_progress') {
                          onNavigate('writing-flow', { recordId: rec.recordId });
                        } else {
                          onNavigate('my-writings', { selectedId: rec.recordId });
                        }
                      }}
                      className={`p-4 rounded-2xl ${borderTheme} flex items-center justify-between cursor-pointer hover:scale-[1.01] transition-transform shadow-xs`}
                    >
                      <div className="min-w-0 pr-2">
                        <h3 className="font-black text-sm sm:text-base truncate">
                          {rec.topicTitle}
                        </h3>
                        <span className="text-xs opacity-80 block mt-0.5">
                          {rec.status === 'in_progress'
                            ? `${rec.currentStep}단계 작성 중 • ${(rec.draft || '').length}자`
                            : `제출 완료 • ${new Date(rec.updatedAt).toLocaleDateString('ko-KR')}`}
                        </span>
                      </div>
                      <span className="text-2xl shrink-0">{badgeEmoji}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-[#EEEEEE] flex items-center justify-between text-xs text-[#888888] font-medium">
            <span>완성된 글: <strong className="text-[#6BCB77]">{studentGrowth?.completedWritingCount || 0}편</strong></span>
            <span>고쳐쓰기 완료: <strong className="text-[#4D96FF]">{studentGrowth?.revisionCount || 0}회</strong></span>
          </div>
        </div>

        {/* Right Column: Badges Banner & Character Card */}
        <div className="flex flex-col gap-6">
          {/* Blue Badges Card (Design Spec: bg-[#4D96FF] rounded-3xl p-6 text-white shadow-lg) */}
          <div className="bg-[#4D96FF] rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-black flex items-center gap-2">
                  <span>🏅</span> 나의 배지 도감
                </h2>
                <button
                  onClick={() => onNavigate('growth')}
                  className="text-xs font-bold text-white/90 hover:underline"
                >
                  도감 보기 &gt;
                </button>
              </div>

              <div className="flex gap-3 overflow-x-auto py-1">
                {recentBadges.length > 0 ? (
                  recentBadges.map((badge: any) => (
                    <div
                      key={badge.id}
                      title={badge.title}
                      className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-2xl border border-white/30 backdrop-blur-xs shadow-xs shrink-0"
                    >
                      {badge.icon}
                    </div>
                  ))
                ) : (
                  <>
                    <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-2xl border border-white/30">🏆</div>
                    <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-2xl border border-white/30">✏️</div>
                    <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-2xl border border-white/30">⭐</div>
                    <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-2xl border border-white/10 opacity-50">?</div>
                  </>
                )}
              </div>
            </div>
            <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-white/10 rounded-full pointer-events-none"></div>
          </div>

          {/* Character Showcase Card (Design Spec) */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border-2 border-[#EEEEEE] flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-28 h-28 sm:w-32 sm:h-32 bg-yellow-50 rounded-full border-4 border-[#FFD93D] mb-3 flex items-center justify-center shadow-inner relative">
              <span className="text-5xl sm:text-6xl">{currentAvatar.icon}</span>
              {currentAccessory.id !== 'none' && (
                <div className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-[#FFD93D] border-2 border-white flex items-center justify-center text-lg shadow-sm">
                  {currentAccessory.icon}
                </div>
              )}
            </div>
            <h3 className="font-black text-base text-[#4D4D4D] mb-0.5">
              내 캐릭터: {currentAvatar.name}
            </h3>
            <p className="text-xs text-[#888888] font-medium">
              {studentGrowth?.selectedCharacter?.customTitle || '열정 가득한 글쓰기 작가'}
            </p>
            <button
              id="btn-character-customize"
              onClick={() => onNavigate('growth')}
              className="mt-4 px-6 py-2 bg-[#FFD93D] hover:opacity-90 active:scale-95 text-[#4D4D4D] font-black rounded-full text-sm shadow-md transition-all"
            >
              캐릭터 꾸미기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

