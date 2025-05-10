import React from 'react';
import { ApolloProvider } from '@apollo/client';
import { client } from './apollo/client';
import AIChat from './components/AIChat';
import './App.css';

const App: React.FC = () => {
  return (
    <ApolloProvider client={client}>
      <div className="app">
        <header className="app-header">
          <h1>小胖AI</h1>
        </header>

        <main className="app-main">
          <AIChat />
        </main>

        <footer className="app-footer">
          <p>© {new Date().getFullYear()} 小胖AI - 王小胖+deepseek = 嘎嘎乱杀</p>
        </footer>
      </div>
    </ApolloProvider>
  );
}

export default App;