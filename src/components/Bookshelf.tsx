import React, { useState, useEffect } from 'react';
import {
  Library,
  BookOpen,
  Plus,
  Printer,
  Trash2,
  X,
  Sparkles,
  Calendar,
  Layers,
} from 'lucide-react';
import { StudentInfo, StudentBook } from '../types';
import { collection, query, where, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface BookshelfProps {
  student: StudentInfo;
  onNavigate: (view: string, extraData?: any) => void;
}

export const Bookshelf: React.FC<BookshelfProps> = ({ student, onNavigate }) => {
  const [books, setBooks] = useState<StudentBook[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [readingBook, setReadingBook] = useState<StudentBook | null>(null);

  useEffect(() => {
    loadBooks();
  }, [student.studentKey]);

  const loadBooks = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'studentBooks'),
        where('studentKey', '==', student.studentKey)
      );
      const snap = await getDocs(q);
      const list: StudentBook[] = [];
      snap.forEach((doc) => {
        list.push(doc.data() as StudentBook);
      });
      setBooks(list);
    } catch (err) {
      console.error('Error fetching student books:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBook = async (bookId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('이 책을 책장에서 삭제하시겠습니까? (원문 글은 삭제되지 않습니다)')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'studentBooks', bookId));
      setBooks(books.filter((b) => b.bookId !== bookId));
      if (readingBook?.bookId === bookId) {
        setReadingBook(null);
      }
    } catch (err) {
      console.error('Delete book error:', err);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight flex items-center gap-2.5">
            <Library className="w-7 h-7 text-emerald-600" />
            나의 책장 (서재)
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-1">
            내가 직접 출판한 나만의 이야기 책들을 모아둔 공간입니다.
          </p>
        </div>

        <button
          onClick={() => onNavigate('book-creator')}
          className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-colors flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          새 책 만들기
        </button>
      </div>

      {/* Bookshelf Wooden Shelf Display Grid */}
      {loading ? (
        <div className="py-20 text-center text-stone-500 text-sm flex flex-col items-center gap-2">
          <span className="inline-block w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></span>
          <span>책장을 정리하는 중...</span>
        </div>
      ) : books.length === 0 ? (
        <div className="bg-white rounded-3xl border border-stone-200 p-12 text-center text-stone-400 space-y-3">
          <Library className="w-12 h-12 mx-auto text-stone-300" />
          <p className="font-bold text-stone-700 text-base">아직 출판한 책이 없습니다.</p>
          <p className="text-xs text-stone-400 max-w-sm mx-auto">
            완성한 글들을 모아 멋진 표지와 머리말을 달아 나만의 특별한 책을 만들어 보세요!
          </p>
          <button
            onClick={() => onNavigate('book-creator')}
            className="mt-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs"
          >
            첫 책 출판하기
          </button>
        </div>
      ) : (
        <div className="bg-stone-100 border border-stone-300 rounded-3xl p-6 sm:p-8 shadow-inner space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {books.map((book) => (
              <div
                key={book.bookId}
                onClick={() => setReadingBook(book)}
                className="bg-white rounded-2xl border border-stone-200 hover:border-purple-300 hover:shadow-xl transition-all p-5 flex flex-col justify-between gap-4 cursor-pointer group relative overflow-hidden"
              >
                {/* Visual Mini Cover */}
                <div
                  className={`h-44 rounded-xl p-4 text-white flex flex-col justify-between relative overflow-hidden shadow-sm bg-gradient-to-br ${
                    book.coverColor || 'from-amber-600 to-orange-600'
                  }`}
                >
                  <div className="text-3xl">{book.coverMotif || '📖'}</div>
                  <div>
                    <h3 className="font-extrabold text-base leading-snug drop-shadow-xs line-clamp-2">
                      {book.bookTitle}
                    </h3>
                    <p className="text-[11px] opacity-85 line-clamp-1 mt-0.5">{book.subtitle}</p>
                  </div>
                  <div className="text-[10px] opacity-75 border-t border-white/20 pt-1">
                    {book.studentName} 지음
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-stone-500">
                    <span className="flex items-center gap-1 font-medium">
                      <Layers className="w-3.5 h-3.5 text-purple-600" />
                      수록 작품: {book.selectedWritingIds?.length || 0}편
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-stone-400" />
                      {new Date(book.createdAt).toLocaleDateString('ko-KR', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>

                  <p className="text-xs text-stone-600 line-clamp-2 italic">
                    &ldquo;{book.foreword || '소중한 글 모음집'}&rdquo;
                  </p>
                </div>

                {/* Bottom Actions */}
                <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-600 group-hover:underline flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5" /> 책 열어보기
                  </span>
                  <button
                    onClick={(e) => handleDeleteBook(book.bookId, e)}
                    className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-stone-100 transition-colors"
                    title="책 삭제"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Book Reader Modal */}
      {readingBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] shadow-2xl border border-stone-200 overflow-hidden flex flex-col my-auto animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="bg-stone-50 border-b border-stone-200 px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xl">{readingBook.coverMotif || '📖'}</span>
                <div>
                  <h2 className="font-bold text-stone-900 text-base sm:text-lg">
                    {readingBook.bookTitle}
                  </h2>
                  <p className="text-xs text-stone-500">{readingBook.studentName} 작가</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs rounded-xl flex items-center gap-1"
                >
                  <Printer className="w-3.5 h-3.5" />
                  인쇄 / PDF
                </button>
                <button
                  onClick={() => setReadingBook(null)}
                  className="p-2 text-stone-400 hover:text-stone-800 rounded-xl"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Reader Content */}
            <div className="p-6 sm:p-10 overflow-y-auto space-y-10 font-serif">
              {/* Cover in Reader */}
              <div
                className={`p-10 rounded-2xl text-white text-center space-y-6 bg-gradient-to-br ${
                  readingBook.coverColor || 'from-amber-600 to-orange-600'
                }`}
              >
                <div className="text-5xl">{readingBook.coverMotif || '📖'}</div>
                <h1 className="text-2xl sm:text-3xl font-bold">{readingBook.bookTitle}</h1>
                <p className="text-xs opacity-90">{readingBook.subtitle}</p>
                <div className="text-xs border-t border-white/20 pt-3">
                  지은이: {readingBook.studentName}
                </div>
              </div>

              {/* Foreword */}
              {readingBook.foreword && (
                <div className="p-6 bg-stone-50 rounded-2xl space-y-2 border border-stone-200">
                  <h3 className="font-bold text-sm font-sans text-stone-900">머리말</h3>
                  <p className="text-sm text-stone-700 leading-relaxed italic">
                    &ldquo;{readingBook.foreword}&rdquo;
                  </p>
                </div>
              )}

              {/* Writings Body */}
              <div className="space-y-10">
                {readingBook.writingsContent?.map((item, idx) => (
                  <div key={item.recordId} className="space-y-3 border-t border-stone-200 pt-8">
                    <div className="text-center space-y-1 font-sans">
                      <span className="text-xs font-bold text-purple-600">작품 {idx + 1}</span>
                      <h4 className="text-xl font-bold text-stone-900">{item.title}</h4>
                    </div>
                    <p className="text-stone-800 text-sm sm:text-base leading-loose whitespace-pre-wrap p-4 bg-stone-50/50 rounded-xl">
                      {item.content}
                    </p>
                  </div>
                ))}
              </div>

              {/* Bio */}
              {readingBook.authorBio && (
                <div className="border-t-2 border-stone-200 pt-6 space-y-2 text-center font-sans">
                  <h4 className="font-bold text-sm text-stone-900">지은이 소개</h4>
                  <p className="text-xs text-stone-600 max-w-md mx-auto">{readingBook.authorBio}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
