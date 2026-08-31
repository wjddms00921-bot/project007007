import React from 'react';
import { Sparkles, BookOpen, PenTool, Award, Library, LogOut, User, Shield, KeyRound, Home } from 'lucide-react';
import { StudentInfo, StudentGrowth, AVATAR_LIST, ACCESSORY_LIST } from '../types';
import { calculateLevel } from '../lib/gamification';

interface NavbarProps {
  currentUser?: StudentInfo | null;
  student?: StudentInfo | null;
  studentGrowth: StudentGrowth | null;
  isTeacher: boolean;
  activeView?: string;
  currentView?: string;
  onNavigate?: (view: string) => void;
  setCurrentView?: (view: string) => void;
  onOpenStudentLogin?: () => void;
  onOpenStudentAuth?: () => void;
  onOpenTeacherLogin?: () => void;
  onOpenTeacherAuth?: () => void;
  onLogout: () => void;
  onOpenChangePassword?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  student,
  studentGrowth,
  isTeacher,
  activeView,
  currentView,
  onNavigate,
  setCurrentView,
  onOpenStudentLogin,
  onOpenStudentAuth,
  onOpenTeacherLogin,
  onOpenTeacherAuth,
  onLogout,
  onOpenChangePassword,
}) => {
  const activeStudent = currentUser || student || null;
  const view = activeView || currentView || 'home';
  const setView = onNavigate || setCurrentView || (() => {});
  const openStudentAuth = onOpenStudentLogin || onOpenStudentAuth || (() => {});
  const openTeacherAuth = onOpenTeacherLogin || onOpenTeacherAuth || (() => {});

  const levelInfo = studentGrowth ? calculateLevel(studentGrowth.totalXP) : null;
  const currentAvatar = AVATAR_LIST.find(a => a.id === studentGrowth?.selectedCharacter?.avatarId) || AVATAR_LIST[0];
  const currentAccessory = ACCESSORY_LIST.find(a => a.id === studentGrowth?.selectedCharacter?.accessoryId) || ACCESSORY_LIST[0];

  return (
    <header className="sticky top-0 z-40 h-20 bg-white border-b-4 border-[#FFD93D] shadow-sm print:hidden flex items-center">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Brand Logo with Vibrant Coral Badge & Rotation */}
          <div
            id="nav-brand-logo"
            onClick={() => setView(isTeacher ? 'teacher-dashboard' : 'home')}
            className="flex items-center gap-3.5 cursor-pointer group"
          >
            <div className="w-12 h-12 bg-[#FF6B6B] rounded-2xl flex items-center justify-center shadow-lg transform -rotate-3 group-hover:rotate-0 transition-transform">
              <span className="text-white text-2xl font-black">AI</span>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-[#4D4D4D] tracking-tight">
                AI와 함께하는 <span className="text-[#4D96FF]">글쓰기 성장</span>
              </h1>
              <p className="text-[11px] font-bold text-[#888888] hidden sm:block">초등 국어 과정중심 생각 자람터</p>
            </div>
          </div>

          {/* Nav Items for Student */}
          {activeStudent && !isTeacher && (
            <nav className="hidden md:flex items-center gap-2">
              <button
                id="nav-btn-home"
                onClick={() => setView('home')}
                className={`px-3.5 py-2 rounded-2xl text-sm font-bold transition-all flex items-center gap-1.5 ${
                  view === 'home'
                    ? 'bg-[#FF6B6B] text-white shadow-md'
                    : 'bg-white text-[#4D4D4D] border-2 border-[#EEEEEE] hover:bg-amber-50'
                }`}
              >
                <span>🏠</span>
                홈
              </button>
              <button
                id="nav-btn-new-writing"
                onClick={() => setView('new-writing')}
                className={`px-3.5 py-2 rounded-2xl text-sm font-bold transition-all flex items-center gap-1.5 ${
                  view === 'new-writing'
                    ? 'bg-[#FF6B6B] text-white shadow-md'
                    : 'bg-white text-[#4D4D4D] border-2 border-[#EEEEEE] hover:bg-amber-50'
                }`}
              >
                <span>✍️</span>
                새 글 쓰기
              </button>
              <button
                id="nav-btn-my-writings"
                onClick={() => setView('my-writings')}
                className={`px-3.5 py-2 rounded-2xl text-sm font-bold transition-all flex items-center gap-1.5 ${
                  view === 'my-writings'
                    ? 'bg-[#FF6B6B] text-white shadow-md'
                    : 'bg-white text-[#4D4D4D] border-2 border-[#EEEEEE] hover:bg-amber-50'
                }`}
              >
                <span>📂</span>
                나의 글
              </button>
              <button
                id="nav-btn-bookshelf"
                onClick={() => setView('bookshelf')}
                className={`px-3.5 py-2 rounded-2xl text-sm font-bold transition-all flex items-center gap-1.5 ${
                  view === 'bookshelf' || view === 'book-creator'
                    ? 'bg-[#FF6B6B] text-white shadow-md'
                    : 'bg-white text-[#4D4D4D] border-2 border-[#EEEEEE] hover:bg-amber-50'
                }`}
              >
                <span>📚</span>
                나의 책장
              </button>
              <button
                id="nav-btn-growth"
                onClick={() => setView('growth')}
                className={`px-3.5 py-2 rounded-2xl text-sm font-bold transition-all flex items-center gap-1.5 ${
                  view === 'growth'
                    ? 'bg-[#FF6B6B] text-white shadow-md'
                    : 'bg-white text-[#4D4D4D] border-2 border-[#EEEEEE] hover:bg-amber-50'
                }`}
              >
                <span>🌱</span>
                나의 성장
              </button>
            </nav>
          )}

          {/* Nav Items for Teacher */}
          {isTeacher && (
            <nav className="hidden md:flex items-center gap-2">
              <button
                id="nav-teacher-dashboard"
                onClick={() => setView('teacher-dashboard')}
                className={`px-3.5 py-2 rounded-2xl text-sm font-bold transition-all flex items-center gap-1.5 ${
                  view === 'teacher-dashboard'
                    ? 'bg-[#4D96FF] text-white shadow-md'
                    : 'bg-white text-[#4D4D4D] border-2 border-[#EEEEEE] hover:bg-blue-50'
                }`}
              >
                <span>🛡️</span>
                학급 대시보드
              </button>
              <button
                id="nav-teacher-topics"
                onClick={() => setView('teacher-topics')}
                className={`px-3.5 py-2 rounded-2xl text-sm font-bold transition-all flex items-center gap-1.5 ${
                  view === 'teacher-topics'
                    ? 'bg-[#4D96FF] text-white shadow-md'
                    : 'bg-white text-[#4D4D4D] border-2 border-[#EEEEEE] hover:bg-blue-50'
                }`}
              >
                <span>🎯</span>
                주제 관리
              </button>
              <button
                id="nav-teacher-books"
                onClick={() => setView('teacher-books')}
                className={`px-3.5 py-2 rounded-2xl text-sm font-bold transition-all flex items-center gap-1.5 ${
                  view === 'teacher-books'
                    ? 'bg-[#4D96FF] text-white shadow-md'
                    : 'bg-white text-[#4D4D4D] border-2 border-[#EEEEEE] hover:bg-blue-50'
                }`}
              >
                <span>📚</span>
                학생 책장
              </button>
              <button
                id="nav-teacher-settings"
                onClick={() => setView('teacher-settings')}
                className={`px-3.5 py-2 rounded-2xl text-sm font-bold transition-all flex items-center gap-1.5 ${
                  view === 'teacher-settings'
                    ? 'bg-[#4D96FF] text-white shadow-md'
                    : 'bg-white text-[#4D4D4D] border-2 border-[#EEEEEE] hover:bg-blue-50'
                }`}
              >
                <span>⚙️</span>
                진단 & 설정
              </button>
            </nav>
          )}

          {/* Right Action Bar */}
          <div className="flex items-center gap-4">
            {activeStudent && !isTeacher && (
              <div className="flex items-center gap-4">
                {/* Level Progress Indicator (Design Match) */}
                <div
                  onClick={() => setView('growth')}
                  className="hidden sm:flex flex-col items-end cursor-pointer group"
                >
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-0.5 bg-[#4D96FF] text-white text-xs font-bold rounded-full">
                      Lv.{levelInfo?.currentLevel.level} {levelInfo?.currentLevel.title}
                    </span>
                    <span className="text-sm sm:text-base font-bold text-[#4D4D4D] group-hover:text-[#4D96FF] transition-colors">
                      {activeStudent.studentName} 작가님
                    </span>
                  </div>
                  <div className="w-36 sm:w-44 h-2.5 bg-[#EEEEEE] rounded-full mt-1.5 relative overflow-hidden">
                    <div
                      className="absolute left-0 top-0 h-full bg-[#6BCB77] rounded-full transition-all duration-500"
                      style={{ width: `${levelInfo?.progressPercent || 0}%` }}
                    ></div>
                  </div>
                  <span className="text-[10px] font-bold text-[#888888] mt-0.5">
                    {levelInfo?.nextLevel
                      ? `다음 단계까지 ${levelInfo.xpForNext} XP 남음`
                      : '최고 레벨 도달'}
                  </span>
                </div>

                {/* Avatar Circle with Yellow border & shadow */}
                <div
                  onClick={() => setView('growth')}
                  title="캐릭터 및 레벨 보기"
                  className="w-12 h-12 sm:w-14 sm:h-14 bg-[#FFD93D] rounded-full border-4 border-white shadow-md flex items-center justify-center cursor-pointer hover:scale-105 transition-transform shrink-0"
                >
                  <div className="w-9 h-9 sm:w-10 sm:h-10 bg-white rounded-full flex items-center justify-center text-xl sm:text-2xl shadow-inner">
                    {currentAvatar.icon}
                  </div>
                </div>

                {onOpenChangePassword && (
                  <button
                    id="btn-change-student-pw"
                    onClick={onOpenChangePassword}
                    title="비밀번호 변경"
                    className="p-2 text-[#888888] hover:text-[#4D4D4D] hover:bg-[#EEEEEE]/60 rounded-xl transition-colors hidden sm:block"
                  >
                    <KeyRound className="w-4 h-4" />
                  </button>
                )}

                <button
                  id="btn-logout"
                  onClick={onLogout}
                  title="로그아웃"
                  className="p-2 text-[#888888] hover:text-[#FF6B6B] hover:bg-red-50 rounded-xl transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}

            {isTeacher && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-blue-50 border-2 border-blue-200 px-3.5 py-1.5 rounded-2xl">
                  <Shield className="w-4 h-4 text-[#4D96FF]" />
                  <span className="text-xs font-bold text-[#4D96FF]">선생님 관리 모드</span>
                </div>
                <button
                  id="btn-teacher-logout"
                  onClick={onLogout}
                  className="px-3.5 py-2 text-xs font-bold text-[#4D4D4D] hover:text-[#FF6B6B] bg-white border-2 border-[#EEEEEE] hover:bg-red-50 rounded-2xl flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  로그아웃
                </button>
              </div>
            )}

            {!activeStudent && !isTeacher && (
              <div className="flex items-center gap-2.5">
                <button
                  id="btn-nav-student-login"
                  onClick={openStudentAuth}
                  className="px-4 py-2.5 bg-[#FF6B6B] hover:opacity-90 active:scale-95 text-white rounded-2xl text-xs sm:text-sm font-bold shadow-md transition-all flex items-center gap-1.5"
                >
                  <User className="w-4 h-4" />
                  학생 로그인
                </button>
                <button
                  id="btn-nav-teacher-login"
                  onClick={openTeacherAuth}
                  className="px-3.5 py-2.5 bg-white hover:bg-gray-50 active:scale-95 text-[#4D4D4D] rounded-2xl text-xs sm:text-sm font-bold border-2 border-[#EEEEEE] transition-all flex items-center gap-1.5"
                >
                  <Shield className="w-4 h-4 text-[#888888]" />
                  교사 관리자
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Submenu for Student */}
        {activeStudent && !isTeacher && (
          <div className="md:hidden flex items-center justify-around py-2 border-t border-[#EEEEEE] text-xs">
            <button
              onClick={() => setView('home')}
              className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl font-bold ${view === 'home' ? 'text-[#FF6B6B]' : 'text-[#888888]'}`}
            >
              <span>🏠</span>
              <span>홈</span>
            </button>
            <button
              onClick={() => setView('new-writing')}
              className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl font-bold ${view === 'new-writing' ? 'text-[#FF6B6B]' : 'text-[#888888]'}`}
            >
              <span>✍️</span>
              <span>새 글</span>
            </button>
            <button
              onClick={() => setView('my-writings')}
              className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl font-bold ${view === 'my-writings' ? 'text-[#FF6B6B]' : 'text-[#888888]'}`}
            >
              <span>📂</span>
              <span>나의 글</span>
            </button>
            <button
              onClick={() => setView('bookshelf')}
              className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl font-bold ${view === 'bookshelf' || view === 'book-creator' ? 'text-[#FF6B6B]' : 'text-[#888888]'}`}
            >
              <span>📚</span>
              <span>책장</span>
            </button>
            <button
              onClick={() => setView('growth')}
              className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl font-bold ${view === 'growth' ? 'text-[#FF6B6B]' : 'text-[#888888]'}`}
            >
              <span>🌱</span>
              <span>성장</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

