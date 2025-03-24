const app = getApp();
const config = require('../../config');

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
    currentMessage: '',
    inputValue: '',
    lastMessageId: ''
  },

  onLoad: function(options) {
    const that = this;
    console.log('chat页面加载');
    
    try {
      // 获取事件通道
      const eventChannel = this.getOpenerEventChannel();
      
      // 监听从index页面传来的数据
      eventChannel.on('acceptDataFromOpenerPage', (data) => {
        console.log('接收到的数据:', data);
        this.setData({
          sessionId: data.sessionId
        });

        // 如果是首条消息，直接发送到后端
        if (data.isFirstMessage) {
          this.handleFirstMessage(data.message);
        }
      });
    } catch (error) {
      console.log('初始化事件通道失败:', error);
      // 设置默认的sessionId
      that.setData({
        sessionId: `session_${Date.now()}`
      });
    }

    // 添加欢迎消息
    this.setData({
      messages: [{
        id: 'welcome',
        type: 'assistant',
        content: '你好！我是AI护肤助手，请问有什么可以帮你？'
      }]
    });
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
    if (!this.data.inputValue.trim() || this.data.loading) {
      return;
    }

    const message = this.data.inputValue;
    
    // 添加用户消息
    const userMessage = {
      id: `msg_${Date.now()}`,
      type: 'user',
      content: message
    };

    this.setData({
      messages: [...this.data.messages, userMessage],
      inputValue: '',
      lastMessageId: userMessage.id,
      loading: true
    });

    // 发送到后端
    this.sendToBackend(message);
  },

  // 发送消息到后端
  sendToBackend: function(message) {
    wx.request({
      url: `${config.apiUrl}/chat`,
      method: 'POST',
      data: {
        message: message,
        sessionId: this.data.sessionId
      },
      success: (res) => {
        if (res.data.success) {
          // 添加AI回复消息
          const aiMessage = {
            id: `msg_${Date.now()}`,
            type: 'assistant',
            content: res.data.response
          };

          this.setData({
            messages: [...this.data.messages, aiMessage],
            lastMessageId: aiMessage.id,
            loading: false
          });
        } else {
          wx.showToast({
            title: '获取回复失败',
            icon: 'none'
          });
        }
      },
      fail: (error) => {
        console.error('请求失败:', error);
        wx.showToast({
          title: '网络请求失败',
          icon: 'none'
        });
      },
      complete: () => {
        this.setData({
          loading: false
        });
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
          url: 'http://127.0.0.1:5000/chat',
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
        this.sendToBackend(data.message);
      }
    }
  },

  onInput: function(e) {
    this.setData({
      inputValue: e.detail.value
    });
  },

  chooseImage() {
    wx.chooseImage({
      count: 1,
      success: (res) => {
        // 处理选择的图片
        console.log('选择的图片:', res.tempFilePaths[0]);
      }
    });
  },

  // 处理首条消息
  handleFirstMessage: function(message) {
    // 先显示用户消息
    const userMessage = {
      id: `msg_${Date.now()}`,
      type: 'user',
      content: message
    };

    this.setData({
      messages: [userMessage],
      lastMessageId: userMessage.id,
      loading: true
    });

    // 发送到后端
    this.sendToBackend(message);
  }
});