import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Sparkles,
  PenTool,
  ArrowRight,
  Filter,
  Plus,
  Compass,
} from 'lucide-react';
import { DailyTopic, StudentInfo } from '../types';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface TopicSelectionViewProps {
  student: StudentInfo;
  onSelectTopic: (topic: DailyTopic | null, customTitle?: string) => void;
  onBack: () => void;
}

export const TopicSelectionView: React.FC<TopicSelectionViewProps> = ({
  student,
  onSelectTopic,
  onBack,
}) => {
  const [topics, setTopics] = useState<DailyTopic[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [customTopicTitle, setCustomTopicTitle] = useState<string>('');

  useEffect(() => {
    loadTopics();
  }, []);

  const loadTopics = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'dailyTopics'),
        where('isPublished', '==', true),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      const list: DailyTopic[] = [];
      snap.forEach((doc) => {
        list.push(doc.data() as DailyTopic);
      });
      setTopics(list);
    } catch (err) {
      console.error('Error fetching topics:', err);
    } finally {
      setLoading(false);
    }
  };

  const categories = ['all', '생활문', '독서감상문', '설명문', '주장하는 글', '일기', '편지글', '상상글'];

  const filteredTopics = topics.filter((t) => {
    if (selectedCategory === 'all') return true;
    return t.category === selectedCategory;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight flex items-center gap-2.5">
          <Compass className="w-7 h-7 text-amber-600" />
          글쓰기 주제 선택
        </h1>
        <p className="text-xs sm:text-sm text-stone-500 mt-1">
          선생님이 추천한 주제 중에서 마음에 드는 주제를 고르거나, 나만의 자유 주제로 글쓰기를 시작해보세요.
        </p>
      </div>

      {/* Free / Custom Topic Card */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-3xl p-6 text-white shadow-md space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          <h2 className="font-extrabold text-lg">나만의 자유 주제로 글쓰기</h2>
        </div>
        <p className="text-xs sm:text-sm text-amber-100">
          오늘 쓰고 싶은 나만의 특별한 이야기 제목을 직접 정하고 시작할 수 있습니다.
        </p>

        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <input
            type="text"
            placeholder="내가 쓰고 싶은 글의 제목을 적어보세요 (예: 우리 집 반려견 초코와의 하루)"
            value={customTopicTitle}
            onChange={(e) => setCustomTopicTitle(e.target.value)}
            className="flex-1 px-4 py-3 text-sm rounded-xl text-stone-900 bg-white placeholder:text-stone-400 outline-hidden font-medium"
          />
          <button
            onClick={() => {
              if (!customTopicTitle.trim()) {
                alert('자유 주제 제목을 입력해주세요.');
                return;
              }
              onSelectTopic(null, customTopicTitle.trim());
            }}
            className="px-6 py-3 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 shrink-0"
          >
            <PenTool className="w-4 h-4" />
            자유 주제로 시작
          </button>
        </div>
      </div>

      {/* Categories Filter Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
              selectedCategory === cat
                ? 'bg-amber-500 text-white'
                : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
            }`}
          >
            {cat === 'all' ? '전체 갈래' : cat}
          </button>
        ))}
      </div>

      {/* Topics Grid */}
      {loading ? (
        <div className="py-16 text-center text-stone-400 text-sm flex flex-col items-center gap-2">
          <span className="inline-block w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></span>
          <span>추천 주제를 불러오는 중...</span>
        </div>
      ) : filteredTopics.length === 0 ? (
        <div className="bg-white rounded-3xl border border-stone-200 p-12 text-center text-stone-400 space-y-2">
          <BookOpen className="w-10 h-10 mx-auto text-stone-300" />
          <p className="font-bold text-stone-700 text-sm">해당 분류의 추천 주제가 없습니다.</p>
          <p className="text-xs text-stone-400">위의 자유 주제 입력창을 통해 원하는 주제로 글을 시작할 수 있습니다!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTopics.map((top) => (
            <div
              key={top.id}
              onClick={() => onSelectTopic(top)}
              className="bg-white rounded-2xl border border-stone-200 hover:border-amber-400 hover:shadow-md transition-all p-5 flex flex-col justify-between gap-4 cursor-pointer group"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                    {top.category} • {top.gradeLevel}학년
                  </span>
                  <span className="text-xs text-stone-400">최소 {top.minCharacters || 150}자</span>
                </div>

                <h3 className="font-bold text-stone-900 text-base group-hover:text-amber-600 transition-colors">
                  {top.title}
                </h3>

                <p className="text-xs text-stone-600 leading-relaxed line-clamp-3">
                  {top.description}
                </p>
              </div>

              <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
                <span className="text-xs font-bold text-amber-600 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                  이 주제로 쓰기 <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
