import React, { useState, useEffect } from 'react';
import {
  Bookmark,
  Sparkles,
  Printer,
  CheckCircle2,
  BookOpen,
  Palette,
  Eye,
  Plus,
  Trash2,
  ArrowLeft,
  Save,
} from 'lucide-react';
import { StudentInfo, WritingRecord, StudentBook, COVER_COLORS, COVER_MOTIFS } from '../types';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface BookCreatorProps {
  student: StudentInfo;
  onBack: () => void;
  onBookCreated: (bookId: string) => void;
}

export const BookCreator: React.FC<BookCreatorProps> = ({
  student,
  onBack,
  onBookCreated,
}) => {
  const [completedWritings, setCompletedWritings] = useState<WritingRecord[]>([]);
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  // Book customization fields
  const [bookTitle, setBookTitle] = useState<string>(`${student.studentName} 작가의 첫 번째 이야기 모음`);
  const [subtitle, setSubtitle] = useState<string>('꿈과 생각이 자라나는 특별한 글쓰기');
  const [selectedColor, setSelectedColor] = useState<string>(COVER_COLORS[0]);
  const [selectedMotif, setSelectedMotif] = useState<string>(COVER_MOTIFS[0]);
  const [foreword, setForeword] = useState<string>(
    '이 책은 제가 초등학교 시절 정성껏 쓴 생각과 마음이 담긴 소중한 작품들입니다. 즐겁게 읽어주세요!'
  );
  const [authorBio, setAuthorBio] = useState<string>(
    `초등학교 ${student.grade}학년에 재학 중인 ${student.studentName} 작가입니다. 일상의 소소한 순간들을 글로 기록하는 것을 좋아합니다.`
  );

  const [previewMode, setPreviewMode] = useState<boolean>(false);

  useEffect(() => {
    loadCompletedWritings();
  }, [student.studentKey]);

  const loadCompletedWritings = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'writingRecords'),
        where('studentKey', '==', student.studentKey),
        where('status', '==', 'submitted')
      );
      const snap = await getDocs(q);
      const list: WritingRecord[] = [];
      snap.forEach((doc) => {
        list.push(doc.data() as WritingRecord);
      });
      setCompletedWritings(list);
      // Select all by default
      setSelectedRecordIds(list.map((w) => w.recordId));
    } catch (err) {
      console.error('Error fetching writings for book:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectRecord = (id: string) => {
    if (selectedRecordIds.includes(id)) {
      setSelectedRecordIds(selectedRecordIds.filter((item) => item !== id));
    } else {
      setSelectedRecordIds([...selectedRecordIds, id]);
    }
  };

  const handlePublishBook = async () => {
    if (selectedRecordIds.length === 0) {
      alert('책에 실을 글을 최소 1편 이상 선택해주세요.');
      return;
    }

    if (!bookTitle.trim()) {
      alert('책 제목을 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      const bookId = `book_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const selectedWritings = completedWritings.filter((w) => selectedRecordIds.includes(w.recordId));

      const newBook: StudentBook = {
        bookId,
        studentKey: student.studentKey,
        studentName: student.studentName,
        classId: student.classId || 'default',
        schoolYear: student.schoolYear,
        grade: student.grade,
        classNum: student.classNum,
        bookTitle: bookTitle.trim(),
        subtitle: subtitle.trim(),
        coverColor: selectedColor,
        coverMotif: selectedMotif,
        selectedWritingIds: selectedRecordIds,
        writingsContent: selectedWritings.map((w) => ({
          recordId: w.recordId,
          title: w.topicTitle,
          content: w.finalWriting || w.revisedWriting || w.draft,
          createdAt: w.createdAt,
        })),
        foreword: foreword.trim(),
        authorBio: authorBio.trim(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const docRef = doc(db, 'studentBooks', bookId);
      await setDoc(docRef, newBook);
      onBookCreated(bookId);
    } catch (err: any) {
      console.error('Error publishing book:', err);
      alert('책을 출판하는 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const selectedWritingsList = completedWritings.filter((w) => selectedRecordIds.includes(w.recordId));

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="p-2 rounded-xl text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors flex items-center gap-1.5 text-xs sm:text-sm font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          뒤로 가기
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 font-bold text-xs sm:text-sm hover:bg-stone-50 flex items-center gap-1.5 transition-colors"
          >
            <Eye className="w-4 h-4 text-amber-600" />
            {previewMode ? '편집 모드로 돌아가기' : '책 인쇄 미리보기'}
          </button>

          <button
            onClick={handlePublishBook}
            disabled={saving || selectedRecordIds.length === 0}
            className="px-5 py-2 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            {saving ? (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <>
                <Bookmark className="w-4 h-4" />
                책 출판 및 서재에 저장
              </>
            )}
          </button>
        </div>
      </div>

      {!previewMode ? (
        /* Edit & Customize Mode */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Book Cover Preview */}
          <div className="space-y-4">
            <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2">
              <Palette className="w-4 h-4 text-purple-600" />
              표지 실시간 미리보기
            </h3>

            {/* Book Cover Container */}
            <div
              className={`rounded-3xl p-6 text-white shadow-xl min-h-[380px] flex flex-col justify-between relative overflow-hidden transition-all bg-gradient-to-br ${selectedColor}`}
            >
              <div className="text-right text-xs font-semibold opacity-80">
                {student.grade}학년 {student.classNum}반
              </div>

              <div className="text-center space-y-3 my-auto py-6">
                <div className="text-5xl mb-2">{selectedMotif}</div>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight leading-snug drop-shadow-xs">
                  {bookTitle || '나의 글 모음집'}
                </h2>
                <p className="text-xs opacity-90">{subtitle}</p>
              </div>

              <div className="text-center border-t border-white/20 pt-3">
                <div className="text-xs font-bold">{student.studentName} 지음</div>
                <div className="text-[10px] opacity-75">{new Date().getFullYear()}년 출판</div>
              </div>
            </div>

            {/* Cover Color Pick */}
            <div className="bg-white p-4 rounded-2xl border border-stone-200 space-y-2">
              <label className="block text-xs font-bold text-stone-700">표지 배경색</label>
              <div className="flex gap-2">
                {COVER_COLORS.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedColor(c)}
                    className={`w-8 h-8 rounded-full bg-gradient-to-br ${c} transition-transform ${
                      selectedColor === c ? 'scale-110 ring-4 ring-purple-200' : 'hover:scale-105'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Motif Pick */}
            <div className="bg-white p-4 rounded-2xl border border-stone-200 space-y-2">
              <label className="block text-xs font-bold text-stone-700">표지 상징 아이콘</label>
              <div className="flex flex-wrap gap-2">
                {COVER_MOTIFS.map((m) => (
                  <button
                    key={m}
                    onClick={() => setSelectedMotif(m)}
                    className={`w-9 h-9 rounded-xl border flex items-center justify-center text-lg transition-all ${
                      selectedMotif === m
                        ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200'
                        : 'border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Book Details & Writing Selector */}
          <div className="lg:col-span-2 space-y-6">
            {/* Metadata Inputs */}
            <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-xs space-y-4">
              <h3 className="font-bold text-stone-900 text-sm">책 정보 설정</h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">책 제목</label>
                  <input
                    type="text"
                    value={bookTitle}
                    onChange={(e) => setBookTitle(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-hidden font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">부제목</label>
                  <input
                    type="text"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">머리말 / 서문</label>
                    <textarea
                      rows={3}
                      value={foreword}
                      onChange={(e) => setForeword(e.target.value)}
                      className="w-full p-3 text-xs border border-stone-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-hidden leading-relaxed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">지은이 소개</label>
                    <textarea
                      rows={3}
                      value={authorBio}
                      onChange={(e) => setAuthorBio(e.target.value)}
                      className="w-full p-3 text-xs border border-stone-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-hidden leading-relaxed"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Writings Selector */}
            <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-stone-900 text-sm">수록할 작품 선택</h3>
                  <p className="text-xs text-stone-500">완성된 글 중 책에 실을 글을 골라주세요.</p>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-purple-100 text-purple-800">
                  {selectedRecordIds.length}편 선택됨
                </span>
              </div>

              {loading ? (
                <div className="py-8 text-center text-xs text-stone-400">글 목록 확인 중...</div>
              ) : completedWritings.length === 0 ? (
                <div className="p-8 text-center text-stone-400 bg-stone-50 rounded-2xl space-y-2">
                  <p className="text-xs">아직 완성된 작품이 없습니다.</p>
                  <p className="text-[11px] text-stone-400">
                    글쓰기 9단계(최종 제출)까지 완료된 글만 책으로 출판할 수 있습니다.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {completedWritings.map((w) => {
                    const isSelected = selectedRecordIds.includes(w.recordId);
                    return (
                      <div
                        key={w.recordId}
                        onClick={() => toggleSelectRecord(w.recordId)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'border-purple-500 bg-purple-50/50'
                            : 'border-stone-200 hover:border-stone-300 bg-white'
                        }`}
                      >
                        <div className="space-y-0.5 min-w-0">
                          <h4 className="font-bold text-stone-900 text-xs sm:text-sm truncate">
                            {w.topicTitle}
                          </h4>
                          <p className="text-[11px] text-stone-500 line-clamp-1">
                            {w.finalWriting || w.revisedWriting || w.draft}
                          </p>
                        </div>

                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectRecord(w.recordId)}
                          className="w-4 h-4 text-purple-600 rounded-sm focus:ring-purple-500"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Printable Book View Layout */
        <div className="space-y-6">
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center justify-between text-xs text-amber-900">
            <span>
              💡 브라우저 인쇄 버튼을 눌러 A4 책 형식으로 출력하거나 PDF로 저장할 수 있습니다.
            </span>
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-xs"
            >
              <Printer className="w-4 h-4" />
              인쇄하기 (PDF 저장)
            </button>
          </div>

          {/* Book Sheet Container */}
          <div className="bg-white rounded-3xl border border-stone-200 p-8 sm:p-12 shadow-md space-y-12 max-w-3xl mx-auto print:p-0 print:border-none print:shadow-none">
            {/* Page 1: Cover */}
            <div className={`p-12 rounded-3xl text-white text-center space-y-8 min-h-[500px] flex flex-col justify-between bg-gradient-to-br ${selectedColor} print:rounded-none print:min-h-[90vh]`}>
              <div className="text-sm font-semibold opacity-90">
                {student.schoolYear}학년도 {student.grade}학년 {student.classNum}반
              </div>

              <div className="space-y-4 my-auto">
                <div className="text-6xl">{selectedMotif}</div>
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">{bookTitle}</h1>
                <p className="text-sm opacity-90">{subtitle}</p>
              </div>

              <div className="border-t border-white/20 pt-4 text-sm font-bold">
                지은이: {student.studentName}
              </div>
            </div>

            {/* Page 2: Foreword & Table of Contents */}
            <div className="space-y-8 pt-8 border-t border-stone-100">
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-stone-900 text-center">머리말</h2>
                <p className="text-stone-700 text-sm leading-relaxed p-4 bg-stone-50 rounded-2xl italic">
                  &ldquo;{foreword}&rdquo;
                </p>
              </div>

              <div className="space-y-3">
                <h2 className="text-xl font-bold text-stone-900 text-center">차 례 (목차)</h2>
                <div className="space-y-2 max-w-md mx-auto">
                  {selectedWritingsList.map((w, idx) => (
                    <div key={w.recordId} className="flex justify-between items-center text-sm border-b border-dotted border-stone-300 pb-1">
                      <span className="font-semibold text-stone-800">
                        {idx + 1}. {w.topicTitle}
                      </span>
                      <span className="text-stone-400">작품 {idx + 1}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Page 3+: Body Writings */}
            <div className="space-y-12 pt-8">
              {selectedWritingsList.map((w, idx) => (
                <div key={w.recordId} className="space-y-4 border-t border-stone-200 pt-8 print:break-before-page">
                  <div className="text-center space-y-1">
                    <span className="text-xs font-bold text-purple-700">작품 {idx + 1}</span>
                    <h3 className="text-2xl font-bold text-stone-900">{w.topicTitle}</h3>
                  </div>

                  <p className="text-stone-800 text-sm sm:text-base leading-loose whitespace-pre-wrap p-6 bg-stone-50/50 rounded-2xl font-serif">
                    {w.finalWriting || w.revisedWriting || w.draft}
                  </p>
                </div>
              ))}
            </div>

            {/* Final Page: Author Bio */}
            <div className="border-t-2 border-stone-200 pt-8 space-y-3 text-center">
              <h4 className="font-bold text-base text-stone-900">지은이 소개</h4>
              <p className="text-xs sm:text-sm text-stone-600 max-w-lg mx-auto leading-relaxed">
                {authorBio}
              </p>
              <div className="text-[11px] text-stone-400 pt-4">
                발행일: {new Date().toLocaleDateString('ko-KR')} • 글쓰기 성장 플랫폼
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
