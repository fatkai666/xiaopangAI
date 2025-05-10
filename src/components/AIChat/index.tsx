import React, { useState, useRef, useEffect } from 'react';
import { useMutation, gql } from '@apollo/client';
import './index.css';

// 定义 TypeScript 接口
interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatResponse {
  messages: Message[];
  conversationId?: string | null;
}

interface ChatWithAIData {
  chatWithAI: ChatResponse;
}

interface ChatWithAIVariables {
  message: string;
  conversationId?: string | null;
}

// GraphQL 变更操作定义
const CHAT_WITH_AI = gql`
  mutation ChatWithAI($message: String!, $conversationId: String) {
    chatWithAI(message: $message, conversationId: $conversationId) {
      messages {
        role
        content
      }
      conversationId
    }
  }
`;

const AIChat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 执行 GraphQL 变更的钩子
  const [chatWithAI] = useMutation<ChatWithAIData, ChatWithAIVariables>(CHAT_WITH_AI);

  // 自动滚动到最新消息
  const scrollToBottom = (): void => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 处理发送消息
  const handleSendMessage = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();

    if (!input.trim()) return;

    // 显示用户消息
    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);

    // 清空输入框并显示加载状态
    setInput('');
    setIsLoading(true);

    try {
      // 调用 GraphQL 变更
      const { data } = await chatWithAI({
        variables: {
          message: userMessage.content,
          conversationId
        }
      });

      // 更新消息和会话 ID
      if (data && data.chatWithAI) {
        // 只添加 AI 的回复消息
        const aiMessages = data.chatWithAI.messages.filter(msg => msg.role === 'assistant');
        if (aiMessages.length > 0) {
          setMessages(prev => [...prev, ...aiMessages]);
        }

        // 更新会话 ID
        if (data.chatWithAI.conversationId) {
          setConversationId(data.chatWithAI.conversationId);
        }
      }
    } catch (err) {
      console.error('Error sending message:', err);
      // 显示错误消息
      const errorMessage: string = err instanceof Error
        ? err.message
        : '未知错误';

      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `发生错误: ${errorMessage}` }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // 显示欢迎消息
  useEffect(() => {
    setMessages([
      {
        role: 'assistant',
        content: '你好！我是 小胖砸，有什么我可以帮助你的吗？'
      }
    ]);
  }, []);

  return (
    <div className="ai-chat-container">
      <div className="chat-header">
        <h2>小胖AI的聊天界面</h2>
      </div>

      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="empty-state">
            开始与 小胖砸聊天...
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={index}
              className={`message ${msg.role === 'user' ? 'user-message' : 'ai-message'}`}
            >
              <div className="message-avatar">
                {msg.role === 'user' ? '👤' : '🤖'}
              </div>
              <div className="message-bubble">
                <div className="message-content">{msg.content}</div>
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="message ai-message">
            <div className="message-avatar">🤖</div>
            <div className="message-bubble">
              <div className="loading-indicator">
                <span className="dot"></span>
                <span className="dot"></span>
                <span className="dot"></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="input-form" onSubmit={handleSendMessage}>
        <input
          type="text"
          value={input}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
          placeholder="输入您的消息..."
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className={input.trim() ? 'active' : ''}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </form>
    </div>
  );
};

export default AIChat;