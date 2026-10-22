// PDF 解析模块（纯前端，无后端依赖）
// 文本型 PDF 用 pdf.js 抽取文字；扫描件用 tesseract.js 做 OCR
// 再用启发式规则把简历文字映射成档案结构

let pdfjsLib = null;

async function loadPdfLib() {
  if (pdfjsLib) return pdfjsLib;
  pdfjsLib = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.7.76/build/pdf.min.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.7.76/build/pdf.worker.min.mjs';
  return pdfjsLib;
}

async function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export async function extractText(file, onProgress) {
  const pdfjs = await loadPdfLib();
  const data = await readFileAsArrayBuffer(file);
  const pdf = await pdfjs.getDocument({ data }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i += 1) {
    if (onProgress) onProgress(i, pdf.numPages);
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str || '').join(' ');
    text += `${pageText}\n`;
  }
  return text;
}

export async function ocrImage(file, onProgress) {
  // 扫描件兜底：用 tesseract.js 做中文 OCR（按需加载，体积较大）
  const { createWorker } = await import('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js');
  const worker = await createWorker('chi_sim+eng');
  const { data } = await worker.recognize(file, {}, {
    logger: (m) => {
      if (onProgress && m.status === 'recognizing text') onProgress(m.progress);
    }
  });
  await worker.terminate();
  return data.text || '';
}

/* ------------ 启发式简历解析 ------------ */
const CITY_RE = /(北京|上海|广州|深圳|杭州|成都|武汉|南京|西安|苏州|重庆|天津|青岛|长沙|郑州|合肥|福州|厦门|大连|宁波|济南|昆明|哈尔滨|沈阳|长春)/;

function pick(pattern, text, flags = '') {
  const m = text.match(new RegExp(pattern, flags));
  return m ? m[1] || '' : '';
}

function pickAll(pattern, text) {
  const re = new RegExp(pattern, 'g');
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) out.push(m[1] || m[0]);
  return out;
}

function parseName(text) {
  // 优先匹配 "姓名：xxx"，否则取开头短文本
  const labeled = pick(/姓\s*名[：:\s]+([\u4e00-\u9fa5·]{2,6})/, text);
  if (labeled) return labeled.trim();
  // 取第一行（去除空白），2-6 个中文字
  const firstLine = text.split('\n').map((l) => l.trim()).find((l) => l && l.length <= 10);
  if (firstLine && /^[\u4e00-\u9fa5·]{2,6}$/.test(firstLine)) return firstLine;
  return '';
}

function parsePhone(text) {
  const m = text.match(/1[3-9]\d{9}/);
  return m ? m[0] : '';
}

function parseEmail(text) {
  const m = text.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/);
  return m ? m[0] : '';
}

function parseBirthDate(text) {
  let m = text.match(/(19[5-9]\d|200\d)[年.\-/](\d{1,2})[月.\-/]?(\d{1,2})?/);
  if (m) {
    const y = m[1];
    const mo = String(m[2]).padStart(2, '0');
    const d = m[3] ? String(m[3]).padStart(2, '0') : '01';
    return `${y}-${mo}-${d}`;
  }
  m = text.match(/(19[5-9]\d|200\d)\s*年/);
  return m ? `${m[1]}-01-01` : '';
}

function parseLocation(text) {
  const m = text.match(CITY_RE);
  return m ? m[0] : '';
}

function parseEducation(text) {
  const edu = { school: '', major: '', degree: '', period: '' };
  edu.degree = pick(/(博士|硕士|本科|大专|专科|学士)/, text);
  edu.school = pick(/([\u4e00-\u9fa5A-Za-z]{2,20}(大学|学院|学校|University|College))/, text);
  // 专业：优先 "专业：xxx"，其次从非学校名的关键词里找
  const labeledMajor = pick(/(?:专业|主修)[：:\s]*([\u4e00-\u9fa5A-Za-z]{2,20})/, text);
  if (labeledMajor) {
    edu.major = labeledMajor;
  } else {
    const majorCandidates = text.match(/[\u4e00-\u9fa5]{2,12}(学|工程|管理|经济|科学|技术|设计|医学|法学|文学)/g) || [];
    edu.major = majorCandidates.find((m) => !edu.school || !m.includes(edu.school.slice(0, 4))) || '';
  }
  const period = text.match(/((?:19|20)\d{2})\s*[-~至到]\s*((?:19|20)\d{2})/);
  if (period) edu.period = `${period[1]}-${period[2]}`;
  return edu;
}

const EDU_HINT = /(大学|学院|学校|University|College|教育|学历|专业|主修|GPA|绩点)/;

// 识别一段时间段，用于经历切分
function parseExperiences(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const exps = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const periodMatch = line.match(/((?:19|20)\d{2})[年.\-/]?\s*(\d{1,2})?\s*[-~至到]\s*((?:19|20)\d{2}|至今|现在)[年.\-/]?\s*(\d{1,2})?/);
    if (periodMatch && !EDU_HINT.test(line)) {
      const start = `${periodMatch[1]}-${String(periodMatch[2] || '01').padStart(2, '0')}`;
      const endRaw = periodMatch[3];
      const end = /至今|现在/.test(endRaw) ? '至今' : `${endRaw}-${String(periodMatch[4] || '01').padStart(2, '0')}`;
      const nameLine = line.replace(periodMatch[0], '').trim() || lines[i + 1] || '';
      const name = nameLine.replace(/\(.*?\)/g, '').replace(/（.*?）/g, '').trim().slice(0, 40);
      const role = pick(/(前端|后端|全栈|产品|算法|测试|运营|设计|开发|经理|主管|工程师|实习生|负责人)/, nameLine);
      const descLines = [];
      let j = i + 1;
      while (j < lines.length && !/((?:19|20)\d{2})[年.\-/]?\s*(\d{1,2})?\s*[-~至到]/.test(lines[j])) {
        descLines.push(lines[j]);
        j += 1;
      }
      const desc = descLines.join('；').slice(0, 200);
      if (name && !EDU_HINT.test(name)) {
        const type = /实习/.test(desc + name) ? '实践' : '项目';
        exps.push({ type, name, role, start, end, desc, achievements: [] });
      }
      i = j;
    } else {
      i += 1;
    }
  }
  return exps;
}

function parseHonors(text) {
  const honors = pickAll(/([\u4e00-\u9fa5A-Za-z0-9]{2,30}(奖|荣誉|称号|证书|认证))/, text);
  const stopWords = ['荣誉奖励', '荣誉', '奖励', '证书', '奖项'];
  return honors
    .filter((h) => !stopWords.includes(h) && h.length > 3)
    .slice(0, 5)
    .map((name) => ({ name, level: '', time: '', desc: '' }));
}

function parseLanguages(text) {
  const langs = [];
  const cet = text.match(/CET-?([46])\s*(?:[:：]?\s*(\d{2,3}))?/);
  if (cet) {
    const score = cet[2] || '';
    const proficiency = score ? (parseInt(score, 10) >= 550 ? '熟练' : '良好') : '';
    langs.push({ lang: '英语', level: `CET-${cet[1]}`, proficiency, score });
  }
  const toefl = text.match(/(?:TOEFL|托福)\s*[:：]?\s*(\d{2,3})/i);
  if (toefl) langs.push({ lang: '英语', level: 'TOEFL', proficiency: '', score: toefl[1] });
  const ielts = text.match(/(?:IELTS|雅思)\s*[:：]?\s*(\d(?:\.\d)?)/i);
  if (ielts) langs.push({ lang: '英语', level: 'IELTS', proficiency: '', score: ielts[1] });
  if (langs.length === 0) langs.push({ lang: '英语', level: '', proficiency: '', score: '' });
  return langs;
}

function parseSelfEvaluation(text) {
  const patterns = [
    /(?:自我评价|个人简介|个人评价|自我介绍)[：:\s]*([\s\S]{20,300}?)(?=\n[\u4e00-\u9fa5]{2,8}[:：]|\n\s*\n|$)/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].replace(/\s+/g, ' ').trim().slice(0, 200);
  }
  // 兜底：取最后一段较长文字
  const blocks = text.split(/\n\s*\n/).filter((b) => b.length > 30);
  return blocks.length ? blocks[blocks.length - 1].replace(/\s+/g, ' ').trim().slice(0, 200) : '';
}

export function parseResumeText(text) {
  const profile = {
    full_name: parseName(text),
    phone: parsePhone(text),
    email: parseEmail(text),
    birth_date: parseBirthDate(text),
    location: parseLocation(text),
    education: [parseEducation(text)],
    experiences: parseExperiences(text),
    honors: parseHonors(text),
    languages: parseLanguages(text),
    self_evaluation: parseSelfEvaluation(text),
    custom_fields: []
  };
  return profile;
}

// 解析置信度：有多少关键字段被成功提取
export function confidenceOf(profile) {
  const keys = ['full_name', 'phone', 'email', 'education'];
  let hit = 0;
  keys.forEach((k) => {
    if (k === 'education') {
      if (profile.education[0] && (profile.education[0].school || profile.education[0].degree)) hit += 1;
    } else if (profile[k]) hit += 1;
  });
  return Math.round((hit / keys.length) * 100);
}

export function lowConfidenceFields(profile) {
  const low = [];
  if (!profile.full_name) low.push('姓名');
  if (!profile.phone) low.push('手机号');
  if (!profile.email) low.push('邮箱');
  if (!profile.education[0]?.school) low.push('毕业院校');
  return low;
}
