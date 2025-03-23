const app = getApp();
import config from '../../config';

Page({
  data: {
    messageList: [],
    inputMessage: '',
    loading: false,
    scrollToMessage: '',
    sessionId: '',
    backgroundImage: '/mzWechatapp-beta/images/chat-bg.jpg',
    analyzing: false,
    messages: [],
    currentMessage: ''
  },

  onLoad: function(options) {
    const that = this;
    console.log('chat页面加载');
    
    try {
      // 获取事件通道
      const eventChannel = this.getOpenerEventChannel();
      
      // 检查eventChannel是否存在
      if (eventChannel && typeof eventChannel.on === 'function') {
        eventChannel.on('acceptDataFromOpenerPage', (data) => {
          if (data.type === 'stream') {
            this.handleStreamMessage(data);
          } else {
            // 处理其他类型的消息
            this.handleNormalMessage(data);
          }
        });
      } else {
        // 如果没有事件通道，设置默认的sessionId
        that.setData({
          sessionId: `session_${Date.now()}`
        });
      }
    } catch (error) {
      console.log('初始化事件通道失败:', error);
      // 设置默认的sessionId
      that.setData({
        sessionId: `session_${Date.now()}`
      });
    }
  },

  onShow: function() {
    const savedMessage = wx.getStorageSync('chatInputMessage') || '';
    if (savedMessage !== this.data.inputMessage) {
      this.setData({
        inputMessage: savedMessage
      });
    }
  },

  onInputChange: function(e) {
    const value = e.detail.value;
    this.setData({
      inputMessage: value
    });
    wx.setStorageSync('chatInputMessage', value);
  },

  sendMessage: function() {
    const { inputMessage } = this.data;
    if (!inputMessage.trim()) return;

    // 添加用户消息
    const userMessage = {
      type: 'user',
      content: inputMessage
    };

    this.setData({
      messageList: [...this.data.messageList, userMessage],
      inputMessage: '',
      loading: true
    });

    // 发送到服务器
    wx.request({
      url: 'http://127.0.0.1:5000/chat',  // 使用您的服务器IP
      method: 'POST',
      header: {
        'content-type': 'application/json',
        'Accept': 'application/json'
      },
      data: {
        question: userMessage.content,
        sessionId: this.data.sessionId
      },
      timeout: 600000,  // 增加到10分钟
      success: (res) => {
        console.log('请求成功:', res)
        if (!res.data) {
          console.error('响应数据为空');
          return;
        }
        
        let responseText = '';
        if (typeof res.data === 'string') {
          responseText = res.data;
        } else if (res.data.message) {
          responseText = res.data.message;
        } else {
          console.error('无效的响应格式:', res.data);
          return;
        }
        
        // 创建一个新的AI消息对象
        const newMessage = {
          type: 'assistant',
          content: '',  // 初始为空
          fullContent: responseText
        };
        
        this.setData({
          messageList: [...this.data.messageList, newMessage],
          loading: false
        }, () => {
          // 开始逐字显示
          this.typeMessage(this.data.messageList.length - 1, responseText);
        });
      },
      fail: (err) => {
        console.error('请求失败:', err)
        this.setData({ loading: false });
        wx.showToast({
          title: '请求超时，请稍后重试',
          icon: 'none',
          duration: 3000  // 提示显示3秒
        });
      }
    });
  },

  // 发送消息到服务器的统一方法
  sendToServer: function(message) {
    const that = this;
    console.log('发送消息到服务器:', message);
    
    wx.request({
      url: 'http://8.152.213.187/chat',  // 使用您的服务器IP
      method: 'POST',
      header: {
        'content-type': 'application/json',
        'Accept': 'application/json'
      },
      data: {
        question: message,
        sessionId: that.data.sessionId
      },
      timeout: 600000,  // 增加到10分钟
      success: function(res) {
        console.log('服务器响应:', res.data);  // 添加日志查看响应数据结构
        
        // 处理响应数据
        let responseText = '';
        if (typeof res.data === 'string') {
          responseText = res.data;
        } else if (res.data.message) {
          responseText = res.data.message;
        } else {
          responseText = JSON.stringify(res.data);  // 如果是其他格式，转换为字符串
        }
        
        // 添加AI回复消息
        that.setData({
          messageList: [...that.data.messageList, {
            type: 'assistant',
            content: responseText  // 使用处理后的响应文本
          }],
          loading: false
        });
        
        // 更新最近对话记录
        let recentChats = wx.getStorageSync('recentChats') || [];
        const sessionInfo = {
          sessionId: that.data.sessionId,
          lastMessage: message,
          time: new Date().toLocaleTimeString()
        };
        
        // 检查是否已存在相同sessionId的记录
        const existingIndex = recentChats.findIndex(chat => chat.sessionId === that.data.sessionId);
        if (existingIndex !== -1) {
          recentChats[existingIndex] = sessionInfo;
        } else {
          recentChats.unshift(sessionInfo);
        }
        
        wx.setStorageSync('recentChats', recentChats);
        
        // 滚动到底部
        that.scrollToBottom();
      },
      fail: function(error) {
        console.error('请求失败:', error);
        wx.showToast({
          title: '请求超时，请稍后重试',
          icon: 'none',
          duration: 3000
        });
        that.setData({ loading: false });
      }
    });
  },

  scrollToBottom: function() {
    const query = wx.createSelectorQuery();
    query.select('#chatScroll').boundingClientRect();
    query.selectViewport().scrollOffset();
    query.exec(function(res) {
      if (res[0] && res[1]) {
        wx.pageScrollTo({
          scrollTop: res[0].bottom,
          duration: 300
        });
      }
    });
  },

  onInputFocus: function() {
    this.scrollToBottom();
  },

  onInputBlur: function() {
    wx.setStorageSync('chatInputMessage', this.data.inputMessage);
  },

  onInputConfirm: function(e) {
    this.sendMessage();
  },

  onUnload: function() {
    wx.removeStorageSync('chatInputMessage');
  },

  // 处理图片上传
  goToFaceAnalysis: function() {
    const that = this;
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: function(res) {
        that.setData({ analyzing: true });
        
        wx.uploadFile({
          url: 'http://8.152.213.187/chat',
          filePath: res.tempFilePaths[0],
          name: 'image',
          timeout: 600000,  // 增加到10分钟
          success: function(uploadRes) {
            try {
              const response = JSON.parse(uploadRes.data);
              
              // 创建一个新的消息对象
              const newMessage = {
                type: 'assistant',
                content: '',  // 初始为空
                fullContent: response.message  // 存储完整消息
              };
              
              // 添加消息到列表
              that.setData({
                messageList: [...that.data.messageList, newMessage],
                analyzing: false,
                sessionId: response.sessionId || that.data.sessionId
              }, () => {
                // 开始逐字显示
                that.typeMessage(that.data.messageList.length - 1, response.message);
              });

              // 更新最近对话记录
              let recentChats = wx.getStorageSync('recentChats') || [];
              const sessionInfo = {
                sessionId: that.data.sessionId,
                lastMessage: '[图片分析]',
                time: new Date().toLocaleTimeString()
              };
              
              const existingIndex = recentChats.findIndex(chat => 
                chat.sessionId === that.data.sessionId
              );
              if (existingIndex !== -1) {
                recentChats[existingIndex] = sessionInfo;
              } else {
                recentChats.unshift(sessionInfo);
              }
              
              wx.setStorageSync('recentChats', recentChats);
              
            } catch (error) {
              console.error('解析响应数据失败:', error);
              that.setData({ analyzing: false });
              wx.showToast({
                title: '分析失败',
                icon: 'none'
              });
            }
          },
          fail: function(error) {
            console.error('上传失败:', error);
            that.setData({ analyzing: false });
            wx.showToast({
              title: '上传失败，请检查网络连接',
              icon: 'none',
              duration: 3000
            });
          }
        });
      },
      fail: function(error) {
        console.error('选择图片失败:', error);
        wx.showToast({
          title: '选择图片失败',
          icon: 'none'
        });
      }
    });
  },

  // 添加新的方法：实现打字机效果
  typeMessage: function(messageIndex, fullContent) {
    const that = this;
    let currentIndex = 0;
    const typing = setInterval(() => {
      if (currentIndex < fullContent.length) {
        // 更新指定消息的内容
        const messageList = that.data.messageList;
        messageList[messageIndex].content = fullContent.slice(0, currentIndex + 1);
        
        that.setData({
          messageList: messageList
        }, () => {
          // 每次更新后滚动到底部
          that.scrollToBottom();
        });
        
        currentIndex++;
      } else {
        clearInterval(typing);
      }
    }, 50); // 每50毫秒显示一个字符
  },

  handleStreamMessage: function(data) {
    const { message, sessionId } = data;
    
    console.log('开始处理消息:', message); // 调试日志

    // 添加用户消息到对话列表
    this.addMessage({
        content: message,
        type: 'user'
    });

    const ws = wx.connectSocket({
        url: `ws://localhost:5000?sessionId=${sessionId}`,
        success: () => {
            console.log('WebSocket连接成功建立'); // 调试日志
        },
        fail: (err) => {
            console.error('WebSocket连接失败:', err); // 调试日志
        }
    });

    // 初始化AI回复消息
    let aiResponse = '';
    
    ws.onOpen(function() {
        console.log('连接已打开，发送消息...'); // 调试日志
        ws.send({
            data: JSON.stringify({
                message: message,
                sessionId: sessionId
            }),
            success: () => console.log('消息发送成功'), // 调试日志
            fail: (err) => console.error('消息发送失败:', err) // 调试日志
        });
    });

    ws.onMessage((res) => {
        console.log('收到消息:', res.data); // 调试日志
        try {
            const data = JSON.parse(res.data);
            if (data.chunk) {
                aiResponse += data.chunk;
                console.log('当前累积响应:', aiResponse); // 调试日志
                
                // 更新UI显示
                this.setData({
                    currentMessage: aiResponse
                });
            }
        } catch (e) {
            console.error('解析消息失败:', e);
        }
    });

    ws.onClose(() => {
        console.log('连接关闭，完整响应:', aiResponse); // 调试日志
        if (aiResponse) {
            this.addMessage({
                content: aiResponse,
                type: 'ai'
            });
            this.setData({
                currentMessage: ''
            });
        }
    });

    ws.onError((err) => {
        console.error('WebSocket错误:', err); // 调试日志
    });
  },

  addMessage: function(message) {
    const messages = this.data.messages;
    messages.push(message);
    this.setData({
      messages: messages
    });
    // 滚动到底部
    this.scrollToBottom();
  },

  handleNormalMessage: function(data) {
    if (data && data.message) {
      // 设置会话ID
      this.setData({
        sessionId: data.sessionId || `session_${Date.now()}`
      });
      
      if (data.type === 'face-analysis' || data.isHistoryChat) {
        // 如果是面部分析结果或历史对话，显示为AI消息
        this.setData({
          messageList: [{
            type: 'assistant',
            content: data.message
          }]
        });
      } else {
        // 其他情况（如提示词点击）作为用户消息处理
        const userMessage = {
          type: 'user',
          content: data.message
        };
        
        this.setData({
          messageList: [userMessage],
          loading: true
        });
        
        // 自动发送到服务器获取回复
        this.sendToServer(data.message);
      }
    }
  }
});