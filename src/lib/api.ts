import { AIFeedbackData, SpellingCorrection, WritingRecord } from '../types';

export interface GenerateTopicParams {
  category?: string;
  gradeLevel?: number;
  writingType?: string;
  keywords?: string;
  prompt?: string;
  count?: number;
}

export interface ProofreadResult {
  corrections: SpellingCorrection[];
  correctedFullText: string;
}

export interface ProcessAssessmentDraft {
  overview: string;
  processEvaluation: string;
  strengthsSummary: string;
  growthAdvice: string;
  scores: {
    contentRichness: number;
    structureOrganization: number;
    expressionVocabulary: number;
    revisionEffort: number;
  };
}

export interface GeminiConnectionTestResult {
  success: boolean;
  status?: string;
  modelUsed?: string;
  primaryModel?: string;
  fallbackModel?: string;
  latencyMs?: number;
  message?: string;
  sampleEncouragement?: string;
  error?: string;
  hasApiKey?: boolean;
}

/**
 * 1. [연결 점검] /api/gemini/test-connection 엔드포인트 호출
 */
export async function testGeminiConnection(): Promise<GeminiConnectionTestResult> {
  try {
    const res = await fetch('/api/gemini/test-connection', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    return await res.json();
  } catch (err: any) {
    return {
      success: false,
      status: 'error',
      error: err.message || '서버 통신 실패 (네트워크 오류)',
    };
  }
}

/**
 * Legacy alias for test-health
 */
export async function testGeminiHealth(): Promise<GeminiConnectionTestResult> {
  return testGeminiConnection();
}

/**
 * 2. 글쓰기 주제 생성 (듀얼 모델 & JSON 정제 지원)
 */
export async function generateTopicsAPI(params: GenerateTopicParams): Promise<{ success: boolean; topics?: any[]; modelUsed?: string; error?: string }> {
  try {
    const res = await fetch('/api/gemini/generate-topic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...params,
        keywords: params.prompt || params.keywords,
      }),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message || '주제 생성 실패' };
  }
}

/**
 * 3. 초고 AI 피드백 생성
 */
export async function getAIFeedbackAPI(params: {
  topicTitle: string;
  draft: string;
  planning?: any;
  gradeLevel?: number;
}): Promise<{ success: boolean; feedback?: AIFeedbackData; modelUsed?: string; error?: string }> {
  try {
    const res = await fetch('/api/gemini/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message || 'AI 피드백 요청 실패' };
  }
}

/**
 * 4. 맞춤법 및 띄어쓰기 교정 (원문 문체 100% 보존)
 */
export async function proofreadAPI(text: string): Promise<{ success: boolean; result?: ProofreadResult; modelUsed?: string; error?: string }> {
  try {
    const res = await fetch('/api/gemini/proofread', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message || '맞춤법 점검 요청 실패' };
  }
}

/**
 * 5. 과정중심평가 초안 종합 생성
 */
export async function generateAssessmentAPI(data: {
  studentName?: string;
  topicTitle?: string;
  planning?: any;
  draft?: string;
  revisionGoal?: string;
  revisedWriting?: string;
  finalWriting?: string;
  selfAssessment?: any;
}): Promise<{ success: boolean; assessment?: string; assessmentDraft?: ProcessAssessmentDraft; modelUsed?: string; error?: string }> {
  try {
    const res = await fetch('/api/gemini/process-assessment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ record: data }),
    });
    const json = await res.json();
    if (json.success && json.assessmentDraft) {
      const draft = json.assessmentDraft as ProcessAssessmentDraft;
      const formatted = `[총평] ${draft.overview}\n\n[과정 분석] ${draft.processEvaluation}\n\n[주요 강점] ${draft.strengthsSummary}\n\n[성장 조언] ${draft.growthAdvice}`;
      return { success: true, assessment: formatted, assessmentDraft: draft, modelUsed: json.modelUsed };
    }
    return json;
  } catch (err: any) {
    return { success: false, error: err.message || '과정중심평가 초안 생성 실패' };
  }
}

export async function generateProcessAssessmentAPI(record: WritingRecord): Promise<{ success: boolean; assessmentDraft?: ProcessAssessmentDraft; modelUsed?: string; error?: string }> {
  return generateAssessmentAPI(record);
}
