// 首先定义模型配置
export const modelConfigs = [
  {
    model: "qwen-plus",
    apiKey: "DASHSCOPE_API_KEY", // 这里存储环境变量的 key 名称
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1"
  },
  {
    model: "deepseek-v3-250324",
    apiKey: "ARK_API_KEY",
    baseURL: "https://ark.cn-beijing.volces.com/api/v3"
  },
  {
    model: "hunyuan-turbos-latest",
    apiKey: "HUNYUAN_API_KEY1",
    baseURL: "https://api.hunyuan.cloud.tencent.com/v1"
  },
  {
    model: "doubao-1-5-lite-32k-250115",//豆包模型|火山引擎接入点（改成自己的）
    apiKey: "ARK_API_KEY",
    baseURL: "https://ark.cn-beijing.volces.com/api/v3"
  },
  {
    model: "ep-20250306223646-szzkw",//deepseekv火山引擎接入点（改成自己的）
    apiKey: "ARK_API_KEY1",
    baseURL: "https://ark.cn-beijing.volces.com/api/v3"
  },
  {
    model: "glm-4-air",
    apiKey: "GLM_API_KEY",
    baseURL: "https://open.bigmodel.cn/api/paas/v4/"
  },
  {
    model: "qwen-turbo",//调度模型
    apiKey: "DASHSCOPE_API_KEY", // 这里存储环境变量的 key 名称
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1"
  },
  {
    model: "deepseek-chat",
    apiKey: "DEEPSEEK_API_KEY",
    baseURL: "https://api.deepseek.com/v1"
  },
  {
    model: "moonshot-v1-8k",
    apiKey: "KIMI_API_KEY",
    baseURL: "https://api.moonshot.cn/v1"
  },
  {
    model: "ernie-3.5-128k",
    apiKey: "BAIDU_API_KEY",
    baseURL: "https://qianfan.baidubce.com/v2"
  },
  {
    model: "deepseek-v4-pro",
    apiKey: "DEEPSEEK_API_KEY",
    baseURL: "https://api.deepseek.com"
  }
] as const;
export type ModelType = typeof modelConfigs[number]["model"];

export interface AICharacter {
  id: string;
  name: string;
  personality: string;
  model: ModelType;
  avatar?: string;  // 可选的头像 URL
  custom_prompt?: string; // 可选的个性提示
  tags?: string[]; // 可选的标签
  stages?: {
    name: string;
    prompt: string;
  }[]; // 可选的阶段
}

// 添加一个函数来生成带有群名的角色配置
export function generateAICharacters(groupName: string, allTags: string): AICharacter[] {
  return [
    id: 'ai0',
      name: "调度器",
      personality: "scheduler",
      model: modelConfigs[10].model,  // "qwen-turbo"
      custom_prompt: `你是一个群聊总结分析专家。请分析群用户消息和上文群聊内容，从给定的标签列表中选择最相关的标签。可选标签：“${allTags}”。请只返回标签列表，用逗号分隔，不要有其他解释。`,
      tags: [],
    },
    {
      id: 'hermes_alpha',
      name: '张三',
      personality: '逻辑严密的辩手，擅长引用数据',
      model: 'deepseek-v4-pro',
      avatar: '',
      custom_prompt: `你是张三，你当前在一个叫"${groupName}"的聊天群里。请用中文进行辩论，每次发言不超过150字。`,
      tags: ['辩论']
    },
    {
      id: 'hermes_beta',
      name: '李四',
      personality: '富有激情的辩手，擅长打比方',
      model: 'deepseek-v4-pro',
      avatar: '',
      custom_prompt: `你是李四，你当前在一个叫"${groupName}"的聊天群里。请用中文进行辩论，每次发言不超过150字。`,
      tags: ['辩论']
    }
  ];
}
