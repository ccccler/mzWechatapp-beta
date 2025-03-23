App({
  onLaunch: function() {
    // 从本地存储加载历史对话记录
    const chatHistory = wx.getStorageSync('recentChats') || [];
    this.globalData.recentChats = chatHistory;
  },
  
  globalData: {
    pendingMessage: null,
    recentChats: [], 
    maxRecentChats: 3
  },
  
  // 添加新的对话记录
  addRecentChat: function(chat) {
    let recentChats = this.globalData.recentChats;
    
    // 检查是否已存在相同sessionId的对话
    const existingIndex = recentChats.findIndex(item => item.sessionId === chat.sessionId);
    if (existingIndex !== -1) {
      // 如果存在，更新该对话
      recentChats[existingIndex] = chat;
    } else {
      // 如果不存在，添加新对话
      recentChats.unshift(chat);
      // 保持最多3条记录
      if (recentChats.length > this.globalData.maxRecentChats) {
        recentChats = recentChats.slice(0, this.globalData.maxRecentChats);
      }
    }
    
    this.globalData.recentChats = recentChats;
    // 保存到本地存储
    wx.setStorageSync('recentChats', recentChats);
  }
});