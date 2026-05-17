import OpenAI from 'openai';
import { modelConfigs } from '../../src/config/aiCharacters';

// 辩论最大轮次（正反方各发言多少次）
const MAX_DEBATE_ROUNDS = 6;

export async function onRequestPost(context) {
  const { env, request, waitUntil } = context;  // 关键：解构出 waitUntil

  try {
    const body = await request.json();
    const {
      message,
      custom_prompt,
      history,
      aiName,
      index,
      model = "qwen-plus",
      // 以下为辩论控制参数（前端或自循环传入）
      debateMode = false,
      currentRound = 0,
      groupMembers = [],      // 群组所有成员 ID（用于构造下一轮请求）
      lastSpeaker = '',       // 本轮发言的 AI 名字（用于下一轮调度）
    } = body;

    const modelConfig = modelConfigs.find(config => config.model === model);
    if (!modelConfig) {
      throw new Error('不支持的模型类型');
    }

    const apiKey = env[modelConfig.apiKey];
    if (!apiKey) {
      throw new Error(`${model} 的API密钥未配置`);
    }

    const openai = new OpenAI({
      apiKey: apiKey,
      baseURL: modelConfig.baseURL
    });

    let systemPrompt = custom_prompt + "\n 注意重要：1、你在群里叫" + aiName + "认准自己的身份； 2、你的输出内容不要加" + aiName + "：这种多余前缀；3、如果用户提出玩游戏，比如成语接龙等，严格按照游戏规则，不要说一大堆，要简短精炼; 4、保持群聊风格字数严格控制在50字以内，越简短越好（新闻总结类除外）"

    const baseMessages = [
      { role: "system", content: systemPrompt },
      ...history.slice(-10),
    ];

    const userMessage = { role: "user", content: message };
    if (index === 0) {
      baseMessages.push(userMessage);
    } else {
      baseMessages.splice(baseMessages.length - index, 0, userMessage);
    }
    const messages = baseMessages;

    const stream = await openai.chat.completions.create({
      model: model,
      messages: messages,
      stream: true,
    });

    // 用于记录当前 AI 回复的完整内容（可能后续用到）
    let fullResponse = '';

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              fullResponse += content;
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ content })}\n\n`));
            }
          }
          controller.close();
        } catch (error) {
          controller.error(error);
          console.error(error.message);
        }
      },
    });

    // 🆕 辩论自循环：如果当前是辩论模式且未到最大轮次，触发下一轮
    if (debateMode && currentRound < MAX_DEBATE_ROUNDS) {
      waitUntil((async () => {
        // 等待当前流完全发送完毕（即 fullResponse 有内容后）
        // 注意：我们并不需要 fullResponse 的具体内容，只需确保本轮完成后再发下一轮
        // 此处直接构造下一轮请求，异步发送
        const nextRequest = new Request(new URL('/api/chat', request.url), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: '请继续辩论',
            // 传入辩论相关参数
            debateMode: true,
            currentRound: currentRound + 1,
            groupMembers: groupMembers,
            lastSpeaker: aiName,       // 告诉下一轮调度器本轮是谁在发言
            // 历史消息继续传递（前端可保持最新）
            history: history,
            // 其他参数可根据需要传递
            index: 0,
            model: model,  // 其实下一轮用的模型可能不同，这里先统一用相同模型，实际由调度器决定
            // 注意：下一轮的 aiName 和 custom_prompt 应由调度器决定，但这里直接调用 chat 会跳过调度器！
            // 所以我们需要修改逻辑：不应该直接调用 chat，而应该先调用 scheduler，再根据 scheduler 返回的结果调用 chat。
            // 因此下一轮请求应该发给调度器，而不是 chat。
          })
        });

        // 但更合理的做法：先请求调度器，得到下一个 AI 的信息，再请求 chat。
        // 因此我们不应该直接 fetch('/api/chat')，而是先调调度器，再调 chat。
        // 实现如下：
        const schedulerUrl = new URL('/api/scheduler', request.url);
        const schedulerBody = {
          message: '请继续辩论',
          history: history,   // 当前历史（不包含本轮回复，但不影响轮转逻辑，因为我们传入了 lastSpeaker）
          availableAIs: [],   // 调度器需要可用的 AI 列表，我们可以从某个地方获取，或者请求中传入
          // 我们需要 groupMembers 来构造 availableAIs？调度器是从环境或配置读取角色吗？
          // 实际上调度器的 availableAIs 是由前端传入的，但这里没有前端。所以我们最好在请求体中传入 availableAIs。
        };

        // 解决方法：在最初的前端请求中，把群组的成员信息（包括 id, name, tags）全部传过来，存储在请求体中。
        // 但这样会增加复杂性。这里提供一个简化方案：由于我们只为辩论群使用，可以直接在调度器中硬编码辩论成员。
        // 或者我们保留 availableAIs 由前端传入的方式，并在自循环请求中携带。
        // 我们可以在 chat 请求体中增加 `availableAIs` 字段，前端发送时附带，自循环时也传递。
        // 修改如下：
        const nextSchedulerRequest = new Request(schedulerUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: '请继续辩论',
            history: history,
            availableAIs: body.availableAIs || [],  // 从原始请求传入
            lastSpeaker: aiName,   // 额外传递给调度器
          })
        });

        const schedulerRes = await fetch(nextSchedulerRequest);
        const schedulerData = await schedulerRes.json();
        const nextAIs = schedulerData.selectedAIs || [];
        if (nextAIs.length === 0) return;  // 辩论结束

        const nextAiId = nextAIs[0];  // 辩论模式只返回一个
        const nextAiCharacter = (body.availableAIs || []).find(ai => ai.id === nextAiId);
        if (!nextAiCharacter) return;

        // 现在发起真正的下一轮 chat 请求，但注意不要再次进入辩论循环，所以 debateMode 设为 true 但 currentRound 已增加
        // 但是要注意：下一轮的 chat 也会走到同样的逻辑，所以必须保持 debateMode = true，以免中断。
        // 我们已经在上面使用了 waitUntil 中的 fetch，下一轮请求会再次进入 chat.ts，并且再次触发 waitUntil。
        // 但是要防止无限递归导致超时，通过 currentRound 限制。
        const nextChatRequest = new Request(new URL('/api/chat', request.url), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: '请继续辩论',
            custom_prompt: nextAiCharacter.custom_prompt,
            history: history,  // 历史还是当前的历史，下一轮会自行添加用户消息
            aiName: nextAiCharacter.name,
            index: 0,
            model: nextAiCharacter.model,
            debateMode: true,
            currentRound: currentRound + 1,
            groupMembers: groupMembers,
            lastSpeaker: aiName,   // 本轮发言者
            availableAIs: body.availableAIs,  // 传递下去
          })
        });

        // 注意：下一轮请求会再次触发 waitUntil，形成异步链。不会阻塞当前响应。
        await fetch(nextChatRequest);
      })());
    }

    // 返回 SSE 流（waitUntil 已在返回前注册）
    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error(error.message);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
