const config = {
  development: {
    apiUrl: 'http://localhost:5000',
    wsUrl: 'ws://localhost:5000'
  },
  production: {
    apiUrl: 'http://8.152.213.187',
    wsUrl: 'ws://8.152.213.187'
  }
};

// 设置当前环境
const currentEnv = 'development';  // 确保使用开发环境

export default {
  apiUrl: config[currentEnv].apiUrl,
  wsUrl: config[currentEnv].wsUrl
}; 