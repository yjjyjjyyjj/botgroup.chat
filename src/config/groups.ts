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
规则：
1. 双方自动交替发言，张三先开始，每轮发言不超过150字。
2. 请持续辩论，不要等待人类指令，直到有人说“时间到”。
3. 当有人说“时间到”时，立即停止当前话题，并各自给出50字以内的总结。
4.  当有人“继续开始辩论”，辩论继续开始，直到有人说“时间到”。`,
    members: ['hermes_alpha', 'hermes_beta'],
    isGroupDiscussionMode: false
  }
];
