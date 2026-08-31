import React, { useState, useEffect } from 'react';
import { X, Shield, Lock, KeyRound, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { sha256 } from '../lib/crypto';
import { SystemSettings } from '../types';

interface TeacherAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
}

export const TeacherAuthModal: React.FC<TeacherAuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [isFirstSetup, setIsFirstSetup] = useState<boolean>(false);
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [checkingInit, setCheckingInit] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      checkAdminInitStatus();
    }
  }, [isOpen]);

  const checkAdminInitStatus = async () => {
    setCheckingInit(true);
    setErrorMsg('');
    try {
      const settingsRef = doc(db, 'settings', 'admin');
      const snap = await getDoc(settingsRef);
      if (!snap.exists() || !snap.data().adminPasswordHash) {
        setIsFirstSetup(true);
      } else {
        setIsFirstSetup(false);
      }
    } catch (err: any) {
      console.error('Settings fetch error:', err);
      // Fallback: If document doesn't exist yet, treat as first setup
      setIsFirstSetup(true);
    } finally {
      setCheckingInit(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!password) {
      setErrorMsg('비밀번호를 입력해주세요.');
      return;
    }

    setLoading(true);

    try {
      const settingsRef = doc(db, 'settings', 'admin');

      if (isFirstSetup) {
        if (password.length < 4) {
          setErrorMsg('관리자 비밀번호는 안전을 위해 최소 4자 이상으로 설정해주세요.');
          setLoading(false);
          return;
        }

        if (password !== confirmPassword) {
          setErrorMsg('비밀번호와 비밀번호 확인이 일치하지 않습니다.');
          setLoading(false);
          return;
        }

        const adminPasswordHash = await sha256(password);
        const initialSettings: SystemSettings = {
          adminPasswordHash,
          initialized: true,
          defaultNameDisplay: 'full',
          siteTitle: 'AI와 함께하는 글쓰기 성장',
          updatedAt: Date.now(),
        };

        await setDoc(settingsRef, initialSettings);
        setSuccessMsg('관리자 비밀번호가 성공적으로 설정되었습니다!');
        setTimeout(() => {
          onLoginSuccess();
          onClose();
        }, 600);
      } else {
        // Verify admin password
        const snap = await getDoc(settingsRef);
        if (!snap.exists()) {
          setIsFirstSetup(true);
          setLoading(false);
          return;
        }

        const data = snap.data() as SystemSettings;
        const enteredHash = await sha256(password);

        if (enteredHash !== data.adminPasswordHash) {
          setErrorMsg('관리자 비밀번호가 일치하지 않습니다.');
          setLoading(false);
          return;
        }

        onLoginSuccess();
        onClose();
      }
    } catch (err: any) {
      console.error('Admin auth error:', err);
      setErrorMsg(err.message || '관리자 인증 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-snug">
                {isFirstSetup ? '교사 관리자 비밀번호 최초 설정' : '교사 관리자 로그인'}
              </h2>
              <p className="text-xs text-emerald-100">
                {isFirstSetup
                  ? '처음 실행되었습니다. 사용할 마스터 비밀번호를 등록하세요'
                  : '학급 및 학생 관리를 위한 교사용 모드입니다'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {errorMsg && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {checkingInit ? (
            <div className="py-8 text-center text-stone-500 text-sm flex flex-col items-center gap-2">
              <span className="inline-block w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></span>
              <span>시스템 상태 확인 중...</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {isFirstSetup && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed">
                  <div className="font-bold flex items-center gap-1 text-amber-800 mb-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    최초 실행 안내
                  </div>
                  비밀번호 원문은 서버에 저장되지 않고 <strong>SHA-256 단방향 암호화(해시)</strong>되어 안전하게 저장됩니다. 교사 전용 마스터 비밀번호를 등록하세요.
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">
                  {isFirstSetup ? '새 관리자 비밀번호' : '관리자 비밀번호'}
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    placeholder="관리자 비밀번호를 입력하세요"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-hidden"
                    required
                  />
                </div>
              </div>

              {isFirstSetup && (
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">
                    비밀번호 확인
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      placeholder="비밀번호를 한 번 더 입력하세요"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-hidden"
                      required
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold rounded-xl shadow-sm text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <>
                    <Shield className="w-4 h-4" />
                    {isFirstSetup ? '관리자 비밀번호 설정 및 접속' : '교사 관리자 접속'}
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
