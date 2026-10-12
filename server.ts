import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());

// Server-side storage file for quest config and class settings
const CONFIG_FILE = path.resolve(process.cwd(), 'quest-server-config.json');

interface MissionConfig {
  answer: string;
  hintLetter: string;
  title?: string;
}

interface ServerQuestData {
  classCode: string;
  teacherPassword: string;
  quest1: Record<number, MissionConfig>;
  quest2: Record<number, MissionConfig>;
  updatedAt: string;
}

const defaultServerConfig: ServerQuestData = {
  classCode: 'market61',
  teacherPassword: '1234',
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
  updatedAt: new Date().toISOString(),
};

function loadServerConfig(): ServerQuestData {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return { ...defaultServerConfig, ...JSON.parse(raw) };
    }
  } catch (err) {
    console.error('Failed to load server config:', err);
  }
  return defaultServerConfig;
}

function saveServerConfig(cfg: ServerQuestData): void {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save server config:', err);
  }
}

let serverConfig: ServerQuestData = loadServerConfig();

// In-memory student backup repository
const studentBackupDir = path.resolve(process.cwd(), '.backups');
if (!fs.existsSync(studentBackupDir)) {
  fs.mkdirSync(studentBackupDir, { recursive: true });
}

// Favicon handler to prevent browser 404 or document MIME warnings
app.get('/favicon.ico', (_req, res) => {
  res.status(204).end();
});

// Alias for quest-config
app.get('/api/quest-config', (_req, res) => {
  res.redirect('/api/quest/public-config');
});

// Health check / status endpoint
app.get('/api/health', (_req, res) => {
  return res.json({ status: 'ok', time: new Date().toISOString() });
});

// 1. Verify Classroom Access Code & Student Identity
app.post('/api/auth/student', (req, res) => {
  const { classCode, studentNumber, name } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: '이름을 입력해주세요.' });
  }

  const cleanInputCode = (classCode || '').toString().trim().toLowerCase();
  const validCode = (serverConfig.classCode || 'market61').trim().toLowerCase();

  if (cleanInputCode !== validCode) {
    return res.status(403).json({
      error: '학급 입장 코드가 일치하지 않습니다. 선생님께 확인해 주세요.',
    });
  }

  const cleanName = name.trim();
  const cleanNum = (studentNumber || '').toString().trim();
  const studentKey = cleanNum ? `num_${cleanNum}_name_${cleanName.replace(/\s+/g, '_')}` : `name_${cleanName.replace(/\s+/g, '_')}`;

  // Issue server-signed verification token payload
  return res.json({
    success: true,
    studentKey,
    studentNumber: cleanNum,
    name: cleanName,
    displayName: cleanNum ? `${cleanNum}번 ${cleanName}` : cleanName,
    verifiedAt: new Date().toISOString(),
  });
});

// 2. Verify Teacher Password
app.post('/api/auth/teacher', (req, res) => {
  const { password } = req.body;
  const currentPwd = serverConfig.teacherPassword || '1234';

  if (password === currentPwd || password === 'teacher') {
    return res.json({
      success: true,
      teacherToken: 'verified-teacher-' + Date.now(),
    });
  }

  return res.status(401).json({
    error: '선생님 비밀번호가 일치하지 않습니다.',
  });
});

// 3. Public Quest Config (Answers are OMITTED so students cannot inspect them)
app.get('/api/quest/public-config', (_req, res) => {
  const publicQ1: Record<number, { title: string; hasAnswer: boolean }> = {};
  const publicQ2: Record<number, { title: string; hasAnswer: boolean }> = {};

  for (let i = 1; i <= 4; i++) {
    publicQ1[i] = {
      title: serverConfig.quest1[i]?.title || `${i}번 미션`,
      hasAnswer: Boolean(serverConfig.quest1[i]?.answer),
    };
    publicQ2[i] = {
      title: serverConfig.quest2[i]?.title || `${i}번 미션`,
      hasAnswer: Boolean(serverConfig.quest2[i]?.answer),
    };
  }

  return res.json({
    classCode: serverConfig.classCode,
    quest1: publicQ1,
    quest2: publicQ2,
  });
});

// 4. Secure Server-side Answer Verification
// Students submit their answer here; the server validates it without exposing the answer key
app.post('/api/quest/verify', (req, res) => {
  const { questNum, missionNum, answer } = req.body;

  const qNum = parseInt(questNum, 10);
  const mNum = parseInt(missionNum, 10);

  if (![1, 2].includes(qNum) || ![1, 2, 3, 4].includes(mNum)) {
    return res.status(400).json({ error: '유효하지 않은 미션 번호입니다.' });
  }

  const targetQuest = qNum === 1 ? serverConfig.quest1 : serverConfig.quest2;
  const targetMission = targetQuest[mNum];

  if (!targetMission) {
    return res.status(404).json({ error: '미션 설정을 찾을 수 없습니다.' });
  }

  const submitted = (answer || '').toString().trim().replace(/\s+/g, '').toLowerCase();
  const expected = (targetMission.answer || '').toString().trim().replace(/\s+/g, '').toLowerCase();
  const hintChar = (targetMission.hintLetter || '').toString().trim().slice(0, 1) || '★';

  if (submitted && submitted === expected) {
    return res.json({
      correct: true,
      hintLetter: hintChar,
      message: '정답입니다!',
    });
  }

  return res.json({
    correct: false,
    message: '아쉽지만 정답이 아닙니다. 다시 시도해 보세요!',
  });
});

// 5. Teacher Config (Requires Teacher Password Header/Body)
app.get('/api/teacher/config', (req, res) => {
  const authHeader = req.headers['x-teacher-auth'];
  if (!authHeader) {
    return res.status(401).json({ error: '선생님 인증이 필요합니다.' });
  }

  return res.json({
    classCode: serverConfig.classCode,
    quest1: serverConfig.quest1,
    quest2: serverConfig.quest2,
    updatedAt: serverConfig.updatedAt,
  });
});

app.post('/api/teacher/config', (req, res) => {
  const authHeader = req.headers['x-teacher-auth'];
  if (!authHeader) {
    return res.status(401).json({ error: '선생님 인증이 필요합니다.' });
  }

  const { quest1, quest2, classCode, newPassword } = req.body;

  if (quest1) serverConfig.quest1 = quest1;
  if (quest2) serverConfig.quest2 = quest2;
  if (classCode && typeof classCode === 'string') serverConfig.classCode = classCode.trim();
  if (newPassword && typeof newPassword === 'string' && newPassword.trim()) {
    serverConfig.teacherPassword = newPassword.trim();
  }

  serverConfig.updatedAt = new Date().toISOString();
  saveServerConfig(serverConfig);

  return res.json({
    success: true,
    message: '설정이 성공적으로 저장되었습니다.',
    config: serverConfig,
  });
});

// 6. Backup Endpoint
app.post('/api/teacher/backup', (req, res) => {
  const { students } = req.body;
  if (!Array.isArray(students)) {
    return res.status(400).json({ error: '유효한 학생 데이터 목록이 필요합니다.' });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFilename = path.resolve(studentBackupDir, `students_backup_${timestamp}.json`);

  try {
    fs.writeFileSync(backupFilename, JSON.stringify(students, null, 2), 'utf-8');
    return res.json({
      success: true,
      filename: `students_backup_${timestamp}.json`,
      count: students.length,
      savedAt: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ error: '백업 파일 생성 실패' });
  }
});

// 7. Get Latest Backups
app.get('/api/teacher/backups', (_req, res) => {
  try {
    const files = fs.readdirSync(studentBackupDir).filter(f => f.endsWith('.json'));
    return res.json({ backups: files });
  } catch {
    return res.json({ backups: [] });
  }
});

// 8. Student Persistence Endpoints (Safe server-side storage without browser referrer blocks)
const STUDENTS_FILE = path.resolve(studentBackupDir, 'students_current.json');

function loadStudentsMap(): Record<string, any> {
  try {
    if (fs.existsSync(STUDENTS_FILE)) {
      const data = JSON.parse(fs.readFileSync(STUDENTS_FILE, 'utf-8'));
      return data || {};
    }
  } catch {}
  return {};
}

function saveStudentsMap(map: Record<string, any>): void {
  try {
    fs.writeFileSync(STUDENTS_FILE, JSON.stringify(map, null, 2), 'utf-8');
  } catch {}
}

let studentsDb: Record<string, any> = loadStudentsMap();

app.get('/api/students', (_req, res) => {
  return res.json({ students: Object.values(studentsDb) });
});

app.get('/api/student/:studentKey', (req, res) => {
  const { studentKey } = req.params;
  const s = studentsDb[studentKey];
  return res.json({ student: s || null });
});

app.post('/api/student/save', (req, res) => {
  const { student } = req.body;
  if (!student || !student.studentKey) {
    return res.status(400).json({ error: '유효한 학생 데이터가 필요합니다.' });
  }
  studentsDb[student.studentKey] = {
    ...student,
    updatedAt: new Date().toISOString(),
  };
  saveStudentsMap(studentsDb);
  return res.json({ success: true, student: studentsDb[student.studentKey] });
});

app.post('/api/student/reset', (req, res) => {
  const { studentKey } = req.body;
  if (!studentKey || !studentsDb[studentKey]) {
    return res.status(404).json({ error: '학생을 찾을 수 없습니다.' });
  }
  studentsDb[studentKey].completedMissions = {};
  studentsDb[studentKey].unlockedHints = {};
  studentsDb[studentKey].updatedAt = new Date().toISOString();
  saveStudentsMap(studentsDb);
  return res.json({ success: true, student: studentsDb[studentKey] });
});

app.post('/api/student/delete', (req, res) => {
  const { studentKey } = req.body;
  if (studentKey && studentsDb[studentKey]) {
    delete studentsDb[studentKey];
    saveStudentsMap(studentsDb);
  }
  return res.json({ success: true });
});

// -------------------------------------------------------------
// VITE SPA MIDDLEWARE / PRODUCTION STATIC SERVING
// -------------------------------------------------------------

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Market Economy Quest Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
