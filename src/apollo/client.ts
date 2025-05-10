import { 
  ApolloClient, 
  InMemoryCache, 
  HttpLink, 
  from
} from '@apollo/client';
import type { NormalizedCacheObject } from '@apollo/client';
import { onError } from '@apollo/client/link/error';
import { RetryLink } from '@apollo/client/link/retry';

// 错误处理链接
const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path }) => 
      console.error(
        `[GraphQL error]: Message: ${message}, Location: ${JSON.stringify(locations)}, Path: ${path?.join('.')}`
      )
    );
  }
  if (networkError) {
    console.error(`[Network error]: ${networkError.message}`);
  }
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
      return !!error && (statusCode >= 500 || statusCode === 0);
    },
  },
});

const httpLink = new HttpLink({
  // Worker URL
  uri: 'https://ai-chat-graphql-worker.your-subdomain.workers.dev',
});

// 创建 Apollo Client
export const client: ApolloClient<NormalizedCacheObject> = new ApolloClient({
  link: from([errorLink, retryLink, httpLink]),
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
    },
  },
  connectToDevTools: process.env.NODE_ENV === 'development',
});