import { collection, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { sha256 } from './crypto';
import { ClassInfo, DailyTopic, SystemSettings } from '../types';

export const INITIAL_TOPICS: Omit<DailyTopic, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    title: '내가 가장 아끼는 보물 1호 이야기',
    category: '생활문',
    gradeLevel: 3,
    description: '나에게 가장 소중하고 특별한 물건은 무엇인가요? 그 물건을 언제, 어떻게 얻게 되었고 왜 소중한지 자세히 써보세요.',
    tips: [
      '보물의 생김새나 특징을 눈에 보이듯 묘사해 보세요.',
      '그 물건과 관련된 잊을 수 없는 추억이나 사건을 소개하세요.',
      '앞으로 그 보물을 어떻게 아껴줄 것인지 다짐을 덧붙여 보세요.',
    ],
    minCharacters: 150,
    isPublished: true,
  },
  {
    title: '내가 만약 하루 동안 투명인간이 된다면?',
    category: '상상글',
    gradeLevel: 3,
    description: '어느 날 아침 일어났더니 내 몸이 투명해졌습니다! 아무도 나를 볼 수 없다면 어디에 가서 어떤 신나는 일을 하고 싶나요?',
    tips: [
      '투명인간이 되었을 때 처음 느낀 기분이나 놀란 마음을 표현해 보세요.',
      '꼭 해보고 싶었던 엉뚱하거나 재미있는 계획을 3가지 상상해 보세요.',
      '하루가 끝나고 다시 원래대로 돌아왔을 때의 느낌으로 마무리해 보세요.',
    ],
    minCharacters: 150,
    isPublished: true,
  },
  {
    title: '나를 힘나게 해 준 따뜻한 말 한마디',
    category: '생활문',
    gradeLevel: 4,
    description: '힘들거나 속상했을 때, 혹은 무언가에 도전할 때 가족이나 친구, 선생님께 들었던 따뜻한 말 한마디를 떠올려 보세요.',
    tips: [
      '그 말을 들었던 당시의 상황과 내 기분을 솔직하게 적어보세요.',
      '대화 내용을 큰따옴표("")를 사용해 생생하게 살려보세요.',
      '그 말이 나에게 어떤 용기와 변화를 주었는지 적어보세요.',
    ],
    minCharacters: 150,
    isPublished: true,
  },
  {
    title: '내가 좋아하는 책 속 인물에게 보내는 편지',
    category: '독서감상문',
    gradeLevel: 4,
    description: '최근에 읽은 동화나 이야기책 속에서 가장 마음이 가는 주인공이나 인물을 골라 진심을 담은 편지를 써보세요.',
    tips: [
      '편지글 형식(받는 사람, 첫인사, 본문, 끝인사, 보낸이)을 지켜보세요.',
      '책 속 인물의 어떤 행동이나 성격이 인상 깊었는지 이야기하세요.',
      '만약 내가 그 상황이었다면 어땠을지 나의 생각도 전해보세요.',
    ],
    minCharacters: 150,
    isPublished: true,
  },
  {
    title: '스마트폰 사용 시간, 스스로 조절할 수 있을까?',
    category: '주장하는 글',
    gradeLevel: 5,
    description: '초등학생의 스마트폰 사용 시간에 대해 나의 의견(자율 조절 vs 부모님 규칙 정하기)을 정하고, 설득력 있는 까닭을 들어 주장해 보세요.',
    tips: [
      '나의 주장(입장)을 명확하고 분명하게 제시하세요.',
      '주장을 뒷받침하는 구체적인 경험이나 타당한 근거를 2가지 이상 적으세요.',
      '예상되는 반대 의견을 고려하며 글을 설득력 있게 마무리하세요.',
    ],
    minCharacters: 200,
    isPublished: true,
  },
];

export async function bootstrapInitialDataIfEmpty() {
  try {
    // 1. Check classes collection
    const classSnap = await getDocs(collection(db, 'classes'));
    if (classSnap.empty) {
      const defaultPasswordHash = await sha256('1234');
      const sampleClass: ClassInfo = {
        id: `cls_2026_3_1`,
        schoolYear: 2026,
        grade: 3,
        classNum: 1,
        classPasswordHash: defaultPasswordHash,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await setDoc(doc(db, 'classes', sampleClass.id), sampleClass);
    }

    // 2. Check dailyTopics collection
    const topicsSnap = await getDocs(collection(db, 'dailyTopics'));
    if (topicsSnap.empty) {
      for (let i = 0; i < INITIAL_TOPICS.length; i++) {
        const top = INITIAL_TOPICS[i];
        const topicId = `top_init_${i + 1}`;
        await setDoc(doc(db, 'dailyTopics', topicId), {
          ...top,
          id: topicId,
          createdAt: Date.now() - i * 3600000,
          updatedAt: Date.now(),
        });
      }
    }

    // 3. Check settings collection
    const settingsSnap = await getDoc(doc(db, 'settings', 'admin'));
    if (!settingsSnap.exists()) {
      const defaultAdminPassHash = await sha256('1234');
      const initialSettings: SystemSettings = {
        adminPasswordHash: defaultAdminPassHash,
        initialized: true,
        defaultNameDisplay: 'full',
        siteTitle: 'AI와 함께하는 글쓰기 성장',
        updatedAt: Date.now(),
      };
      await setDoc(doc(db, 'settings', 'admin'), initialSettings);
    }
  } catch (err) {
    console.error('Error bootstrapping initial data:', err);
  }
}
