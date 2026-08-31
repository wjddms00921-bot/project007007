import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Multi-tier model fallback list
const MODELS = ['gemini-3.1-flash-lite', 'gemini-3.7-flash', 'gemini-flash-latest'];
const PRIMARY_MODEL = MODELS[0];
const FALLBACK_MODEL = MODELS[1];

// 1. [보안 & 안정성] Lazy initialization helper for Gemini client
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY 환경변수가 설정되지 않았습니다. AI Studio 설정에서 API 키를 등록해주세요.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// 2. [오류 방지 정제] Markdown 및 여백 제거 후 순수 JSON 파싱 유틸리티
export function cleanJsonString(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  let str = raw.trim();

  // Strip Markdown code block wrappers like ```json ... ``` or ``` ... ```
  str = str.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // Extract content between first and last JSON delimiters
  const firstBrace = str.indexOf('{');
  const firstBracket = str.indexOf('[');

  let start = -1;
  if (firstBrace !== -1 && firstBracket !== -1) {
    start = Math.min(firstBrace, firstBracket);
  } else if (firstBrace !== -1) {
    start = firstBrace;
  } else if (firstBracket !== -1) {
    start = firstBracket;
  }

  if (start !== -1) {
    const isObj = str[start] === '{';
    const last = isObj ? str.lastIndexOf('}') : str.lastIndexOf(']');
    if (last !== -1 && last >= start) {
      str = str.substring(start, last + 1);
    }
  }

  return str;
}

export function parseJsonSafely<T = any>(raw: string, defaultValue: T): T {
  const cleaned = cleanJsonString(raw);
  if (!cleaned) return defaultValue;
  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    console.warn('[Gemini AI] JSON parse failure on text:', cleaned, err);
    return defaultValue;
  }
}

// 3. [자동 복구 멀티 모델] 가용 모델을 순차적으로 시도하여 무중단 서비스 보장
async function generateWithDualModel(
  ai: GoogleGenAI,
  options: {
    contents: any;
    config?: any;
  }
): Promise<{ text: string; modelUsed: string }> {
  let lastError: any = null;

  for (const modelName of MODELS) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: options.contents,
        config: options.config,
      });
      return {
        text: response.text || '',
        modelUsed: modelName,
      };
    } catch (err: any) {
      console.warn(`[Gemini AI] Model ${modelName} returned error:`, err?.message || err);
      lastError = err;
      // Continue to next available fallback model in the list
    }
  }

  throw lastError || new Error('모든 AI 모델 호출에 실패했습니다.');
}

// 4. Server health & status check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    primaryModel: PRIMARY_MODEL,
    fallbackModel: FALLBACK_MODEL,
    timestamp: Date.now(),
  });
});

// 5. [연결 점검] /api/gemini/test-connection (GET & POST 지원)
const handleTestConnection = async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const ai = getGeminiClient();
    const result = await generateWithDualModel(ai, {
      contents: '초등학생 글쓰기 성장을 응원하는 다정한 1줄 격려 메시지를 작성해주세요.',
    });
    const latencyMs = Date.now() - startTime;

    res.json({
      success: true,
      status: 'connected',
      modelUsed: result.modelUsed,
      primaryModel: PRIMARY_MODEL,
      fallbackModel: FALLBACK_MODEL,
      latencyMs,
      message: 'Google Gemini AI 엔진과 정상적으로 연결되었습니다.',
      sampleEncouragement: result.text.trim() || '오늘도 스스로 생각하고 글을 써보는 멋진 하루를 보내세요!',
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error('[Gemini AI] Connection test failed:', error);
    res.status(500).json({
      success: false,
      status: 'error',
      error: error.message || 'Gemini API 호출에 실패했습니다.',
      hasApiKey: !!process.env.GEMINI_API_KEY,
      timestamp: Date.now(),
    });
  }
};

app.get('/api/gemini/test-connection', handleTestConnection);
app.post('/api/gemini/test-connection', handleTestConnection);
app.post('/api/gemini/test-health', handleTestConnection);

// 6. Topic generation for teachers
app.post('/api/gemini/generate-topic', async (req: Request, res: Response) => {
  try {
    const { category, gradeLevel, writingType, keywords, count = 3 } = req.body;
    const ai = getGeminiClient();

    const prompt = `초등학교 ${gradeLevel || 3}학년 수준에 알맞은 글쓰기 주제를 ${count}개 생성해주세요.
글쓰기 영역: ${category || '생활/경험'}
글의 갈래: ${writingType || '생활문'}
참고 키워드/상황: ${keywords || '초등학생 일상 및 상상'}

각 주제는 다음 JSON 형식의 배열로 생성하세요:
[
  {
    "title": "주제 제목 (아이들의 호기심과 생각할 거리를 자극하는 다정한 문장)",
    "description": "글쓰기 가이드 및 생각 열기 질문 (2-3문장)",
    "category": "${category || '생활/경험'}",
    "gradeLevel": ${gradeLevel || 3},
    "writingType": "${writingType || '생활문'}",
    "minCharacters": 150,
    "tips": ["글을 쓸 때 도움이 되는 팁 1", "도움이 되는 팁 2", "도움이 되는 팁 3"]
  }
]`;

    const { text, modelUsed } = await generateWithDualModel(ai, {
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              category: { type: Type.STRING },
              gradeLevel: { type: Type.NUMBER },
              writingType: { type: Type.STRING },
              minCharacters: { type: Type.NUMBER },
              tips: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ['title', 'description', 'category', 'gradeLevel', 'writingType', 'minCharacters', 'tips'],
          },
        },
      },
    });

    const parsed = parseJsonSafely(text, []);
    res.json({ success: true, topics: parsed, modelUsed });
  } catch (error: any) {
    console.error('[Gemini AI] Topic generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || '글쓰기 주제 생성 중 오류가 발생했습니다.',
    });
  }
});

// 7. AI Feedback on student draft
app.post('/api/gemini/feedback', async (req: Request, res: Response) => {
  try {
    const { topicTitle, draft, planning, gradeLevel = 3 } = req.body;
    if (!draft || draft.trim().length === 0) {
      return res.status(400).json({ success: false, error: '초고 내용이 없습니다.' });
    }

    const ai = getGeminiClient();

    const prompt = `당신은 초등학생 글쓰기를 따뜻하고 전문적으로 지도하는 초등 교육 글쓰기 멘토 AI입니다.
학생이 작성한 초고를 읽고, 칭찬과 성장을 위한 안내를 제공해주세요.
절대로 학생의 글을 직접 대신 써주거나 새로 지어주지 마세요. 학생 스스로 생각을 펼치고 수정할 수 있도록 유도해야 합니다.

[글쓰기 정보]
- 학년 수준: 초등학교 ${gradeLevel}학년
- 글쓰기 주제: "${topicTitle || '자유 주제'}"
- 학생이 작성한 계획: ${planning?.notes || planning?.outlineMiddle || '자유롭게 구상함'}

[학생의 초고]:
"""
${draft}
"""

다음 5가지 항목을 충실히 포함하여 JSON 객체로 응답해주세요:
1. goodPoints: 학생 글에서 잘된 점 2~3가지 (구체적인 문장이나 표현을 언급하며 다정하게 칭찬)
2. improvementPoints: 조금 더 발전시키면 좋을 점 2가지 (생각을 구체화하거나 상황을 생생하게 그릴 수 있는 조언)
3. reasoning: 왜 그런 보완이 글을 더 풍성하게 만드는지에 대한 쉬운 설명
4. priorityFix: 고쳐쓰기 할 때 가장 먼저 손보면 좋을 한 가지 핵심 포인트
5. thinkingQuestion: 학생 스스로 생각의 폭을 넓힐 수 있는 친절한 유도 질문 1개`;

    const { text, modelUsed } = await generateWithDualModel(ai, {
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            goodPoints: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '잘된 점 2-3가지',
            },
            improvementPoints: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '보완할 점 2가지',
            },
            reasoning: {
              type: Type.STRING,
              description: '판단 근거 및 설명',
            },
            priorityFix: {
              type: Type.STRING,
              description: '가장 먼저 고칠 부분',
            },
            thinkingQuestion: {
              type: Type.STRING,
              description: '스스로 생각할 질문',
            },
          },
          required: ['goodPoints', 'improvementPoints', 'reasoning', 'priorityFix', 'thinkingQuestion'],
        },
      },
    });

    const feedback = parseJsonSafely(text, {
      goodPoints: ['생각을 솔직하고 용기 있게 잘 표현했습니다.'],
      improvementPoints: ['그때의 마음이나 주변 장면을 한 문장 더 자세히 들려주면 좋겠습니다.'],
      reasoning: '자세한 묘사가 읽는 이의 상상을 돕습니다.',
      priorityFix: '가장 기억에 남는 순간의 느낌을 조금 더 적어보세요.',
      thinkingQuestion: '그때 어떤 소리나 표정이 가장 먼저 떠올랐나요?',
    });

    res.json({ success: true, feedback, modelUsed });
  } catch (error: any) {
    console.error('[Gemini AI] Feedback generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'AI 피드백 생성 중 오류가 발생했습니다.',
    });
  }
});

// 8. Spelling & spacing proofreader (Strictly preserves student content/ideas)
app.post('/api/gemini/proofread', async (req: Request, res: Response) => {
  try {
    const { text: rawInputText } = req.body;
    if (!rawInputText || rawInputText.trim().length === 0) {
      return res.status(400).json({ success: false, error: '점검할 글 내용이 없습니다.' });
    }

    const ai = getGeminiClient();

    const prompt = `당신은 초등학생 글의 맞춤법, 띄어쓰기, 문장 부호, 명백한 오타만을 교정해 주는 한국어 교정 도우미입니다.
학생의 생각이나 문체, 표현, 아이디어를 변경하거나 문장을 임의로 다시 쓰지 마세요.
오직 표준 맞춤법, 띄어쓰기, 문장 부호(마침표, 물음표, 느낌표, 쉼표 등), 단순 오타만 점검하세요.

[학생 글]
"""
${rawInputText}
"""

JSON 형식으로 응답하세요:
- corrections: 찾은 교정 사항 목록. 각 항목은 { id: "1", original: "틀린단어", corrected: "바른단어", reason: "이유(초등학생이 알기 쉽게 1문장)", type: "맞춤법" | "띄어쓰기" | "문장부호" | "오타" }
- correctedFullText: 교정 사항들을 모두 반영한 전체 완성 글 (학생의 문체와 원문 내용 100% 보존)`;

    const { text: resultText, modelUsed } = await generateWithDualModel(ai, {
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            corrections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  original: { type: Type.STRING },
                  corrected: { type: Type.STRING },
                  reason: { type: Type.STRING },
                  type: {
                    type: Type.STRING,
                    description: '맞춤법, 띄어쓰기, 문장부호, 오타 중 하나',
                  },
                },
                required: ['id', 'original', 'corrected', 'reason', 'type'],
              },
            },
            correctedFullText: {
              type: Type.STRING,
              description: '교정이 반영된 전체 글',
            },
          },
          required: ['corrections', 'correctedFullText'],
        },
      },
    });

    const result = parseJsonSafely(resultText, {
      corrections: [],
      correctedFullText: rawInputText,
    });

    res.json({ success: true, result, modelUsed });
  } catch (error: any) {
    console.error('[Gemini AI] Proofreading error:', error);
    res.status(500).json({
      success: false,
      error: error.message || '맞춤법 점검 중 오류가 발생했습니다.',
    });
  }
});

// 9. Process-centered assessment draft for teachers
app.post('/api/gemini/process-assessment', async (req: Request, res: Response) => {
  try {
    const { record } = req.body;
    if (!record) {
      return res.status(400).json({ success: false, error: '글쓰기 기록이 제공되지 않았습니다.' });
    }

    const ai = getGeminiClient();

    const prompt = `당신은 초등 국어 교육 과정중심평가 전문 교사 보조 AI입니다.
학생이 한 편의 글을 완성하기까지 거친 [계획 -> 초고 -> AI 피드백 수용 -> 수정 목표 설정 -> 고쳐쓰기 -> 자기평가 -> 맞춤법 점검 -> 최종 글] 전체 과정을 종합적으로 분석하여 교사가 검토하고 승인할 '과정중심평가 초안'을 작성해주세요.

[글쓰기 과정 데이터]
- 주제: ${record.topicTitle}
- 학생 이름: ${record.studentName || '학생'}
- 계획 단계: ${JSON.stringify(record.planning || {})}
- 초고 내용: """${record.draft || ''}"""
- AI 피드백 요약: ${JSON.stringify(record.aiFeedback || {})}
- 학생이 세운 수정 목표: "${record.revisionGoal || ''}"
- 고쳐쓴 글: """${record.revisedWriting || ''}"""
- 자기평가: ${JSON.stringify(record.selfAssessment || {})}
- 최종 완성 글: """${record.finalWriting || ''}"""

다음 JSON 형식으로 과정중심평가 초안을 도출하세요:
{
  "overview": "글쓰기 전반에 대한 총평 (3~4문장, 학생의 진정성과 노력 중심)",
  "processEvaluation": "계획부터 고쳐쓰기까지의 과정 분석 (AI 피드백과 본인의 수정 목표를 어떻게 글에 반영했는지 구체적으로 평가)",
  "strengthsSummary": "글에서 드러난 주요 강점 요약 (표현력, 구성력, 주제 의식 등)",
  "growthAdvice": "앞으로의 글쓰기 발전을 위한 따뜻한 조언",
  "scores": {
    "contentRichness": 5,
    "structureOrganization": 5,
    "expressionVocabulary": 5,
    "revisionEffort": 5
  }
}`;

    const { text, modelUsed } = await generateWithDualModel(ai, {
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overview: { type: Type.STRING },
            processEvaluation: { type: Type.STRING },
            strengthsSummary: { type: Type.STRING },
            growthAdvice: { type: Type.STRING },
            scores: {
              type: Type.OBJECT,
              properties: {
                contentRichness: { type: Type.NUMBER },
                structureOrganization: { type: Type.NUMBER },
                expressionVocabulary: { type: Type.NUMBER },
                revisionEffort: { type: Type.NUMBER },
              },
              required: ['contentRichness', 'structureOrganization', 'expressionVocabulary', 'revisionEffort'],
            },
          },
          required: ['overview', 'processEvaluation', 'strengthsSummary', 'growthAdvice', 'scores'],
        },
      },
    });

    const assessmentDraft = parseJsonSafely(text, {
      overview: '글쓰기 과정 전반에 걸쳐 진지하게 생각을 펼쳐내었습니다.',
      processEvaluation: 'AI 피드백과 자신의 수정 목표를 충실히 반영하여 글을 완성했습니다.',
      strengthsSummary: '자신의 경험과 감정을 솔직하게 드러낸 점이 돋보입니다.',
      growthAdvice: '생각을 구체적인 상황과 연결하여 표현하는 연습을 꾸준히 해보세요.',
      scores: {
        contentRichness: 4,
        structureOrganization: 4,
        expressionVocabulary: 4,
        revisionEffort: 5,
      },
    });

    res.json({ success: true, assessmentDraft, modelUsed });
  } catch (error: any) {
    console.error('[Gemini AI] Process assessment error:', error);
    res.status(500).json({
      success: false,
      error: error.message || '과정중심평가 초안 생성 중 오류가 발생했습니다.',
    });
  }
});

// 10. Vite & Static file handling
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
