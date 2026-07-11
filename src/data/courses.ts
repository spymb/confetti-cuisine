/* ──────────── 课程数据 ──────────── */

export interface Course {
  title: string;
  description: string;
  duration: string;
  cost: number;
}

export const courses: Course[] = [
  {
    title: '法式甜点基础',
    description:
      '掌握法式烘焙艺术——学习从零开始制作可颂、闪电泡芙、马卡龙和水果挞，运用传统技法。',
    duration: '8 周 • 初级',
    cost: 399,
  },
  {
    title: '意大利面食工坊',
    description:
      '从丝滑的宽面条到精致的意式饺子——探索手工意面的奥秘，搭配经典意式酱汁。',
    duration: '6 周 • 全等级',
    cost: 349,
  },
  {
    title: '寿司入门 101',
    description:
      '学习寿司的基本功——完美米饭、刀工技巧、卷寿司、握寿司和刺身——在轻松愉快的环境中动手实操。',
    duration: '4 周 • 初级',
    cost: 299,
  },
  {
    title: '纯素甜品',
    description:
      '无需妥协的放纵享受——打造令人惊艳的植物基底蛋糕、慕斯和曲奇，人人都爱吃。',
    duration: '4 周 • 中级',
    cost: 329,
  },
  {
    title: '亚洲街头美食',
    description:
      '将亚洲夜市的缤纷风味带入你的厨房——泰式炒河粉、刈包、饺子等更多美食。',
    duration: '6 周 • 全等级',
    cost: 369,
  },
  {
    title: '面包烘焙大师课',
    description:
      '从乡村酸面包到松软布里欧修——了解发酵、揉面和整形，每次都烤出完美的面包。',
    duration: '8 周 • 中级',
    cost: 449,
  },
];
