import config from '../../config';
import questionData from './questions';

Page({
  data: {
    randomQuestions: [],
    inputMessage: '',
    allQuestions: [],
    analyzing: false,
    recentChats: []
  },

  onLoad: function() {
    const app = getApp();
    this.setData({
      allQuestions: app.globalData.questions
    }, () => {
      this.refreshQuestions();
    });
    
    this.loadRecentChats();
  },

  onShow: function() {
    // 从本地存储获取之前的输入信息
    const savedMessage = wx.getStorageSync('inputMessage') || '';
    if (savedMessage !== this.data.inputMessage) {
      this.setData({
        inputMessage: savedMessage
      });
    }
    this.loadRecentChats();
  },

  refreshQuestions: function() {
    const questions = this.data.allQuestions;
    
    if (!questions || !questions.length) {
      console.error('问题数据为空');
      return;
    }
    
    // 随机选择3个问题
    let indices = Array.from({length: questions.length}, (_, i) => i);
    
    // Fisher-Yates 洗牌算法
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    
    const randomQuestions = indices
      .slice(0, 3)
      .map(index => questions[index]);
    
    this.setData({
      randomQuestions: randomQuestions
    });
  },

  onQuestionTap: function(e) {
    const question = e.currentTarget.dataset.question;
    // 保存当前输入框的内容
    wx.setStorageSync('inputMessage', this.data.inputMessage);
    wx.navigateTo({
      url: '/pages/chat/chat',
      success: function(res) {
        res.eventChannel.emit('acceptDataFromOpenerPage', { 
          message: question,
          type: 'prompt',
          sessionId: `session_${Date.now()}` // 添加sessionId
        });
      },
      fail: function(err) {
        console.error('页面跳转失败:', err);
        wx.showToast({
          title: '页面跳转失败',
          icon: 'none'
        });
      }
    });
  },

  onInputChange: function(e) {
    const value = e.detail.value;
    this.setData({
      inputMessage: value
    });
    // 实时保存输入内容到本地存储
    wx.setStorageSync('inputMessage', value);
  },

  sendMessage: function() {
    if (!this.data.inputMessage.trim()) {
      return;
    }

    const message = this.data.inputMessage;
    const sessionId = `session_${Date.now()}`;
    
    // 更新最近对话列表
    const sessionInfo = {
      sessionId: sessionId,
      lastMessage: message,
      time: new Date().toLocaleTimeString()
    };
    
    let recentChats = wx.getStorageSync('recentChats') || [];
    recentChats.unshift(sessionInfo);
    wx.setStorageSync('recentChats', recentChats);
    
    // 清空输入框
    this.setData({
      inputMessage: ''
    });
    
    // 跳转到聊天页面，并传递消息类型为 'stream'
    wx.navigateTo({
      url: `/pages/chat/chat`,
      success: function(res) {
        if (res.eventChannel) {
          res.eventChannel.emit('acceptDataFromOpenerPage', {
            message: message,
            sessionId: sessionId,
            type: 'stream'  // 标记为流式输出类型
          });
        }
      },
      fail: function(err) {
        console.error('页面跳转失败:', err);
        wx.showToast({
          title: '页面跳转失败',
          icon: 'none'
        });
        // 恢复输入框内容
        this.setData({
          inputMessage: message
        });
      }.bind(this)
    });
  },

  goToFaceAnalysis: function() {
    const that = this;
    that.setData({ analyzing: true });

    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['camera', 'album'],
      success(res) {
        const tempFilePath = res.tempFilePaths[0];
        console.log('选择图片成功:', tempFilePath);
        
        wx.uploadFile({
          url: `${config.apiUrl}/chat`,
          filePath: tempFilePath,
          name: 'image',
          timeout: 300000,  // 增加到5分钟
          success(res) {
            console.log('服务器响应:', res.data);
            try {
              const data = JSON.parse(res.data);
              if (data.success) {
                // 保存会话ID和最后一条消息
                const sessionInfo = {
                  sessionId: data.sessionId,
                  lastMessage: '面部分析结果',
                  time: new Date().toLocaleTimeString(),
                  type: 'image'  // 添加类型标识
                };
                
                // 更新最近对话列表
                let recentChats = wx.getStorageSync('recentChats') || [];
                recentChats.unshift(sessionInfo);
                wx.setStorageSync('recentChats', recentChats);
                
                // 跳转到聊天页面
                wx.navigateTo({
                  url: `/pages/chat/chat`,
                  success: function(res) {
                    // 传递消息数据到新页面，使用统一的 'image' 类型
                    res.eventChannel.emit('acceptDataFromOpenerPage', {
                      message: data.message,
                      sessionId: data.sessionId,
                      type: 'image'  // 统一使用 'image' 类型
                    });
                  }
                });
              } else {
                wx.showToast({
                  title: data.error || '分析失败',
                  icon: 'none'
                });
              }
            } catch (error) {
              console.error('解析响应数据失败:', error);
              wx.showToast({
                title: '服务器响应格式错误',
                icon: 'none'
              });
            }
          },
          fail(error) {
            console.error('上传失败:', error);
            wx.showToast({
              title: '上传失败，请检查网络连接',
              icon: 'none'
            });
          },
          complete() {
            that.setData({ analyzing: false });
          }
        });
      },
      fail(error) {
        console.error('选择图片失败:', error);
        that.setData({ analyzing: false });
        wx.showToast({
          title: '选择图片失败',
          icon: 'none'
        });
      }
    });
  },

  // 可选：在页面卸载时清除存储的信息
  onUnload: function() {
    wx.removeStorageSync('inputMessage');
  },

  loadRecentChats: function() {
    // 从本地存储获取聊天记录
    const allChats = wx.getStorageSync('recentChats') || [];
    // 只取最近的三条记录
    const recentThreeChats = allChats.slice(0, 3);
    console.log('加载最近三条聊天记录:', recentThreeChats);
    
    this.setData({
      recentChats: recentThreeChats
    });
  },

  onChatTap: function(e) {
    const sessionId = e.currentTarget.dataset.sessionId;
    const lastMessage = e.currentTarget.dataset.lastMessage;
    
    wx.navigateTo({
      url: `/pages/chat/chat`,  // 移除URL参数
      success: function(res) {
        // 确保事件通道存在
        if (res.eventChannel) {
          res.eventChannel.emit('acceptDataFromOpenerPage', { 
            sessionId: sessionId, 
            message: lastMessage, 
            isHistoryChat: true 
          });
        }
      },
      fail: function(err) {
        console.error('页面跳转失败:', err);
        wx.showToast({
          title: '无法打开聊天记录',
          icon: 'none'
        });
      }
    });
  },

  startChat: function(e) {
    wx.navigateTo({
      url: '/pages/chat/chat',
      success: function(res) {
        // 确保事件通道存在
        if (res.eventChannel) {
          res.eventChannel.emit('acceptDataFromOpenerPage', {
            message: '欢迎使用AI助手，请问有什么可以帮您？',
            isHistoryChat: true,
            sessionId: `session_${Date.now()}` // 添加sessionId
          });
        }
      },
      fail: function(err) {
        console.error('页面跳转失败:', err);
        wx.showToast({
          title: '无法开始新对话',
          icon: 'none'
        });
      }
    });
  }
});