export const COLORS = ['#1a1a1a', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export const seedProfiles = [
  {
    id: 'p-tech',
    name: '技术岗版',
    color: '#0ea5e9',
    target: '前端 / 全栈开发',
    avatar: null,
    full_name: '李明',
    birth_date: '1998-05-12',
    phone: '13800006688',
    email: 'liming@example.com',
    location: '北京',
    education: [
      { school: '北京邮电大学', major: '计算机科学与技术', degree: '本科', period: '2016-2020' }
    ],
    experiences: [
      {
        type: '项目',
        name: '企业级低代码平台',
        role: '前端负责人',
        start: '2023-03',
        end: '2024-06',
        desc: '基于 React + TypeScript 搭建可视化拖拽搭建平台，支持 30+ 组件、条件渲染、主题切换。',
        achievements: ['主导架构设计', '首屏加载优化 40%', '组件复用率提升至 70%']
      },
      {
        type: '实践',
        name: '字节跳动 · 抖音电商前端',
        role: '前端开发实习生',
        start: '2019-07',
        end: '2019-12',
        desc: '参与商家后台开发，负责商品管理模块与数据看板。',
        achievements: []
      }
    ],
    honors: [{ name: '蓝桥杯全国一等奖', level: '国家级', time: '2018', desc: '算法组' }],
    languages: [{ lang: '英语', level: 'CET-6', proficiency: '熟练', score: '560' }],
    self_evaluation: '5年前端开发经验，擅长 React 生态与性能优化，有从 0 到 1 项目经验。',
    custom_fields: [{ key: 'github', label: 'GitHub', type: 'text', value: 'github.com/liming' }],
    updated_at: '2026-10-15'
  },
  {
    id: 'p-product',
    name: '产品岗版',
    color: '#10b981',
    target: '产品经理',
    avatar: null,
    full_name: '李明',
    birth_date: '1998-05-12',
    phone: '13800006688',
    email: 'liming@example.com',
    location: '北京',
    education: [
      { school: '北京邮电大学', major: '计算机科学与技术', degree: '本科', period: '2016-2020' }
    ],
    experiences: [
      {
        type: '项目',
        name: '内部效率工具平台',
        role: '产品负责人',
        start: '2022-01',
        end: '2023-02',
        desc: '从需求调研到上线全流程负责，服务公司 2000+ 员工，日活 600+。',
        achievements: ['NPS 从 32 提升至 58', '获公司年度创新奖']
      }
    ],
    honors: [],
    languages: [{ lang: '英语', level: 'CET-6', proficiency: '良好', score: '498' }],
    self_evaluation: '具备技术背景的产品经理，擅长数据驱动与跨团队协作。',
    custom_fields: [],
    updated_at: '2026-09-28'
  }
];
