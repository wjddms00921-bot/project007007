import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { StudentAuthModal } from './components/StudentAuthModal';
import { TeacherAuthModal } from './components/TeacherAuthModal';
import { StudentPasswordModal } from './components/StudentPasswordModal';
import { StudentHome } from './components/StudentHome';
import { WritingFlow } from './components/WritingFlow';
import { TopicSelectionView } from './components/TopicSelectionView';
import { MyWritings } from './components/MyWritings';
import { StudentGrowthView } from './components/StudentGrowthView';
import { BookCreator } from './components/BookCreator';
import { Bookshelf } from './components/Bookshelf';
import { TeacherDashboard } from './components/TeacherDashboard';
import { StudentInfo, StudentGrowth, DailyTopic } from './types';
import { bootstrapInitialDataIfEmpty } from './lib/defaultData';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './lib/firebase';
import { getTodayDateStr } from './lib/gamification';
import {
  PenTool,
  Sparkles,
  Award,
  BookOpen,
  School,
  Shield,
  ArrowRight,
  CheckCircle2,
  Library,
  Star,
} from 'lucide-react';

export default function App() {
  // Auth state
  const [currentUser, setCurrentUser] = useState<StudentInfo | null>(null);
  const [isTeacher, setIsTeacher] = useState<boolean>(false);
  const [studentGrowth, setStudentGrowth] = useState<StudentGrowth | null>(null);

  // Modals state
  const [showStudentLoginModal, setShowStudentLoginModal] = useState<boolean>(false);
  const [showTeacherLoginModal, setShowTeacherLoginModal] = useState<boolean>(false);
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState<boolean>(false);

  // Router view state
  const [currentView, setCurrentView] = useState<string>('home');
  const [activeWritingRecordId, setActiveWritingRecordId] = useState<string | undefined>(undefined);
  const [activeWritingTopic, setActiveWritingTopic] = useState<DailyTopic | null>(null);
  const [selectedMyWritingId, setSelectedMyWritingId] = useState<string | undefined>(undefined);

  // Initialize
  useEffect(() => {
    bootstrapInitialDataIfEmpty();
    // Check if student session was saved in sessionStorage
    try {
      const savedStudent = sessionStorage.getItem('active_student_session');
      if (savedStudent) {
        const parsed = JSON.parse(savedStudent) as StudentInfo;
        setCurrentUser(parsed);
        loadStudentGrowth(parsed);
      }
      const savedTeacher = sessionStorage.getItem('active_teacher_session');
      if (savedTeacher === 'true') {
        setIsTeacher(true);
      }
    } catch (_) {}
  }, []);

  const loadStudentGrowth = async (student: StudentInfo) => {
    try {
      const docRef = doc(db, 'studentGrowth', student.studentKey);
      const snap = await getDoc(docRef);
      const todayStr = getTodayDateStr();

      if (snap.exists()) {
        const data = snap.data() as StudentGrowth;
        setStudentGrowth(data);
      } else {
        // Initial growth doc
        const initGrowth: StudentGrowth = {
          studentKey: student.studentKey,
          studentName: student.studentName,
          totalXP: 0,
          todayXP: 0,
          todayXPDate: todayStr,
          completedWritingCount: 0,
          revisionCount: 0,
          writingDays: [todayStr],
          lastWritingDate: todayStr,
          earnedBadges: [],
          selectedCharacter: {
            avatarId: 'sprout',
            accessoryId: 'none',
            customTitle: '열정 가득한 글쓰기 작가',
          },
          updatedAt: Date.now(),
        };
        await setDoc(docRef, initGrowth);
        setStudentGrowth(initGrowth);
      }
    } catch (err) {
      console.error('Error loading growth:', err);
    }
  };

  const handleStudentLoginSuccess = (student: StudentInfo) => {
    setCurrentUser(student);
    setIsTeacher(false);
    sessionStorage.setItem('active_student_session', JSON.stringify(student));
    sessionStorage.removeItem('active_teacher_session');
    loadStudentGrowth(student);
    setCurrentView('home');
  };

  const handleTeacherLoginSuccess = () => {
    setIsTeacher(true);
    setCurrentUser(null);
    sessionStorage.setItem('active_teacher_session', 'true');
    sessionStorage.removeItem('active_student_session');
    setCurrentView('teacher-dashboard');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsTeacher(false);
    setStudentGrowth(null);
    sessionStorage.removeItem('active_student_session');
    sessionStorage.removeItem('active_teacher_session');
    setCurrentView('home');
  };

  const handleNavigate = (view: string, extraData?: any) => {
    if (view === 'writing-flow') {
      if (extraData?.recordId) {
        setActiveWritingRecordId(extraData.recordId);
        setActiveWritingTopic(null);
      } else if (extraData?.topic) {
        setActiveWritingRecordId(undefined);
        setActiveWritingTopic(extraData.topic);
      } else {
        setActiveWritingRecordId(undefined);
        setActiveWritingTopic(null);
      }
    }

    if (view === 'my-writings' && extraData?.selectedId) {
      setSelectedMyWritingId(extraData.selectedId);
    } else {
      setSelectedMyWritingId(undefined);
    }

    setCurrentView(view);
  };

  return (
    <div className="min-h-screen bg-[#FFFBEB] text-[#4D4D4D] flex flex-col font-sans selection:bg-[#FFD93D]/40">
      {/* Top Navigation */}
      <Navbar
        currentUser={currentUser}
        isTeacher={isTeacher}
        studentGrowth={studentGrowth}
        activeView={currentView}
        onNavigate={handleNavigate}
        onOpenStudentLogin={() => setShowStudentLoginModal(true)}
        onOpenTeacherLogin={() => setShowTeacherLoginModal(true)}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-8">
        {isTeacher ? (
          <TeacherDashboard onLogout={handleLogout} />
        ) : currentUser ? (
          <>
            {currentView === 'home' && (
              <StudentHome
                student={currentUser}
                studentGrowth={studentGrowth}
                onNavigate={handleNavigate}
                onOpenChangePassword={() => setShowPasswordChangeModal(true)}
              />
            )}

            {currentView === 'new-writing' && (
              <TopicSelectionView
                student={currentUser}
                onSelectTopic={(topic, customTitle) => {
                  if (customTitle) {
                    setActiveWritingRecordId(undefined);
                    setActiveWritingTopic({
                      id: 'custom',
                      title: customTitle,
                      description: '내가 직접 정한 자유 주제로 글을 씁니다.',
                      category: '자유글',
                      gradeLevel: currentUser.grade,
                      tips: ['떠오르는 생각을 솔직하고 생생하게 적어보세요.'],
                      minCharacters: 150,
                      isPublished: true,
                      createdAt: Date.now(),
                      updatedAt: Date.now(),
                    });
                  } else {
                    setActiveWritingRecordId(undefined);
                    setActiveWritingTopic(topic);
                  }
                  setCurrentView('writing-flow');
                }}
                onBack={() => setCurrentView('home')}
              />
            )}

            {currentView === 'writing-flow' && (
              <WritingFlow
                student={currentUser}
                recordId={activeWritingRecordId}
                initialTopic={activeWritingTopic}
                onBack={() => setCurrentView('home')}
                onCompleted={(recId) => {
                  setSelectedMyWritingId(recId);
                  setCurrentView('my-writings');
                }}
                onRefreshGrowth={() => loadStudentGrowth(currentUser)}
              />
            )}

            {currentView === 'my-writings' && (
              <MyWritings
                student={currentUser}
                initialSelectedId={selectedMyWritingId}
                onNavigate={handleNavigate}
              />
            )}

            {currentView === 'growth' && (
              <StudentGrowthView
                student={currentUser}
                growth={studentGrowth}
                onUpdateGrowth={(updated) => setStudentGrowth(updated)}
              />
            )}

            {currentView === 'book-creator' && (
              <BookCreator
                student={currentUser}
                onBack={() => setCurrentView('bookshelf')}
                onBookCreated={() => setCurrentView('bookshelf')}
              />
            )}

            {currentView === 'bookshelf' && (
              <Bookshelf student={currentUser} onNavigate={handleNavigate} />
            )}
          </>
        ) : (
          /* Logged Out / Landing View */
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-10">
            {/* Hero Section with Vibrant Coral & Yellow Accents */}
            <div className="bg-white rounded-3xl p-8 sm:p-12 border-4 border-[#FFD93D] shadow-lg text-center space-y-6 relative overflow-hidden">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#4D96FF] text-white text-xs font-black shadow-xs">
                <span>🎯</span>
                초등학생을 위한 AI 글쓰기 성장 &amp; 과정중심평가 플랫폼
              </div>

              <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight text-[#4D4D4D] max-w-3xl mx-auto">
                생각을 키우고, 마음을 담아<br />
                <span className="text-[#FF6B6B] underline decoration-[#FFD93D] decoration-wavy underline-offset-8">
                  나만의 특별한 이야기
                </span>
                를 완성해요!
              </h1>

              <p className="text-[#4D4D4D]/80 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed font-medium">
                생각 계획부터 초고, AI 다정한 피드백, 목표 기반 고쳐쓰기, 맞춤법 점검, 그리고 나만의 책 출판까지!
                글을 쓸 때마다 작가 레벨과 경험치(XP)가 자라납니다.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                <button
                  id="landing-student-login-btn"
                  onClick={() => setShowStudentLoginModal(true)}
                  className="w-full sm:w-auto px-8 py-4 bg-[#FF6B6B] hover:opacity-90 active:scale-95 text-white font-black text-base rounded-2xl shadow-md transition-all flex items-center justify-center gap-2.5"
                >
                  <PenTool className="w-5 h-5" />
                  학생 로그인 및 글쓰기 시작
                  <ArrowRight className="w-5 h-5" />
                </button>

                <button
                  id="landing-teacher-login-btn"
                  onClick={() => setShowTeacherLoginModal(true)}
                  className="w-full sm:w-auto px-6 py-4 bg-white hover:bg-gray-50 active:scale-95 text-[#4D4D4D] font-bold text-sm rounded-2xl border-2 border-[#EEEEEE] shadow-xs transition-all flex items-center justify-center gap-2"
                >
                  <School className="w-4 h-4 text-[#4D96FF]" />
                  교사 관리자 모드
                </button>
              </div>
            </div>

            {/* 8-Step Writing Process Showcase */}
            <div className="bg-white rounded-3xl border-2 border-[#EEEEEE] p-8 sm:p-10 shadow-xs space-y-6">
              <div className="text-center space-y-2">
                <span className="text-xs font-bold text-[#4D96FF] tracking-wider uppercase">Process Journey</span>
                <h2 className="text-2xl sm:text-3xl font-black text-[#4D4D4D]">
                  완성도 높은 8단계 체계적 글쓰기 여정
                </h2>
                <p className="text-xs sm:text-sm text-[#888888] max-w-xl mx-auto">
                  학생이 글쓰기의 주도권을 쥐고, AI는 학생의 글을 대신 써주지 않고 친절한 조언자 역할을 합니다.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
                {[
                  { step: '1', title: '주제 확인', desc: '풍부한 동기유발과 가이드 팁 확인', icon: '📖', color: 'bg-amber-100 text-amber-800' },
                  { step: '2', title: '생각 계획', desc: '키워드 마인드맵 & 처음-가운데-끝 구성', icon: '💡', color: 'bg-blue-100 text-blue-800' },
                  { step: '3', title: '초고 쓰기', desc: '생각을 자유롭게 150자 이상 풀어쓰기', icon: '✍️', color: 'bg-green-100 text-green-800' },
                  { step: '4', title: 'AI 피드백', desc: '칭찬, 보완점, 생각할 질문 다정히 제시', icon: '🤖', color: 'bg-purple-100 text-purple-800' },
                  { step: '5', title: '수정 목표', desc: '피드백 바탕 나만의 구체적 수정 계획', icon: '🎯', color: 'bg-rose-100 text-rose-800' },
                  { step: '6', title: '고쳐쓰기', desc: '초고와 목표를 비교하며 문장 다듬기', icon: '✨', color: 'bg-teal-100 text-teal-800' },
                  { step: '7', title: '자기평가', desc: '루브릭 자가점검 및 뿌듯한 점 성찰', icon: '⭐', color: 'bg-orange-100 text-orange-800' },
                  { step: '8', title: '맞춤법 점검', desc: '내용 보존하며 띄어쓰기·철자 교정', icon: '🔍', color: 'bg-indigo-100 text-indigo-800' },
                ].map((item) => (
                  <div
                    key={item.step}
                    className="p-5 rounded-2xl bg-white border-2 border-[#EEEEEE] hover:border-[#FFD93D] transition-all flex flex-col justify-between space-y-2 shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">{item.icon}</span>
                      <span className={`text-xs font-black px-2 py-0.5 rounded-full ${item.color}`}>
                        {item.step}단계
                      </span>
                    </div>
                    <div>
                      <h3 className="font-bold text-[#4D4D4D] text-sm">{item.title}</h3>
                      <p className="text-[11px] text-[#888888] mt-1 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Feature Highlights Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-3xl border-2 border-[#EEEEEE] shadow-xs space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-[#FFD93D] text-[#4D4D4D] flex items-center justify-center text-2xl font-black shadow-xs">
                  🏆
                </div>
                <h3 className="font-bold text-[#4D4D4D] text-base">동기부여 성장 게이미피케이션</h3>
                <p className="text-xs sm:text-sm text-[#888888] leading-relaxed">
                  단계별 완료 시 경험치(XP) 지급, 일일 최대 10 XP 상한제, 8가지 작가 배지 도감 수집 및 나만의 작가 캐릭터 꾸미기 지원.
                </p>
              </div>

              <div className="bg-white p-6 rounded-3xl border-2 border-[#EEEEEE] shadow-xs space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-[#4D96FF] text-white flex items-center justify-center text-2xl font-black shadow-xs">
                  📚
                </div>
                <h3 className="font-bold text-[#4D4D4D] text-base">나만의 이야기 책 출판 &amp; 인쇄</h3>
                <p className="text-xs sm:text-sm text-[#888888] leading-relaxed">
                  완성된 글들을 묶어 표지 색상과 상징 아이콘, 머리말, 지은이 소개를 넣어 실제 책처럼 인쇄 및 PDF 저장이 가능합니다.
                </p>
              </div>

              <div className="bg-white p-6 rounded-3xl border-2 border-[#EEEEEE] shadow-xs space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-[#6BCB77] text-white flex items-center justify-center text-2xl font-black shadow-xs">
                  🎓
                </div>
                <h3 className="font-bold text-[#4D4D4D] text-base">교사 과정중심평가 &amp; 안전한 보안</h3>
                <p className="text-xs sm:text-sm text-[#888888] leading-relaxed">
                  초고부터 퇴고까지 전 과정 비교 열람, AI 종합 평가 초안 생성, 학생 비밀번호 즉시 초기화 및 SHA-256 단방향 암호화 적용.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Vibrant Palette Footer */}
      <footer className="h-12 bg-[#F3F4F6] border-t border-[#EEEEEE] flex items-center justify-between px-6 sm:px-8 text-[11px] font-medium text-[#888888] print:hidden">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#6BCB77] inline-block animate-pulse"></span>
            Firestore: <strong className="text-[#6BCB77]">Connected</strong>
          </span>
          <span className="hidden sm:inline-flex items-center gap-1">
            Gemini AI: <strong className="text-[#4D96FF]">Active (2.5 Flash)</strong>
          </span>
        </div>
        <div>
          © 2026 AI와 함께하는 글쓰기 성장 • 초등 국어 교육 플랫폼
        </div>
      </footer>

      {/* Modals */}
      <StudentAuthModal
        isOpen={showStudentLoginModal}
        onClose={() => setShowStudentLoginModal(false)}
        onLoginSuccess={handleStudentLoginSuccess}
      />

      <TeacherAuthModal
        isOpen={showTeacherLoginModal}
        onClose={() => setShowTeacherLoginModal(false)}
        onLoginSuccess={handleTeacherLoginSuccess}
      />

      {currentUser && (
        <StudentPasswordModal
          isOpen={showPasswordChangeModal}
          student={currentUser}
          onClose={() => setShowPasswordChangeModal(false)}
          onSuccess={() => {}}
        />
      )}
    </div>
  );
}
