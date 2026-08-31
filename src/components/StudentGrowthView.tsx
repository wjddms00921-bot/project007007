import React, { useState } from 'react';
import {
  Award,
  Sparkles,
  Flame,
  CheckCircle2,
  Lock,
  User,
  Crown,
  Smile,
  Zap,
  Save,
} from 'lucide-react';
import {
  StudentInfo,
  StudentGrowth,
  BADGE_DEFINITIONS,
  AVATAR_LIST,
  ACCESSORY_LIST,
} from '../types';
import { calculateLevel, DAILY_MAX_XP, getTodayDateStr } from '../lib/gamification';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface StudentGrowthViewProps {
  student: StudentInfo;
  growth: StudentGrowth | null;
  onUpdateGrowth: (growth: StudentGrowth) => void;
}

export const StudentGrowthView: React.FC<StudentGrowthViewProps> = ({
  student,
  growth,
  onUpdateGrowth,
}) => {
  const levelInfo = calculateLevel(growth?.totalXP || 0);
  const todayStr = getTodayDateStr();
  const todayXP = growth?.todayXPDate === todayStr ? (growth?.todayXP || 0) : 0;

  // Character custom state
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>(
    growth?.selectedCharacter?.avatarId || AVATAR_LIST[0].id
  );
  const [selectedAccessoryId, setSelectedAccessoryId] = useState<string>(
    growth?.selectedCharacter?.accessoryId || ACCESSORY_LIST[0].id
  );
  const [customTitle, setCustomTitle] = useState<string>(
    growth?.selectedCharacter?.customTitle || '열정 가득한 글쓰기 작가'
  );
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  const earnedBadgeMap = new Map<string, number>();
  growth?.earnedBadges?.forEach((b) => {
    earnedBadgeMap.set(b.badgeId, b.earnedAt);
  });

  const handleSaveCharacter = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const updatedGrowth: StudentGrowth = {
        studentKey: student.studentKey,
        studentName: student.studentName,
        totalXP: growth?.totalXP || 0,
        todayXP: growth?.todayXP || 0,
        todayXPDate: growth?.todayXPDate || todayStr,
        completedWritingCount: growth?.completedWritingCount || 0,
        revisionCount: growth?.revisionCount || 0,
        writingDays: growth?.writingDays || [todayStr],
        lastWritingDate: growth?.lastWritingDate || todayStr,
        earnedBadges: growth?.earnedBadges || [],
        selectedCharacter: {
          avatarId: selectedAvatarId,
          accessoryId: selectedAccessoryId,
          customTitle: customTitle.trim() || '빛나는 글쓰기 작가',
        },
        updatedAt: Date.now(),
      };

      const docRef = doc(db, 'studentGrowth', student.studentKey);
      await setDoc(docRef, updatedGrowth, { merge: true });
      onUpdateGrowth(updatedGrowth);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error('Save character error:', err);
    } finally {
      setSaving(false);
    }
  };

  const previewAvatar = AVATAR_LIST.find((a) => a.id === selectedAvatarId) || AVATAR_LIST[0];
  const previewAccessory = ACCESSORY_LIST.find((a) => a.id === selectedAccessoryId) || ACCESSORY_LIST[0];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight flex items-center gap-2.5">
          <Award className="w-7 h-7 text-amber-600" />
          나의 작가 성장 일지
        </h1>
        <p className="text-xs sm:text-sm text-stone-500 mt-1">
          글쓰기 활동으로 모은 경험치(XP), 획득한 배지, 그리고 나만의 작가 캐릭터를 꾸며보세요.
        </p>
      </div>

      {/* Level Summary Banner */}
      <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 rounded-3xl p-6 sm:p-8 text-white shadow-md flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-3 w-full md:w-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-xs font-semibold">
            <span>{levelInfo.currentLevel.badge}</span>
            <span>현재 작가 칭호</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold">
            Lv.{levelInfo.currentLevel.level} {levelInfo.currentLevel.title}
          </h2>
          <p className="text-xs sm:text-sm text-amber-100 max-w-lg">
            총 <strong>{growth?.totalXP || 0} XP</strong>를 모았습니다.
            {levelInfo.nextLevel
              ? ` 다음 단계인 [Lv.${levelInfo.nextLevel.level} ${levelInfo.nextLevel.title}]까지 ${levelInfo.xpForNext} XP 남았습니다.`
              : ' 최고 레벨에 도달했습니다!'}
          </p>

          {/* Progress bar */}
          <div className="w-full md:w-80 bg-white/20 rounded-full h-3 overflow-hidden mt-2">
            <div
              className="bg-white h-full rounded-full transition-all duration-500"
              style={{ width: `${levelInfo.progressPercent}%` }}
            ></div>
          </div>
        </div>

        {/* Growth Stats Pills */}
        <div className="grid grid-cols-2 gap-3 w-full md:w-auto shrink-0">
          <div className="bg-white/15 backdrop-blur-xs p-4 rounded-2xl border border-white/20 text-center">
            <div className="text-2xl font-extrabold">{growth?.completedWritingCount || 0}</div>
            <div className="text-xs text-amber-100 mt-0.5">완성한 작품 수</div>
          </div>
          <div className="bg-white/15 backdrop-blur-xs p-4 rounded-2xl border border-white/20 text-center">
            <div className="text-2xl font-extrabold">{growth?.revisionCount || 0}</div>
            <div className="text-xs text-amber-100 mt-0.5">고쳐쓰기 횟수</div>
          </div>
          <div className="bg-white/15 backdrop-blur-xs p-4 rounded-2xl border border-white/20 text-center">
            <div className="text-2xl font-extrabold">{growth?.writingDays?.length || 1}</div>
            <div className="text-xs text-amber-100 mt-0.5">글쓰기 참여 일수</div>
          </div>
          <div className="bg-white/15 backdrop-blur-xs p-4 rounded-2xl border border-white/20 text-center">
            <div className="text-2xl font-extrabold">{growth?.earnedBadges?.length || 0}</div>
            <div className="text-xs text-amber-100 mt-0.5">획득 배지 수</div>
          </div>
        </div>
      </div>

      {/* Character Customization Studio */}
      <div className="bg-white rounded-3xl border border-stone-200 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-4">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-stone-900 flex items-center gap-2">
              <Smile className="w-5 h-5 text-amber-600" />
              나만의 작가 캐릭터 &amp; 칭호 꾸미기
            </h2>
            <p className="text-xs text-stone-500">
              레벨이 올라가면 더 멋진 아바타와 장식 아이템을 착용할 수 있습니다.
            </p>
          </div>

          <button
            onClick={handleSaveCharacter}
            disabled={saving}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-all flex items-center gap-1.5 self-start sm:self-auto"
          >
            {saving ? (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : saveSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                저장 완료!
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                캐릭터 저장하기
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Character Live Preview */}
          <div className="bg-gradient-to-b from-amber-50 to-orange-50/50 border border-amber-200 rounded-3xl p-6 flex flex-col items-center justify-center text-center space-y-3">
            <div className="relative">
              <div className="w-24 h-24 rounded-3xl bg-white shadow-md flex items-center justify-center text-6xl transform hover:scale-105 transition-transform">
                {previewAvatar.icon}
              </div>
              {previewAccessory.id !== 'none' && (
                <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-amber-400 border-2 border-white flex items-center justify-center text-xl shadow-md">
                  {previewAccessory.icon}
                </div>
              )}
            </div>

            <div>
              <div className="text-xs font-bold text-amber-700">{previewAvatar.name}</div>
              <h3 className="font-extrabold text-stone-900 text-base">{student.studentName} 작가</h3>
              <div className="inline-block mt-1 px-3 py-1 rounded-full bg-amber-200 text-amber-900 text-[11px] font-bold">
                &ldquo;{customTitle || '열정 가득한 글쓰기 작가'}&rdquo;
              </div>
            </div>

            <div className="w-full pt-3">
              <label className="block text-[11px] font-bold text-stone-600 mb-1 text-left">
                나만의 작가 칭호 직접 입력
              </label>
              <input
                type="text"
                maxLength={20}
                placeholder="예: 호기심 많은 동화 작가"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-xl bg-white focus:ring-2 focus:ring-amber-500 outline-hidden"
              />
            </div>
          </div>

          {/* Select Avatar & Accessory */}
          <div className="lg:col-span-2 space-y-5">
            {/* Avatar List */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-stone-700">1. 아바타 캐릭터 선택</label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {AVATAR_LIST.map((av) => {
                  const isLocked = levelInfo.currentLevel.level < av.requiredLevel;
                  const isSelected = selectedAvatarId === av.id;

                  return (
                    <button
                      key={av.id}
                      disabled={isLocked}
                      onClick={() => setSelectedAvatarId(av.id)}
                      className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1 ${
                        isSelected
                          ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-400'
                          : isLocked
                          ? 'border-stone-200 bg-stone-100 opacity-50 cursor-not-allowed'
                          : 'border-stone-200 hover:border-amber-300 bg-white'
                      }`}
                    >
                      <span className="text-2xl">{av.icon}</span>
                      <span className="text-[11px] font-bold text-stone-800 truncate w-full">{av.name}</span>
                      {isLocked ? (
                        <span className="text-[9px] font-semibold text-rose-500 flex items-center gap-0.5">
                          <Lock className="w-2.5 h-2.5" /> Lv.{av.requiredLevel}
                        </span>
                      ) : (
                        <span className="text-[9px] text-stone-400">선택 가능</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Accessory List */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-stone-700">2. 장식 아이템 선택</label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {ACCESSORY_LIST.map((acc) => {
                  const isLocked = levelInfo.currentLevel.level < acc.requiredLevel;
                  const isSelected = selectedAccessoryId === acc.id;

                  return (
                    <button
                      key={acc.id}
                      disabled={isLocked}
                      onClick={() => setSelectedAccessoryId(acc.id)}
                      className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1 ${
                        isSelected
                          ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-400'
                          : isLocked
                          ? 'border-stone-200 bg-stone-100 opacity-50 cursor-not-allowed'
                          : 'border-stone-200 hover:border-amber-300 bg-white'
                      }`}
                    >
                      <span className="text-2xl">{acc.icon || '❌'}</span>
                      <span className="text-[11px] font-bold text-stone-800 truncate w-full">{acc.name}</span>
                      {isLocked ? (
                        <span className="text-[9px] font-semibold text-rose-500 flex items-center gap-0.5">
                          <Lock className="w-2.5 h-2.5" /> Lv.{acc.requiredLevel}
                        </span>
                      ) : (
                        <span className="text-[9px] text-stone-400">선택 가능</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Badges Collection / Encyclopedia */}
      <div className="bg-white rounded-3xl border border-stone-200 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="border-b border-stone-100 pb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-stone-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-orange-500" />
              배지 도감
            </h2>
            <p className="text-xs text-stone-500">
              글쓰기 미션을 달성하여 총 {BADGE_DEFINITIONS.length}개의 작가 배지를 모두 수집해보세요!
            </p>
          </div>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-100 text-amber-800">
            {growth?.earnedBadges?.length || 0} / {BADGE_DEFINITIONS.length} 수집 완료
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {BADGE_DEFINITIONS.map((badge) => {
            const isEarned = earnedBadgeMap.has(badge.id);
            const earnedAt = earnedBadgeMap.get(badge.id);

            return (
              <div
                key={badge.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                  isEarned
                    ? 'bg-amber-50/50 border-amber-300 shadow-xs'
                    : 'bg-stone-50 border-stone-200 opacity-60'
                }`}
              >
                <div className="space-y-2 text-center">
                  <div
                    className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center text-3xl shadow-xs ${
                      isEarned ? 'bg-amber-100' : 'bg-stone-200 grayscale'
                    }`}
                  >
                    {badge.icon}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-stone-900">{badge.title}</h3>
                    <p className="text-xs text-stone-500 mt-0.5">{badge.condition}</p>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-stone-100 text-center">
                  {isEarned ? (
                    <span className="text-[11px] font-bold text-emerald-700 flex items-center justify-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {new Date(earnedAt!).toLocaleDateString('ko-KR', {
                        month: 'short',
                        day: 'numeric',
                      })}{' '}
                      획득
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold text-stone-400 flex items-center justify-center gap-1">
                      <Lock className="w-3.5 h-3.5" /> 미획득
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
