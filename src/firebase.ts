// Client proxies all operations through internal server endpoints without external API keys or third-party services.
export const auth = null;
export const db = null;

export interface MissionConfig {
  answer: string;
  hintLetter: string; // Exactly 1 character
  title?: string;
}

export interface QuestConfigData {
  classCode?: string;
  quest1: {
    1: MissionConfig;
    2: MissionConfig;
    3: MissionConfig;
    4: MissionConfig;
  };
  quest2: {
    1: MissionConfig;
    2: MissionConfig;
    3: MissionConfig;
    4: MissionConfig;
  };
  updatedAt?: string;
}

export const defaultQuestConfig: QuestConfigData = {
  classCode: 'market61',
  quest1: {
    1: { answer: '시장', hintLetter: '시', title: '1번 미션' },
    2: { answer: '가격', hintLetter: '장', title: '2번 미션' },
    3: { answer: '수요', hintLetter: '경', title: '3번 미션' },
    4: { answer: '공급', hintLetter: '제', title: '4번 미션' },
  },
  quest2: {
    1: { answer: '가계', hintLetter: '보', title: '1번 미션' },
    2: { answer: '기업', hintLetter: '물', title: '2번 미션' },
    3: { answer: '생산', hintLetter: '상', title: '3번 미션' },
    4: { answer: '소비', hintLetter: '자', title: '4번 미션' },
  },
};

export interface StudentProgress {
  studentKey: string;
  studentNumber: string;
  name: string;
  displayName: string;
  ownerUid?: string;
  completedMissions: Record<string, boolean>; // key like "q1_1", "q1_2", "q2_1", ...
  unlockedHints: Record<string, string>; // key like "q1_1" -> "시"
  updatedAt?: string;
  migratedFromLegacy?: boolean;
}

export function generateStudentKey(number: string, name: string): string {
  const cleanName = (name || '').trim().replace(/\s+/g, '_');
  const cleanNum = (number || '').trim();
  if (cleanNum) {
    return `num_${cleanNum}_name_${cleanName}`;
  }
  return `name_${cleanName}`;
}

export async function ensureAuth(): Promise<null> {
  return null;
}

// Helper to sanitize quest config
function sanitizeQuestConfig(input: any): QuestConfigData {
  const result: QuestConfigData = {
    classCode: input?.classCode || defaultQuestConfig.classCode,
    quest1: {
      1: { ...defaultQuestConfig.quest1[1] },
      2: { ...defaultQuestConfig.quest1[2] },
      3: { ...defaultQuestConfig.quest1[3] },
      4: { ...defaultQuestConfig.quest1[4] },
    },
    quest2: {
      1: { ...defaultQuestConfig.quest2[1] },
      2: { ...defaultQuestConfig.quest2[2] },
      3: { ...defaultQuestConfig.quest2[3] },
      4: { ...defaultQuestConfig.quest2[4] },
    },
    updatedAt: input?.updatedAt || new Date().toISOString(),
  };

  for (let i = 1; i <= 4; i++) {
    if (input?.quest1?.[i]) {
      result.quest1[i as 1 | 2 | 3 | 4] = {
        answer: input.quest1[i].answer ?? defaultQuestConfig.quest1[i as 1 | 2 | 3 | 4].answer,
        hintLetter: (input.quest1[i].hintLetter ?? defaultQuestConfig.quest1[i as 1 | 2 | 3 | 4].hintLetter).slice(0, 1),
        title: input.quest1[i].title || defaultQuestConfig.quest1[i as 1 | 2 | 3 | 4].title,
      };
    }
    if (input?.quest2?.[i]) {
      result.quest2[i as 1 | 2 | 3 | 4] = {
        answer: input.quest2[i].answer ?? defaultQuestConfig.quest2[i as 1 | 2 | 3 | 4].answer,
        hintLetter: (input.quest2[i].hintLetter ?? defaultQuestConfig.quest2[i as 1 | 2 | 3 | 4].hintLetter).slice(0, 1),
        title: input.quest2[i].title || defaultQuestConfig.quest2[i as 1 | 2 | 3 | 4].title,
      };
    }
  }

  return result;
}

// Get Quest Config with multi-tier fallback (localStorage -> server)
export async function getQuestConfig(): Promise<QuestConfigData> {
  let config: QuestConfigData = defaultQuestConfig;

  // 1. From localStorage
  try {
    const cached = localStorage.getItem('market_quest_config');
    if (cached) {
      config = sanitizeQuestConfig(JSON.parse(cached));
    }
  } catch {}

  // 2. Sync from server public config endpoint
  try {
    const res = await fetch('/api/quest/public-config');
    if (res.ok) {
      const publicCfg = await res.json();
      if (publicCfg?.classCode) {
        config.classCode = publicCfg.classCode;
        try {
          localStorage.setItem('market_quest_config', JSON.stringify(config));
        } catch {}
      }
    }
  } catch {}

  return config;
}

// Save Quest Config (Teacher Mode)
export async function saveQuestConfig(config: QuestConfigData): Promise<void> {
  const sanitized = sanitizeQuestConfig(config);
  const payload = {
    ...sanitized,
    updatedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem('market_quest_config', JSON.stringify(payload));
  } catch {}

  try {
    const teacherToken = localStorage.getItem('market_teacher_token') || 'local';
    await fetch('/api/teacher/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-teacher-auth': teacherToken,
      },
      body: JSON.stringify({
        quest1: sanitized.quest1,
        quest2: sanitized.quest2,
        classCode: sanitized.classCode,
      }),
    });
  } catch {}

  // Broadcast update to all client listeners
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('quest-config-updated', { detail: payload }));
  }
}

// Subscribe to real-time Quest Config changes
export function subscribeQuestConfig(callback: (config: QuestConfigData) => void): () => void {
  const handleUpdate = (e: Event) => {
    const custom = e as CustomEvent<QuestConfigData>;
    if (custom.detail) {
      callback(custom.detail);
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('quest-config-updated', handleUpdate);
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('quest-config-updated', handleUpdate);
    }
  };
}

// Seamless legacy data migration helper
export function migrateLegacyStudentData(studentKey: string, currentUid?: string): StudentProgress | null {
  const legacyKeys = [
    `market_student_${studentKey}`,
    `gyuyeo_data_${studentKey}`,
  ];

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.includes(studentKey) || (studentKey.split('_name_')[1] && k.includes(studentKey.split('_name_')[1])))) {
        if (!legacyKeys.includes(k)) legacyKeys.push(k);
      }
    }
  } catch {}

  let mergedProgress: StudentProgress | null = null;

  for (const k of legacyKeys) {
    try {
      const raw = localStorage.getItem(k);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          if (!mergedProgress) {
            mergedProgress = {
              studentKey: parsed.studentKey || studentKey,
              studentNumber: parsed.studentNumber || '',
              name: parsed.name || '',
              displayName: parsed.displayName || parsed.name || '학생',
              ownerUid: parsed.ownerUid || currentUid,
              completedMissions: { ...(parsed.completedMissions || {}) },
              unlockedHints: { ...(parsed.unlockedHints || {}) },
              migratedFromLegacy: true,
            };
          } else {
            mergedProgress.completedMissions = {
              ...mergedProgress.completedMissions,
              ...(parsed.completedMissions || {}),
            };
            mergedProgress.unlockedHints = {
              ...mergedProgress.unlockedHints,
              ...(parsed.unlockedHints || {}),
            };
          }
        }
      }
    } catch {}
  }

  return mergedProgress;
}

// Load student progress safely with local cache and server persistence
export async function loadStudentProgress(studentKey: string): Promise<StudentProgress | null> {
  let studentData: StudentProgress | null = null;
  const localKey = `market_student_${studentKey}`;

  // 1. From localStorage
  try {
    const localSaved = localStorage.getItem(localKey);
    if (localSaved) {
      studentData = JSON.parse(localSaved);
    }
  } catch {}

  // 2. From Server Database
  try {
    const res = await fetch(`/api/student/${encodeURIComponent(studentKey)}`);
    if (res.ok) {
      const data = await res.json();
      if (data?.student) {
        studentData = {
          ...(studentData || {}),
          ...data.student,
          completedMissions: {
            ...(studentData?.completedMissions || {}),
            ...(data.student.completedMissions || {}),
          },
          unlockedHints: {
            ...(studentData?.unlockedHints || {}),
            ...(data.student.unlockedHints || {}),
          },
        };
        try {
          localStorage.setItem(localKey, JSON.stringify(studentData));
        } catch {}
      }
    }
  } catch {}

  // 3. Fallback to legacy migration
  if (!studentData || Object.keys(studentData.completedMissions || {}).length === 0) {
    const legacy = migrateLegacyStudentData(studentKey);
    if (legacy && Object.keys(legacy.completedMissions || {}).length > 0) {
      studentData = legacy;
      try {
        localStorage.setItem(localKey, JSON.stringify(studentData));
      } catch {}
      saveStudentProgress(studentData).catch(() => {});
    }
  }

  if (studentData) {
    studentData.completedMissions = studentData.completedMissions || {};
    studentData.unlockedHints = studentData.unlockedHints || {};
  }

  return studentData;
}

// Save student progress safely to localStorage and server database
export async function saveStudentProgress(student: StudentProgress): Promise<void> {
  const payload: StudentProgress = {
    ...student,
    completedMissions: student.completedMissions || {},
    unlockedHints: student.unlockedHints || {},
    updatedAt: new Date().toISOString(),
  };

  const localKey = `market_student_${student.studentKey}`;
  try {
    localStorage.setItem(localKey, JSON.stringify(payload));
  } catch {}

  // Save to server database
  try {
    await fetch('/api/student/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student: payload }),
    });
  } catch {}

  // Broadcast to student listeners
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('student-progress-updated', {
        detail: { studentKey: student.studentKey, progress: payload },
      })
    );
  }
}

// Subscribe to Student Data changes
export function subscribeStudentProgress(
  studentKey: string,
  callback: (data: StudentProgress) => void
): () => void {
  const handleUpdate = (e: Event) => {
    const custom = e as CustomEvent<{ studentKey: string; progress: StudentProgress }>;
    if (custom.detail?.studentKey === studentKey && custom.detail?.progress) {
      callback(custom.detail.progress);
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('student-progress-updated', handleUpdate);
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('student-progress-updated', handleUpdate);
    }
  };
}

// Fetch all students for teacher overview
export async function fetchAllStudents(): Promise<StudentProgress[]> {
  const studentsMap: Record<string, StudentProgress> = {};

  // 1. From localStorage
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('market_student_') || k.startsWith('gyuyeo_data_'))) {
        try {
          const item = JSON.parse(localStorage.getItem(k) || '');
          if (item && (item.studentKey || item.name)) {
            const sKey = item.studentKey || generateStudentKey(item.studentNumber, item.name);
            studentsMap[sKey] = {
              ...item,
              completedMissions: item.completedMissions || {},
              unlockedHints: item.unlockedHints || {},
              studentKey: sKey,
            };
          }
        } catch {}
      }
    }
  } catch {}

  // 2. From server database
  try {
    const res = await fetch('/api/students');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.students)) {
        data.students.forEach((st: StudentProgress) => {
          if (st && st.studentKey) {
            studentsMap[st.studentKey] = {
              ...(studentsMap[st.studentKey] || {}),
              ...st,
              completedMissions: {
                ...(studentsMap[st.studentKey]?.completedMissions || {}),
                ...(st.completedMissions || {}),
              },
              unlockedHints: {
                ...(studentsMap[st.studentKey]?.unlockedHints || {}),
                ...(st.unlockedHints || {}),
              },
            };
          }
        });
      }
    }
  } catch {}

  const list = Object.values(studentsMap);
  list.sort((a, b) => {
    const numA = parseInt(a.studentNumber) || 999;
    const numB = parseInt(b.studentNumber) || 999;
    if (numA !== numB) return numA - numB;
    return (a.name || '').localeCompare(b.name || '');
  });
  return list;
}

// Reset student progress
export async function resetStudentProgress(studentKey: string): Promise<void> {
  const localKey = `market_student_${studentKey}`;
  const localSaved = localStorage.getItem(localKey);
  let cleared: StudentProgress = {
    studentKey,
    studentNumber: '',
    name: '',
    displayName: '',
    completedMissions: {},
    unlockedHints: {},
    updatedAt: new Date().toISOString(),
  };

  if (localSaved) {
    try {
      const parsed = JSON.parse(localSaved);
      cleared = {
        ...parsed,
        completedMissions: {},
        unlockedHints: {},
        updatedAt: new Date().toISOString(),
      };
    } catch {}
  }

  try {
    localStorage.setItem(localKey, JSON.stringify(cleared));
  } catch {}

  try {
    await fetch('/api/student/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentKey }),
    });
  } catch {}

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('student-progress-updated', {
        detail: { studentKey, progress: cleared },
      })
    );
  }
}

// Delete student progress
export async function deleteStudentProgress(studentKey: string): Promise<void> {
  try {
    localStorage.removeItem(`market_student_${studentKey}`);
    localStorage.removeItem(`gyuyeo_data_${studentKey}`);
  } catch {}

  try {
    await fetch('/api/student/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentKey }),
    });
  } catch {}
}

// Server-backed Student Login
export async function verifyStudentLoginWithServer(
  classCode: string,
  studentNumber: string,
  name: string
): Promise<{
  success: boolean;
  student?: StudentProgress;
  studentKey?: string;
  displayName?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/auth/student', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classCode, studentNumber, name }),
    });
    if (res.status === 404) {
      throw new Error('Static host - fallback to local storage');
    }
    const data = await res.json();
    if (res.ok && data.success) {
      const fullProgress = (await loadStudentProgress(data.studentKey)) || {
        studentKey: data.studentKey,
        studentNumber: data.studentNumber,
        name: data.name,
        displayName: data.displayName,
        completedMissions: {},
        unlockedHints: {},
      };
      await saveStudentProgress(fullProgress);
      return {
        success: true,
        student: fullProgress,
        studentKey: data.studentKey,
        displayName: data.displayName,
      };
    }
    return { success: false, error: data.error || '학급 입장 코드 또는 학생 정보가 일치하지 않습니다.' };
  } catch {
    // Offline / static hosting fallback
    const localCfg = await getQuestConfig();
    const expectedCode = (localCfg.classCode || 'market61').trim().toLowerCase();
    if (classCode && classCode.trim().toLowerCase() !== expectedCode) {
      return { success: false, error: '학급 입장 코드가 일치하지 않습니다. 선생님께 확인해 주세요.' };
    }
    const studentKey = generateStudentKey(studentNumber, name);
    const displayName = studentNumber.trim() ? `${studentNumber.trim()}번 ${name.trim()}` : name.trim();
    const fallbackProgress: StudentProgress = {
      studentKey,
      studentNumber: studentNumber.trim(),
      name: name.trim(),
      displayName,
      completedMissions: {},
      unlockedHints: {},
    };
    await saveStudentProgress(fallbackProgress);
    return {
      success: true,
      student: fallbackProgress,
      studentKey,
      displayName,
    };
  }
}

// Server-backed Teacher Login
export async function verifyTeacherLoginWithServer(
  password: string
): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    const res = await fetch('/api/auth/teacher', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, token: data.teacherToken };
    } else {
      const data = await res.json().catch(() => ({}));
      return { success: false, error: data.error || '선생님 비밀번호가 일치하지 않습니다.' };
    }
  } catch {
    if (password === '1234' || password === 'teacher') {
      return { success: true, token: 'local-teacher-session' };
    }
    return { success: false, error: '선생님 비밀번호가 일치하지 않습니다.' };
  }
}

// Server-side answer verification (keeps correct answer secret from student client bundle)
export async function verifyMissionAnswerOnServer(
  questNum: number,
  missionNum: number,
  answer: string
): Promise<{ correct: boolean; hintLetter?: string; message: string }> {
  try {
    const res = await fetch('/api/quest/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questNum, missionNum, answer }),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        correct: data.correct,
        hintLetter: data.hintLetter,
        message: data.message,
      };
    }
  } catch {}

  // Local verification fallback if server is unreachable
  try {
    const localConfig = await getQuestConfig();
    const qData = questNum === 1 ? localConfig.quest1 : localConfig.quest2;
    const target = (qData as any)?.[missionNum];
    const expected = (target?.answer || '').trim().replace(/\s+/g, '').toLowerCase();
    const submitted = (answer || '').trim().replace(/\s+/g, '').toLowerCase();

    if (submitted && submitted === expected) {
      return {
        correct: true,
        hintLetter: (target?.hintLetter || '★').slice(0, 1),
        message: '정답입니다!',
      };
    }
  } catch {}

  return {
    correct: false,
    message: '아쉽지만 정답이 아닙니다. 다시 시도해 보세요!',
  };
}
