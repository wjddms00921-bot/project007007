import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Search,
  Filter,
  Star,
  Clock,
  CheckCircle2,
  ChevronRight,
  ArrowUpDown,
  FileText,
  Lightbulb,
  Wand2,
  CheckSquare,
  Sparkles,
  X,
  Printer,
  PenTool,
} from 'lucide-react';
import { WritingRecord, StudentInfo } from '../types';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface MyWritingsProps {
  student: StudentInfo;
  initialSelectedId?: string;
  onNavigate: (view: string, extraData?: any) => void;
}

export const MyWritings: React.FC<MyWritingsProps> = ({
  student,
  initialSelectedId,
  onNavigate,
}) => {
  const [writings, setWritings] = useState<WritingRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<'all' | 'in_progress' | 'submitted' | 'favorite'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'title'>('newest');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [selectedRecord, setSelectedRecord] = useState<WritingRecord | null>(null);

  useEffect(() => {
    loadWritings();
  }, [student.studentKey]);

  const loadWritings = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'writingRecords'),
        where('studentKey', '==', student.studentKey)
      );
      const snap = await getDocs(q);
      const list: WritingRecord[] = [];
      snap.forEach((doc) => {
        list.push(doc.data() as WritingRecord);
      });
      setWritings(list);

      if (initialSelectedId) {
        const found = list.find((w) => w.recordId === initialSelectedId);
        if (found) setSelectedRecord(found);
      }
    } catch (err) {
      console.error('Error fetching student writings:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async (rec: WritingRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    const newFav = !rec.favorite;
    try {
      const docRef = doc(db, 'writingRecords', rec.recordId);
      await updateDoc(docRef, { favorite: newFav });
      setWritings(prev => prev.map(w => w.recordId === rec.recordId ? { ...w, favorite: newFav } : w));
      if (selectedRecord?.recordId === rec.recordId) {
        setSelectedRecord({ ...selectedRecord, favorite: newFav });
      }
    } catch (err) {
      console.error('Favorite update error:', err);
    }
  };

  // Filter & Sort Logic
  const filteredWritings = writings
    .filter((w) => {
      if (filterType === 'in_progress') return w.status === 'in_progress';
      if (filterType === 'submitted') return w.status === 'submitted';
      if (filterType === 'favorite') return w.favorite;
      return true;
    })
    .filter((w) => {
      if (!searchKeyword.trim()) return true;
      const kw = searchKeyword.toLowerCase();
      return (
        w.topicTitle.toLowerCase().includes(kw) ||
        (w.finalWriting && w.finalWriting.toLowerCase().includes(kw)) ||
        (w.draft && w.draft.toLowerCase().includes(kw))
      );
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return (b.updatedAt || 0) - (a.updatedAt || 0);
      if (sortBy === 'oldest') return (a.createdAt || 0) - (b.createdAt || 0);
      if (sortBy === 'title') return a.topicTitle.localeCompare(b.topicTitle);
      return 0;
    });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight flex items-center gap-2.5">
            <BookOpen className="w-7 h-7 text-amber-600" />
            나의 글 보관함
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-1">
            지금까지 쓴 글의 전체 퇴고 과정과 초고-완성본 비교를 확인할 수 있습니다.
          </p>
        </div>

        <button
          onClick={() => onNavigate('new-writing')}
          className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-colors flex items-center gap-1.5 self-start sm:self-auto"
        >
          <PenTool className="w-4 h-4" />
          새 글 쓰기
        </button>
      </div>

      {/* Filter and Search Controls */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 md:pb-0">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              filterType === 'all'
                ? 'bg-amber-500 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            전체 ({writings.length})
          </button>
          <button
            onClick={() => setFilterType('submitted')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              filterType === 'submitted'
                ? 'bg-emerald-600 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            완성 글 ({writings.filter((w) => w.status === 'submitted').length})
          </button>
          <button
            onClick={() => setFilterType('in_progress')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              filterType === 'in_progress'
                ? 'bg-amber-600 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            작성 중 ({writings.filter((w) => w.status === 'in_progress').length})
          </button>
          <button
            onClick={() => setFilterType('favorite')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              filterType === 'favorite'
                ? 'bg-amber-400 text-stone-900'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            ⭐ 즐겨찾기 ({writings.filter((w) => w.favorite).length})
          </button>
        </div>

        {/* Search & Sort */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-56">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="제목, 내용 검색"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-hidden"
            />
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-2.5 py-1.5 text-xs border border-stone-300 rounded-lg bg-white font-medium text-stone-700 outline-hidden"
          >
            <option value="newest">최신순</option>
            <option value="oldest">오래된순</option>
            <option value="title">주제별(가나다)</option>
          </select>
        </div>
      </div>

      {/* Writings Grid */}
      {loading ? (
        <div className="py-20 text-center text-stone-500 text-sm flex flex-col items-center gap-2">
          <span className="inline-block w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></span>
          <span>글쓰기 목록을 불러오는 중...</span>
        </div>
      ) : filteredWritings.length === 0 ? (
        <div className="bg-white rounded-3xl border border-stone-200 p-12 text-center text-stone-400 space-y-3">
          <BookOpen className="w-10 h-10 mx-auto text-stone-300" />
          <p className="font-bold text-stone-700 text-base">해당하는 글이 없습니다.</p>
          <p className="text-xs text-stone-400">새로운 글쓰기를 시작해 보세요!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredWritings.map((rec) => {
            const isCompleted = rec.status === 'submitted';
            const previewText = rec.finalWriting || rec.revisedWriting || rec.draft || '구상 단계 중';

            return (
              <div
                key={rec.recordId}
                onClick={() => setSelectedRecord(rec)}
                className="bg-white rounded-2xl border border-stone-200 hover:border-amber-300 hover:shadow-md transition-all p-5 flex flex-col justify-between gap-4 cursor-pointer group relative overflow-hidden"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                        isCompleted
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {isCompleted ? '완성됨' : `${rec.currentStep}단계 작성 중`}
                    </span>

                    <button
                      onClick={(e) => toggleFavorite(rec, e)}
                      className={`p-1 rounded-lg transition-colors ${
                        rec.favorite ? 'text-amber-500 hover:text-stone-400' : 'text-stone-300 hover:text-amber-500'
                      }`}
                      title={rec.favorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                    >
                      <Star className={`w-4 h-4 ${rec.favorite ? 'fill-amber-400' : ''}`} />
                    </button>
                  </div>

                  <h3 className="font-bold text-stone-900 text-base group-hover:text-amber-600 transition-colors line-clamp-1">
                    {rec.topicTitle}
                  </h3>

                  <p className="text-xs text-stone-600 line-clamp-3 leading-relaxed">
                    {previewText}
                  </p>
                </div>

                <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-400">
                  <span>
                    {new Date(rec.updatedAt || rec.createdAt).toLocaleDateString('ko-KR', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                  <span className="font-bold text-amber-600 group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                    {isCompleted ? '작품 보기' : '이어서 쓰기'} &gt;
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detailed Modal: Full Process & Comparison */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] shadow-2xl border border-stone-200 overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200 my-auto">
            {/* Modal Header */}
            <div className="bg-stone-50 border-b border-stone-200 px-6 py-4 flex items-center justify-between shrink-0">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                      selectedRecord.status === 'submitted'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {selectedRecord.status === 'submitted' ? '완성 작품' : '작성 중'}
                  </span>
                  <span className="text-xs text-stone-500">
                    작성일: {new Date(selectedRecord.createdAt).toLocaleDateString('ko-KR')}
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-stone-900">
                  {selectedRecord.topicTitle}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                {selectedRecord.status === 'in_progress' && (
                  <button
                    onClick={() => onNavigate('writing-flow', { recordId: selectedRecord.recordId })}
                    className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl flex items-center gap-1 shadow-xs"
                  >
                    <PenTool className="w-3.5 h-3.5" />
                    이어서 쓰기
                  </button>
                )}
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="p-2 text-stone-400 hover:text-stone-800 hover:bg-stone-200 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Draft vs Final Comparison */}
              <div className="space-y-2">
                <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  초고와 최종 완성 글 비교
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Draft Column */}
                  <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-stone-500">
                      <span>처음 작성한 초고</span>
                      <span>{selectedRecord.draft?.length || 0}자</span>
                    </div>
                    <p className="text-xs sm:text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">
                      {selectedRecord.draft || '초고가 없습니다.'}
                    </p>
                  </div>

                  {/* Final Column */}
                  <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
                      <span>다듬고 완성한 최종 글</span>
                      <span>{(selectedRecord.finalWriting || selectedRecord.revisedWriting || selectedRecord.draft)?.length || 0}자</span>
                    </div>
                    <p className="text-xs sm:text-sm text-emerald-950 whitespace-pre-wrap leading-relaxed">
                      {selectedRecord.finalWriting || selectedRecord.revisedWriting || selectedRecord.draft || '작성 중'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Full Evolution Process Accordion / Cards */}
              <div className="space-y-3 pt-2">
                <h3 className="font-bold text-stone-900 text-sm">글쓰기 성장 전체 과정</h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  {/* Planning Card */}
                  <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl space-y-1.5">
                    <div className="font-bold text-stone-800 flex items-center gap-1">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                      1. 생각 계획
                    </div>
                    <div className="text-stone-600 space-y-1">
                      {selectedRecord.planning?.mindmapKeywords?.length ? (
                        <div>
                          <strong>키워드:</strong> {selectedRecord.planning.mindmapKeywords.join(', ')}
                        </div>
                      ) : null}
                      {selectedRecord.planning?.outlineMiddle && (
                        <div>
                          <strong>중심내용:</strong> {selectedRecord.planning.outlineMiddle}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* AI Feedback & Goal */}
                  <div className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-xl space-y-1.5">
                    <div className="font-bold text-amber-900 flex items-center gap-1">
                      <Wand2 className="w-3.5 h-3.5 text-amber-600" />
                      2. AI 피드백 &amp; 수정 목표
                    </div>
                    <p className="text-amber-950 line-clamp-3">
                      <strong>나의 목표:</strong> {selectedRecord.revisionGoal || '자유 수정'}
                    </p>
                  </div>

                  {/* Self-Assessment */}
                  <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-xl space-y-1.5">
                    <div className="font-bold text-blue-900 flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-blue-600" />
                      3. 자기평가 &amp; 돌아보기
                    </div>
                    <p className="text-blue-950 line-clamp-3">
                      {selectedRecord.selfAssessment?.pridePoint || '성실하게 자기평가를 완료했습니다.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Teacher Assessment (if checked by teacher) */}
              {selectedRecord.teacherAssessment && (
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl space-y-1 text-xs sm:text-sm">
                  <div className="font-bold text-purple-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-purple-600" />
                    선생님의 과정중심평가 &amp; 격려 한마디
                  </div>
                  <p className="text-purple-950 whitespace-pre-wrap leading-relaxed mt-1">
                    {selectedRecord.teacherAssessment}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
