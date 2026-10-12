import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  Store,
  Coins,
  TrendingUp,
  Landmark,
  KeyRound,
  CheckCircle2,
  Lock,
  Sparkles,
  HelpCircle,
  GraduationCap,
  LogOut,
  Settings,
  Users,
  Award,
  BookOpen,
  ArrowRight,
  RotateCcw,
  Trash2,
  Save,
  Check,
  Flame,
  ChevronRight,
  Trophy,
  ShieldCheck,
  Download,
  AlertCircle,
} from 'lucide-react';
import {
  QuestConfigData,
  defaultQuestConfig,
  StudentProgress,
  generateStudentKey,
  getQuestConfig,
  saveQuestConfig,
  subscribeQuestConfig,
  loadStudentProgress,
  saveStudentProgress,
  subscribeStudentProgress,
  fetchAllStudents,
  resetStudentProgress,
  deleteStudentProgress,
  verifyStudentLoginWithServer,
  verifyTeacherLoginWithServer,
  verifyMissionAnswerOnServer,
} from './firebase';

export default function App() {
  // Session State
  const [isTeacher, setIsTeacher] = useState<boolean>(false);
  const [student, setStudent] = useState<StudentProgress | null>(null);
  const [loginModalOpen, setLoginModalOpen] = useState<boolean>(false);
  const [teacherLoginModalOpen, setTeacherLoginModalOpen] = useState<boolean>(false);
  const [teacherPassword, setTeacherPassword] = useState<string>('');

  // Student Login Input States
  const [inputClassCode, setInputClassCode] = useState<string>(() => {
    return localStorage.getItem('market_class_code') || 'market61';
  });
  const [inputStudentNum, setInputStudentNum] = useState<string>('');
  const [inputStudentName, setInputStudentName] = useState<string>('');

  // View Navigation: 'hub' (Home/Quest Selection), 'quest1', 'quest2', 'teacher'
  const [currentView, setCurrentView] = useState<'hub' | 'quest1' | 'quest2' | 'teacher'>('hub');
  const [questSelectModalOpen, setQuestSelectModalOpen] = useState<boolean>(false);

  // Quest Configuration
  const [questConfig, setQuestConfig] = useState<QuestConfigData>(defaultQuestConfig);
  const [teacherConfigForm, setTeacherConfigForm] = useState<QuestConfigData>(defaultQuestConfig);
  const [teacherActiveTab, setTeacherActiveTab] = useState<'settings' | 'students'>('settings');
  const [allStudentsList, setAllStudentsList] = useState<StudentProgress[]>([]);
  const [loadingStudents, setLoadingStudents] = useState<boolean>(false);

  // Answer Inputs for Missions
  const [answerInputs, setAnswerInputs] = useState<Record<string, string>>({});
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  // Celebration Modal
  const [celebrationModal, setCelebrationModal] = useState<{
    questNum: number;
    missionNum: number;
    hintLetter: string;
  } | null>(null);

  // Confirm Modal for Teacher Actions
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    description: string;
    action: () => Promise<void>;
  } | null>(null);

  // 1. Initialize session and config
  useEffect(() => {
    getQuestConfig()
      .then((cfg) => {
        setQuestConfig(cfg);
        setTeacherConfigForm(cfg);
        if (cfg.classCode) {
          setInputClassCode(cfg.classCode);
        }
      })
      .catch(() => {
        // Fallback already handled
      });

    const unsubConfig = subscribeQuestConfig((newCfg) => {
      setQuestConfig(newCfg);
      setTeacherConfigForm(newCfg);
      if (newCfg.classCode) {
        setInputClassCode(newCfg.classCode);
      }
    });

    // Check saved session
    const savedIsTeacher = localStorage.getItem('market_is_teacher') === 'true';
    const savedStudentKey = localStorage.getItem('market_student_key');

    if (savedIsTeacher) {
      setIsTeacher(true);
      setCurrentView('teacher');
    } else if (savedStudentKey) {
      loadStudentProgress(savedStudentKey)
        .then((prog) => {
          if (prog) {
            setStudent(prog);
            setCurrentView('hub');
          } else {
            setLoginModalOpen(true);
          }
        })
        .catch(() => {
          setLoginModalOpen(true);
        });
    } else {
      setLoginModalOpen(true);
    }

    return () => {
      unsubConfig();
    };
  }, []);

  // 2. Real-time listener for current student
  useEffect(() => {
    if (!student?.studentKey) return;
    const unsub = subscribeStudentProgress(student.studentKey, (updated) => {
      if (updated) {
        setStudent(updated);
      }
    });
    return () => {
      unsub();
    };
  }, [student?.studentKey]);

  // Load students when opening teacher dashboard
  useEffect(() => {
    if (isTeacher && teacherActiveTab === 'students') {
      refreshStudentsList();
    }
  }, [isTeacher, teacherActiveTab]);

  const refreshStudentsList = async () => {
    setLoadingStudents(true);
    try {
      const list = await fetchAllStudents();
      setAllStudentsList(list || []);
    } catch {
      setAllStudentsList([]);
    } finally {
      setLoadingStudents(false);
    }
  };

  // Toast feedback helper
  const showToast = (text: string, isError = false) => {
    setFeedbackMessage({ text, isError });
    setTimeout(() => {
      setFeedbackMessage(null);
    }, 2800);
  };

  // Confetti helper
  const fireCelebrationConfetti = () => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
    });
    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
      });
    }, 200);
    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
      });
    }, 350);
  };

  // Handle Student Login with Classroom Code Verification & Identity Validation
  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = inputStudentName.trim();
    const num = inputStudentNum.trim();
    const code = inputClassCode.trim();

    if (!code) {
      showToast('선생님이 알려주신 학급 입장 코드를 입력해주세요!', true);
      return;
    }
    if (!name) {
      showToast('이름을 입력해주세요!', true);
      return;
    }

    // Server-side code and identity validation
    const authResult = await verifyStudentLoginWithServer(code, num, name);
    if (!authResult.success) {
      showToast(authResult.error || '학급 입장 코드가 올바르지 않습니다!', true);
      return;
    }

    const key = authResult.studentKey || generateStudentKey(num, name);
    const displayName = authResult.displayName || (num ? `${num}번 ${name}` : name);

    // Load progress and automatically migrate legacy records if existing
    let existingProg = await loadStudentProgress(key);
    if (!existingProg) {
      existingProg = {
        studentKey: key,
        studentNumber: num,
        name,
        displayName,
        completedMissions: {},
        unlockedHints: {},
      };
      await saveStudentProgress(existingProg);
    }

    setStudent(existingProg);
    setIsTeacher(false);
    localStorage.setItem('market_student_key', key);
    localStorage.setItem('market_is_teacher', 'false');
    localStorage.setItem('market_class_code', code);
    setLoginModalOpen(false);
    setCurrentView('hub');
    showToast(`환영합니다, ${displayName}님! ✨`);
  };

  // Handle Teacher Login with Server Verification (No password revealed on screen)
  const handleTeacherLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const pwd = teacherPassword.trim();
    const result = await verifyTeacherLoginWithServer(pwd);
    if (result.success) {
      setIsTeacher(true);
      setStudent(null);
      localStorage.setItem('market_is_teacher', 'true');
      localStorage.removeItem('market_student_key');
      if (result.token) localStorage.setItem('market_teacher_token', result.token);
      setTeacherLoginModalOpen(false);
      setCurrentView('teacher');
      setTeacherPassword('');
      showToast('교사 모드로 접속되었습니다. 👨‍🏫');
    } else {
      showToast(result.error || '선생님 비밀번호가 일치하지 않습니다!', true);
    }
  };

  // Logout
  const handleLogout = () => {
    setIsTeacher(false);
    setStudent(null);
    localStorage.removeItem('market_is_teacher');
    localStorage.removeItem('market_student_key');
    setCurrentView('hub');
    setLoginModalOpen(true);
    showToast('로그아웃되었습니다.');
  };

  // Submit Mission Answer via Secure Server Verification
  const handleSubmitMission = async (questNum: 1 | 2, missionNum: 1 | 2 | 3 | 4) => {
    if (!student) {
      showToast('먼저 학생 로그인을 진행해주세요!', true);
      return;
    }

    const missionKey = `q${questNum}_${missionNum}`;
    const userAns = (answerInputs[missionKey] || '').trim().replace(/\s+/g, '');

    if (!userAns) {
      showToast('정답을 입력해주세요!', true);
      return;
    }

    // Verify answer on server side (plain answer is never exposed to client)
    const result = await verifyMissionAnswerOnServer(questNum, missionNum, userAns);

    if (result.correct) {
      fireCelebrationConfetti();
      const hintChar = result.hintLetter || '★';
      const updatedCompleted = { ...student.completedMissions, [missionKey]: true };
      const updatedHints = { ...student.unlockedHints, [missionKey]: hintChar };

      const updatedProgress: StudentProgress = {
        ...student,
        completedMissions: updatedCompleted,
        unlockedHints: updatedHints,
      };

      setStudent(updatedProgress);
      await saveStudentProgress(updatedProgress);

      setCelebrationModal({
        questNum,
        missionNum,
        hintLetter: hintChar,
      });

      // Clear input
      setAnswerInputs((prev) => ({ ...prev, [missionKey]: '' }));
    } else {
      showToast(result.message || '❌ 아쉽지만 정답이 아닙니다. 다시 시도해 보세요!', true);
    }
  };

  // Save Teacher Config
  const handleSaveTeacherConfig = async () => {
    try {
      await saveQuestConfig(teacherConfigForm);
      setQuestConfig(teacherConfigForm);
      showToast('퀘스트 문제 정답 및 힌트 글자가 안전하게 저장되었습니다! 💾');
    } catch {
      showToast('저장 중 문제가 발생했습니다.', true);
    }
  };

  // Reset to Defaults
  const handleResetTeacherConfigToDefault = () => {
    setTeacherConfigForm(defaultQuestConfig);
    showToast('기본 예시 정답과 힌트로 복원되었습니다. 저장을 눌러 적용하세요.');
  };

  // Backup Download Handler
  const handleDownloadBackup = async () => {
    try {
      const students = await fetchAllStudents();
      const backupData = {
        exportedAt: new Date().toISOString(),
        totalStudents: students.length,
        config: questConfig,
        students,
      };

      // Server backup call
      await fetch('/api/teacher/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students }),
      }).catch(() => {});

      // Browser JSON download
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `market_quest_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast(`학생 ${students.length}명의 데이터 백업 파일이 다운로드되었습니다! 💾`);
    } catch {
      showToast('백업 파일 생성 중 오류가 발생했습니다.', true);
    }
  };

  // Count completions
  const getQuestCompletedCount = (questNum: 1 | 2) => {
    if (!student || !student.completedMissions) return 0;
    let count = 0;
    for (let i = 1; i <= 4; i++) {
      if (student.completedMissions[`q${questNum}_${i}`]) count++;
    }
    return count;
  };

  const q1CompletedCount = getQuestCompletedCount(1);
  const q2CompletedCount = getQuestCompletedCount(2);
  const totalCompletedCount = q1CompletedCount + q2CompletedCount;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800">
      {/* Toast Feedback */}
      {feedbackMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 animate-pop-bounce">
          <div
            className={`px-5 py-3 rounded-2xl shadow-xl font-jua text-sm sm:text-base flex items-center gap-2 border ${
              feedbackMessage.isError
                ? 'bg-rose-50 border-rose-200 text-rose-700'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            <span>{feedbackMessage.text}</span>
          </div>
        </div>
      )}

      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div
            onClick={() => setCurrentView(isTeacher ? 'teacher' : 'hub')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition">
              <Store className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="font-jua text-lg sm:text-xl text-slate-900 leading-tight flex items-center gap-1.5">
                시장경제 퀘스트
                <span className="text-[11px] font-normal bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                  초등 사회
                </span>
              </h1>
              <p className="text-[11px] text-slate-500 font-sans">문제를 풀고 비밀 힌트 글자를 모아보세요!</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {student ? (
              <div className="flex items-center gap-2">
                <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-3 py-1.5 flex items-center gap-2 text-xs sm:text-sm font-jua">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                  <span>{student.displayName}</span>
                  <span className="bg-amber-200/70 text-amber-900 text-xs px-1.5 py-0.5 rounded font-mono">
                    {totalCompletedCount}/8 힌트
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  title="로그아웃"
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : isTeacher ? (
              <div className="flex items-center gap-2">
                <div className="bg-purple-50 border border-purple-200 text-purple-800 rounded-xl px-3 py-1.5 flex items-center gap-1.5 text-xs sm:text-sm font-jua">
                  <GraduationCap className="w-4 h-4 text-purple-600" />
                  <span>선생님 모드</span>
                </div>
                <button
                  onClick={handleLogout}
                  title="교사 모드 종료"
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setLoginModalOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-jua text-xs sm:text-sm px-3.5 py-1.5 rounded-xl shadow-xs transition cursor-pointer"
                >
                  학생 로그인
                </button>
                <button
                  onClick={() => setTeacherLoginModalOpen(true)}
                  className="bg-purple-100 hover:bg-purple-200 text-purple-800 font-jua text-xs px-3 py-1.5 rounded-xl border border-purple-200 transition cursor-pointer"
                >
                  교사 모드
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Body Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* VIEW: TEACHER DASHBOARD */}
        {isTeacher && currentView === 'teacher' && (
          <div className="space-y-6">
            {/* Teacher Top Bar */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-purple-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-jua">
                    👨‍🏫
                  </span>
                  <h2 className="font-jua text-xl sm:text-2xl text-purple-900">교사 전용 보안 관리 패널</h2>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  학급 입장 코드, 문제 정답 및 <strong>힌트 한 글자</strong>를 안전하게 설정하고 학생 기록을 백업합니다.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleDownloadBackup}
                  className="font-jua text-xs sm:text-sm px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition cursor-pointer flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  전체 백업 다운로드
                </button>
                <button
                  onClick={() => setTeacherActiveTab('settings')}
                  className={`font-jua text-xs sm:text-sm px-4 py-2 rounded-xl transition cursor-pointer ${
                    teacherActiveTab === 'settings'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                  }`}
                >
                  <Settings className="w-4 h-4 inline mr-1" />
                  정답 &amp; 힌트 설정
                </button>
                <button
                  onClick={() => setTeacherActiveTab('students')}
                  className={`font-jua text-xs sm:text-sm px-4 py-2 rounded-xl transition cursor-pointer ${
                    teacherActiveTab === 'students'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                  }`}
                >
                  <Users className="w-4 h-4 inline mr-1" />
                  학생 현황 ({allStudentsList.length}명)
                </button>
              </div>
            </div>

            {/* TAB: SETTINGS */}
            {teacherActiveTab === 'settings' && (
              <div className="space-y-6">
                {/* Classroom Access Code Setting Card */}
                <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-purple-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="font-jua text-sm text-purple-900 flex items-center gap-1.5">
                      <KeyRound className="w-4 h-4 text-purple-600" />
                      학급 전용 입장 코드 설정
                    </span>
                    <p className="text-xs text-slate-500 font-sans">
                      학생들이 로그인 창에서 입력해야 하는 보안 입장 코드입니다. (외부인 접속 차단)
                    </p>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <input
                      type="text"
                      value={teacherConfigForm.classCode || 'market61'}
                      onChange={(e) => {
                        setTeacherConfigForm((prev) => ({
                          ...prev,
                          classCode: e.target.value.trim(),
                        }));
                      }}
                      placeholder="예: market61"
                      className="border-2 border-purple-200 rounded-xl px-3.5 py-2 text-sm font-mono text-purple-800 font-bold focus:outline-none focus:border-purple-500 w-full sm:w-44 bg-purple-50/40"
                    />
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs sm:text-sm text-amber-900 flex items-start gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">보안 안내</p>
                    <p className="text-amber-800 mt-0.5">
                      선생님께서 설정하신 문제 정답은 학생 브라우저에 전송되지 않으며, 서버 측에서 비밀리에 채점됩니다. 학생이 정답을 맞히면 지정된 <strong>힌트 한 글자</strong>만 제공됩니다.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Quest 1 Config Form */}
                  <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-emerald-100 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-emerald-100">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-jua">
                          1
                        </span>
                        <h3 className="font-jua text-lg text-emerald-900">퀘스트 1 설정 (미션 1~4)</h3>
                      </div>
                      <span className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-jua">
                        4개 문제
                      </span>
                    </div>

                    <div className="space-y-4">
                      {([1, 2, 3, 4] as const).map((mNum) => (
                        <div key={`q1_edit_${mNum}`} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-jua text-sm text-slate-800 flex items-center gap-1.5">
                              <span className="w-5 h-5 rounded-md bg-emerald-600 text-white text-xs flex items-center justify-center font-jua">
                                {mNum}
                              </span>
                              {mNum}번 미션
                            </span>
                            <span className="text-[11px] text-slate-400">정답 &amp; 힌트 한 글자</span>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <div className="col-span-2">
                              <label className="text-[11px] text-slate-500 font-sans block mb-1">인정 정답</label>
                              <input
                                type="text"
                                value={teacherConfigForm?.quest1?.[mNum]?.answer ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setTeacherConfigForm((prev) => ({
                                    ...prev,
                                    quest1: {
                                      ...prev.quest1,
                                      [mNum]: { ...(prev.quest1?.[mNum] || { hintLetter: '★', title: `${mNum}번 미션` }), answer: val },
                                    },
                                  }));
                                }}
                                placeholder="예: 시장"
                                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs sm:text-sm font-sans focus:outline-none focus:border-emerald-500"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] text-slate-500 font-sans block mb-1">힌트 한 글자</label>
                              <input
                                type="text"
                                maxLength={1}
                                value={teacherConfigForm?.quest1?.[mNum]?.hintLetter ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value.slice(0, 1);
                                  setTeacherConfigForm((prev) => ({
                                    ...prev,
                                    quest1: {
                                      ...prev.quest1,
                                      [mNum]: { ...(prev.quest1?.[mNum] || { answer: '', title: `${mNum}번 미션` }), hintLetter: val },
                                    },
                                  }));
                                }}
                                placeholder="예: 시"
                                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-center font-jua text-sm text-emerald-700 focus:outline-none focus:border-emerald-500"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Quest 2 Config Form */}
                  <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-indigo-100 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-indigo-100">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-jua">
                          2
                        </span>
                        <h3 className="font-jua text-lg text-indigo-900">퀘스트 2 설정 (미션 1~4)</h3>
                      </div>
                      <span className="text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded font-jua">
                        4개 문제
                      </span>
                    </div>

                    <div className="space-y-4">
                      {([1, 2, 3, 4] as const).map((mNum) => (
                        <div key={`q2_edit_${mNum}`} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-jua text-sm text-slate-800 flex items-center gap-1.5">
                              <span className="w-5 h-5 rounded-md bg-indigo-600 text-white text-xs flex items-center justify-center font-jua">
                                {mNum}
                              </span>
                              {mNum}번 미션
                            </span>
                            <span className="text-[11px] text-slate-400">정답 &amp; 힌트 한 글자</span>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <div className="col-span-2">
                              <label className="text-[11px] text-slate-500 font-sans block mb-1">인정 정답</label>
                              <input
                                type="text"
                                value={teacherConfigForm?.quest2?.[mNum]?.answer ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setTeacherConfigForm((prev) => ({
                                    ...prev,
                                    quest2: {
                                      ...prev.quest2,
                                      [mNum]: { ...(prev.quest2?.[mNum] || { hintLetter: '★', title: `${mNum}번 미션` }), answer: val },
                                    },
                                  }));
                                }}
                                placeholder="예: 기업"
                                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs sm:text-sm font-sans focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] text-slate-500 font-sans block mb-1">힌트 한 글자</label>
                              <input
                                type="text"
                                maxLength={1}
                                value={teacherConfigForm?.quest2?.[mNum]?.hintLetter ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value.slice(0, 1);
                                  setTeacherConfigForm((prev) => ({
                                    ...prev,
                                    quest2: {
                                      ...prev.quest2,
                                      [mNum]: { ...(prev.quest2?.[mNum] || { answer: '', title: `${mNum}번 미션` }), hintLetter: val },
                                    },
                                  }));
                                }}
                                placeholder="예: 물"
                                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-center font-jua text-sm text-indigo-700 focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Bottom Action Buttons */}
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-xs text-slate-500 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    저장 버튼을 누르면 실시간으로 서버 및 Firestore에 반영되어 모든 학생에게 동기화됩니다.
                  </div>
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button
                      onClick={handleResetTeacherConfigToDefault}
                      className="flex-1 sm:flex-none font-jua text-xs sm:text-sm px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                    >
                      기본 예시 불러오기
                    </button>
                    <button
                      onClick={handleSaveTeacherConfig}
                      className="flex-1 sm:flex-none font-jua text-xs sm:text-sm px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-200 transition cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      설정 전체 저장하기
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: STUDENTS PROGRESS */}
            {teacherActiveTab === 'students' && (
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="font-jua text-lg text-slate-900">학급 학생 퀘스트 완료 현황</h3>
                    <p className="text-xs text-slate-500">학생별 진행도와 모은 힌트 글자를 안전하게 관리합니다.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDownloadBackup}
                      className="font-jua text-xs px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition cursor-pointer flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                      백업 파일 저장
                    </button>
                    <button
                      onClick={refreshStudentsList}
                      className="font-jua text-xs px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      새로고침
                    </button>
                  </div>
                </div>

                {loadingStudents ? (
                  <div className="py-12 text-center text-slate-400 font-jua">
                    학생 데이터를 불러오는 중입니다...
                  </div>
                ) : allStudentsList.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 font-jua">
                    아직 등록된 학생 데이터가 없습니다.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {allStudentsList.map((st) => {
                      let q1Count = 0;
                      let q2Count = 0;
                      for (let i = 1; i <= 4; i++) {
                        if (st.completedMissions?.[`q1_${i}`]) q1Count++;
                        if (st.completedMissions?.[`q2_${i}`]) q2Count++;
                      }

                      const q1Hints = [1, 2, 3, 4]
                        .map((i) => st.unlockedHints?.[`q1_${i}`] || '_')
                        .join(' ');
                      const q2Hints = [1, 2, 3, 4]
                        .map((i) => st.unlockedHints?.[`q2_${i}`] || '_')
                        .join(' ');

                      return (
                        <div
                          key={st.studentKey}
                          className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-jua text-base shadow-xs">
                              {st.studentNumber ? `${st.studentNumber}번` : '학생'}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-jua text-base text-slate-900">{st.displayName}</h4>
                                {st.ownerUid && (
                                  <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-sans flex items-center gap-0.5">
                                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                    인증됨
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 font-mono">
                                <span className="text-emerald-700 bg-emerald-100/60 px-1.5 py-0.5 rounded">
                                  퀘스트1: {q1Count}/4 [{q1Hints}]
                                </span>
                                <span className="text-indigo-700 bg-indigo-100/60 px-1.5 py-0.5 rounded">
                                  퀘스트2: {q2Count}/4 [{q2Hints}]
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center">
                            <button
                              onClick={() => {
                                setConfirmModal({
                                  title: `${st.displayName} 초기화`,
                                  description: '해당 학생의 미션 완료 내역과 획득한 힌트 글자를 0으로 초기화하시겠습니까?',
                                  action: async () => {
                                    await resetStudentProgress(st.studentKey);
                                    await refreshStudentsList();
                                    showToast(`${st.displayName}의 진행도가 초기화되었습니다.`);
                                  },
                                });
                              }}
                              className="font-jua text-xs px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition cursor-pointer"
                            >
                              진행 초기화
                            </button>
                            <button
                              onClick={() => {
                                setConfirmModal({
                                  title: `${st.displayName} 영구 삭제`,
                                  description: '해당 학생 계정과 모든 기록을 영구 삭제하시겠습니까?',
                                  action: async () => {
                                    await deleteStudentProgress(st.studentKey);
                                    await refreshStudentsList();
                                    showToast(`${st.displayName} 계정이 삭제되었습니다.`);
                                  },
                                });
                              }}
                              className="font-jua text-xs px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition cursor-pointer"
                            >
                              삭제
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* STUDENT VIEWS */}
        {(!isTeacher || currentView !== 'teacher') && (
          <div className="space-y-6">
            {/* Top Quest Navigator Bar */}
            <div className="bg-white rounded-2xl p-2.5 shadow-xs border border-slate-200 flex items-center justify-between gap-2 overflow-x-auto">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentView('hub')}
                  className={`font-jua text-xs sm:text-sm px-4 py-2 rounded-xl transition cursor-pointer whitespace-nowrap ${
                    currentView === 'hub'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Store className="w-4 h-4 inline mr-1" />
                  퀘스트 메인
                </button>
                <button
                  onClick={() => setCurrentView('quest1')}
                  className={`font-jua text-xs sm:text-sm px-4 py-2 rounded-xl transition cursor-pointer whitespace-nowrap ${
                    currentView === 'quest1'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                  }`}
                >
                  퀘스트 1
                  <span className="ml-1.5 text-xs bg-white/20 px-1.5 py-0.2 rounded-full font-mono">
                    {q1CompletedCount}/4
                  </span>
                </button>
                <button
                  onClick={() => setCurrentView('quest2')}
                  className={`font-jua text-xs sm:text-sm px-4 py-2 rounded-xl transition cursor-pointer whitespace-nowrap ${
                    currentView === 'quest2'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100'
                  }`}
                >
                  퀘스트 2
                  <span className="ml-1.5 text-xs bg-white/20 px-1.5 py-0.2 rounded-full font-mono">
                    {q2CompletedCount}/4
                  </span>
                </button>
              </div>

              <button
                onClick={() => setQuestSelectModalOpen(true)}
                className="font-jua text-xs sm:text-sm px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-md shadow-amber-200/50 transition cursor-pointer whitespace-nowrap flex items-center gap-1.5"
              >
                <BookOpen className="w-4 h-4" />
                퀘스트 열기
              </button>
            </div>

            {/* Hint Letter Collection Board (Shared Mystery Bar) */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 rounded-3xl p-5 sm:p-6 text-white shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                    <h3 className="font-jua text-lg sm:text-xl text-amber-300">비밀 힌트 글자 모음판</h3>
                  </div>
                  <p className="text-xs text-slate-300 font-sans mt-0.5">
                    문제를 맞힐 때마다 교실 암호를 풀 수 있는 <strong>힌트 한 글자</strong>가 공개됩니다!
                  </p>
                </div>
                <div className="text-xs font-mono bg-white/10 px-3 py-1 rounded-xl self-start sm:self-center border border-white/10">
                  전체 진행도: <span className="text-amber-400 font-bold">{totalCompletedCount}</span> / 8 미션
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Quest 1 Hint Characters */}
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="font-jua text-xs sm:text-sm text-emerald-300 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-md bg-emerald-500 text-white text-[11px] flex items-center justify-center">1</span>
                      퀘스트 1 힌트 글자
                    </span>
                    <span className="text-[11px] text-slate-300 font-mono">{q1CompletedCount}/4 완료</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {([1, 2, 3, 4] as const).map((mNum) => {
                      const isDone = student?.completedMissions?.[`q1_${mNum}`];
                      const hint = isDone
                        ? student?.unlockedHints?.[`q1_${mNum}`] || '★'
                        : null;

                      return (
                        <div
                          key={`hint_q1_${mNum}`}
                          className={`aspect-square rounded-xl border flex flex-col items-center justify-center transition-all ${
                            isDone
                              ? 'bg-gradient-to-b from-amber-300 to-amber-500 border-amber-200 text-slate-900 shadow-md shadow-amber-500/30 animate-celebrate-glow'
                              : 'bg-white/5 border-white/15 text-slate-400'
                          }`}
                        >
                          <span className="text-[10px] font-sans opacity-70 mb-0.5">{mNum}번</span>
                          <span className="font-jua text-lg sm:text-2xl">
                            {isDone ? hint : <Lock className="w-4 h-4 opacity-40" />}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Quest 2 Hint Characters */}
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="font-jua text-xs sm:text-sm text-indigo-300 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-md bg-indigo-500 text-white text-[11px] flex items-center justify-center">2</span>
                      퀘스트 2 힌트 글자
                    </span>
                    <span className="text-[11px] text-slate-300 font-mono">{q2CompletedCount}/4 완료</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {([1, 2, 3, 4] as const).map((mNum) => {
                      const isDone = student?.completedMissions?.[`q2_${mNum}`];
                      const hint = isDone
                        ? student?.unlockedHints?.[`q2_${mNum}`] || '★'
                        : null;

                      return (
                        <div
                          key={`hint_q2_${mNum}`}
                          className={`aspect-square rounded-xl border flex flex-col items-center justify-center transition-all ${
                            isDone
                              ? 'bg-gradient-to-b from-indigo-300 to-indigo-500 border-indigo-200 text-slate-900 shadow-md shadow-indigo-500/30 animate-celebrate-glow'
                              : 'bg-white/5 border-white/15 text-slate-400'
                          }`}
                        >
                          <span className="text-[10px] font-sans opacity-70 mb-0.5">{mNum}번</span>
                          <span className="font-jua text-lg sm:text-2xl">
                            {isDone ? hint : <Lock className="w-4 h-4 opacity-40" />}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* VIEW: HUB (MAIN OVERVIEW) */}
            {currentView === 'hub' && (
              <div className="space-y-6">
                {/* Hero Card with Big "퀘스트 열기" Button */}
                <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 text-center relative overflow-hidden">
                  <div className="max-w-xl mx-auto space-y-4">
                    <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner animate-float">
                      <Store className="w-9 h-9 text-emerald-600" />
                    </div>

                    <div>
                      <h2 className="font-jua text-2xl sm:text-3xl text-slate-900">
                        시장경제 탐험을 시작할 준비가 되셨나요?
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-500 mt-2 font-sans leading-relaxed">
                        아래 <strong>[퀘스트 열기]</strong> 버튼을 눌러 퀘스트 1 또는 퀘스트 2를 선택하고,
                        <br />
                        각 4개의 미션 정답을 맞춰 숨겨진 힌트 글자를 획득해보세요!
                      </p>
                    </div>

                    <div className="pt-2">
                      <button
                        onClick={() => setQuestSelectModalOpen(true)}
                        className="inline-flex items-center gap-2.5 bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-jua text-lg sm:text-xl px-8 py-4 rounded-2xl shadow-xl shadow-amber-500/25 active:scale-95 transition cursor-pointer"
                      >
                        <BookOpen className="w-6 h-6" />
                        <span>퀘스트 열기</span>
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2 Big Quest Cards Directly Clickable */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Card 1 */}
                  <div
                    onClick={() => setCurrentView('quest1')}
                    className="group bg-white rounded-3xl p-6 shadow-sm border-2 border-emerald-100 hover:border-emerald-300 hover:shadow-md transition cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-jua text-xl group-hover:scale-110 transition">
                          1
                        </div>
                        <span
                          className={`font-jua text-xs px-3 py-1 rounded-xl border ${
                            q1CompletedCount === 4
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {q1CompletedCount === 4 ? '⭐ 완료' : `${q1CompletedCount}/4 미션 완료`}
                        </span>
                      </div>

                      <h3 className="font-jua text-xl text-slate-900 mb-1">퀘스트 1 : 미션 1~4</h3>
                      <p className="text-xs text-slate-500 font-sans mb-4">
                        시장과 가격, 수요와 공급에 관한 4개의 문제를 풀고 힌트 글자를 획득하세요!
                      </p>

                      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden mb-4">
                        <div
                          className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500"
                          style={{ width: `${(q1CompletedCount / 4) * 100}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between text-emerald-700 font-jua text-sm">
                      <span>퀘스트 1 도전하기</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
                    </div>
                  </div>

                  {/* Card 2 */}
                  <div
                    onClick={() => setCurrentView('quest2')}
                    className="group bg-white rounded-3xl p-6 shadow-sm border-2 border-indigo-100 hover:border-indigo-300 hover:shadow-md transition cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-jua text-xl group-hover:scale-110 transition">
                          2
                        </div>
                        <span
                          className={`font-jua text-xs px-3 py-1 rounded-xl border ${
                            q2CompletedCount === 4
                              ? 'bg-indigo-100 text-indigo-800 border-indigo-300'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {q2CompletedCount === 4 ? '⭐ 완료' : `${q2CompletedCount}/4 미션 완료`}
                        </span>
                      </div>

                      <h3 className="font-jua text-xl text-slate-900 mb-1">퀘스트 2 : 미션 1~4</h3>
                      <p className="text-xs text-slate-500 font-sans mb-4">
                        가계와 기업, 생산과 소비에 관한 4개의 문제를 풀고 힌트 글자를 획득하세요!
                      </p>

                      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden mb-4">
                        <div
                          className="bg-indigo-500 h-2.5 rounded-full transition-all duration-500"
                          style={{ width: `${(q2CompletedCount / 4) * 100}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between text-indigo-700 font-jua text-sm">
                      <span>퀘스트 2 도전하기</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW: QUEST 1 (MISSION 1 ~ 4) */}
            {currentView === 'quest1' && (
              <div className="space-y-6">
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-emerald-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-jua text-xl shadow-xs">
                      1
                    </div>
                    <div>
                      <h2 className="font-jua text-xl sm:text-2xl text-slate-900 flex items-center gap-2">
                        퀘스트 1
                        <span className="text-xs font-normal bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                          미션 1 ~ 4
                        </span>
                      </h2>
                      <p className="text-xs text-slate-500 font-sans mt-0.5">
                        문제를 맞히면 각각 1글자씩 힌트가 공개됩니다! (현재: {q1CompletedCount}/4 완료)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentView('hub')}
                      className="font-jua text-xs px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                    >
                      ← 퀘스트 목록
                    </button>
                    <button
                      onClick={() => setCurrentView('quest2')}
                      className="font-jua text-xs px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition cursor-pointer flex items-center gap-1"
                    >
                      퀘스트 2 가기 →
                    </button>
                  </div>
                </div>

                {/* 4 Mission Cards for Quest 1 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  {([1, 2, 3, 4] as const).map((mNum) => {
                    const missionKey = `q1_${mNum}`;
                    const isCompleted = student?.completedMissions?.[missionKey] === true;
                    const hintLetter = student?.unlockedHints?.[missionKey] || '★';

                    return (
                      <div
                        key={missionKey}
                        className={`rounded-3xl p-5 sm:p-6 transition-all border-2 flex flex-col justify-between ${
                          isCompleted
                            ? 'bg-emerald-50/70 border-emerald-300 shadow-sm'
                            : 'bg-white border-slate-200 shadow-xs hover:border-emerald-200'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-8 h-8 rounded-xl flex items-center justify-center font-jua text-sm ${
                                  isCompleted ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {mNum}
                              </span>
                              <h3 className="font-jua text-base sm:text-lg text-slate-900">{mNum}번 미션</h3>
                            </div>

                            {isCompleted ? (
                              <span className="bg-emerald-200 text-emerald-900 font-jua text-xs px-2.5 py-1 rounded-full flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                                정답 완료
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-sans flex items-center gap-1">
                                <Lock className="w-3 h-3" />
                                도전 중
                              </span>
                            )}
                          </div>

                          {/* Reward / Hint Display */}
                          <div className="mb-4">
                            {isCompleted ? (
                              <div className="p-3 bg-white rounded-2xl border border-emerald-200 flex items-center justify-between">
                                <span className="text-xs text-slate-600 font-sans">획득한 비밀 힌트 글자:</span>
                                <span className="font-jua text-xl text-emerald-700 bg-emerald-100 px-3 py-0.5 rounded-xl border border-emerald-300">
                                  [ {hintLetter} ]
                                </span>
                              </div>
                            ) : (
                              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between text-xs text-slate-500 font-sans">
                                <span>정답 시 획득 힌트:</span>
                                <span className="font-jua text-sm text-slate-400 bg-slate-200/70 px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                                  <Lock className="w-3 h-3" /> 비밀 글자
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Input or Completed State */}
                        <div>
                          {isCompleted ? (
                            <div className="w-full py-2.5 rounded-2xl bg-emerald-100 text-emerald-800 font-jua text-xs sm:text-sm text-center flex items-center justify-center gap-1.5">
                              <Check className="w-4 h-4 text-emerald-600" />
                              미션을 성공적으로 완료했습니다!
                            </div>
                          ) : (
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                handleSubmitMission(1, mNum);
                              }}
                              className="flex gap-2"
                            >
                              <input
                                type="text"
                                value={answerInputs[missionKey] || ''}
                                onChange={(e) =>
                                  setAnswerInputs({ ...answerInputs, [missionKey]: e.target.value })
                                }
                                placeholder="정답을 입력하세요"
                                className="flex-1 bg-slate-50 border-2 border-slate-200 focus:bg-white focus:border-emerald-500 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-sans focus:outline-none transition"
                              />
                              <button
                                type="submit"
                                className="font-jua text-xs sm:text-sm px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow-md shadow-emerald-200 transition cursor-pointer whitespace-nowrap"
                              >
                                정답 확인
                              </button>
                            </form>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* VIEW: QUEST 2 (MISSION 1 ~ 4) */}
            {currentView === 'quest2' && (
              <div className="space-y-6">
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-jua text-xl shadow-xs">
                      2
                    </div>
                    <div>
                      <h2 className="font-jua text-xl sm:text-2xl text-slate-900 flex items-center gap-2">
                        퀘스트 2
                        <span className="text-xs font-normal bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full">
                          미션 1 ~ 4
                        </span>
                      </h2>
                      <p className="text-xs text-slate-500 font-sans mt-0.5">
                        문제를 맞히면 각각 1글자씩 힌트가 공개됩니다! (현재: {q2CompletedCount}/4 완료)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentView('hub')}
                      className="font-jua text-xs px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                    >
                      ← 퀘스트 목록
                    </button>
                    <button
                      onClick={() => setCurrentView('quest1')}
                      className="font-jua text-xs px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition cursor-pointer flex items-center gap-1"
                    >
                      ← 퀘스트 1 가기
                    </button>
                  </div>
                </div>

                {/* 4 Mission Cards for Quest 2 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  {([1, 2, 3, 4] as const).map((mNum) => {
                    const missionKey = `q2_${mNum}`;
                    const isCompleted = student?.completedMissions?.[missionKey] === true;
                    const hintLetter = student?.unlockedHints?.[missionKey] || '★';

                    return (
                      <div
                        key={missionKey}
                        className={`rounded-3xl p-5 sm:p-6 transition-all border-2 flex flex-col justify-between ${
                          isCompleted
                            ? 'bg-indigo-50/70 border-indigo-300 shadow-sm'
                            : 'bg-white border-slate-200 shadow-xs hover:border-indigo-200'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-8 h-8 rounded-xl flex items-center justify-center font-jua text-sm ${
                                  isCompleted ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {mNum}
                              </span>
                              <h3 className="font-jua text-base sm:text-lg text-slate-900">{mNum}번 미션</h3>
                            </div>

                            {isCompleted ? (
                              <span className="bg-indigo-200 text-indigo-900 font-jua text-xs px-2.5 py-1 rounded-full flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-700" />
                                정답 완료
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-sans flex items-center gap-1">
                                <Lock className="w-3 h-3" />
                                도전 중
                              </span>
                            )}
                          </div>

                          {/* Reward / Hint Display */}
                          <div className="mb-4">
                            {isCompleted ? (
                              <div className="p-3 bg-white rounded-2xl border border-indigo-200 flex items-center justify-between">
                                <span className="text-xs text-slate-600 font-sans">획득한 비밀 힌트 글자:</span>
                                <span className="font-jua text-xl text-indigo-700 bg-indigo-100 px-3 py-0.5 rounded-xl border border-indigo-300">
                                  [ {hintLetter} ]
                                </span>
                              </div>
                            ) : (
                              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between text-xs text-slate-500 font-sans">
                                <span>정답 시 획득 힌트:</span>
                                <span className="font-jua text-sm text-slate-400 bg-slate-200/70 px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                                  <Lock className="w-3 h-3" /> 비밀 글자
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Input or Completed State */}
                        <div>
                          {isCompleted ? (
                            <div className="w-full py-2.5 rounded-2xl bg-indigo-100 text-indigo-800 font-jua text-xs sm:text-sm text-center flex items-center justify-center gap-1.5">
                              <Check className="w-4 h-4 text-indigo-600" />
                              미션을 성공적으로 완료했습니다!
                            </div>
                          ) : (
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                handleSubmitMission(2, mNum);
                              }}
                              className="flex gap-2"
                            >
                              <input
                                type="text"
                                value={answerInputs[missionKey] || ''}
                                onChange={(e) =>
                                  setAnswerInputs({ ...answerInputs, [missionKey]: e.target.value })
                                }
                                placeholder="정답을 입력하세요"
                                className="flex-1 bg-slate-50 border-2 border-slate-200 focus:bg-white focus:border-indigo-500 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-sans focus:outline-none transition"
                              />
                              <button
                                type="submit"
                                className="font-jua text-xs sm:text-sm px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white shadow-md shadow-indigo-200 transition cursor-pointer whitespace-nowrap"
                              >
                                정답 확인
                              </button>
                            </form>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-xs text-slate-400 border-t border-slate-200 font-sans flex items-center justify-center gap-2">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
        <span>초등 사회 시장경제 탐험 퀘스트 웹 애플리케이션 (보안 강화 모드) © 2026</span>
      </footer>

      {/* MODAL 1: QUEST SELECTION MODAL */}
      {questSelectModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border-4 border-amber-200 animate-pop-bounce text-center space-y-5">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-inner">
              📖
            </div>

            <div>
              <h3 className="font-jua text-2xl text-slate-900">도전할 퀘스트를 선택하세요!</h3>
              <p className="text-xs sm:text-sm text-slate-500 font-sans mt-1">
                퀘스트 1 또는 퀘스트 2를 선택하여 4개의 미션 정답을 맞춰보세요.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
              {/* Quest 1 Button */}
              <button
                onClick={() => {
                  setQuestSelectModalOpen(false);
                  setCurrentView('quest1');
                }}
                className="p-5 rounded-2xl border-2 border-emerald-300 bg-emerald-50/60 hover:bg-emerald-100/70 text-slate-800 transition active:scale-95 cursor-pointer shadow-sm group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="w-8 h-8 rounded-xl bg-emerald-600 text-white font-jua text-sm flex items-center justify-center">
                    1
                  </span>
                  <span className="font-mono text-xs text-emerald-800 bg-emerald-200/70 px-2 py-0.5 rounded">
                    {q1CompletedCount}/4 완료
                  </span>
                </div>
                <h4 className="font-jua text-lg text-emerald-900 group-hover:text-emerald-700">퀘스트 1</h4>
                <p className="text-xs text-emerald-700/80 mt-1 font-sans">미션 1 ~ 4 문제 풀기</p>
              </button>

              {/* Quest 2 Button */}
              <button
                onClick={() => {
                  setQuestSelectModalOpen(false);
                  setCurrentView('quest2');
                }}
                className="p-5 rounded-2xl border-2 border-indigo-300 bg-indigo-50/60 hover:bg-indigo-100/70 text-slate-800 transition active:scale-95 cursor-pointer shadow-sm group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-jua text-sm flex items-center justify-center">
                    2
                  </span>
                  <span className="font-mono text-xs text-indigo-800 bg-indigo-200/70 px-2 py-0.5 rounded">
                    {q2CompletedCount}/4 완료
                  </span>
                </div>
                <h4 className="font-jua text-lg text-indigo-900 group-hover:text-indigo-700">퀘스트 2</h4>
                <p className="text-xs text-indigo-700/80 mt-1 font-sans">미션 1 ~ 4 문제 풀기</p>
              </button>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setQuestSelectModalOpen(false)}
                className="font-jua text-xs text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CELEBRATION MODAL (HINT LETTER REVEAL) */}
      {celebrationModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border-4 border-amber-300 text-center animate-celebrate-glow space-y-4">
            <div className="w-20 h-20 bg-gradient-to-tr from-amber-400 to-yellow-300 text-amber-900 rounded-3xl flex items-center justify-center text-4xl mx-auto shadow-lg shadow-amber-300/50">
              🎉
            </div>

            <div>
              <span className="text-xs bg-amber-100 text-amber-800 font-jua px-3 py-1 rounded-full border border-amber-200">
                퀘스트 {celebrationModal.questNum} - {celebrationModal.missionNum}번 미션 성공!
              </span>
              <h3 className="font-jua text-2xl text-slate-900 mt-2">정답입니다!</h3>
              <p className="text-xs text-slate-500 font-sans mt-1">새로운 비밀 힌트 글자를 획득했습니다!</p>
            </div>

            {/* Big Shiny Hint Letter Badge */}
            <div className="py-2">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-amber-400 via-amber-300 to-yellow-200 border-4 border-amber-100 mx-auto flex items-center justify-center text-slate-900 shadow-xl shadow-amber-400/40 animate-pop-bounce">
                <span className="font-jua text-4xl sm:text-5xl drop-shadow-md">
                  {celebrationModal.hintLetter}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-400 font-sans">
              상단 <strong>'비밀 힌트 글자 모음판'</strong>에 안전하게 보관되었습니다.
            </p>

            <button
              onClick={() => setCelebrationModal(null)}
              className="w-full font-jua text-sm py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-300/40 transition cursor-pointer"
            >
              확인하고 계속하기 🚀
            </button>
          </div>
        </div>
      )}

      {/* MODAL 3: STUDENT LOGIN MODAL WITH CLASS CODE & IDENTITY VALIDATION */}
      {loginModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border-4 border-amber-200 text-center animate-pop-bounce">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-inner relative">
              <Store className="w-10 h-10 text-emerald-600" />
              <span className="absolute -bottom-1 -right-1 w-7 h-7 bg-amber-400 text-slate-900 rounded-full flex items-center justify-center text-xs font-jua shadow border-2 border-white">
                🪙
              </span>
            </div>
            <h2 className="font-jua text-2xl text-slate-900 mb-1">시장경제 퀘스트 로그인</h2>
            <p className="text-xs sm:text-sm text-slate-500 mb-6 font-sans">
              학급 입장 코드와 본인 정보를 입력하면 퀘스트 진행 상태가 안전하게 저장됩니다!
            </p>

            <form onSubmit={handleStudentLogin} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-jua text-slate-600 mb-1 flex items-center gap-1">
                  <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
                  학급 입장 코드
                </label>
                <input
                  type="text"
                  value={inputClassCode}
                  onChange={(e) => setInputClassCode(e.target.value)}
                  placeholder="선생님이 알려주신 입장 코드 (예: market61)"
                  required
                  className="w-full border-2 border-slate-200 rounded-2xl px-3.5 py-3 text-sm focus:outline-none focus:border-emerald-500 font-sans"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-jua text-slate-600 mb-1">학급 번호</label>
                  <input
                    type="number"
                    value={inputStudentNum}
                    onChange={(e) => setInputStudentNum(e.target.value)}
                    placeholder="예: 5"
                    className="w-full border-2 border-slate-200 rounded-2xl px-3 py-3 text-sm focus:outline-none focus:border-emerald-500 font-sans"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-jua text-slate-600 mb-1">이름</label>
                  <input
                    type="text"
                    value={inputStudentName}
                    onChange={(e) => setInputStudentName(e.target.value)}
                    placeholder="이름 입력"
                    required
                    className="w-full border-2 border-slate-200 rounded-2xl px-3 py-3 text-sm focus:outline-none focus:border-emerald-500 font-sans"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-jua text-base shadow-lg shadow-emerald-300/40 active:scale-95 transition cursor-pointer flex items-center justify-center gap-2"
              >
                <Store className="w-5 h-5" />
                <span>시장경제 퀘스트 로그인</span>
              </button>
            </form>

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-center">
              <button
                onClick={() => {
                  setLoginModalOpen(false);
                  setTeacherLoginModalOpen(true);
                }}
                className="font-jua text-xs text-purple-600 hover:text-purple-800 transition cursor-pointer flex items-center gap-1"
              >
                <GraduationCap className="w-4 h-4" />
                선생님이신가요? 교사 모드 접속
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: TEACHER LOGIN MODAL (No Password Revealed on Screen) */}
      {teacherLoginModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border-4 border-purple-200 text-center animate-pop-bounce">
            <div className="w-18 h-18 bg-purple-100 text-purple-600 rounded-3xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-inner">
              👨‍🏫
            </div>
            <h2 className="font-jua text-2xl text-purple-900 mb-1">교사 모드 로그인</h2>
            <p className="text-xs text-slate-500 mb-6 font-sans">
              문제 정답 설정 및 학급 관리를 위한 선생님 비밀번호를 입력해주세요.
            </p>

            <form onSubmit={handleTeacherLogin} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-jua text-slate-600 mb-1">선생님 비밀번호</label>
                <input
                  type="password"
                  value={teacherPassword}
                  onChange={(e) => setTeacherPassword(e.target.value)}
                  placeholder="비밀번호 입력"
                  required
                  autoComplete="current-password"
                  className="w-full border-2 border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500 font-sans"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-jua text-base shadow-lg shadow-purple-300/40 active:scale-95 transition cursor-pointer"
              >
                교사 모드 입장하기
              </button>
            </form>

            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-center">
              <button
                onClick={() => {
                  setTeacherLoginModalOpen(false);
                  setLoginModalOpen(true);
                }}
                className="font-jua text-xs text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                ← 학생 로그인으로 돌아가기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: CONFIRM MODAL */}
      {confirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border-2 border-slate-200 text-center animate-pop-bounce space-y-4">
            <h3 className="font-jua text-xl text-slate-900">{confirmModal.title}</h3>
            <p className="text-xs text-slate-500 font-sans">{confirmModal.description}</p>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setConfirmModal(null)}
                className="font-jua text-xs py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
              >
                취소
              </button>
              <button
                onClick={async () => {
                  const act = confirmModal.action;
                  setConfirmModal(null);
                  await act();
                }}
                className="font-jua text-xs py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-200 transition cursor-pointer"
              >
                실행
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
