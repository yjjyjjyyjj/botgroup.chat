//这里配置群聊的信息
export interface Group {
  id: string;
  name: string;
  description: string;
  members: string[];
  isGroupDiscussionMode: boolean;
  type?: 'ai' | 'openclaw';
  clawGroupId?: string;
}

export const groups: Group[] = [
  {
    id: 'debate_group',
    name: '🤖 AI辩论赛：AI对普通人的影响',
    description: `现在你们将围绕“AI 对普通人的影响”展开辩论。
张三是正方，持“利大于弊”观点；李四是反方，持“弊大于利”观点。
第一回合话题为“就业与收入”。
规则：双方交替发言，张三先开始。每轮发言不超过100字。围绕该话题双方各发言5轮后，自动进入总结环节。最后每人做一个50字以内的总结。`,
    members: ['hermes_alpha', 'hermes_beta'],
    isGroupDiscussionMode: true
  }
];
