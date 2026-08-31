import React, { useState } from 'react';
import { X, User, KeyRound, School, CheckCircle2, AlertCircle, Sparkles, ShieldCheck } from 'lucide-react';
import { collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { sha256 } from '../lib/crypto';
import { StudentInfo, ClassInfo } from '../types';

interface StudentAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (student: StudentInfo) => void;
}

export const StudentAuthModal: React.FC<StudentAuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const currentYear = new Date().getFullYear();
  const [schoolYear, setSchoolYear] = useState<number>(currentYear);
  const [grade, setGrade] = useState<number>(3);
  const [classNum, setClassNum] = useState<number>(1);
  const [studentNumber, setStudentNumber] = useState<number>(1);
  const [studentName, setStudentName] = useState<string>('');
  const [password, setPassword] = useState<string>('');

  // First-time setup / Password reset flow states
  const [isSettingNewPassword, setIsSettingNewPassword] = useState<boolean>(false);
  const [classPassword, setClassPassword] = useState<string>('');
  const [newPersonalPassword, setNewPersonalPassword] = useState<string>('');
  const [confirmPersonalPassword, setConfirmPersonalPassword] = useState<string>('');
  const [targetStudentDoc, setTargetStudentDoc] = useState<StudentInfo | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [infoMsg, setInfoMsg] = useState<string>('');

  if (!isOpen) return null;

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');

    const cleanName = studentName.trim();
    if (!cleanName) {
      setErrorMsg('이름을 입력해주세요.');
      return;
    }

    const studentKey = `${schoolYear}_${grade}_${classNum}_${studentNumber}`;
    setLoading(true);

    try {
      const studentRef = doc(db, 'students', studentKey);
      const studentSnap = await getDoc(studentRef);

      if (!studentSnap.exists()) {
        // Check if class exists
        const classQuery = query(
          collection(db, 'classes'),
          where('schoolYear', '==', Number(schoolYear)),
          where('grade', '==', Number(grade)),
          where('classNum', '==', Number(classNum))
        );
        const classSnap = await getDocs(classQuery);

        if (classSnap.empty) {
          setErrorMsg(`${schoolYear}학년도 ${grade}학년 ${classNum}반이 아직 등록되지 않았습니다. 선생님께 학급 등록을 요청하세요.`);
          setLoading(false);
          return;
        }

        // Create student record with first-time password setup requirement
        const classData = classSnap.docs[0].data() as ClassInfo;
        const newStudent: StudentInfo = {
          studentKey,
          classId: classSnap.docs[0].id,
          schoolYear: Number(schoolYear),
          grade: Number(grade),
          classNum: Number(classNum),
          studentNumber: Number(studentNumber),
          studentName: cleanName,
          isPasswordSet: false,
          isPasswordResetRequired: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        setTargetStudentDoc(newStudent);
        setIsSettingNewPassword(true);
        setInfoMsg('처음 방문하셨네요! 학급 비밀번호로 본인 확인 후 사용할 개인 비밀번호를 만들어주세요.');
        setLoading(false);
        return;
      }

      const existingStudent = studentSnap.data() as StudentInfo;

      // Check name match
      if (existingStudent.studentName.trim() !== cleanName) {
        setErrorMsg(`등록된 학생 이름과 일치하지 않습니다. 번호(${studentNumber}번)와 이름을 다시 확인해주세요.`);
        setLoading(false);
        return;
      }

      // Check if first-time or password reset required
      if (!existingStudent.isPasswordSet || existingStudent.isPasswordResetRequired) {
        setTargetStudentDoc(existingStudent);
        setIsSettingNewPassword(true);
        setInfoMsg(
          existingStudent.isPasswordResetRequired
            ? '선생님께서 비밀번호를 초기화하셨습니다. 학급 비밀번호를 입력하고 새로운 개인 비밀번호를 설정해주세요.'
            : '처음 로그인합니다. 학급 비밀번호를 입력하고 사용할 개인 비밀번호를 설정해주세요.'
        );
        setLoading(false);
        return;
      }

      // Normal login: verify personal password
      if (!password) {
        setErrorMsg('개인 비밀번호를 입력해주세요.');
        setLoading(false);
        return;
      }

      const enteredHash = await sha256(password);
      if (enteredHash !== existingStudent.personalPasswordHash) {
        setErrorMsg('비밀번호가 일치하지 않습니다. 비밀번호를 잊으셨다면 선생님께 초기화를 요청하세요.');
        setLoading(false);
        return;
      }

      // Success
      onLoginSuccess(existingStudent);
      onClose();
    } catch (err: any) {
      console.error('Student login error:', err);
      setErrorMsg(err.message || '로그인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePersonalPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetStudentDoc) return;
    setErrorMsg('');
    setInfoMsg('');

    if (!classPassword) {
      setErrorMsg('학급 비밀번호를 입력해주세요.');
      return;
    }

    if (newPersonalPassword.length < 2) {
      setErrorMsg('개인 비밀번호는 최소 2자 이상 입력해주세요 (예: 생일, 좋아하는 숫자).');
      return;
    }

    if (newPersonalPassword !== confirmPersonalPassword) {
      setErrorMsg('새 비밀번호와 비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    setLoading(true);

    try {
      // Find class doc to verify class password
      const classQuery = query(
        collection(db, 'classes'),
        where('schoolYear', '==', targetStudentDoc.schoolYear),
        where('grade', '==', targetStudentDoc.grade),
        where('classNum', '==', targetStudentDoc.classNum)
      );
      const classSnap = await getDocs(classQuery);

      if (classSnap.empty) {
        setErrorMsg('학급 정보를 찾을 수 없습니다.');
        setLoading(false);
        return;
      }

      const classData = classSnap.docs[0].data() as ClassInfo;
      const enteredClassHash = await sha256(classPassword);

      if (enteredClassHash !== classData.classPasswordHash) {
        setErrorMsg('학급 비밀번호가 올바르지 않습니다. 선생님께 확인해주세요.');
        setLoading(false);
        return;
      }

      // Hash new personal password and save student doc
      const personalPasswordHash = await sha256(newPersonalPassword);
      const studentRef = doc(db, 'students', targetStudentDoc.studentKey);

      const updatedStudent: StudentInfo = {
        ...targetStudentDoc,
        classId: classSnap.docs[0].id,
        personalPasswordHash,
        isPasswordSet: true,
        isPasswordResetRequired: false,
        updatedAt: Date.now(),
      };

      await setDoc(studentRef, updatedStudent, { merge: true });

      onLoginSuccess(updatedStudent);
      onClose();
    } catch (err: any) {
      console.error('Password creation error:', err);
      setErrorMsg(err.message || '비밀번호 설정 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-snug">
                {isSettingNewPassword ? '개인 비밀번호 설정' : '학생 작가 로그인'}
              </h2>
              <p className="text-xs text-amber-100">
                {isSettingNewPassword ? '학급 비밀번호 확인 및 새 비밀번호 생성' : '학년, 반, 번호, 이름으로 접속하세요'}
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

        {/* Form Body */}
        <div className="p-6">
          {errorMsg && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {infoMsg && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-start gap-2">
              <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <span>{infoMsg}</span>
            </div>
          )}

          {!isSettingNewPassword ? (
            <form onSubmit={handleStudentLogin} className="space-y-4">
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">학년도</label>
                  <input
                    type="number"
                    value={schoolYear}
                    onChange={(e) => setSchoolYear(Number(e.target.value))}
                    className="w-full px-2.5 py-2 text-xs border border-stone-300 rounded-lg text-center font-medium focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-hidden"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">학년</label>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(Number(e.target.value))}
                    className="w-full px-2 py-2 text-xs border border-stone-300 rounded-lg text-center font-medium focus:ring-2 focus:ring-amber-500 outline-hidden bg-white"
                  >
                    {[1, 2, 3, 4, 5, 6].map((g) => (
                      <option key={g} value={g}>
                        {g}학년
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">반</label>
                  <select
                    value={classNum}
                    onChange={(e) => setClassNum(Number(e.target.value))}
                    className="w-full px-2 py-2 text-xs border border-stone-300 rounded-lg text-center font-medium focus:ring-2 focus:ring-amber-500 outline-hidden bg-white"
                  >
                    {Array.from({ length: 15 }, (_, i) => i + 1).map((c) => (
                      <option key={c} value={c}>
                        {c}반
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">번호</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={studentNumber}
                    onChange={(e) => setStudentNumber(Number(e.target.value))}
                    className="w-full px-2.5 py-2 text-xs border border-stone-300 rounded-lg text-center font-medium focus:ring-2 focus:ring-amber-500 outline-hidden"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">이름</label>
                <div className="relative">
                  <User className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="본인 이름을 정확히 입력하세요"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-hidden"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-stone-600">개인 비밀번호</label>
                  <span className="text-[11px] text-stone-400">최초 로그인 시 자동 생성 단계로 이동</span>
                </div>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    placeholder="개인 비밀번호 (처음이면 비워도 됩니다)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-hidden"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-white font-bold rounded-xl shadow-sm text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    로그인 및 글쓰기 시작
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleCreatePersonalPassword} className="space-y-4">
              <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs space-y-1 text-stone-700">
                <div className="font-semibold text-stone-900 flex items-center gap-1.5">
                  <School className="w-3.5 h-3.5 text-amber-600" />
                  {targetStudentDoc?.schoolYear}학년도 {targetStudentDoc?.grade}학년 {targetStudentDoc?.classNum}반 {targetStudentDoc?.studentNumber}번 {targetStudentDoc?.studentName}
                </div>
                <p className="text-stone-500">선생님이 알려주신 학급 비밀번호를 입력한 뒤, 본인만의 비밀번호를 만드세요.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">
                  선생님이 알려주신 학급 비밀번호
                </label>
                <div className="relative">
                  <ShieldCheck className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    placeholder="학급 비밀번호 입력"
                    value={classPassword}
                    onChange={(e) => setClassPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-hidden"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">
                  앞으로 사용할 새 개인 비밀번호
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    placeholder="기억하기 쉬운 번호 (예: 1234)"
                    value={newPersonalPassword}
                    onChange={(e) => setNewPersonalPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-hidden"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">
                  새 개인 비밀번호 확인
                </label>
                <div className="relative">
                  <CheckCircle2 className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    placeholder="한 번 더 입력하세요"
                    value={confirmPersonalPassword}
                    onChange={(e) => setConfirmPersonalPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-hidden"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSettingNewPassword(false)}
                  className="w-1/3 py-2 px-3 border border-stone-300 text-stone-700 text-xs font-semibold rounded-xl hover:bg-stone-50"
                >
                  뒤로 가기
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-2/3 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-sm text-xs transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {loading ? '설정 중...' : '비밀번호 저장 및 시작'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
