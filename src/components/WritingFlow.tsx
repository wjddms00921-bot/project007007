import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  ArrowLeft,
  ArrowRight,
  Save,
  CheckCircle2,
  AlertCircle,
  Clock,
  HelpCircle,
  Wand2,
  CheckSquare,
  FileText,
  Lightbulb,
  Edit3,
  Star,
  RefreshCw,
  Send,
  Eye,
  BookOpen,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  StudentInfo,
  DailyTopic,
  WritingRecord,
  AIFeedbackData,
  SelfAssessmentData,
  SpellingCorrection,
} from '../types';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { awardStepXP } from '../lib/gamification';
import { getAIFeedbackAPI, proofreadAPI } from '../lib/api';

interface WritingFlowProps {
  student: StudentInfo;
  recordId?: string;
  initialTopic?: DailyTopic | null;
  onBack: () => void;
  onCompleted: (recordId: string) => void;
  onRefreshGrowth: () => void;
}

const STEPS = [
  { id: 1, name: '주제 확인', icon: BookOpen },
  { id: 2, name: '생각 계획', icon: Lightbulb },
  { id: 3, name: '초고 쓰기', icon: Edit3 },
  { id: 4, name: 'AI 피드백', icon: Wand2 },
  { id: 5, name: '수정 목표', icon: CheckSquare },
  { id: 6, name: '고쳐쓰기', icon: FileText },
  { id: 7, name: '자기평가', icon: Star },
  { id: 8, name: '맞춤법 점검', icon: CheckCircle2 },
  { id: 9, name: '최종 제출', icon: Send },
];

export const WritingFlow: React.FC<WritingFlowProps> = ({
  student,
  recordId: passedRecordId,
  initialTopic,
  onBack,
  onCompleted,
  onRefreshGrowth,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [recordId, setRecordId] = useState<string>(passedRecordId || `wr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);

  // Record data state
  const [record, setRecord] = useState<WritingRecord>({
    recordId: passedRecordId || '',
    studentKey: student.studentKey,
    classId: student.classId || 'default',
    studentName: student.studentName,
    topicId: initialTopic?.id || 'custom',
    topicTitle: initialTopic?.title || '자유 주제 글쓰기',
    minCharacters: initialTopic?.minCharacters || 150,
    planning: {
      mindmapKeywords: [],
      outlineBeginning: '',
      outlineMiddle: '',
      outlineEnd: '',
      characterOrSetting: '',
      notes: '',
    },
    draft: '',
    aiFeedback: null,
    revisionGoal: '',
    revisedWriting: '',
    selfAssessment: null,
    beforeProofreading: '',
    afterProofreading: '',
    spellingCorrections: [],
    finalWriting: '',
    currentStep: 1,
    status: 'in_progress',
    favorite: false,
    xpGranted: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  // Local inputs
  const [mindmapInput, setMindmapInput] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [loadingAI, setLoadingAI] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string>('');
  const [stepWarning, setStepWarning] = useState<string>('');
  const [appliedCorrectionIds, setAppliedCorrectionIds] = useState<Set<string>>(new Set());

  // Self assessment temporary state
  const [selfRatings, setSelfRatings] = useState<{ question: string; score: number }[]>([
    { question: '주제에 맞는 생각과 경험을 진솔하게 표현했나요?', score: 5 },
    { question: '처음-가운데-끝 흐름이 자연스럽게 이어지나요?', score: 5 },
    { question: 'AI 피드백과 내가 세운 수정 목표를 잘 반영했나요?', score: 5 },
    { question: '읽는 사람이 상황을 상상할 수 있도록 자세히 썼나요?', score: 5 },
  ]);
  const [pridePoint, setPridePoint] = useState<string>('');
  const [futureEffort, setFutureEffort] = useState<string>('');

  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize or load record
  useEffect(() => {
    loadOrCreateRecord();
  }, [passedRecordId]);

  const loadOrCreateRecord = async () => {
    if (passedRecordId) {
      try {
        const docRef = doc(db, 'writingRecords', passedRecordId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data() as WritingRecord;
          setRecord(data);
          setRecordId(data.recordId);
          setCurrentStep(data.currentStep || 1);
          if (data.selfAssessment) {
            setSelfRatings(data.selfAssessment.rubricAnswers || selfRatings);
            setPridePoint(data.selfAssessment.pridePoint || '');
            setFutureEffort(data.selfAssessment.futureEffort || '');
          }
          return;
        }
      } catch (err) {
        console.error('Error fetching writing record:', err);
      }
    }

    // Try restoring from localStorage backup
    const localBackupKey = `draft_backup_${student.studentKey}_${recordId}`;
    try {
      const localData = localStorage.getItem(localBackupKey);
      if (localData) {
        const parsed = JSON.parse(localData);
        setRecord(parsed);
        setCurrentStep(parsed.currentStep || 1);
        return;
      }
    } catch (_) {}

    // Otherwise create initial record
    const newRecordId = passedRecordId || `wr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newRecord: WritingRecord = {
      recordId: newRecordId,
      studentKey: student.studentKey,
      classId: student.classId || 'default',
      studentName: student.studentName,
      topicId: initialTopic?.id || 'custom',
      topicTitle: initialTopic?.title || '자유 주제 글쓰기',
      minCharacters: initialTopic?.minCharacters || 150,
      planning: {
        mindmapKeywords: [],
        outlineBeginning: '',
        outlineMiddle: '',
        outlineEnd: '',
        characterOrSetting: '',
        notes: '',
      },
      draft: '',
      aiFeedback: null,
      revisionGoal: '',
      revisedWriting: '',
      selfAssessment: null,
      beforeProofreading: '',
      afterProofreading: '',
      spellingCorrections: [],
      finalWriting: '',
      currentStep: 1,
      status: 'in_progress',
      favorite: false,
      xpGranted: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setRecord(newRecord);
    setRecordId(newRecordId);
    saveRecordToFirestore(newRecord, false);
  };

  // Debounced auto-save on change
  const triggerAutoSave = (updated: WritingRecord) => {
    setRecord(updated);

    // Save to localStorage immediately as safety buffer
    try {
      localStorage.setItem(`draft_backup_${student.studentKey}_${updated.recordId}`, JSON.stringify(updated));
    } catch (_) {}

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    setSaveStatus('saving');
    autoSaveTimerRef.current = setTimeout(() => {
      saveRecordToFirestore(updated, false);
    }, 1500);
  };

  const saveRecordToFirestore = async (recToSave: WritingRecord, forceSync = false) => {
    setSaveStatus('saving');
    try {
      const docRef = doc(db, 'writingRecords', recToSave.recordId);
      const dataToSave = {
        ...recToSave,
        updatedAt: Date.now(),
      };
      await setDoc(docRef, dataToSave, { merge: true });
      setSaveStatus('saved');
    } catch (err: any) {
      console.error('Firestore save error:', err);
      setSaveStatus('error');
    }
  };

  // Step advancement & validation
  const handleNextStep = async () => {
    setStepWarning('');
    const minChars = record.minCharacters || 150;

    // Step-specific validations
    if (currentStep === 3) {
      // Draft validation
      const charCount = record.draft.trim().length;
      if (charCount < minChars) {
        setStepWarning(`초고 글자 수가 ${charCount}자입니다. 최소 ${minChars}자 이상 작성해야 다음 단계로 이동할 수 있어요!`);
        return;
      }
    }

    if (currentStep === 5) {
      // Revision goal validation
      if (!record.revisionGoal || record.revisionGoal.trim().length < 5) {
        setStepWarning('AI 피드백을 바탕으로 고칠 수정 목표를 1줄 이상 구체적으로 적어주세요.');
        return;
      }
    }

    if (currentStep === 6) {
      // Revised writing validation
      const charCount = (record.revisedWriting || record.draft).trim().length;
      if (charCount < minChars) {
        setStepWarning(`고쳐쓴 글이 ${charCount}자입니다. 최소 ${minChars}자 이상 정성껏 작성해주세요.`);
        return;
      }
      if (!record.revisedWriting) {
        record.revisedWriting = record.draft;
      }
    }

    // Award Step XP if not granted
    const stepKeyMap: Record<number, string> = {
      2: 'planning',
      3: 'draft',
      4: 'feedback',
      5: 'revisionGoal',
      6: 'revision',
      7: 'selfAssessment',
      8: 'proofreading',
    };

    const currentStepKey = stepKeyMap[currentStep];
    let updatedXpGranted = { ...record.xpGranted };

    if (currentStepKey && !updatedXpGranted[currentStepKey as keyof typeof updatedXpGranted]) {
      const xpResult = await awardStepXP(student.studentKey, currentStepKey, {
        revisionCompleted: currentStep === 6,
        selfAssessmentCompleted: currentStep === 7,
        proofreadCompleted: currentStep === 8,
      });

      if (xpResult.granted) {
        (updatedXpGranted as any)[currentStepKey] = true;
        onRefreshGrowth();
      }
    }

    const nextStepNum = Math.min(9, currentStep + 1);
    const updatedRecord: WritingRecord = {
      ...record,
      currentStep: nextStepNum,
      xpGranted: updatedXpGranted,
    };

    // Pre-populate steps if empty
    if (nextStepNum === 6 && !updatedRecord.revisedWriting) {
      updatedRecord.revisedWriting = updatedRecord.draft;
    }
    if (nextStepNum === 8 && !updatedRecord.beforeProofreading) {
      updatedRecord.beforeProofreading = updatedRecord.revisedWriting || updatedRecord.draft;
      updatedRecord.afterProofreading = updatedRecord.beforeProofreading;
    }

    setCurrentStep(nextStepNum);
    triggerAutoSave(updatedRecord);

    // Auto-fetch AI feedback if entering step 4 and not fetched yet
    if (nextStepNum === 4 && !updatedRecord.aiFeedback) {
      fetchAIFeedback(updatedRecord);
    }

    // Auto-fetch Proofreading if entering step 8 and not fetched yet
    if (nextStepNum === 8 && (!updatedRecord.spellingCorrections || updatedRecord.spellingCorrections.length === 0)) {
      fetchProofreading(updatedRecord);
    }
  };

  const handlePrevStep = () => {
    setStepWarning('');
    if (currentStep > 1) {
      const prevStepNum = currentStep - 1;
      setCurrentStep(prevStepNum);
      const updated = { ...record, currentStep: prevStepNum };
      triggerAutoSave(updated);
    }
  };

  // AI Feedback Request
  const fetchAIFeedback = async (currentRec = record) => {
    setLoadingAI(true);
    setAiError('');
    try {
      const res = await getAIFeedbackAPI({
        topicTitle: currentRec.topicTitle,
        draft: currentRec.draft,
        planning: currentRec.planning,
        gradeLevel: student.grade,
      });

      if (res.success && res.feedback) {
        const updated: WritingRecord = {
          ...currentRec,
          aiFeedback: res.feedback,
        };
        triggerAutoSave(updated);
      } else {
        setAiError(res.error || 'AI 피드백을 가져오지 못했습니다. 잠시 후 다시 시도해주세요.');
      }
    } catch (err: any) {
      setAiError(err.message || '네트워크 오류가 발생했습니다.');
    } finally {
      setLoadingAI(false);
    }
  };

  // Proofreading Request
  const fetchProofreading = async (currentRec = record) => {
    setLoadingAI(true);
    setAiError('');
    const textToCheck = currentRec.revisedWriting || currentRec.draft;
    try {
      const res = await proofreadAPI(textToCheck);
      if (res.success && res.result) {
        const updated: WritingRecord = {
          ...currentRec,
          beforeProofreading: textToCheck,
          afterProofreading: textToCheck,
          spellingCorrections: res.result.corrections,
        };
        triggerAutoSave(updated);
      } else {
        setAiError(res.error || '맞춤법 점검을 진행하지 못했습니다.');
      }
    } catch (err: any) {
      setAiError(err.message || '맞춤법 점검 중 오류가 발생했습니다.');
    } finally {
      setLoadingAI(false);
    }
  };

  // Apply single spelling correction
  const applySingleCorrection = (correction: SpellingCorrection) => {
    let currentText = record.afterProofreading || record.beforeProofreading;
    if (currentText.includes(correction.original)) {
      currentText = currentText.replace(correction.original, correction.corrected);
      const newApplied = new Set(appliedCorrectionIds);
      newApplied.add(correction.id);
      setAppliedCorrectionIds(newApplied);

      const updated: WritingRecord = {
        ...record,
        afterProofreading: currentText,
      };
      triggerAutoSave(updated);
    }
  };

  // Apply all spelling corrections
  const applyAllCorrections = () => {
    if (!record.spellingCorrections) return;
    let currentText = record.beforeProofreading;
    const newApplied = new Set<string>();

    record.spellingCorrections.forEach((c) => {
      currentText = currentText.replaceAll(c.original, c.corrected);
      newApplied.add(c.id);
    });

    setAppliedCorrectionIds(newApplied);
    const updated: WritingRecord = {
      ...record,
      afterProofreading: currentText,
    };
    triggerAutoSave(updated);
  };

  // Final Submit
  const handleFinalSubmit = async () => {
    const finalContent = record.afterProofreading || record.revisedWriting || record.draft;
    const selfAssessmentData: SelfAssessmentData = {
      rubricAnswers: selfRatings,
      satisfactionRating: 5,
      pridePoint: pridePoint || '끝까지 포기하지 않고 정성껏 글을 완성했습니다.',
      futureEffort: futureEffort || '다음에도 더 생생한 표현으로 글을 써보고 싶습니다.',
    };

    let updatedXpGranted = { ...record.xpGranted };
    if (!updatedXpGranted.finalSubmit) {
      const xpRes = await awardStepXP(student.studentKey, 'finalSubmit', {
        completedWriting: true,
      });
      if (xpRes.granted) {
        updatedXpGranted.finalSubmit = true;
        onRefreshGrowth();
      }
    }

    const finalRecord: WritingRecord = {
      ...record,
      finalWriting: finalContent,
      selfAssessment: selfAssessmentData,
      status: 'submitted',
      currentStep: 9,
      xpGranted: updatedXpGranted,
      submittedAt: Date.now(),
    };

    await saveRecordToFirestore(finalRecord, true);
    setRecord(finalRecord);

    // Confetti celebration!
    try {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
      });
    } catch (_) {}
  };

  // Mindmap tag add
  const addMindmapKeyword = () => {
    const val = mindmapInput.trim();
    if (!val) return;
    const currentKeywords = record.planning.mindmapKeywords || [];
    if (!currentKeywords.includes(val)) {
      const updated: WritingRecord = {
        ...record,
        planning: {
          ...record.planning,
          mindmapKeywords: [...currentKeywords, val],
        },
      };
      triggerAutoSave(updated);
    }
    setMindmapInput('');
  };

  const removeMindmapKeyword = (tag: string) => {
    const currentKeywords = record.planning.mindmapKeywords || [];
    const updated: WritingRecord = {
      ...record,
      planning: {
        ...record.planning,
        mindmapKeywords: currentKeywords.filter((k) => k !== tag),
      },
    };
    triggerAutoSave(updated);
  };

  const minChars = record.minCharacters || 150;
  const currentDraftLength = (currentStep === 6 ? record.revisedWriting : record.draft).trim().length;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Bar: Back button, Title & Auto-Save Indicator */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            id="flow-back-btn"
            onClick={onBack}
            className="p-2 rounded-xl text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                {record.topicTitle}
              </span>
              <span className="text-xs text-stone-400">최소 {minChars}자 목표</span>
            </div>
            <h1 className="text-base sm:text-lg font-bold text-stone-900 mt-0.5">
              {STEPS.find((s) => s.id === currentStep)?.name}
            </h1>
          </div>
        </div>

        {/* Save Status & Action Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            {saveStatus === 'saving' && (
              <span className="text-amber-600 flex items-center gap-1">
                <span className="inline-block w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></span>
                저장 중...
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="text-emerald-600 flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                저장 완료
              </span>
            )}
            {saveStatus === 'error' && (
              <button
                onClick={() => saveRecordToFirestore(record, true)}
                className="text-rose-600 hover:underline flex items-center gap-1 font-medium"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                저장 오류 (다시 저장)
              </button>
            )}
          </div>

          <button
            onClick={() => saveRecordToFirestore(record, true)}
            className="px-3 py-1.5 rounded-xl border border-stone-200 hover:bg-stone-100 text-stone-600 text-xs font-semibold flex items-center gap-1 transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            지금 저장
          </button>
        </div>
      </div>

      {/* Step Stepper Progress Indicator */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-stone-200 shadow-xs overflow-x-auto scrollbar-none">
        <div className="flex items-center justify-between min-w-[720px] gap-2">
          {STEPS.map((s, idx) => {
            const Icon = s.icon;
            const isCurrent = s.id === currentStep;
            const isCompleted = s.id < currentStep;

            return (
              <React.Fragment key={s.id}>
                <div
                  onClick={() => {
                    // Allow clicking only on visited steps
                    if (s.id <= currentStep) {
                      setCurrentStep(s.id);
                    }
                  }}
                  className={`flex flex-col items-center gap-1.5 cursor-pointer transition-all ${
                    isCurrent
                      ? 'scale-105 font-bold text-amber-600'
                      : isCompleted
                      ? 'text-emerald-600 opacity-90'
                      : 'text-stone-400 opacity-60 cursor-not-allowed'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm shadow-xs transition-colors ${
                      isCurrent
                        ? 'bg-amber-500 text-white font-bold ring-4 ring-amber-100'
                        : isCompleted
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-stone-100 text-stone-400'
                    }`}
                  >
                    {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span className="text-[11px] whitespace-nowrap">{s.name}</span>
                </div>

                {idx < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 rounded-full ${
                      s.id < currentStep ? 'bg-emerald-400' : 'bg-stone-200'
                    }`}
                  ></div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Warning Alert */}
      {stepWarning && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl text-amber-900 text-xs sm:text-sm flex items-start gap-2.5 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>{stepWarning}</span>
        </div>
      )}

      {/* Step Content Container */}
      <div className="bg-white rounded-3xl border border-stone-200 p-6 sm:p-8 shadow-xs min-h-[480px]">
        {/* STEP 1: Topic Guide */}
        {currentStep === 1 && (
          <div className="space-y-6 max-w-3xl mx-auto">
            <div className="text-center space-y-2">
              <span className="inline-block px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full">
                1단계 • 주제 확인 및 생각 열기
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-900">
                {record.topicTitle}
              </h2>
            </div>

            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-6 space-y-4">
              <div>
                <h3 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">글쓰기 안내</h3>
                <p className="text-stone-800 text-sm sm:text-base leading-relaxed">
                  {initialTopic?.description ||
                    '오늘 떠오르는 소중한 생각과 경험을 진솔하게 적어보세요. 최소 150자 이상 정성껏 글을 쓰면 AI 피드백을 받을 수 있습니다.'}
                </p>
              </div>

              {initialTopic?.tips && initialTopic.tips.length > 0 && (
                <div className="pt-4 border-t border-stone-200">
                  <h3 className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5" />
                    선생님이 알려주는 글쓰기 팁
                  </h3>
                  <ul className="space-y-1.5 text-xs sm:text-sm text-stone-600 list-disc list-inside">
                    {initialTopic.tips.map((tip, i) => (
                      <li key={i}>{tip}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-center gap-3">
              <span className="text-xl">🌱</span>
              <div>
                <strong>글쓰기 성장 여정:</strong> 구상 → 초고 → AI 피드백 → 목표 세우기 → 고쳐쓰기 → 자기평가 → 맞춤법 점검 과정을 거치며 작가 경험치(XP)가 쑥쑥 자라납니다!
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Planning */}
        {currentStep === 2 && (
          <div className="space-y-6 max-w-3xl mx-auto">
            <div className="border-b border-stone-100 pb-3">
              <span className="text-xs font-bold text-amber-600">2단계 • 생각 계획하기</span>
              <h2 className="text-xl font-bold text-stone-900">글의 뼈대를 세우고 생각을 정리해요</h2>
              <p className="text-xs text-stone-500 mt-0.5">키워드 마인드맵과 처음-가운데-끝 구성을 미리 메모해 보세요.</p>
            </div>

            {/* Keyword Mindmap Tags */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-stone-700">
                떠오르는 핵심 낱말 (키워드 마인드맵)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="예: 여름방학, 수영장, 시원한 수박"
                  value={mindmapInput}
                  onChange={(e) => setMindmapInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addMindmapKeyword();
                    }
                  }}
                  className="flex-1 px-3 py-2 text-sm border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-hidden"
                />
                <button
                  type="button"
                  onClick={addMindmapKeyword}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-xs"
                >
                  추가
                </button>
              </div>

              {/* Tags Cloud */}
              <div className="flex flex-wrap gap-2 pt-2">
                {record.planning.mindmapKeywords?.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-semibold"
                  >
                    #{tag}
                    <button
                      onClick={() => removeMindmapKeyword(tag)}
                      className="hover:text-rose-600 font-bold ml-1"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Outline: Beginning - Middle - End */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-stone-700">처음 (시작하기)</label>
                <textarea
                  rows={4}
                  placeholder="글을 어떻게 시작할까요? 때와 장소, 시작하는 생각 등"
                  value={record.planning.outlineBeginning || ''}
                  onChange={(e) => {
                    const updated = {
                      ...record,
                      planning: { ...record.planning, outlineBeginning: e.target.value },
                    };
                    triggerAutoSave(updated);
                  }}
                  className="w-full p-3 text-xs sm:text-sm border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-hidden"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-stone-700">가운데 (중심 내용)</label>
                <textarea
                  rows={4}
                  placeholder="가장 중요하게 전하고 싶은 사건, 대화, 생각 등"
                  value={record.planning.outlineMiddle || ''}
                  onChange={(e) => {
                    const updated = {
                      ...record,
                      planning: { ...record.planning, outlineMiddle: e.target.value },
                    };
                    triggerAutoSave(updated);
                  }}
                  className="w-full p-3 text-xs sm:text-sm border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-hidden"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-stone-700">끝 (마무리 및 느낌)</label>
                <textarea
                  rows={4}
                  placeholder="마무리 느낌, 깨달은 점, 앞으로의 다짐 등"
                  value={record.planning.outlineEnd || ''}
                  onChange={(e) => {
                    const updated = {
                      ...record,
                      planning: { ...record.planning, outlineEnd: e.target.value },
                    };
                    triggerAutoSave(updated);
                  }}
                  className="w-full p-3 text-xs sm:text-sm border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-hidden"
                />
              </div>
            </div>

            {/* Extra Notes */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-stone-700">
                기타 메모 및 꼭 쓰고 싶은 문장
              </label>
              <textarea
                rows={2}
                placeholder="꼭 넣고 싶은 특별한 표현이나 잊지 말아야 할 내용"
                value={record.planning.notes || ''}
                onChange={(e) => {
                  const updated = {
                    ...record,
                    planning: { ...record.planning, notes: e.target.value },
                  };
                  triggerAutoSave(updated);
                }}
                className="w-full p-3 text-xs sm:text-sm border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-hidden"
              />
            </div>
          </div>
        )}

        {/* STEP 3: Draft Writing */}
        {currentStep === 3 && (
          <div className="space-y-4 max-w-3xl mx-auto">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <span className="text-xs font-bold text-amber-600">3단계 • 초고 작성</span>
                <h2 className="text-xl font-bold text-stone-900">생각나는 대로 마음껏 써보세요</h2>
              </div>
              <div className="text-right">
                <div
                  className={`text-sm font-bold ${
                    currentDraftLength >= minChars ? 'text-emerald-600' : 'text-amber-600'
                  }`}
                >
                  {currentDraftLength} / {minChars}자
                </div>
                <div className="text-[11px] text-stone-400">
                  {currentDraftLength >= minChars
                    ? '✨ 목표 글자 수 달성!'
                    : `최소 ${minChars - currentDraftLength}자 더 필요해요`}
                </div>
              </div>
            </div>

            {/* Draft Input Area */}
            <textarea
              id="draft-textarea"
              rows={12}
              placeholder="여기에 초고를 작성하세요. 맞춤법이나 완벽한 문장에 너무 얽매이지 말고, 생각과 느낌을 솔직하고 자유롭게 적어보세요..."
              value={record.draft}
              onChange={(e) => {
                const updated = { ...record, draft: e.target.value };
                triggerAutoSave(updated);
              }}
              className="w-full p-4 text-sm sm:text-base border border-stone-300 rounded-2xl focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-hidden leading-relaxed resize-y"
            />

            {/* Character Count Bar */}
            <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  currentDraftLength >= minChars ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
                style={{ width: `${Math.min(100, (currentDraftLength / minChars) * 100)}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* STEP 4: AI Feedback */}
        {currentStep === 4 && (
          <div className="space-y-6 max-w-3xl mx-auto">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <span className="text-xs font-bold text-amber-600">4단계 • AI 피드백 확인</span>
                <h2 className="text-xl font-bold text-stone-900">AI 글쓰기 멘토의 다정한 조언</h2>
              </div>
              <button
                onClick={() => fetchAIFeedback(record)}
                disabled={loadingAI}
                className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold hover:bg-amber-100 transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingAI ? 'animate-spin' : ''}`} />
                피드백 다시 받기
              </button>
            </div>

            {loadingAI ? (
              <div className="py-16 text-center space-y-3 flex flex-col items-center">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center animate-bounce">
                  <Wand2 className="w-6 h-6" />
                </div>
                <p className="font-bold text-stone-800 text-sm">AI 멘토가 학생의 초고를 꼼꼼히 읽고 있습니다...</p>
                <p className="text-xs text-stone-400">잠시만 기다려주세요 (학생의 글을 대신 쓰지 않고 조언만 드립니다)</p>
              </div>
            ) : aiError ? (
              <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-3">
                <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
                <p className="text-xs text-rose-700 font-medium">{aiError}</p>
                <button
                  onClick={() => fetchAIFeedback(record)}
                  className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold"
                >
                  다시 시도하기
                </button>
              </div>
            ) : record.aiFeedback ? (
              <div className="space-y-4">
                {/* 1. Good Points */}
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-5 space-y-2">
                  <h3 className="font-bold text-emerald-900 text-sm flex items-center gap-2">
                    <span className="text-lg">👏</span>
                    이런 점이 참 잘 되었어요! (칭찬과 잘된 점)
                  </h3>
                  <ul className="space-y-1.5 text-xs sm:text-sm text-emerald-950 list-disc list-inside">
                    {record.aiFeedback.goodPoints?.map((p, i) => (
                      <li key={i} className="leading-relaxed">{p}</li>
                    ))}
                  </ul>
                </div>

                {/* 2. Improvement Points & Reasoning */}
                <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-5 space-y-2">
                  <h3 className="font-bold text-amber-900 text-sm flex items-center gap-2">
                    <span className="text-lg">💡</span>
                    조금 더 멋지게 발전시킬 부분
                  </h3>
                  <ul className="space-y-1.5 text-xs sm:text-sm text-amber-950 list-disc list-inside">
                    {record.aiFeedback.improvementPoints?.map((p, i) => (
                      <li key={i} className="leading-relaxed">{p}</li>
                    ))}
                  </ul>
                  {record.aiFeedback.reasoning && (
                    <div className="mt-2 pt-2 border-t border-amber-200/60 text-xs text-amber-800">
                      <strong>판단 근거:</strong> {record.aiFeedback.reasoning}
                    </div>
                  )}
                </div>

                {/* 3. Priority Fix & Thinking Question */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-1.5">
                    <h4 className="font-bold text-blue-900 text-xs flex items-center gap-1.5">
                      <span className="text-base">🎯</span>
                      가장 먼저 고칠 부분
                    </h4>
                    <p className="text-xs sm:text-sm text-blue-950 leading-relaxed">
                      {record.aiFeedback.priorityFix}
                    </p>
                  </div>

                  <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 space-y-1.5">
                    <h4 className="font-bold text-purple-900 text-xs flex items-center gap-1.5">
                      <span className="text-base">🤔</span>
                      스스로 생각해 볼 질문
                    </h4>
                    <p className="text-xs sm:text-sm text-purple-950 leading-relaxed font-medium">
                      &ldquo;{record.aiFeedback.thinkingQuestion}&rdquo;
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* STEP 5: Revision Goal */}
        {currentStep === 5 && (
          <div className="space-y-6 max-w-3xl mx-auto">
            <div className="border-b border-stone-100 pb-3">
              <span className="text-xs font-bold text-amber-600">5단계 • 수정 목표 세우기</span>
              <h2 className="text-xl font-bold text-stone-900">AI 피드백을 바탕으로 나만의 수정 목표를 정해요</h2>
            </div>

            {/* Quick reference of priority fix */}
            {record.aiFeedback && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs space-y-1">
                <span className="font-bold text-amber-900">참고할 AI 조언:</span>
                <p className="text-amber-800">{record.aiFeedback.priorityFix}</p>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-bold text-stone-700">
                고쳐쓰기에서 집중해서 바꿀 나의 목표
              </label>
              <textarea
                id="revision-goal-textarea"
                rows={5}
                placeholder="예: 그때 친구와 나누었던 대화를 따옴표를 넣어 생생하게 살리고, 마지막에 느꼈던 나의 뿌듯한 감정을 한 문장 더 구체적으로 적겠습니다."
                value={record.revisionGoal}
                onChange={(e) => {
                  const updated = { ...record, revisionGoal: e.target.value };
                  triggerAutoSave(updated);
                }}
                className="w-full p-4 text-sm sm:text-base border border-stone-300 rounded-2xl focus:ring-2 focus:ring-amber-500 outline-hidden leading-relaxed"
              />
            </div>
          </div>
        )}

        {/* STEP 6: Revised Writing (Side-by-side) */}
        {currentStep === 6 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <span className="text-xs font-bold text-amber-600">6단계 • 고쳐쓰기</span>
                <h2 className="text-xl font-bold text-stone-900">목표를 생각하며 글을 한 단계 발전시켜요</h2>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-emerald-600">
                  {(record.revisedWriting || record.draft).trim().length} / {minChars}자
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Left: Original Draft & Goal Reference */}
              <div className="space-y-3">
                <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs">
                  <strong className="text-amber-900">나의 수정 목표:</strong>
                  <p className="text-amber-800 mt-0.5">{record.revisionGoal || '목표를 정하고 수정하세요'}</p>
                </div>

                <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 space-y-1.5 max-h-[380px] overflow-y-auto">
                  <span className="text-xs font-bold text-stone-500">처음 쓴 초고 (참고용)</span>
                  <p className="text-xs sm:text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">
                    {record.draft}
                  </p>
                </div>
              </div>

              {/* Right: Revised Draft Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-stone-700">고쳐 쓴 글 (최종 반영용)</label>
                <textarea
                  id="revised-writing-textarea"
                  rows={16}
                  placeholder="수정 목표를 떠올리며 글을 다듬고 고쳐 써보세요..."
                  value={record.revisedWriting || record.draft}
                  onChange={(e) => {
                    const updated = { ...record, revisedWriting: e.target.value };
                    triggerAutoSave(updated);
                  }}
                  className="w-full p-4 text-sm sm:text-base border border-stone-300 rounded-2xl focus:ring-2 focus:ring-amber-500 outline-hidden leading-relaxed resize-y"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 7: Self-Assessment */}
        {currentStep === 7 && (
          <div className="space-y-6 max-w-3xl mx-auto">
            <div className="border-b border-stone-100 pb-3">
              <span className="text-xs font-bold text-amber-600">7단계 • 자기평가</span>
              <h2 className="text-xl font-bold text-stone-900">스스로 나의 글쓰기 과정을 돌아보아요</h2>
            </div>

            {/* Rubrics Checklist */}
            <div className="space-y-3">
              {selfRatings.map((item, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-stone-50 border border-stone-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <span className="text-xs sm:text-sm font-medium text-stone-800">{item.question}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => {
                          const newRatings = [...selfRatings];
                          newRatings[idx].score = star;
                          setSelfRatings(newRatings);
                        }}
                        className="p-1 text-base hover:scale-125 transition-transform"
                      >
                        {star <= item.score ? '⭐' : '☆'}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Pride & Future */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-stone-700">
                  이번 글에서 가장 뿌듯했던 점
                </label>
                <textarea
                  rows={3}
                  placeholder="예: AI 피드백을 보고 대화를 넣어서 훨씬 재미있어졌습니다."
                  value={pridePoint}
                  onChange={(e) => setPridePoint(e.target.value)}
                  className="w-full p-3 text-xs sm:text-sm border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-hidden"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-stone-700">
                  다음 글쓰기에서 더 노력해보고 싶은 점
                </label>
                <textarea
                  rows={3}
                  placeholder="예: 생생한 소리나 모양을 나타내는 낱말을 더 많이 써보고 싶습니다."
                  value={futureEffort}
                  onChange={(e) => setFutureEffort(e.target.value)}
                  className="w-full p-3 text-xs sm:text-sm border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-hidden"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 8: Proofreading */}
        {currentStep === 8 && (
          <div className="space-y-6 max-w-3xl mx-auto">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <span className="text-xs font-bold text-amber-600">8단계 • 맞춤법 &amp; 띄어쓰기 점검</span>
                <h2 className="text-xl font-bold text-stone-900">문장 부호와 맞춤법을 바르게 다듬어요</h2>
                <p className="text-xs text-stone-500">학생의 소중한 생각은 그대로 두고, 철자와 띄어쓰기만 교정합니다.</p>
              </div>
              <button
                onClick={() => fetchProofreading(record)}
                disabled={loadingAI}
                className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold hover:bg-amber-100 transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingAI ? 'animate-spin' : ''}`} />
                다시 검사하기
              </button>
            </div>

            {loadingAI ? (
              <div className="py-16 text-center space-y-3 flex flex-col items-center">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center animate-spin">
                  <RefreshCw className="w-6 h-6" />
                </div>
                <p className="font-bold text-stone-800 text-sm">맞춤법과 띄어쓰기를 꼼꼼히 점검하고 있습니다...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {record.spellingCorrections && record.spellingCorrections.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between bg-amber-50 p-3 rounded-xl border border-amber-200">
                      <span className="text-xs font-bold text-amber-900">
                        발견된 교정 제안: {record.spellingCorrections.length}개
                      </span>
                      <button
                        onClick={applyAllCorrections}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-xs transition-colors"
                      >
                        모두 적용하기
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                      {record.spellingCorrections.map((c) => {
                        const isApplied = appliedCorrectionIds.has(c.id);
                        return (
                          <div
                            key={c.id}
                            className={`p-3 rounded-xl border transition-all ${
                              isApplied
                                ? 'bg-stone-50 border-stone-200 opacity-60'
                                : 'bg-white border-stone-200 hover:border-amber-400'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-amber-100 text-amber-800">
                                {c.type}
                              </span>
                              {isApplied ? (
                                <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> 적용됨
                                </span>
                              ) : (
                                <button
                                  onClick={() => applySingleCorrection(c)}
                                  className="text-xs font-bold text-amber-700 hover:text-amber-800 underline"
                                >
                                  적용하기
                                </button>
                              )}
                            </div>
                            <div className="text-xs">
                              <span className="text-rose-600 line-through mr-1.5">{c.original}</span>
                              <span className="text-emerald-700 font-bold">{c.corrected}</span>
                            </div>
                            <div className="text-[11px] text-stone-500 mt-1">{c.reason}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center text-xs text-emerald-800">
                    🎉 맞춤법과 띄어쓰기가 아주 훌륭합니다! 특별히 고칠 부분이 발견되지 않았어요.
                  </div>
                )}

                {/* Live Preview Text */}
                <div className="space-y-1.5 pt-2">
                  <label className="block text-xs font-bold text-stone-700">
                    점검 후 최종 글 내용 (필요하면 직접 수정 가능)
                  </label>
                  <textarea
                    rows={10}
                    value={record.afterProofreading || record.revisedWriting || record.draft}
                    onChange={(e) => {
                      const updated = { ...record, afterProofreading: e.target.value };
                      triggerAutoSave(updated);
                    }}
                    className="w-full p-4 text-sm sm:text-base border border-stone-300 rounded-2xl focus:ring-2 focus:ring-amber-500 outline-hidden leading-relaxed resize-y"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 9: Final Submit */}
        {currentStep === 9 && (
          <div className="space-y-6 max-w-3xl mx-auto">
            {record.status === 'submitted' ? (
              <div className="text-center space-y-6 py-6">
                <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-4xl mx-auto shadow-sm animate-in zoom-in">
                  🎉
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-900">
                    멋진 작품이 성공적으로 제출되었습니다!
                  </h2>
                  <p className="text-stone-600 text-sm max-w-md mx-auto">
                    계획부터 퇴고까지 모든 과정을 성실하게 마쳤습니다. 성장 경험치가 지급되었습니다!
                  </p>
                </div>

                <div className="p-6 bg-stone-50 border border-stone-200 rounded-3xl text-left space-y-3">
                  <div className="flex justify-between items-center border-b border-stone-200 pb-2">
                    <span className="font-bold text-stone-900 text-base">{record.topicTitle}</span>
                    <span className="text-xs text-stone-500">
                      총 {record.finalWriting?.length || 0}자
                    </span>
                  </div>
                  <p className="text-sm text-stone-800 whitespace-pre-wrap leading-relaxed">
                    {record.finalWriting}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => onCompleted(record.recordId)}
                    className="w-full sm:w-auto px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-xs transition-colors"
                  >
                    나의 글 목록에서 보기
                  </button>
                  <button
                    onClick={onBack}
                    className="w-full sm:w-auto px-6 py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-xl transition-colors"
                  >
                    홈으로 돌아가기
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="text-center space-y-1">
                  <span className="text-xs font-bold text-amber-600">9단계 • 최종 확인 및 제출</span>
                  <h2 className="text-2xl font-bold text-stone-900">마지막으로 글을 읽고 제출해 주세요</h2>
                </div>

                <div className="p-6 bg-stone-50 border border-stone-200 rounded-3xl space-y-3">
                  <div className="flex justify-between items-center border-b border-stone-200 pb-2">
                    <span className="font-bold text-stone-900 text-base">{record.topicTitle}</span>
                    <span className="text-xs text-stone-500">
                      글자 수: {(record.afterProofreading || record.revisedWriting || record.draft).length}자
                    </span>
                  </div>
                  <p className="text-sm sm:text-base text-stone-800 whitespace-pre-wrap leading-relaxed">
                    {record.afterProofreading || record.revisedWriting || record.draft}
                  </p>
                </div>

                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 flex items-center gap-3">
                  <span className="text-2xl">🏆</span>
                  <div>
                    <strong>제출 시 혜택:</strong> 최종 제출 시 보너스 성장 경험치(+1 XP)와 함께 첫 작품 배지 조건이 달성됩니다!
                  </div>
                </div>

                <button
                  id="btn-final-submit"
                  onClick={handleFinalSubmit}
                  className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-[0.99] text-white font-extrabold text-base rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <Send className="w-5 h-5" />
                  선생님께 최종 작품 제출하기
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Step Navigation Bar */}
      {record.status !== 'submitted' && (
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={handlePrevStep}
            disabled={currentStep === 1}
            className="px-5 py-2.5 rounded-xl border border-stone-300 text-stone-700 font-bold text-xs sm:text-sm hover:bg-stone-100 disabled:opacity-30 disabled:pointer-events-none transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            이전 단계
          </button>

          {currentStep < 9 && (
            <button
              id="btn-next-step"
              onClick={handleNextStep}
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-xs sm:text-sm shadow-xs transition-all flex items-center gap-1.5"
            >
              다음 단계로
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
