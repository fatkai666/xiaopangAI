// 定义代码审查相关的类型
export interface CodeIssue {
  type: 'error' | 'warning' | 'info' | 'style';
  category: 'security' | 'performance' | 'maintainability' | 'reliability' | 'style';
  severity: 'critical' | 'major' | 'minor' | 'info';
  line: number;
  column?: number;
  message: string;
  rule: string;
  suggestion: string;
  example?: string;
}

export interface CodeMetrics {
  linesOfCode: number;
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  duplicatedLines: number;
  codeSmells: number;
}

export interface ReviewSummary {
  totalIssues: number;
  criticalIssues: number;
  majorIssues: number;
  minorIssues: number;
  score: number;
}

// 代码审查请求结构
export interface CodeReviewRequest {
  messages: {
    role: 'user' | 'assistant' | 'system';
    content: string;
  }[];
  runId: string;
  maxRetries?: number;
  maxSteps?: number;
  temperature?: number;
  topP?: number;
  runtimeContext?: Record<string, unknown>;
}

// 代码审查响应结构
export interface CodeReviewResponse {
  success: boolean;
  review?: string;
  staticAnalysis?: CodeIssue[];
  metrics?: CodeMetrics;
  summary?: ReviewSummary;
  error?: string;
  meta?: {
    messageId?: string;
    processedAt: string;
    fromCache?: boolean;
  };
}

// 代码审查服务类
export class CodeReviewService {
  private baseUrl: string;
  
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }
  
  // 发送代码审查请求并处理响应
  async reviewCode(code: string): Promise<CodeReviewResponse> {
    try {
      // 构建请求体
      const requestPayload: CodeReviewRequest = {
        messages: [
          {
            role: 'user',
            content: code
          }
        ],
        runId: "codeReviewAgent",
        maxRetries: 2,
        maxSteps: 5,
        temperature: 0.5,
        topP: 1,
        runtimeContext: {}
      };
      
      console.log('Sending code review request:', {
        codeLength: code.length,
        runId: requestPayload.runId
      });
      
      // 发送请求
      const response = await fetch(`${this.baseUrl}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      // 获取原始文本响应，不尝试解析JSON
      const rawText = await response.text();
      console.log('Raw response received, length:', rawText.length);
      
      // 提取消息ID
      let messageId = '';
      const messageIdMatch = rawText.match(/f:\s*{\s*"messageId"\s*:\s*"([^"]+)"/);
      if (messageIdMatch && messageIdMatch[1]) {
        messageId = messageIdMatch[1];
        console.log('Extracted messageId:', messageId);
      }
      
      // 提取所有内容块
      let content = '';
      
      // 使用正则表达式匹配所有0:"XXX"格式的内容
      const contentMatches = rawText.matchAll(/\d+:"([^"]*)"/g);
      
      // 将所有内容拼接起来
      for (const match of contentMatches) {
        if (match[1]) {
          content += match[1];
        }
      }
      
      // 从内容中提取评分
      let score = 100; // 默认值
      
      // 尝试提取"Overall Score: X/10"格式的评分
      const overallScoreMatch = content.match(/Overall Score:\s*(\d+)\/10/i);
      if (overallScoreMatch && overallScoreMatch[1]) {
        // 将1-10分转换为10-100分
        score = parseInt(overallScoreMatch[1]) * 10;
        console.log('Extracted score:', score);
      }
      
      // 提取问题数量
      let criticalIssues = 0;
      let majorIssues = 0;
      const minorIssues = 0;
      
      // 尝试匹配问题数量
      const criticalMatch = content.match(/🔴\s*Critical\s*Issues.*?(\d+)/s);
      if (criticalMatch && criticalMatch[1]) {
        criticalIssues = parseInt(criticalMatch[1]);
      } else {
        // 尝试计算破折号或项目符号的数量
        const criticalSection = content.match(/Critical\s*Issues.*?:(.*?)(?:-\s*🟡|\n\n)/s);
        if (criticalSection && criticalSection[1]) {
          criticalIssues = (criticalSection[1].match(/-/g) || []).length;
        }
      }
      
      const warningMatch = content.match(/🟡\s*Warnings.*?(\d+)/s);
      if (warningMatch && warningMatch[1]) {
        majorIssues = parseInt(warningMatch[1]);
      } else {
        const warningSection = content.match(/Warnings.*?:(.*?)(?:-\s*🟢|\n\n)/s);
        if (warningSection && warningSection[1]) {
          majorIssues = (warningSection[1].match(/-/g) || []).length;
        }
      }
      
      // 计算总问题数
      const totalIssues = criticalIssues + majorIssues + minorIssues;
      
      // 构造返回结果
      const result: CodeReviewResponse = {
        success: true,
        review: content,
        staticAnalysis: [], // 没有静态分析结果
        metrics: this.generateDefaultMetrics(code),
        summary: {
          totalIssues,
          criticalIssues,
          majorIssues,
          minorIssues,
          score
        },
        meta: {
          messageId,
          processedAt: new Date().toISOString()
        }
      };
      
      console.log('Code review result processed, content length:', content.length);
      console.log('Summary:', result.summary);
      return result;
    } catch (error) {
      console.error('Code review API error:', error);
      throw new Error(
        error instanceof Error 
          ? `代码审查失败: ${error.message}` 
          : '代码审查失败: 未知错误'
      );
    }
  }
  
  // 生成默认指标
  private generateDefaultMetrics(code: string): CodeMetrics {
    const lines = code.split('\n');
    return {
      linesOfCode: lines.length,
      cyclomaticComplexity: Math.min(10, Math.ceil(lines.length / 50)),
      cognitiveComplexity: Math.min(15, Math.ceil(lines.length / 40)),
      duplicatedLines: 0,
      codeSmells: 0
    };
  }
  
  // 健康检查
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch (error) {
      console.error('Health check error:', error);
      return false;
    }
  }
}

// 创建并导出代码审查服务实例
export const codeReviewService = new CodeReviewService('https://code-review-agent-production.wangwenkai918.workers.dev/api/agents/codeReviewAgent/stream');