import { 
  ApolloClient, 
  InMemoryCache, 
  HttpLink, 
  ApolloLink, 
  from 
} from '@apollo/client';
import type { NormalizedCacheObject } from '@apollo/client';
import { onError } from '@apollo/client/link/error';
import { RetryLink } from '@apollo/client/link/retry';

// 错误处理链接
const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path }) => {
      console.error(
        `[GraphQL error]: Message: ${message}, Location: ${JSON.stringify(locations)}, Path: ${path?.join('.')}`
      );
    });
  }
  
  if (networkError) {
    console.error(`[Network error]: ${networkError.message}`, networkError);
    console.log('Request:', operation.variables);
    
    // 用于调试 CORS 问题
    if (networkError.message.includes('CORS')) {
      console.warn('CORS issue detected. Check CORS configuration on the server.');
    }
  }
  
  // 在开发模式下显示详细错误
  if (process.env.NODE_ENV === 'development') {
    console.log('Operation:', operation.operationName);
    console.log('Variables:', operation.variables);
  }
});

// 请求中间件链接，用于调试请求
const requestMiddleware = new ApolloLink((operation, forward) => {
  // 记录请求信息
  console.log(`GraphQL Request: ${operation.operationName}`, {
    variables: operation.variables
  });
  
  // 添加自定义头以避免 CORS 预检问题
  operation.setContext(({ headers = {} }) => ({
    headers: {
      ...headers,
      'Apollo-Require-Preflight': 'true', // 一些 Apollo 客户端版本需要
      'Content-Type': 'application/json',
    }
  }));
  
  return forward(operation).map(response => {
    // 记录响应信息
    console.log(`GraphQL Response for: ${operation.operationName}`, {
      data: response.data,
      errors: response.errors
    });
    return response;
  });
});

// 重试链接配置
const retryLink = new RetryLink({
  delay: {
    initial: 300,
    max: 3000,
    jitter: true,
  },
  attempts: {
    max: 3,
    retryIf: (error) => {
      // 只重试服务器错误或网络错误，不重试客户端错误
      const statusCode = error?.statusCode ?? 0;
      console.log('Retry decision for error:', error);
      return !!error && (statusCode >= 500 || statusCode === 0);
    },
  },
});

// HTTP 链接 - 使用您的真实 Worker URL
const httpLink = new HttpLink({
  uri: 'https://deepseek-graphql-worker.wangwenkai918.workers.dev/',
  credentials: 'same-origin', // 尝试 'same-origin' 或 'omit' 如果有问题
  headers: {
    'Content-Type': 'application/json',
  },
  fetchOptions: {
    mode: 'cors',
  }
});

// 创建 Apollo Client
export const client: ApolloClient<NormalizedCacheObject> = new ApolloClient({
  link: from([errorLink, requestMiddleware, retryLink, httpLink]),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'no-cache',
    },
    query: {
      fetchPolicy: 'no-cache',
    },
    mutate: {
      fetchPolicy: 'no-cache',
      errorPolicy: 'all', // 返回错误和数据（如果有）
    },
  },
  connectToDevTools: true, // 总是启用 DevTools 连接以便调试
});