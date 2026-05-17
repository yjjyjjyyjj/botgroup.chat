import React, { useState, useRef, useEffect } from 'react';
import { Send, Share2, Settings2, ChevronLeft } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { request } from '@/utils/request';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";

import type { AICharacter } from "@/config/aiCharacters";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { SharePoster } from '@/pages/chat/components/SharePoster';
import { MembersManagement } from '@/pages/chat/components/MembersManagement';
import Sidebar from './Sidebar';
import ClawChatUI from './ClawChatUI';
import { AdBanner, AdBannerMobile } from './AdSection';
import { useUserStore } from '@/store/userStore';
import { useIsMobile } from '@/hooks/use-mobile';
import { getAvatarData } from '@/utils/avatar';


// 修改 KaTeXStyle 组件
const KaTeXStyle = () => (
  <style dangerouslySetInnerHTML={{ __html: `
    /* 只在聊天消息内应用 KaTeX 样式 */
    .chat-message .katex-html {
      display: none;
    }
    
    .chat-message .katex {
      font: normal 1.1em KaTeX_Main, Times New Roman, serif;
      line-height: 1.2;
      text-indent: 0;
      white-space: nowrap;
      text-rendering: auto;
    }
    
    .chat-message .katex-display {
      display: block;
      margin: 1em 0;
      text-align: center;
    }
    
    /* 其他必要的 KaTeX 样式 */
    @import "katex/dist/katex.min.css";
  `}} />
);


const ChatUI = () => {
  const userStore = useUserStore();
  const isMobile = useIsMobile();

  //获取url参数
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get('id')? parseInt(urlParams.get('id')!) : 0;
  const joinGroupId = urlParams.get('join');
  // 1. 所有的 useState 声明
  const [groups, setGroups] = useState([]);
  const [selectedGroupIndex, setSelectedGroupIndex] = useState(id);
  const [group, setGroup] = useState(null);
  const [groupAiCharacters, setGroupAiCharacters] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isGroupDiscussionMode, setIsGroupDiscussionMode] = useState(false);
  const [users, setUsers] = useState([]);
  const [allNames, setAllNames] = useState([]);
  const [showMembers, setShowMembers] = useState(false);
  const [messages, setMessages] = useState([]);
  const [showAd, setShowAd] = useState(false);
  const [inputMessage, setInputMessage] = useState("");
  const [pendingContent, setPendingContent] = useState("");
  const [initError, setInitError] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [mutedUsers, setMutedUsers] = useState<string[]>([]);
  const [showPoster, setShowPoster] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false); // 默认关闭，稍后根据设备类型设置

  // 根据设备类型设置侧边栏默认状态
  useEffect(() => {
    if (isMobile !== undefined) {
      setSidebarOpen(!isMobile); // 手机端关闭，PC端开启
    }
  }, [isMobile]);

  // 2. 所有的 useRef 声明
  const currentMessageRef = useRef<number | null>(null);
  const typewriterRef = useRef<NodeJS.Timeout | null>(null);
  const accumulatedContentRef = useRef(""); 
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatAreaRef = useRef<HTMLDivElement>(null);
  const abortController = useRef(new AbortController());

  // 添加一个 ref 来跟踪是否已经初始化
  const isInitialized = useRef(false);

  // 辩论相关 ref
  const MAX_DEBATE_ROUNDS = 6; // 总共辩论轮数（正反方各发言算一轮，即总共6次发言）
  const debateRoundRef = useRef(0);
  const isAutoDebating = useRef(false);

  // 3. 所有的 useEffect
  useEffect(() => {
    // 如果已经初始化过，则直接返回
    if (isInitialized.current) return;

    const initData = async () => {
      try {
        if (joinGroupId) {
          try {
            await request('/api/claw/join', {
              method: 'POST',
              body: JSON.stringify({ groupId: joinGroupId })
            });
          } catch (e) {
            console.error('Failed to join group:', e);
          }
          window.history.replaceState({}, '', '/');
        }

        const response = await request(`/api/init`);
        if (!response.ok) {
          throw new Error('初始化数据失败');
        }
        const {data} = await response.json();
        console.log("初始化数据", data);

        let groupIndex = selectedGroupIndex;
        if (joinGroupId) {
          const idx = data.groups.findIndex((g: any) => g.clawGroupId === joinGroupId || g.id === joinGroupId);
          if (idx >= 0) groupIndex = idx;
        }

        const group = data.groups[groupIndex];
        if (!group) {
          setInitError('群聊不存在或无权访问');
          setIsInitializing(false);
          return;
        }
        const characters = data.characters;
        setGroups(data.groups);
        setGroup(group);
        setIsInitializing(false);
        setIsGroupDiscussionMode(group.isGroupDiscussionMode);
        const groupAiCharacters = characters
          .filter(character => group.members.includes(character.id))
          .filter(character => character.personality !== "sheduler")
          .sort((a, b) => {
            return group.members.indexOf(a.id) - group.members.indexOf(b.id);
          });
        setGroupAiCharacters(groupAiCharacters);
        const allNames = groupAiCharacters.map(character => character.name);
        allNames.push('user');
        let avatar_url = null;
        let nickname = '我';
        setAllNames(allNames);
        if (data.user && data.user != null) {
          const response1 = await request('/api/user/info');
          const userInfo = await response1.json();
          //设置store
          userStore.setUserInfo(userInfo.data);
          avatar_url = userInfo.data.avatar_url;
          nickname = userInfo.data.nickname;
        } else {
          // 设置空的用户信息
          userStore.setUserInfo({
            id: 0,
            phone: '',
            nickname: nickname,
            avatar_url: null,
            status: 0
          });
        }
        setUsers([
          { id: 1, name: nickname, avatar: avatar_url },
          ...groupAiCharacters
        ]);
      } catch (error) {
        console.error("初始化数据失败:", error);
        setInitError('加载失败，请刷新重试');
        setIsInitializing(false);
      }
    };

    initData();
    // 标记为已初始化
    isInitialized.current = true;
  }, [userStore]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (messages.length > 0) {
      setShowAd(false);
    }
  }, [messages]);

  useEffect(() => {
    return () => {
      if (typewriterRef.current) {
        clearInterval(typewriterRef.current);
      }
    };
  }, []);

  // 添加一个新的 useEffect 来监听 userStore.userInfo 的变化
  useEffect(() => {
    if (userStore.userInfo && users.length > 0) {
      setUsers(prev => [
        { id: 1, name: userStore.userInfo.nickname, avatar: userStore.userInfo.avatar_url? userStore.userInfo.avatar_url : null },
        ...prev.slice(1) // 保留其他 AI 角色
      ]);
    }
  }, [userStore.userInfo]); // 当 userInfo 变化时更新 users

  // 4. 工具函数
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleRemoveUser = (userId: number) => {
    setUsers(users.filter(user => user.id !== userId));
  };

  const handleToggleMute = (userId: string) => {
    setMutedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleShareChat = () => {
    setShowPoster(true);
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // 5. 加载检查
  if (initError) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-orange-50 via-orange-50/70 to-orange-100 dark:from-background dark:via-background dark:to-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">🦞</div>
          <p className="text-lg font-medium text-foreground mb-2">{initError}</p>
          <p className="text-sm text-muted-foreground mb-6">请检查链接是否正确，或联系群主获取邀请</p>
          <button
            onClick={() => { window.location.href = '/'; }}
            className="px-6 py-2 bg-[#ff6600] text-white rounded-lg hover:bg-[#e55c00] transition-colors"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  if (isInitializing || !group) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-orange-50 via-orange-50/70 to-orange-100 dark:from-background dark:via-background dark:to-background flex items-center justify-center">
        <div className="w-8 h-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent"></div>
      </div>
    );
  }

  // 核心：发送AI回复并返回最新的历史记录
  const sendAIResponse = async (messageText: string, historyOverride?: any[]) => {
    setIsLoading(true);
    let messageHistory = historyOverride || messages.map(msg => ({
      role: 'user',
      content: msg.sender.name === userStore.userInfo.nickname ? 'user：' + msg.content : msg.sender.name + '：' + msg.content,
      name: msg.sender.name
    }));

    let selectedGroupAiCharacters = groupAiCharacters;

    // 如果不是全员讨论模式，则通过调度器选择发言AI
    if (!isGroupDiscussionMode) {
      const shedulerResponse = await request(`/api/scheduler`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText, history: messageHistory, availableAIs: groupAiCharacters })
      });
      const shedulerData = await shedulerResponse.json();
      const selectedAIs = shedulerData.selectedAIs;
      selectedGroupAiCharacters = selectedAIs.map(ai => groupAiCharacters.find(c => c.id === ai));
    }

    for (let i = 0; i < selectedGroupAiCharacters.length; i++) {
      if (mutedUsers.includes(selectedGroupAiCharacters[i].id)) continue;

      const aiMessage = {
        id: messages.length + i + 1 + Math.random(),
        sender: { id: selectedGroupAiCharacters[i].id, name: selectedGroupAiCharacters[i].name, avatar: selectedGroupAiCharacters[i].avatar },
        content: "",
        isAI: true
      };
      setMessages(prev => [...prev, aiMessage]);

      let completeResponse = '';
      try {
        const response = await request('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: selectedGroupAiCharacters[i].model,
            message: messageText,
            history: messageHistory,
            index: i,
            aiName: selectedGroupAiCharacters[i].name,
            custom_prompt: (selectedGroupAiCharacters[i].custom_prompt || '').replace('#groupName#', group.name) + "\n" + group.description
          })
        });

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let newlineIndex;
          while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, newlineIndex);
            buffer = buffer.slice(newlineIndex + 1);
            if (line.startsWith('data: ')) {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                completeResponse += data.content;
                completeResponse = completeResponse.replace(new RegExp(`^(${allNames.join('|')})：`, 'i'), '');
                setMessages(prev => {
                  const newMessages = [...prev];
                  const idx = newMessages.findIndex(msg => msg.id === aiMessage.id);
                  if (idx !== -1) {
                    newMessages[idx] = { ...newMessages[idx], content: completeResponse };
                  }
                  return newMessages;
                });
              }
            }
          }
        }

        messageHistory.push({
          role: 'user',
          content: selectedGroupAiCharacters[i].name + '：' + completeResponse,
          name: selectedGroupAiCharacters[i].name
        });
      } catch (error) {
        console.error("AI 回复失败:", error);
        messageHistory.push({
          role: 'user',
          content: selectedGroupAiCharacters[i].name + "：对不起，我还不够智能。",
          name: selectedGroupAiCharacters[i].name
        });
        setMessages(prev => prev.map(msg =>
          msg.id === aiMessage.id ? { ...msg, content: "对不起，我还不够智能。" } : msg
        ));
      }
    }
    setIsLoading(false);
    return messageHistory;
  };

  const handleSendMessage = async () => {
    if (isLoading) return;
    if (!inputMessage.trim()) return;

    // 如果是辩论群且用户主动发言，重置轮次
    if (group.id === 'debate_group') {
      debateRoundRef.current = 0;
    }

    // 添加用户消息
    const userMessage = {
      id: messages.length + 1,
      sender: users[0],
      content: inputMessage,
      isAI: false
    };
    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");

    // 发送第一条AI回复，获取新的历史
    let currentHistory = await sendAIResponse(inputMessage);

    // 如果是辩论群，自动继续
    if (group.id === 'debate_group') {
      // 用户发言算第0轮，第一轮AI回复后 debateRoundRef 应设为1，然后循环直到 MAX_DEBATE_ROUNDS - 1（因为还需要再产生 MAX_DEBATE_ROUNDS-1 轮对话）
      let round = 1; // 已经完成了一轮 AI 发言
      while (round < MAX_DEBATE_ROUNDS) {
        // 等待 2 秒，更像真人辩论节奏
        await new Promise(resolve => setTimeout(resolve, 2000));
        currentHistory = await sendAIResponse('请继续辩论', currentHistory);
        round++;
      }
      debateRoundRef.current = MAX_DEBATE_ROUNDS;
    }
  };

  const handleCancel = () => {
    abortController.current.abort();
  };

  // 处理群组选择
  const handleSelectGroup = (index: number) => {
    window.location.href = `?id=${index}`;
    return;
  };

  if (group.type === 'openclaw') {
    return (
      <ClawChatUI
        group={group}
        groups={groups}
        selectedGroupIndex={selectedGroupIndex}
        onSelectGroup={handleSelectGroup}
      />
    );
  }

  return (
    <>
      <KaTeXStyle />
      <div className="fixed inset-0 bg-gradient-to-br from-orange-50 via-orange-50/70 to-orange-100 dark:from-background dark:via-background dark:to-background flex items-start md:items-center justify-center overflow-hidden">
        <div className="h-full flex bg-card w-full mx-auto relative shadow-xl md:max-w-5xl md:h-[96dvh] md:my-auto md:rounded-lg">
          {/* 传递 selectedGroupIndex 和 onSelectGroup 回调给 Sidebar */}
          <Sidebar 
            isOpen={sidebarOpen} 
            toggleSidebar={toggleSidebar} 
            selectedGroupIndex={selectedGroupIndex}
            onSelectGroup={handleSelectGroup}
            groups={groups}
          />
          
          {/* 聊天主界面 */}
          <div className="flex flex-col flex-1">
            {/* Header */}
            <header className="bg-card shadow dark:shadow-none dark:border-b flex-none md:rounded-t-lg">
              <div className="flex items-center justify-between px-0 py-1.5">
                {/* 左侧群组信息 */}
                <div className="flex items-center md:px-2.5">
                  <div 
                    className="md:hidden flex items-center justify-center m-1  cursor-pointer" 
                    onClick={toggleSidebar}
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </div>
                  
                  <h1 className="font-medium text-base -ml-1">{group.name}({users.length})</h1>
                </div>

                
                {/* 右侧头像组和按钮 */}
                <div className="flex items-center">
                {/* 广告位 手机端不展示 */}
                 <div className="hidden md:block">
                   <AdBanner show={showAd} closeAd={() => setShowAd(false)} />
                 </div>
                
                  <div className="flex -space-x-2 ">
                    {users.slice(0, 4).map((user) => {
                      const avatarData = getAvatarData(user.name);
                      return (
                        <TooltipProvider key={user.id}>
                          <Tooltip>
                            <TooltipTrigger>
                              <Avatar className="w-7 h-7 border-2 border-card">
                                {'avatar' in user && user.avatar && user.avatar !== null ? (
                                  <AvatarImage src={user.avatar} />
                                ) : (
                                  <AvatarFallback style={{ backgroundColor: avatarData.backgroundColor, color: 'white' }}>
                                    {avatarData.text}
                                  </AvatarFallback>
                                )}
                              </Avatar>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{user.name}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      );
                    })}
                    {users.length > 4 && (
                      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs border-2 border-card">
                        +{users.length - 4}
                      </div>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setShowMembers(true)}>
                    <Settings2 className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </header>

            {/* Main Chat Area */}
            <div className="flex-1 overflow-hidden bg-muted">

              <ScrollArea className={`h-full ${!showAd ? 'px-2 py-1' : ''} md:px-2 md:py-1`} ref={chatAreaRef}>
                <div className="md:hidden">
                  <AdBannerMobile show={showAd} closeAd={() => setShowAd(false)} />
                </div>
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div key={message.id} 
                      className={`flex items-start gap-2 ${message.sender.name === userStore.userInfo.nickname ? "justify-end" : ""}`}>
                      {message.sender.name !== userStore.userInfo.nickname && (
                        <Avatar>
                          {'avatar' in message.sender && message.sender.avatar ? (
                            <AvatarImage src={message.sender.avatar} className="w-10 h-10" />
                          ) : (
                          <AvatarFallback style={{ backgroundColor: getAvatarData(message.sender.name).backgroundColor, color: 'white' }}>
                            {message.sender.name[0]}
                          </AvatarFallback>
                          )}
                        </Avatar>
                      )}
                      <div className={message.sender.name === userStore.userInfo.nickname ? "text-right" : ""}>
                        <div className="text-sm text-muted-foreground">{message.sender.name}</div>
                        <div className={`mt-1 p-3 rounded-lg shadow-sm chat-message ${
                          message.sender.name === userStore.userInfo.nickname ? "bg-blue-500 text-white text-left" : "bg-card"
                        }`}>
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm, remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                            className={`prose dark:prose-invert max-w-none ${
                              message.sender.name === userStore.userInfo.nickname ? "text-white [&_*]:text-white" : ""
                            }
                            [&_h2]:py-1
                            [&_h2]:m-0
                            [&_h3]:py-1.5
                            [&_h3]:m-0
                            [&_p]:m-0 
                            [&_pre]:bg-gray-900 
                            [&_pre]:p-2
                            [&_pre]:m-0 
                            [&_pre]:rounded-lg
                            [&_pre]:text-gray-100
                            [&_pre]:whitespace-pre-wrap
                            [&_pre]:break-words
                            [&_pre_code]:whitespace-pre-wrap
                            [&_pre_code]:break-words
                            [&_code]:text-sm
                            [&_code]:text-gray-400
                            [&_code:not(:where([class~="language-"]))]:text-pink-500
                            [&_code:not(:where([class~="language-"]))]:bg-transparent
                            [&_a]:text-blue-500
                            [&_a]:no-underline
                            [&_ul]:my-2
                            [&_ol]:my-2
                            [&_li]:my-1
                            [&_blockquote]:border-l-4
                            [&_blockquote]:border-border
                            [&_blockquote]:pl-4
                            [&_blockquote]:my-2
                            [&_blockquote]:italic`}
                          >
                            {message.content}
                          </ReactMarkdown>
                          {message.isAI && isTyping && currentMessageRef.current === message.id && (
                            <span className="typing-indicator ml-1">▋</span>
                          )}
                        </div>
                      </div>
                      {message.sender.name === userStore.userInfo.nickname && (
                        <Avatar>
                         {'avatar' in message.sender && message.sender.avatar ? (
                            <AvatarImage src={message.sender.avatar} className="w-10 h-10" />
                          ) : (
                          <AvatarFallback style={{ backgroundColor: getAvatarData(message.sender.name).backgroundColor, color: 'white' }}>
                            {message.sender.name[0]}
                          </AvatarFallback>
                          )}
                        </Avatar>
                      )}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                  {/* 添加一个二维码 */}
                  <div id="qrcode" className="flex flex-col items-center hidden">
                    <img src="/img/qr.png" alt="QR Code" className="w-24 h-24" />
                    <p className="text-sm text-muted-foreground mt-2 font-medium tracking-tight bg-muted px-3 py-1 rounded-full">扫码体验AI群聊</p>
                  </div>
                </div>
              </ScrollArea>
            </div>

            {/* Input Area */}
            <div className="bg-card border-t py-3 px-2 md:rounded-b-lg">
              <div className="flex gap-1 pb-[env(safe-area-inset-bottom)]">
                {messages.length > 0 && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline"
                          size="icon"
                          onClick={handleShareChat}
                          className="px-3"
                        >
                          <Share2 className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>分享聊天记录</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                <Input 
                  placeholder="输入消息..." 
                  className="flex-1"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <Button 
                  onClick={handleSendMessage}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Members Management Dialog */}
        <MembersManagement 
          showMembers={showMembers}
          setShowMembers={setShowMembers}
          users={users}
          mutedUsers={mutedUsers}
          handleToggleMute={handleToggleMute}
          isGroupDiscussionMode={isGroupDiscussionMode}
          onToggleGroupDiscussion={() => setIsGroupDiscussionMode(!isGroupDiscussionMode)}
          getAvatarData={getAvatarData}
        />
      </div>

      {/* 添加 SharePoster 组件 */}
      <SharePoster 
        isOpen={showPoster}
        onClose={() => setShowPoster(false)}
        chatAreaRef={chatAreaRef}
      />
    </>
  );
};

export default ChatUI;
