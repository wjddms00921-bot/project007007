import React, { useState, useEffect } from 'react';
import {
  Users,
  School,
  BookOpen,
  Sparkles,
  Settings,
  Plus,
  KeyRound,
  Trash2,
  RefreshCw,
  Edit3,
  CheckCircle2,
  AlertCircle,
  Eye,
  Send,
  Lock,
  Layers,
  Wand2,
  FileText,
  Search,
  Filter,
  CheckSquare,
  Cpu,
  Zap,
  Activity,
} from 'lucide-react';
import {
  ClassInfo,
  StudentInfo,
  DailyTopic,
  WritingRecord,
  SystemSettings,
  NameDisplayMode,
} from '../types';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { sha256, formatStudentDisplayName } from '../lib/crypto';
import { generateTopicsAPI, generateAssessmentAPI, testGeminiConnection, GeminiConnectionTestResult } from '../lib/api';

interface TeacherDashboardProps {
  onLogout: () => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ onLogout }) => {
  const currentYear = new Date().getFullYear();
  const [activeTab, setActiveTab] = useState<'classes' | 'students' | 'topics' | 'writings' | 'settings'>('writings');

  // Data states
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [topics, setTopics] = useState<DailyTopic[]>([]);
  const [writings, setWritings] = useState<WritingRecord[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New Class Form State
  const [newSchoolYear, setNewSchoolYear] = useState<number>(currentYear);
  const [newGrade, setNewGrade] = useState<number>(3);
  const [newClassNum, setNewClassNum] = useState<number>(1);
  const [newClassPassword, setNewClassPassword] = useState<string>('');

  // New Student Form State
  const [singleStudentNum, setSingleStudentNum] = useState<number>(1);
  const [singleStudentName, setSingleStudentName] = useState<string>('');
  const [bulkStudentText, setBulkStudentText] = useState<string>('');

  // Topic Generator / Form State
  const [newTopicCategory, setNewTopicCategory] = useState<string>('생활문');
  const [newTopicGrade, setNewTopicGrade] = useState<number>(3);
  const [newTopicTitle, setNewTopicTitle] = useState<string>('');
  const [newTopicDesc, setNewTopicDesc] = useState<string>('');
  const [newTopicMinChars, setNewTopicMinChars] = useState<number>(150);
  const [newTopicTips, setNewTopicTips] = useState<string>('');
  const [generatingAITopics, setGeneratingAITopics] = useState<boolean>(false);
  const [aiTopicPrompt, setAiTopicPrompt] = useState<string>('');

  // Writing Assessment Inspection Modal State
  const [inspectingRecord, setInspectingRecord] = useState<WritingRecord | null>(null);
  const [teacherFeedbackInput, setTeacherFeedbackInput] = useState<string>('');
  const [generatingAssessment, setGeneratingAssessment] = useState<boolean>(false);

  // Change Admin Password State
  const [oldAdminPass, setOldAdminPass] = useState<string>('');
  const [newAdminPass, setNewAdminPass] = useState<string>('');
  const [confirmAdminPass, setConfirmAdminPass] = useState<string>('');

  // Search & Filter
  const [writingSearchKw, setWritingSearchKw] = useState<string>('');
  const [nameDisplayMode, setNameDisplayMode] = useState<NameDisplayMode>('full');

  // Gemini AI Connection Test State
  const [testingGemini, setTestingGemini] = useState<boolean>(false);
  const [geminiTestResult, setGeminiTestResult] = useState<GeminiConnectionTestResult | null>(null);

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      loadStudentsForClass(selectedClassId);
    }
  }, [selectedClassId]);

  const showMsg = (type: 'success' | 'error', text: string) => {
    setStatusMsg({ type, text });
    setTimeout(() => setStatusMsg(null), 4000);
  };

  const loadAllData = async () => {
    setLoading(true);
    try {
      // 1. Settings
      const settingsSnap = await getDoc(doc(db, 'settings', 'admin'));
      if (settingsSnap.exists()) {
        const sData = settingsSnap.data() as SystemSettings;
        setSettings(sData);
        if (sData.defaultNameDisplay) {
          setNameDisplayMode(sData.defaultNameDisplay);
        }
      }

      // 2. Classes
      const classSnap = await getDocs(collection(db, 'classes'));
      const cList: ClassInfo[] = [];
      classSnap.forEach((d) => cList.push(d.data() as ClassInfo));
      setClasses(cList);
      if (cList.length > 0 && !selectedClassId) {
        setSelectedClassId(cList[0].id);
      }

      // 3. Topics
      const topicSnap = await getDocs(collection(db, 'dailyTopics'));
      const tList: DailyTopic[] = [];
      topicSnap.forEach((d) => tList.push(d.data() as DailyTopic));
      setTopics(tList.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));

      // 4. Writings
      const writingSnap = await getDocs(collection(db, 'writingRecords'));
      const wList: WritingRecord[] = [];
      writingSnap.forEach((d) => wList.push(d.data() as WritingRecord));
      setWritings(wList.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)));
    } catch (err: any) {
      console.error('Error loading teacher data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStudentsForClass = async (cId: string) => {
    try {
      const q = query(collection(db, 'students'), where('classId', '==', cId));
      const sSnap = await getDocs(q);
      const sList: StudentInfo[] = [];
      sSnap.forEach((d) => sList.push(d.data() as StudentInfo));
      setStudents(sList.sort((a, b) => a.studentNumber - b.studentNumber));
    } catch (err) {
      console.error('Error loading students:', err);
    }
  };

  // 1. Class Actions
  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassPassword) {
      showMsg('error', '학급 비밀번호를 입력해주세요.');
      return;
    }

    try {
      const classId = `cls_${newSchoolYear}_${newGrade}_${newClassNum}`;
      const classPasswordHash = await sha256(newClassPassword);

      const classData: ClassInfo = {
        id: classId,
        schoolYear: Number(newSchoolYear),
        grade: Number(newGrade),
        classNum: Number(newClassNum),
        classPasswordHash,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await setDoc(doc(db, 'classes', classId), classData);
      setClasses([...classes.filter((c) => c.id !== classId), classData]);
      setSelectedClassId(classId);
      setNewClassPassword('');
      showMsg('success', `${newSchoolYear}학년도 ${newGrade}학년 ${newClassNum}반이 생성되었습니다!`);
    } catch (err: any) {
      showMsg('error', err.message || '학급 생성 중 오류가 발생했습니다.');
    }
  };

  const handleChangeClassPassword = async (targetClass: ClassInfo) => {
    const newPass = prompt(`${targetClass.grade}학년 ${targetClass.classNum}반의 새 학급 비밀번호를 입력하세요:`);
    if (!newPass) return;

    try {
      const hash = await sha256(newPass);
      await updateDoc(doc(db, 'classes', targetClass.id), {
        classPasswordHash: hash,
        updatedAt: Date.now(),
      });
      showMsg('success', '학급 비밀번호가 성공적으로 변경되었습니다.');
      loadAllData();
    } catch (err: any) {
      showMsg('error', err.message || '비밀번호 변경 실패');
    }
  };

  // 2. Student Actions
  const handleAddSingleStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassId) {
      showMsg('error', '먼저 학급을 선택해주세요.');
      return;
    }
    const currentCls = classes.find((c) => c.id === selectedClassId);
    if (!currentCls) return;

    const cleanName = singleStudentName.trim();
    if (!cleanName) {
      showMsg('error', '학생 이름을 입력해주세요.');
      return;
    }

    try {
      const studentKey = `${currentCls.schoolYear}_${currentCls.grade}_${currentCls.classNum}_${singleStudentNum}`;
      const newStudent: StudentInfo = {
        studentKey,
        classId: currentCls.id,
        schoolYear: currentCls.schoolYear,
        grade: currentCls.grade,
        classNum: currentCls.classNum,
        studentNumber: Number(singleStudentNum),
        studentName: cleanName,
        isPasswordSet: false,
        isPasswordResetRequired: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await setDoc(doc(db, 'students', studentKey), newStudent);
      setStudents([...students.filter((s) => s.studentKey !== studentKey), newStudent].sort((a, b) => a.studentNumber - b.studentNumber));
      setSingleStudentName('');
      setSingleStudentNum((prev) => prev + 1);
      showMsg('success', `${singleStudentNum}번 ${cleanName} 학생이 등록되었습니다.`);
    } catch (err: any) {
      showMsg('error', err.message || '학생 등록 중 오류');
    }
  };

  const handleBulkAddStudents = async () => {
    if (!selectedClassId) {
      showMsg('error', '먼저 학급을 선택해주세요.');
      return;
    }
    const currentCls = classes.find((c) => c.id === selectedClassId);
    if (!currentCls) return;

    const lines = bulkStudentText.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      showMsg('error', '등록할 학생 명단을 입력해주세요.');
      return;
    }

    let addedCount = 0;
    try {
      for (const line of lines) {
        // Parse format like "1 김철수" or "1, 김철수" or "김철수"
        let num = 0;
        let name = '';

        const match = line.match(/^(\d+)[\s,.\t]+(.+)$/);
        if (match) {
          num = parseInt(match[1], 10);
          name = match[2].trim();
        } else {
          // If no number, auto-assign
          num = students.length + addedCount + 1;
          name = line;
        }

        if (name) {
          const studentKey = `${currentCls.schoolYear}_${currentCls.grade}_${currentCls.classNum}_${num}`;
          const newStudent: StudentInfo = {
            studentKey,
            classId: currentCls.id,
            schoolYear: currentCls.schoolYear,
            grade: currentCls.grade,
            classNum: currentCls.classNum,
            studentNumber: num,
            studentName: name,
            isPasswordSet: false,
            isPasswordResetRequired: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          await setDoc(doc(db, 'students', studentKey), newStudent);
          addedCount++;
        }
      }

      setBulkStudentText('');
      loadStudentsForClass(currentCls.id);
      showMsg('success', `총 ${addedCount}명의 학생이 일괄 등록되었습니다.`);
    } catch (err: any) {
      showMsg('error', '일괄 등록 중 오류가 발생했습니다.');
    }
  };

  const handleResetStudentPassword = async (stu: StudentInfo) => {
    if (!confirm(`${stu.studentNumber}번 ${stu.studentName} 학생의 비밀번호를 초기화하시겠습니까?\n(초기화 후 학생은 학급 비밀번호로 접속하여 새 비밀번호를 설정하게 됩니다.)`)) {
      return;
    }

    try {
      await updateDoc(doc(db, 'students', stu.studentKey), {
        isPasswordResetRequired: true,
        updatedAt: Date.now(),
      });
      setStudents(students.map((s) => s.studentKey === stu.studentKey ? { ...s, isPasswordResetRequired: true } : s));
      showMsg('success', `${stu.studentName} 학생의 비밀번호 초기화 요청이 완료되었습니다.`);
    } catch (err) {
      showMsg('error', '비밀번호 초기화 실패');
    }
  };

  // 3. Topic Actions
  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopicTitle.trim()) {
      showMsg('error', '주제 제목을 입력해주세요.');
      return;
    }

    try {
      const topicId = `top_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const tipsArray = newTopicTips.split('\n').map((t) => t.trim()).filter(Boolean);

      const topicData: DailyTopic = {
        id: topicId,
        title: newTopicTitle.trim(),
        description: newTopicDesc.trim(),
        category: newTopicCategory,
        gradeLevel: Number(newTopicGrade),
        tips: tipsArray,
        minCharacters: Number(newTopicMinChars) || 150,
        isPublished: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await setDoc(doc(db, 'dailyTopics', topicId), topicData);
      setTopics([topicData, ...topics]);
      setNewTopicTitle('');
      setNewTopicDesc('');
      setNewTopicTips('');
      showMsg('success', '새 글쓰기 주제가 등록 및 배포되었습니다.');
    } catch (err: any) {
      showMsg('error', '주제 등록 중 오류');
    }
  };

  const handleGenerateAITopics = async () => {
    setGeneratingAITopics(true);
    try {
      const res = await generateTopicsAPI({
        gradeLevel: newTopicGrade,
        category: newTopicCategory,
        prompt: aiTopicPrompt.trim() || undefined,
      });

      if (res.success && res.topics && res.topics.length > 0) {
        const first = res.topics[0];
        setNewTopicTitle(first.title);
        setNewTopicDesc(first.description);
        setNewTopicMinChars(first.minCharacters || 150);
        setNewTopicTips(first.tips?.join('\n') || '');
        showMsg('success', `AI가 ${res.topics.length}개의 맞춤형 주제를 추천했습니다!`);
      } else {
        showMsg('error', res.error || 'AI 주제 생성 실패');
      }
    } catch (err: any) {
      showMsg('error', 'AI 연결 중 오류 발생');
    } finally {
      setGeneratingAITopics(false);
    }
  };

  const handleToggleTopicPublish = async (topic: DailyTopic) => {
    const newStatus = !topic.isPublished;
    try {
      await updateDoc(doc(db, 'dailyTopics', topic.id), {
        isPublished: newStatus,
        updatedAt: Date.now(),
      });
      setTopics(topics.map((t) => (t.id === topic.id ? { ...t, isPublished: newStatus } : t)));
      showMsg('success', newStatus ? '주제가 배포되었습니다.' : '주제 배포가 중단되었습니다.');
    } catch (err) {
      showMsg('error', '상태 변경 오류');
    }
  };

  // 4. Writing Assessment & Inspection
  const handleOpenInspectRecord = (rec: WritingRecord) => {
    setInspectingRecord(rec);
    setTeacherFeedbackInput(rec.teacherAssessment || '');
  };

  const handleGenerateAIAssessment = async () => {
    if (!inspectingRecord) return;
    setGeneratingAssessment(true);
    try {
      const res = await generateAssessmentAPI({
        studentName: inspectingRecord.studentName,
        topicTitle: inspectingRecord.topicTitle,
        planning: inspectingRecord.planning,
        draft: inspectingRecord.draft,
        revisionGoal: inspectingRecord.revisionGoal,
        revisedWriting: inspectingRecord.revisedWriting,
        finalWriting: inspectingRecord.finalWriting,
        selfAssessment: inspectingRecord.selfAssessment,
      });

      if (res.success && res.assessment) {
        setTeacherFeedbackInput(res.assessment);
        showMsg('success', 'AI가 글쓰기 전 과정을 종합 분석한 과정중심평가 초안을 생성했습니다.');
      } else {
        showMsg('error', res.error || '평가 생성 실패');
      }
    } catch (err) {
      showMsg('error', '평가 생성 중 오류');
    } finally {
      setGeneratingAssessment(false);
    }
  };

  const handleSaveTeacherAssessment = async () => {
    if (!inspectingRecord) return;
    try {
      await updateDoc(doc(db, 'writingRecords', inspectingRecord.recordId), {
        teacherAssessment: teacherFeedbackInput.trim(),
        updatedAt: Date.now(),
      });
      setWritings(writings.map((w) => w.recordId === inspectingRecord.recordId ? { ...w, teacherAssessment: teacherFeedbackInput.trim() } : w));
      setInspectingRecord({ ...inspectingRecord, teacherAssessment: teacherFeedbackInput.trim() });
      showMsg('success', '교사 과정중심평가가 저장되었습니다. 학생이 자신의 보관함에서 확인할 수 있습니다.');
    } catch (err) {
      showMsg('error', '평가 저장 실패');
    }
  };

  // 5. System Settings & Password Change
  const handleChangeAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldAdminPass || !newAdminPass) {
      showMsg('error', '비밀번호를 모두 입력해주세요.');
      return;
    }
    if (newAdminPass !== confirmAdminPass) {
      showMsg('error', '새 비밀번호와 확인이 일치하지 않습니다.');
      return;
    }

    try {
      const oldHash = await sha256(oldAdminPass);
      if (settings?.adminPasswordHash && oldHash !== settings.adminPasswordHash) {
        showMsg('error', '현재 관리자 비밀번호가 일치하지 않습니다.');
        return;
      }

      const newHash = await sha256(newAdminPass);
      await updateDoc(doc(db, 'settings', 'admin'), {
        adminPasswordHash: newHash,
        updatedAt: Date.now(),
      });
      setSettings((prev) => prev ? { ...prev, adminPasswordHash: newHash } : null);
      setOldAdminPass('');
      setNewAdminPass('');
      setConfirmAdminPass('');
      showMsg('success', '관리자 비밀번호가 안전하게 변경되었습니다.');
    } catch (err: any) {
      showMsg('error', '비밀번호 변경 중 오류');
    }
  };

  const handleSaveNameDisplayMode = async (mode: NameDisplayMode) => {
    setNameDisplayMode(mode);
    try {
      await updateDoc(doc(db, 'settings', 'admin'), {
        defaultNameDisplay: mode,
        updatedAt: Date.now(),
      });
      showMsg('success', `학생 이름 표시 방식이 '${mode}'(으)로 변경되었습니다.`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleTestGemini = async () => {
    setTestingGemini(true);
    setGeminiTestResult(null);
    try {
      const res = await testGeminiConnection();
      setGeminiTestResult(res);
      if (res.success) {
        showMsg('success', `Gemini AI 통신 성공! (${res.modelUsed || '연결됨'}, ${res.latencyMs || 0}ms)`);
      } else {
        showMsg('error', res.error || 'Gemini API 연결 실패');
      }
    } catch (err: any) {
      showMsg('error', '통신 중 네트워크 오류가 발생했습니다.');
    } finally {
      setTestingGemini(false);
    }
  };

  const currentSelectedClass = classes.find((c) => c.id === selectedClassId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Top Banner */}
      <div className="bg-stone-900 text-white p-6 sm:p-8 rounded-3xl shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold">
            <School className="w-3.5 h-3.5" />
            교사 관리자 전용 대시보드
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            AI 글쓰기 수업 &amp; 과정중심평가 관리
          </h1>
          <p className="text-xs sm:text-sm text-stone-400">
            학급별 학생 글쓰기 실시간 모니터링, 비밀번호 초기화, 맞춤형 주제 배포 및 AI 종합 평가 지원
          </p>
        </div>

        <button
          onClick={onLogout}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm rounded-xl transition-colors shrink-0"
        >
          관리자 로그아웃
        </button>
      </div>

      {/* Alert Status Notification */}
      {statusMsg && (
        <div
          className={`p-4 rounded-2xl text-xs sm:text-sm flex items-center gap-2.5 animate-in fade-in ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border border-rose-200 text-rose-900'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="bg-white p-2 rounded-2xl border border-stone-200 shadow-xs flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('writings')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-colors flex items-center gap-2 ${
            activeTab === 'writings'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          학생 글쓰기 현황 &amp; 평가 ({writings.length})
        </button>

        <button
          onClick={() => setActiveTab('students')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-colors flex items-center gap-2 ${
            activeTab === 'students'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          <Users className="w-4 h-4" />
          학생 관리 &amp; 비번 초기화
        </button>

        <button
          onClick={() => setActiveTab('topics')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-colors flex items-center gap-2 ${
            activeTab === 'topics'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          글쓰기 주제 관리 &amp; AI 추천
        </button>

        <button
          onClick={() => setActiveTab('classes')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-colors flex items-center gap-2 ${
            activeTab === 'classes'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          <School className="w-4 h-4" />
          학급 개설 &amp; 비밀번호
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-colors flex items-center gap-2 ${
            activeTab === 'settings'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          <Settings className="w-4 h-4" />
          시스템 설정
        </button>
      </div>

      {/* TAB 1: Writing Status & Process-Centered Assessment */}
      {activeTab === 'writings' && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <span className="text-xs font-bold text-stone-500 shrink-0">학급 선택:</span>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="px-3 py-1.5 text-xs font-bold border border-stone-300 rounded-xl bg-white text-stone-800 outline-hidden"
              >
                <option value="">전체 학급 보기</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.schoolYear}년 {c.grade}학년 {c.classNum}반
                  </option>
                ))}
              </select>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="학생 이름, 글 제목 검색"
                value={writingSearchKw}
                onChange={(e) => setWritingSearchKw(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-hidden"
              />
            </div>
          </div>

          {/* Writings Table */}
          <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-bold">
                  <tr>
                    <th className="py-3.5 px-4">학생 이름</th>
                    <th className="py-3.5 px-4">글쓰기 주제</th>
                    <th className="py-3.5 px-4">진행 단계</th>
                    <th className="py-3.5 px-4">초고 &gt; 최종 분량</th>
                    <th className="py-3.5 px-4">과정중심평가</th>
                    <th className="py-3.5 px-4 text-right">작업</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {writings
                    .filter((w) => !selectedClassId || w.classId === selectedClassId)
                    .filter((w) => {
                      if (!writingSearchKw.trim()) return true;
                      const kw = writingSearchKw.toLowerCase();
                      return (
                        w.studentName.toLowerCase().includes(kw) ||
                        w.topicTitle.toLowerCase().includes(kw)
                      );
                    })
                    .map((rec) => {
                      const isSubmitted = rec.status === 'submitted';
                      const draftLen = rec.draft?.length || 0;
                      const finalLen = (rec.finalWriting || rec.revisedWriting || rec.draft)?.length || 0;

                      return (
                        <tr key={rec.recordId} className="hover:bg-amber-50/30 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-stone-900">
                            {formatStudentDisplayName(rec.studentName, nameDisplayMode)}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-stone-900">{rec.topicTitle}</div>
                            <div className="text-[11px] text-stone-400">
                              {new Date(rec.updatedAt).toLocaleDateString('ko-KR')}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                isSubmitted
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {isSubmitted ? '완성 제출됨' : `${rec.currentStep}단계 작성 중`}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-stone-600 font-medium">
                            {draftLen}자 &rarr; <strong className="text-emerald-700">{finalLen}자</strong>
                          </td>
                          <td className="py-3.5 px-4">
                            {rec.teacherAssessment ? (
                              <span className="text-[11px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md">
                                평가 완료
                              </span>
                            ) : (
                              <span className="text-[11px] text-stone-400">미작성</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => handleOpenInspectRecord(rec)}
                              className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-amber-500 hover:text-white text-stone-700 font-bold text-xs transition-colors"
                            >
                              과정 열람 &amp; 평가
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Student Management */}
      {activeTab === 'students' && (
        <div className="space-y-6">
          {/* Class selector */}
          <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-stone-500">관리 대상 학급:</span>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="px-3 py-1.5 text-xs font-bold border border-stone-300 rounded-xl bg-white text-stone-800 outline-hidden"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.schoolYear}년 {c.grade}학년 {c.classNum}반
                  </option>
                ))}
              </select>
            </div>

            <span className="text-xs font-bold text-stone-500">총 학생 {students.length}명</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Registration Forms (1 col) */}
            <div className="space-y-6">
              {/* Single Add */}
              <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-xs space-y-4">
                <h3 className="font-bold text-stone-900 text-sm flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-amber-600" /> 학생 개별 등록
                </h3>

                <form onSubmit={handleAddSingleStudent} className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-stone-600 mb-1">번호</label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={singleStudentNum}
                        onChange={(e) => setSingleStudentNum(Number(e.target.value))}
                        className="w-full p-2 text-xs border border-stone-300 rounded-xl text-center outline-hidden"
                        required
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-bold text-stone-600 mb-1">이름</label>
                      <input
                        type="text"
                        placeholder="학생 이름"
                        value={singleStudentName}
                        onChange={(e) => setSingleStudentName(e.target.value)}
                        className="w-full p-2 text-xs border border-stone-300 rounded-xl outline-hidden"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl transition-colors shadow-xs"
                  >
                    학생 추가하기
                  </button>
                </form>
              </div>

              {/* Bulk Multi-line Add */}
              <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-xs space-y-3">
                <h3 className="font-bold text-stone-900 text-sm flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-amber-600" /> 여러 줄 일괄 등록
                </h3>
                <p className="text-[11px] text-stone-500">
                  줄마다 [번호 이름] 또는 [이름]을 입력하면 한 번에 등록됩니다.
                </p>

                <textarea
                  rows={5}
                  placeholder={`1 김철수\n2 이영희\n3 박민수`}
                  value={bulkStudentText}
                  onChange={(e) => setBulkStudentText(e.target.value)}
                  className="w-full p-3 text-xs border border-stone-300 rounded-xl font-mono outline-hidden"
                />

                <button
                  onClick={handleBulkAddStudents}
                  className="w-full py-2 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs rounded-xl transition-colors"
                >
                  명단 일괄 등록
                </button>
              </div>
            </div>

            {/* Right: Students Table & Password Reset (2 cols) */}
            <div className="lg:col-span-2 bg-white rounded-3xl border border-stone-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <h3 className="font-bold text-stone-900 text-base">
                  {currentSelectedClass ? `${currentSelectedClass.grade}학년 ${currentSelectedClass.classNum}반 학생 명단` : '학생 명단'}
                </h3>
                <span className="text-xs text-stone-400">비밀번호 분실 시 즉시 초기화 가능</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-stone-50 text-stone-600 font-bold border-b border-stone-200">
                    <tr>
                      <th className="py-2.5 px-3">번호</th>
                      <th className="py-2.5 px-3">이름</th>
                      <th className="py-2.5 px-3">비밀번호 상태</th>
                      <th className="py-2.5 px-3 text-right">초기화</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {students.map((stu) => (
                      <tr key={stu.studentKey} className="hover:bg-stone-50">
                        <td className="py-3 px-3 font-semibold text-stone-700">{stu.studentNumber}번</td>
                        <td className="py-3 px-3 font-bold text-stone-900">
                          {formatStudentDisplayName(stu.studentName, nameDisplayMode)}
                        </td>
                        <td className="py-3 px-3">
                          {stu.isPasswordResetRequired ? (
                            <span className="text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">
                              초기화 대기 중 (학급 비번으로 접속)
                            </span>
                          ) : stu.isPasswordSet ? (
                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                              설정 완료
                            </span>
                          ) : (
                            <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                              미설정 (최초 접속 시 등록)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => handleResetStudentPassword(stu)}
                            className="px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-rose-200"
                          >
                            비번 초기화
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Topic Management & AI Generator */}
      {activeTab === 'topics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Create / AI Generate (1 col) */}
            <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-xs space-y-4">
              <h3 className="font-bold text-stone-900 text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600" />
                새 주제 등록 &amp; AI 추천
              </h3>

              {/* AI Auto-Generate Box */}
              <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl space-y-3">
                <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  <Wand2 className="w-3.5 h-3.5 text-amber-600" />
                  Gemini AI 맞춤 글쓰기 주제 추천
                </div>
                <input
                  type="text"
                  placeholder="추가 요청사항 (예: 봄 소풍, 환경 보호, 과학의 달)"
                  value={aiTopicPrompt}
                  onChange={(e) => setAiTopicPrompt(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-amber-300 rounded-xl bg-white outline-hidden"
                />
                <button
                  type="button"
                  onClick={handleGenerateAITopics}
                  disabled={generatingAITopics}
                  className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  {generatingAITopics ? (
                    <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      AI 주제 자동 생성하여 채우기
                    </>
                  )}
                </button>
              </div>

              {/* Manual Form */}
              <form onSubmit={handleCreateTopic} className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-stone-600 mb-1">대상 학년</label>
                    <select
                      value={newTopicGrade}
                      onChange={(e) => setNewTopicGrade(Number(e.target.value))}
                      className="w-full p-2 text-xs border border-stone-300 rounded-xl bg-white outline-hidden"
                    >
                      {[1, 2, 3, 4, 5, 6].map((g) => (
                        <option key={g} value={g}>
                          {g}학년
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-600 mb-1">글 갈래</label>
                    <select
                      value={newTopicCategory}
                      onChange={(e) => setNewTopicCategory(e.target.value)}
                      className="w-full p-2 text-xs border border-stone-300 rounded-xl bg-white outline-hidden"
                    >
                      {['생활문', '독서감상문', '설명문', '주장하는 글', '일기', '편지글', '상상글'].map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-600 mb-1">주제 제목</label>
                  <input
                    type="text"
                    placeholder="예: 내가 발명가가 된다면?"
                    value={newTopicTitle}
                    onChange={(e) => setNewTopicTitle(e.target.value)}
                    className="w-full p-2.5 text-xs border border-stone-300 rounded-xl outline-hidden"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-600 mb-1">주제 설명</label>
                  <textarea
                    rows={2}
                    placeholder="학생들에게 전할 글쓰기 동기유발 및 안내"
                    value={newTopicDesc}
                    onChange={(e) => setNewTopicDesc(e.target.value)}
                    className="w-full p-2.5 text-xs border border-stone-300 rounded-xl outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-600 mb-1">글쓰기 도움말 (팁, 줄바꿈 구분)</label>
                  <textarea
                    rows={2}
                    placeholder={`어떤 물건을 발명하고 싶나요?\n왜 그 발명품이 필요한가요?`}
                    value={newTopicTips}
                    onChange={(e) => setNewTopicTips(e.target.value)}
                    className="w-full p-2.5 text-xs border border-stone-300 rounded-xl outline-hidden"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
                >
                  주제 저장 및 즉시 배포
                </button>
              </form>
            </div>

            {/* Right: Topics List (2 cols) */}
            <div className="lg:col-span-2 bg-white rounded-3xl border border-stone-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <h3 className="font-bold text-stone-900 text-base">배포된 주제 목록</h3>
                <span className="text-xs text-stone-400">총 {topics.length}개 주제</span>
              </div>

              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {topics.map((t) => (
                  <div
                    key={t.id}
                    className="p-4 rounded-2xl border border-stone-200 hover:border-amber-300 transition-all flex items-start justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                          {t.category} • {t.gradeLevel}학년
                        </span>
                        <span className="text-xs text-stone-400">최소 {t.minCharacters || 150}자</span>
                      </div>
                      <h4 className="font-bold text-stone-900 text-sm sm:text-base">{t.title}</h4>
                      <p className="text-xs text-stone-600 leading-relaxed">{t.description}</p>
                    </div>

                    <div className="shrink-0 flex flex-col items-end gap-2">
                      <button
                        onClick={() => handleToggleTopicPublish(t)}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                          t.isPublished
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-stone-200 text-stone-600 hover:bg-stone-300'
                        }`}
                      >
                        {t.isPublished ? '배포 중' : '비공개'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Class Management */}
      {activeTab === 'classes' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Create Class Form (1 col) */}
            <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-xs space-y-4">
              <h3 className="font-bold text-stone-900 text-base flex items-center gap-2">
                <School className="w-4 h-4 text-emerald-600" />
                새 학급 개설
              </h3>

              <form onSubmit={handleCreateClass} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-stone-600 mb-1">학년도</label>
                  <input
                    type="number"
                    value={newSchoolYear}
                    onChange={(e) => setNewSchoolYear(Number(e.target.value))}
                    className="w-full p-2 text-xs border border-stone-300 rounded-xl outline-hidden"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-stone-600 mb-1">학년</label>
                    <select
                      value={newGrade}
                      onChange={(e) => setNewGrade(Number(e.target.value))}
                      className="w-full p-2 text-xs border border-stone-300 rounded-xl bg-white outline-hidden"
                    >
                      {[1, 2, 3, 4, 5, 6].map((g) => (
                        <option key={g} value={g}>
                          {g}학년
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-600 mb-1">반</label>
                    <select
                      value={newClassNum}
                      onChange={(e) => setNewClassNum(Number(e.target.value))}
                      className="w-full p-2 text-xs border border-stone-300 rounded-xl bg-white outline-hidden"
                    >
                      {Array.from({ length: 15 }, (_, i) => i + 1).map((c) => (
                        <option key={c} value={c}>
                          {c}반
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-600 mb-1">
                    학급 공통 비밀번호 (학생 본인인증용)
                  </label>
                  <input
                    type="password"
                    placeholder="예: 1234"
                    value={newClassPassword}
                    onChange={(e) => setNewClassPassword(e.target.value)}
                    className="w-full p-2 text-xs border border-stone-300 rounded-xl outline-hidden"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
                >
                  학급 개설하기
                </button>
              </form>
            </div>

            {/* Classes List (2 cols) */}
            <div className="lg:col-span-2 bg-white rounded-3xl border border-stone-200 p-6 shadow-xs space-y-4">
              <h3 className="font-bold text-stone-900 text-base">개설된 학급 목록</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {classes.map((cls) => (
                  <div
                    key={cls.id}
                    className="p-5 rounded-2xl border border-stone-200 bg-stone-50 space-y-3 flex flex-col justify-between"
                  >
                    <div>
                      <div className="text-xs text-stone-500 font-medium">{cls.schoolYear}학년도</div>
                      <h4 className="text-lg font-bold text-stone-900">
                        {cls.grade}학년 {cls.classNum}반
                      </h4>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-stone-200">
                      <span className="text-[11px] text-stone-500">학급 비밀번호 암호화됨</span>
                      <button
                        onClick={() => handleChangeClassPassword(cls)}
                        className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1"
                      >
                        <KeyRound className="w-3.5 h-3.5" /> 비번 변경
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: System Settings */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          {/* Gemini AI Integration & Connection Health Card */}
          <div className="bg-gradient-to-br from-stone-900 to-stone-950 text-white p-6 sm:p-7 rounded-3xl border border-stone-800 shadow-lg space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white flex items-center gap-2">
                    Google Gemini AI 엔진 연동 상태
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      서버 보안 연동
                    </span>
                  </h3>
                  <p className="text-xs text-stone-400">
                    Express 백엔드 프록시를 통해 API 키 노출 없이 안전하게 통신하며, 듀얼 모델 자동 복구를 지원합니다.
                  </p>
                </div>
              </div>

              <button
                onClick={handleTestGemini}
                disabled={testingGemini}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-stone-950 font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 shrink-0"
              >
                {testingGemini ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    연결 상태 점검 중...
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    실시간 통신 점검
                  </>
                )}
              </button>
            </div>

            {/* Architecture Specs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                <div className="text-stone-400 text-[11px] font-medium flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
                  메인 AI 모델
                </div>
                <div className="font-mono font-bold text-stone-200">gemini-3.6-flash</div>
                <div className="text-[10px] text-stone-500">최우선 초고속 응답 처리</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                <div className="text-stone-400 text-[11px] font-medium flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block"></span>
                  자동 백업 (Fallback)
                </div>
                <div className="font-mono font-bold text-stone-200">gemini-3.7-flash</div>
                <div className="text-[10px] text-stone-500">과부하/에러 발생 시 무중단 자동 전환</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                <div className="text-stone-400 text-[11px] font-medium">안전성 및 응답 정제</div>
                <div className="font-bold text-stone-200">지연 로딩 &amp; JSON 정제</div>
                <div className="text-[10px] text-stone-500">마크다운 제거 &amp; 완벽 구조화</div>
              </div>
            </div>

            {/* Test Connection Result Box */}
            {geminiTestResult && (
              <div
                className={`p-4 rounded-2xl text-xs space-y-2 animate-in fade-in ${
                  geminiTestResult.success
                    ? 'bg-emerald-950/40 border border-emerald-500/40 text-emerald-200'
                    : 'bg-rose-950/40 border border-rose-500/40 text-rose-200'
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <div className="flex items-center gap-1.5">
                    {geminiTestResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-400" />
                    )}
                    <span>{geminiTestResult.message || (geminiTestResult.success ? '통신 성공' : '통신 실패')}</span>
                  </div>
                  {geminiTestResult.latencyMs !== undefined && (
                    <span className="text-[11px] opacity-80">
                      응답 속도: {geminiTestResult.latencyMs}ms (사용 모델: {geminiTestResult.modelUsed})
                    </span>
                  )}
                </div>

                {geminiTestResult.sampleEncouragement && (
                  <div className="p-2.5 rounded-xl bg-black/40 text-stone-300 font-serif italic text-[11px]">
                    &ldquo;{geminiTestResult.sampleEncouragement}&rdquo;
                  </div>
                )}

                {geminiTestResult.error && (
                  <div className="text-[11px] text-rose-300">
                    오류 세부 내용: {geminiTestResult.error}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Admin Password Change Form */}
            <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-xs space-y-4">
              <h3 className="font-bold text-stone-900 text-base flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-600" />
                교사 관리자 비밀번호 변경
              </h3>

              <form onSubmit={handleChangeAdminPassword} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-stone-600 mb-1">현재 관리자 비밀번호</label>
                  <input
                    type="password"
                    value={oldAdminPass}
                    onChange={(e) => setOldAdminPass(e.target.value)}
                    className="w-full p-2.5 text-xs border border-stone-300 rounded-xl outline-hidden"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-600 mb-1">새 관리자 비밀번호</label>
                  <input
                    type="password"
                    value={newAdminPass}
                    onChange={(e) => setNewAdminPass(e.target.value)}
                    className="w-full p-2.5 text-xs border border-stone-300 rounded-xl outline-hidden"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-600 mb-1">새 비밀번호 확인</label>
                  <input
                    type="password"
                    value={confirmAdminPass}
                    onChange={(e) => setConfirmAdminPass(e.target.value)}
                    className="w-full p-2.5 text-xs border border-stone-300 rounded-xl outline-hidden"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs rounded-xl transition-colors shadow-xs"
                >
                  관리자 비밀번호 업데이트
                </button>
              </form>
            </div>

            {/* Student Privacy & Name Display Settings */}
            <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-xs space-y-4">
              <h3 className="font-bold text-stone-900 text-base flex items-center gap-2">
                <Eye className="w-4 h-4 text-amber-600" />
                학생 이름 표시 및 개인정보 보호 설정
              </h3>
              <p className="text-xs text-stone-500">
                교실 화면이나 공개 서재에서 학생 실명 노출 방식을 선택합니다.
              </p>

              <div className="space-y-2">
                {[
                  { id: 'full', label: '실명 전체 표시', example: '홍길동' },
                  { id: 'masked', label: '가운데 글자 마스킹', example: '홍*동' },
                  { id: 'first_only', label: '성만 표시 후 기호', example: '홍○○' },
                  { id: 'initials', label: '초성만 표시', example: 'ㅎㄱㄷ' },
                ].map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleSaveNameDisplayMode(item.id as NameDisplayMode)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      nameDisplayMode === item.id
                        ? 'border-amber-500 bg-amber-50/60 ring-2 ring-amber-200'
                        : 'border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-xs text-stone-900">{item.label}</div>
                      <div className="text-[11px] text-stone-400">예시: {item.example}</div>
                    </div>
                    <input
                      type="radio"
                      name="nameDisplay"
                      checked={nameDisplayMode === item.id}
                      onChange={() => handleSaveNameDisplayMode(item.id as NameDisplayMode)}
                      className="text-amber-500 focus:ring-amber-400"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Process-Centered Assessment Inspector Modal */}
      {inspectingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] shadow-2xl border border-stone-200 overflow-hidden flex flex-col my-auto animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="bg-stone-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div>
                <span className="text-xs text-amber-400 font-bold">과정중심평가 &amp; 글쓰기 전 과정 열람</span>
                <h2 className="text-base sm:text-lg font-bold">
                  {inspectingRecord.studentName} 학생 &bull; &ldquo;{inspectingRecord.topicTitle}&rdquo;
                </h2>
              </div>
              <button
                onClick={() => setInspectingRecord(null)}
                className="p-1.5 text-stone-400 hover:text-white rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Process Stages Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Draft vs Final */}
                <div className="space-y-2">
                  <div className="font-bold text-xs text-stone-700">1. 초고 (Draft)</div>
                  <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 max-h-40 overflow-y-auto whitespace-pre-wrap">
                    {inspectingRecord.draft || '초고 없음'}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="font-bold text-xs text-emerald-800">2. 최종 완성본 (Final)</div>
                  <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl text-xs text-emerald-950 max-h-40 overflow-y-auto whitespace-pre-wrap">
                    {inspectingRecord.finalWriting || inspectingRecord.revisedWriting || inspectingRecord.draft}
                  </div>
                </div>

                {/* 3. AI Feedback & Goal */}
                <div className="space-y-2">
                  <div className="font-bold text-xs text-amber-800">3. AI 피드백 &amp; 학생 수정 목표</div>
                  <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl text-xs text-amber-950 max-h-40 overflow-y-auto space-y-1">
                    <p><strong>수정 목표:</strong> {inspectingRecord.revisionGoal || '미작성'}</p>
                    {inspectingRecord.aiFeedback && (
                      <p><strong>AI 조언:</strong> {inspectingRecord.aiFeedback.priorityFix}</p>
                    )}
                  </div>
                </div>

                {/* 4. Self Assessment */}
                <div className="space-y-2">
                  <div className="font-bold text-xs text-blue-800">4. 학생 자기평가</div>
                  <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl text-xs text-blue-950 max-h-40 overflow-y-auto space-y-1">
                    <p><strong>가장 뿌듯했던 점:</strong> {inspectingRecord.selfAssessment?.pridePoint || '성실히 작성'}</p>
                    <p><strong>다음 다짐:</strong> {inspectingRecord.selfAssessment?.futureEffort || '더 자세히 작성'}</p>
                  </div>
                </div>
              </div>

              {/* Process-Centered Assessment Editor with AI Assistant */}
              <div className="p-5 bg-purple-50 border border-purple-200 rounded-2xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-purple-900 text-sm flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-purple-600" />
                      교사 종합 과정중심평가 &amp; 격려 한마디
                    </h3>
                    <p className="text-[11px] text-purple-800">
                      초고, 퇴고, 자기평가 등 성장 과정을 종합하여 생활기록부 또는 학생 피드백으로 활용할 수 있습니다.
                    </p>
                  </div>

                  <button
                    onClick={handleGenerateAIAssessment}
                    disabled={generatingAssessment}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1 shrink-0 self-start sm:self-auto"
                  >
                    {generatingAssessment ? (
                      <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      <>
                        <Wand2 className="w-3.5 h-3.5" />
                        AI 종합 평가 생성
                      </>
                    )}
                  </button>
                </div>

                <textarea
                  rows={4}
                  placeholder="예: 초고 작성 후 AI 피드백을 주도적으로 수용하여 인물의 대화와 표정을 생생하게 보완하였으며, 자기평가 과정에서 스스로 글의 흐름을 점검하는 성실한 태도를 보임."
                  value={teacherFeedbackInput}
                  onChange={(e) => setTeacherFeedbackInput(e.target.value)}
                  className="w-full p-3.5 text-xs sm:text-sm border border-purple-300 rounded-xl bg-white outline-hidden leading-relaxed"
                />

                <div className="flex justify-end">
                  <button
                    onClick={handleSaveTeacherAssessment}
                    className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                  >
                    <CheckSquare className="w-4 h-4" />
                    평가 내용 저장 및 학생에게 전달
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
