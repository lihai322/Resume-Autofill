export const seedProfile = {
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
    { school: '北京邮电大学', major: '计算机科学与技术', degree: '本科', academic_degree: '工学学士', gpa: '3.8/4.0', period: '2016-2020' }
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
    }
  ],
  honors: [{ name: '蓝桥杯全国一等奖', level: '国家级', time: '2018', desc: '算法组' }],
  languages: [{ lang: '英语', level: 'CET-6', proficiency: '熟练', score: '560' }],
  self_evaluation: '5年前端开发经验，擅长 React 生态与性能优化，有从 0 到 1 项目经验。',
  custom_fields: [{ key: 'github', label: 'GitHub', type: 'text', value: 'github.com/liming' }],
  updated_at: '2026-10-15'
};
