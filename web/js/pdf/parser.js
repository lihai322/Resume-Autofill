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
    text += `${reorderPageText(content.items)}\n`;
  }
  return normalizeText(text);
}

// pdf.js 的 items 顺序不一定是阅读顺序，需按坐标重排：
// 1. 按 y 坐标分组（同 y 误差 ±5 视为同一行）
// 2. 每行内按 x 排序
function reorderPageText(items) {
  const withPos = items
    .map((item) => {
      const tx = item.transform || [1, 0, 0, 1, 0, 0];
      return { str: item.str || '', x: tx[4], y: tx[5], height: item.height || 0 };
    })
    .filter((t) => t.str.trim() !== '');

  if (withPos.length === 0) return '';

  // 按 y 降序（PDF 坐标 y 越大越靠上）
  withPos.sort((a, b) => b.y - a.y);

  const lines = [];
  let currentLine = [withPos[0]];
  for (let k = 1; k < withPos.length; k += 1) {
    const prev = currentLine[currentLine.length - 1];
    if (Math.abs(prev.y - withPos[k].y) <= 5) {
      currentLine.push(withPos[k]);
    } else {
      lines.push(currentLine);
      currentLine = [withPos[k]];
    }
  }
  lines.push(currentLine);

  return lines
    .map((line) => {
      line.sort((a, b) => a.x - b.x);
      return line.map((t) => t.str).join('');
    })
    .join('\n');
}

// 文本归一化：全角转半角、压缩多余空白、统一标点
function normalizeText(text) {
  return text
    .replace(/　/g, ' ')
    .replace(/\u3000/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\r/g, '')
    .trim();
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
  // 优先匹配 "姓名：xxx"，并严格限制为 2-6 个中文
  const labeled = pick(/姓\s*名\s*[：:\s]+([\u4e00-\u9fa5·]{2,6})/, text);
  if (labeled) return labeled.trim();
  // 取第一个 2-6 个纯中文（且不是标题词）的片段
  const candidates = text.match(/[\u4e00-\u9fa5·]{2,6}/g) || [];
  const stop = ['简历', '姓名', '手机', '邮箱', '电话', '出生', '所在', '城市', '教育', '项目', '实践', '荣誉', '语言', '自评'];
  const hit = candidates.find((c) => !stop.some((s) => c.includes(s)));
  return hit || '';
}

function parsePhone(text) {
  // 手机号：11 位；兼容 3-4-4 分段写法，分隔符可为空格或横线
  // 如 18800003333 / 188 0000 3333 / 188-0000-3333
  const m = text.match(/1[3-9]\d{9}|1[3-9]\d[-\s]?\d{4}[-\s]?\d{4}/);
  return m ? m[0].replace(/[-\s]/g, '') : '';
}

function parseEmail(text) {
  const m = text.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/);
  return m ? m[0] : '';
}

function parseBirthDate(text) {
  // 兼容：1998年5月12日 / 1998.05.12 / 1998-05-12 / 1998/05/12 / 1998年5月
  let m = text.match(/(19[5-9]\d|200\d)\s*[年.\-/]\s*(\d{1,2})\s*[月.\-/]?\s*(\d{1,2})?/);
  if (m) {
    const y = m[1];
    const mo = String(m[2]).padStart(2, '0');
    const d = m[3] ? String(m[3]).padStart(2, '0') : '01';
    return `${y}-${mo}-${d}`;
  }
  // 只有年份
  m = text.match(/(19[5-9]\d|200\d)\s*年/);
  return m ? `${m[1]}-01-01` : '';
}

function parseLocation(text) {
  const m = text.match(CITY_RE);
  return m ? m[0] : '';
}

// 解析单条教育经历
function parseEducationEntry(text) {
  const edu = { school: '', major: '', degree: '', academic_degree: '', gpa: '', courses: '', period: '' };
  edu.degree = pick(/(博士|硕士|本科|大专|专科|学士)/, text);
  // 学位：带学科前缀，如「工学学士」「理学硕士」「管理学博士」
  edu.academic_degree = pick(/([\u4e00-\u9fa5]{1,6}(?:学士|硕士|博士))/, text)
    || pick(/(?:学位)[：:\s]*([\u4e00-\u9fa5]{2,10})/, text);
  edu.school = pick(/([\u4e00-\u9fa5A-Za-z]{2,20}(?:大学|学院|学校|University|College)(?:[（(][^）)]{1,20}[)）])*)/, text);
  // 专业：优先 "专业：xxx"，其次从非学校名的关键词里找
  const labeledMajor = pick(/(?:专业|主修方向|专业方向)[：:\s]*([\u4e00-\u9fa5A-Za-z]{2,20})/, text);
  if (labeledMajor) {
    edu.major = labeledMajor;
  } else {
    const majorCandidates = text.match(/[\u4e00-\u9fa5]{1,12}(学|工程|管理|经济|科学|技术|设计|医学|法学|文学|语)/g) || [];
    edu.major = majorCandidates.find((m) => {
      // 排除学校名片段
      if (edu.school && m.includes(edu.school.slice(0, 4))) return false;
      // 排除学位相关片段（如「工学学」来自「工学学士」）
      if (edu.academic_degree && edu.academic_degree.includes(m)) return false;
      if (edu.degree && m.includes(edu.degree)) return false;
      // 排除通用词（大学/学院/学校本身不应作为专业）
      if (/^(大学|学院|学校|工程|管理|科学|技术|设计|医学|法学|文学|语)$/.test(m)) return false;
      return true;
    }) || '';
  }
  // 主修课程：数据结构、算法、操作系统、计算机网络
  edu.courses = pick(/(?:主修课程|核心课程|主要课程|所学课程|专业课程)[：:\s]*([\u4e00-\u9fa5A-Za-z0-9、,，\s]{2,120})/, text).trim();
  // 绩点：GPA 3.8 / 绩点：3.8/4.0 / 平均分：88 / 均分 85 / 加权分 90 / 成绩 3.8
  const gpaLabels = 'GPA|gpa|绩点|平均绩点|学分绩点|平均分|均分|加权分|加权平均|专业成绩|成绩';
  edu.gpa = pick(`(?:${gpaLabels})[:：\\s]*([\\d.]+(?:\\s*\\/\\s*[\\d.]+)?)`, text);
  const period = text.match(/((?:19|20)\d{2})\s*[-~至到]\s*((?:19|20)\d{2})/);
  if (period) edu.period = `${period[1]}-${period[2]}`;
  // 若简历未写明学位学科门类，则根据专业 + 学历自动推断（如「计算机科学与技术 + 本科 → 工学学士」）
  if (!edu.academic_degree && edu.major && edu.degree) {
    const discipline = inferDiscipline(edu.major);
    const suffix = { '本科': '学士', '学士': '学士', '硕士': '硕士', '博士': '博士' }[edu.degree] || '';
    if (discipline && suffix) edu.academic_degree = `${discipline}${suffix}`;
  }
  return edu;
}

// 解析全部教育经历（支持多条：硕士 + 本科）
function parseEducation(text) {
  // 先截取教育段（从教育标题到下一个段落标题）
  const eduSection = extractSection(text, EDU_SECTION_RE);
  const sectionText = eduSection || text;
  const lines = sectionText.split('\n').map((l) => l.trim()).filter(Boolean);

  // 按学历关键词切分多条教育经历
  // 一行内若含「本科/硕士/博士/大专」或「年份-年份」，视为一条经历的起始
  const entries = [];
  let current = [];
  const DEGREE_RE = /(博士|硕士|本科|大专|专科)/;
  const YEAR_RE = /(?:19|20)\d{2}\s*[-~至到]\s*(?:19|20)\d{2}/;

  for (const line of lines) {
    const isNewEntry = DEGREE_RE.test(line) || (YEAR_RE.test(line) && /(大学|学院|学校)/.test(line));
    if (isNewEntry && current.length > 0) {
      entries.push(current.join(' '));
      current = [];
    }
    current.push(line);
  }
  if (current.length > 0) entries.push(current.join(' '));

  // 对每条经历解析，过滤掉无学校无学历的空条目
  const result = entries
    .map((entryText) => parseEducationEntry(entryText))
    .filter((e) => e.school || e.degree || e.major);

  return result.length > 0 ? result : [parseEducationEntry(text)];
}

// 根据专业关键词推断学位学科门类（工学/理学/农学/医学/文学/法学/经济学/管理学/教育学/艺术学/历史学）
const DISCIPLINE_RULES = [
  { name: '工学', keywords: ['计算机', '软件', '电子', '通信', '信息工程', '机械', '土木', '建筑', '自动化', '材料', '化工', '化学工程', '能源', '航空', '船舶', '兵器', '核工程', '环境工程', '生物医学工程', '工业工程', '网络工程', '物联网', '人工智能', '数据科学', '电气工程', '车辆工程', '测绘', '地质工程', '采矿', '石油', '纺织', '轻工', '印刷', '安全工程'] },
  { name: '理学', keywords: ['数学', '物理', '化学', '生物科学', '生物技术', '地理科学', '地质学', '大气', '海洋', '地球物理', '心理学', '统计学', '应用物理', '应用化学', '生物信息'] },
  { name: '农学', keywords: ['农学', '园艺', '植物保护', '动物科学', '动物医学', '林学', '水产', '草业', '农业资源', '种子科学'] },
  { name: '医学', keywords: ['临床医学', '口腔医学', '基础医学', '预防医学', '中医学', '药学', '护理学', '公共卫生', '医学影像', '医学检验', '康复治疗', '麻醉学', '儿科学', '眼视光'] },
  { name: '文学', keywords: ['汉语言', '中文', '外语', '英语', '日语', '俄语', '德语', '法语', '西班牙语', '新闻', '传播', '翻译', '广告学', '编辑出版'] },
  { name: '法学', keywords: ['法学', '法律', '政治学', '社会学', '公安', '马克思主义', '思想政治', '外交学', '社会工作'] },
  { name: '经济学', keywords: ['经济学', '金融学', '金融工程', '会计学', '会计', '国际贸易', '财政', '税务', '保险', '投资学', '经济统计'] },
  { name: '管理学', keywords: ['工商管理', '行政管理', '人力资源', '市场营销', '旅游管理', '物流管理', '信息管理', '工程管理', '公共事业', '财务管理', '审计', '电子商务', '管理科学'] },
  { name: '教育学', keywords: ['教育学', '学前教育', '小学教育', '体育教育', '运动训练', '特殊教育', '教育技术'] },
  { name: '艺术学', keywords: ['艺术', '音乐', '美术', '设计', '舞蹈', '戏剧', '影视', '动画', '书法', '摄影', '播音', '表演'] },
  { name: '历史学', keywords: ['历史', '考古', '文物', '博物馆'] }
];

function inferDiscipline(major) {
  for (const rule of DISCIPLINE_RULES) {
    if (rule.keywords.some((kw) => major.includes(kw))) return rule.name;
  }
  return '';
}

const EDU_HINT = /(大学|学院|学校|University|College|教育|学历|专业|主修|GPA|绩点)/;

// 段落标题：用于区分教育段 / 项目段 / 实践段
const EDU_SECTION_RE = /(教育背景|教育经历|教育情况|学历背景|学习经历|学习情况)/;
const PRACTICE_SECTION_RE = /(实践经历|实践经验|实习经历|实习经验|工作经历|工作经验|校园经历|校园实践|社会实践|学生工作|志愿服务|社团活动|兼职经历|课外活动)/;
const PROJECT_SECTION_RE = /(项目经历|项目经验|科研项目|项目背景|项目介绍|学术成果)/;

// 所有已知段落标题（用于截取某一段落的内容范围）
const ALL_SECTION_RE = new RegExp(
  `(${EDU_SECTION_RE.source}|${PRACTICE_SECTION_RE.source}|${PROJECT_SECTION_RE.source}|荣誉|奖励|语言|技能|自评|自我评价|个人评价|兴趣|证书|资格)`
);

// 从全文中截取指定标题段落的内容（从该标题到下一个段落标题之间）
function extractSection(text, headerRe) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  let start = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (headerRe.test(lines[i])) { start = i + 1; break; }
  }
  if (start === -1) return '';
  let end = lines.length;
  for (let i = start; i < lines.length; i += 1) {
    if (ALL_SECTION_RE.test(lines[i]) && !headerRe.test(lines[i])) { end = i; break; }
  }
  return lines.slice(start, end).join('\n');
}

// 识别一段时间段，用于经历切分
function parseExperiences(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const exps = [];

  // 第一遍：给每行打上所属段落类型标签
  // 'edu' = 教育段，'practice' = 实践/实习/工作段，'project' = 项目段，'' = 未分类
  const lineSection = [];
  let section = '';
  for (let k = 0; k < lines.length; k += 1) {
    if (EDU_SECTION_RE.test(lines[k])) section = 'edu';
    else if (PRACTICE_SECTION_RE.test(lines[k])) section = 'practice';
    else if (PROJECT_SECTION_RE.test(lines[k])) section = 'project';
    lineSection[k] = section;
  }

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // 教育段的行直接跳过，不再误判为经历
    if (lineSection[i] === 'edu') { i += 1; continue; }

    const periodMatch = line.match(/((?:19|20)\d{2})[年.\-/]?\s*(\d{1,2})?\s*[-~至到]\s*((?:19|20)\d{2}|至今|现在)[年.\-/]?\s*(\d{1,2})?/);
    if (periodMatch) {
      const start = `${periodMatch[1]}-${String(periodMatch[2] || '01').padStart(2, '0')}`;
      const endRaw = periodMatch[3];
      const end = /至今|现在/.test(endRaw) ? '至今' : `${endRaw}-${String(periodMatch[4] || '01').padStart(2, '0')}`;
      const nameLine = line.replace(periodMatch[0], '').trim() || lines[i + 1] || '';
      // 角色词：从行末匹配连续 1-3 个角色关键词（中间允许空格），如「前端开发实习生」「产品经理」
      const rolePat = '前端|后端|全栈|产品|算法|测试|运营|设计|开发|经理|主管|工程师|实习生|负责人|架构师|分析师|顾问';
      const roleRe = new RegExp(`(?:(?:${rolePat})\\s*){1,3}$`);
      const roleMatch = nameLine.match(roleRe);
      let role = '';
      let name = nameLine;
      if (roleMatch) {
        role = roleMatch[0].replace(/\s+/g, '');
        name = nameLine.slice(0, nameLine.length - roleMatch[0].length);
      }
      // 去掉括号内容 + 首尾分隔符（空格 / | / · / - / 冒号 / 逗号）
      name = name
        .replace(/\(.*?\)/g, '')
        .replace(/（.*?）/g, '')
        .replace(/^[\s|·\-:：,，]+|[\s|·\-:：,，]+$/g, '')
        .trim()
        .slice(0, 40);
      const descLines = [];
      let j = i + 1;
      while (j < lines.length && !/((?:19|20)\d{2})[年.\-/]?\s*(\d{1,2})?\s*[-~至到]/.test(lines[j])) {
        descLines.push(lines[j]);
        j += 1;
      }
      const desc = descLines.join('；').slice(0, 200);
      if (name && !EDU_HINT.test(name)) {
        // 类型判定：优先按段落标题，其次按关键词兜底
        let type;
        if (lineSection[i] === 'practice') type = '实践';
        else if (lineSection[i] === 'project') type = '项目';
        else type = /(实习|实践|工作|校园|志愿|学生|社团|兼职|竞赛|比赛)/.test(desc + name) ? '实践' : '项目';
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
  const seen = new Set();
  // 四六级级别识别：
  //   CET-4/CET6 / 英语四级 / 大学英语六级 / 英语6级 / 四级 / 6级
  // 注意：数字 4/6 必须有 CET/英语前缀 或 级 后缀，避免匹配到年份里的数字
  const levelRe = /(?:CET-?([46])|(?:大学\s*)?英语\s*([46四6六])\s*级?|([四64六])级)/g;
  let m;
  while ((m = levelRe.exec(text)) !== null) {
    const rawLevel = m[1] || m[2] || m[3];
    const levelNum = /[4四]/.test(rawLevel) ? '4' : '6';
    if (seen.has(levelNum)) continue;
    seen.add(levelNum);
    // 在匹配位置之后 40 字符范围内找成绩（兼容全角逗号、空格、括号、"分"字）
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 40);
    const scoreMatch = after.match(/(\d{2,3})\s*分?/);
    const score = scoreMatch ? scoreMatch[1] : '';
    const proficiency = score ? (parseInt(score, 10) >= 550 ? '熟练' : '良好') : '';
    langs.push({ lang: '英语', level: `CET-${levelNum}`, proficiency, score });
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
    education: parseEducation(text),
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
