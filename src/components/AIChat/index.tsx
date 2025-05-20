import React, { useState, useRef, useEffect } from 'react';
import { useMutation, gql } from '@apollo/client';
import { codeReviewService } from '../../services/codeReviewService';
import ReactMarkdown from 'react-markdown';
import './index.css';

// 聊天模式类型
type ChatMode = 'chat' | 'code-review';

// 消息接口
interface Message {
  role: 'user' | 'assistant';
  content: string;
  type?: 'chat' | 'code-review';
  metadata?: {
    messageId?: string;
    staticAnalysis?: Array<{
      type: string;
      category: string;
      severity: string;
      message: string;
      line: number;
    }>;
    metrics?: {
      linesOfCode: number;
      cyclomaticComplexity: number;
      cognitiveComplexity: number;
      duplicatedLines: number;
      codeSmells: number;
    };
    summary?: {
      totalIssues: number;
      criticalIssues: number;
      majorIssues: number;
      minorIssues: number;
      score: number;
    };
  };
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
  const [chatMode, setChatMode] = useState<ChatMode>('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 执行 GraphQL 变更的钩子
  const [chatWithAI] = useMutation<ChatWithAIData, ChatWithAIVariables>(CHAT_WITH_AI);

  // 自动滚动到最新消息
  const scrollToBottom = (): void => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 监听消息变化，自动滚动
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 初始化欢迎消息
  useEffect(() => {
    switchMode('chat');
  }, []);

  // 处理聊天消息 - 聊天模式
  const handleChatMessage = async (userMessage: Message): Promise<void> => {
    try {
      const { data } = await chatWithAI({
        variables: {
          message: userMessage.content,
          conversationId
        }
      });

      if (data && data.chatWithAI) {
        const aiMessages = data.chatWithAI.messages.filter(msg => msg.role === 'assistant');
        if (aiMessages.length > 0) {
          setMessages(prev => [...prev, ...aiMessages.map(msg => ({ ...msg, type: 'chat' as const }))]);
        }

        if (data.chatWithAI.conversationId) {
          setConversationId(data.chatWithAI.conversationId);
        }
      }
    } catch (err) {
      console.error('Error sending chat message:', err);
      const errorMessage = err instanceof Error ? err.message : '未知错误';
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `发生错误: ${errorMessage}`, type: 'chat' }
      ]);
    }
  };

  // 处理代码审查
  const handleCodeReview = async (userMessage: Message): Promise<void> => {
    try {
      // 发送代码审查请求
      const result = await codeReviewService.reviewCode(userMessage.content);

      if (result.success && result.review) {
        // 创建代码审查消息
        const reviewMessage: Message = {
          role: 'assistant',
          content: result.review,
          type: 'code-review',
          metadata: {
            messageId: result.meta?.messageId,
            staticAnalysis: result.staticAnalysis,
            metrics: result.metrics,
            summary: result.summary
          }
        };
        setMessages(prev => [...prev, reviewMessage]);
      } else {
        throw new Error(result.error || '代码审查失败');
      }
    } catch (err) {
      console.error('Error reviewing code:', err);
      const errorMessage = err instanceof Error ? err.message : '代码审查失败';
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `代码审查错误: ${errorMessage}`, type: 'code-review' }
      ]);
    }
  };

  // 处理发送消息
  const handleSendMessage = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();

    if (!input.trim()) return;

    // 显示用户消息
    const userMessage: Message = {
      role: 'user',
      content: input,
      type: chatMode
    };
    setMessages(prev => [...prev, userMessage]);

    // 清空输入框并显示加载状态
    setInput('');
    setIsLoading(true);

    try {
      if (chatMode === 'chat') {
        await handleChatMessage(userMessage);
      } else {
        await handleCodeReview(userMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 切换聊天模式
  const switchMode = (mode: ChatMode): void => {
    setChatMode(mode);
    // 清空消息历史并显示对应的欢迎消息
    const welcomeMessage = mode === 'chat'
      ? '你好！我是 小胖砸，有什么我可以帮助你的吗？'
      : '你好！我是代码审查助手。请粘贴您的代码，我将为您提供详细的审查报告。';

    setMessages([{
      role: 'assistant',
      content: welcomeMessage,
      type: mode
    }]);
    setConversationId(null);
  };

  // 渲染消息内容
  const renderMessageContent = (msg: Message): React.ReactNode => {
    if (msg.type === 'code-review' && msg.role === 'assistant' && msg.metadata) {
      return (
        <div className="code-review-response">
          <div className="message-content markdown-content">
            <ReactMarkdown>{msg.content}</ReactMarkdown>
          </div>
          {msg.metadata.summary && (
            <div className="review-summary">
              <h4>📊 审查摘要</h4>
              <div className="summary-stats">
                <span className="stat score-stat">评分: {msg.metadata.summary.score}/100</span>
                {msg.metadata.summary.criticalIssues > 0 && (
                  <span className="stat critical-stat">严重问题: {msg.metadata.summary.criticalIssues}</span>
                )}
                {msg.metadata.summary.majorIssues > 0 && (
                  <span className="stat warning-stat">警告: {msg.metadata.summary.majorIssues}</span>
                )}
                {msg.metadata.summary.minorIssues > 0 && (
                  <span className="stat info-stat">建议: {msg.metadata.summary.minorIssues}</span>
                )}
              </div>
            </div>
          )}
          {msg.metadata.messageId && (
            <div className="review-metadata">
              <span className="metadata-tag">消息ID: {msg.metadata.messageId.substring(0, 8)}...</span>
            </div>
          )}
        </div>
      );
    }

    // 对所有其他消息使用Markdown渲染
    return (
      <div className="message-content markdown-content">
        <ReactMarkdown>{msg.content}</ReactMarkdown>
      </div>
    );
  };

  return (
    <div className="ai-chat-container">
      <div className="chat-header">
        <h2>{chatMode === 'chat' ? '小胖AI的聊天界面' : '代码审查助手'}</h2>
        <div className="mode-toggle">
          <button
            className={`mode-button ${chatMode === 'chat' ? 'active' : ''}`}
            onClick={() => switchMode('chat')}
          >
            💬 聊天模式
          </button>
          <button
            className={`mode-button ${chatMode === 'code-review' ? 'active' : ''}`}
            onClick={() => switchMode('code-review')}
          >
            🔍 代码审查
          </button>
        </div>
      </div>

      {chatMode === 'code-review' && (
        <div className="code-review-info">
          <div className="info-message">
            <p>请将您的代码粘贴到下方输入框中，我将为您提供详细的代码审查报告。</p>
          </div>
        </div>
      )}

      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="empty-state">
            {chatMode === 'chat' ? '开始与 小胖砸聊天...' : '提交代码进行审查...'}
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={index}
              className={`message ${msg.role === 'user' ? 'user-message' : 'ai-message'} ${msg.type === 'code-review' ? 'code-review-message' : ''}`}
            >
              <div className="message-avatar">
                {msg.role === 'user'
                  ? '👤'
                  : (msg.type === 'code-review' ? '🔍' : '🤖')
                }
              </div>
              <div className="message-bubble">
                {renderMessageContent(msg)}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="message ai-message">
            <div className="message-avatar">
              {chatMode === 'code-review' ? '🔍' : '🤖'}
            </div>
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
        <textarea
          value={input}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value)}
          placeholder={chatMode === 'chat' ? '输入您的消息...' : '粘贴您的代码进行审查...'}
          disabled={isLoading}
          className={`input-field ${chatMode === 'code-review' ? 'code-input' : ''}`}
          rows={chatMode === 'code-review' ? 4 : 1}
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