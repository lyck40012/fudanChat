import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, Volume2, VolumeX, Mic, MicOff, Home, User, Bot } from 'lucide-react';

type CallStatus = 'connecting' | 'active' | 'ended';

interface Message {
  id: number;
  type: 'user' | 'ai';
  content: string;
  isTranscribing?: boolean;
}

export function VoiceCallPage() {
  const navigate = useNavigate();
  const [callStatus, setCallStatus] = useState<CallStatus>('connecting');
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(70);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isAISpeaking, setIsAISpeaking] = useState(false);

  // 通话计时器
  useEffect(() => {
    if (callStatus === 'active') {
      const timer = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [callStatus]);

  // 模拟连接过程
  useEffect(() => {
    const connectTimer = setTimeout(() => {
      setCallStatus('active');
      // 添加欢迎消息
      setMessages([{
        id: 1,
        type: 'ai',
        content: '您好！我是AI数字人助手，很高兴为您服务。'
      }]);
    }, 2000);
    return () => clearTimeout(connectTimer);
  }, []);

  // 格式化通话时长
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // 挂断
  const handleHangup = () => {
    setCallStatus('ended');
    setTimeout(() => {
      navigate('/');
    }, 2000);
  };

  // 切换静音
  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  // 模拟添加对话
  const simulateConversation = () => {
    if (callStatus === 'active') {
      // 添加用户消息
      const userMsg: Message = {
        id: messages.length + 1,
        type: 'user',
        content: '请问你能帮我做什么？',
        isTranscribing: true
      };
      setMessages(prev => [...prev, userMsg]);

      setTimeout(() => {
        setMessages(prev => 
          prev.map(msg => msg.id === userMsg.id ? { ...msg, isTranscribing: false } : msg)
        );
        
        setIsAISpeaking(true);
        const aiMsg: Message = {
          id: messages.length + 2,
          type: 'ai',
          content: '我可以回答您关于产品、门店、活动等各类问题，还可以为您提供智能建议。',
          isTranscribing: true
        };
        setMessages(prev => [...prev, aiMsg]);

        setTimeout(() => {
          setMessages(prev => 
            prev.map(msg => msg.id === aiMsg.id ? { ...msg, isTranscribing: false } : msg)
          );
          setIsAISpeaking(false);
        }, 2000);
      }, 1500);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      {/* 9:16 容器 */}
      <div className="w-full max-w-[56.25vh] h-screen bg-gradient-to-b from-slate-900 via-blue-900 to-slate-900 flex flex-col overflow-hidden relative">
        
        {/* 顶部状态栏 */}
        <div className="h-[8%] flex items-center justify-between px-6 bg-black/30 backdrop-blur-sm border-b border-white/10 z-10">
          <div className="flex items-center gap-3">
            {callStatus === 'connecting' && (
              <>
                <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
                <span className="text-white" style={{ fontSize: '20px' }}>正在连接数字人...</span>
              </>
            )}
            {callStatus === 'active' && (
              <>
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-white" style={{ fontSize: '20px' }}>语音通话中 · 数字人助手</span>
              </>
            )}
            {callStatus === 'ended' && (
              <>
                <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                <span className="text-white" style={{ fontSize: '20px' }}>通话已结束</span>
              </>
            )}
          </div>
          {callStatus === 'active' && (
            <span className="text-blue-200" style={{ fontSize: '22px' }}>{formatDuration(callDuration)}</span>
          )}
        </div>

        {/* 主内容区 */}
        <div className="flex-1 flex">
          {/* 左侧：数字人动画 + 对话区 */}
          <div className="flex-1 relative">
            {/* 数字人动画背景 */}
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-900/50 to-purple-900/50">
              <div className={`w-64 h-64 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center transition-all duration-500 ${
                isAISpeaking ? 'scale-110 shadow-[0_0_80px_rgba(96,165,250,0.8)]' : 'shadow-2xl'
              }`}>
                <Bot className={`w-32 h-32 text-white ${isAISpeaking ? 'animate-pulse' : ''}`} />
              </div>
              {isAISpeaking && (
                <>
                  <div className="absolute w-80 h-80 rounded-full border-4 border-blue-400/50 animate-ping"></div>
                  <div className="absolute w-96 h-96 rounded-full border-2 border-purple-400/30 animate-ping" style={{ animationDelay: '0.3s' }}></div>
                </>
              )}
            </div>

            {/* 对话文字区域 */}
            {messages.length > 0 && (
              <div className="absolute bottom-0 left-0 right-0 max-h-[75%] bg-gradient-to-t from-black/80 via-black/60 to-transparent backdrop-blur-sm p-6">
                <div className="space-y-4 overflow-y-auto max-h-[calc(75vh-3rem)]">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${message.type === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                    >
                      {/* 头像 */}
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        message.type === 'user'
                          ? 'bg-gradient-to-br from-blue-500 to-blue-600'
                          : 'bg-gradient-to-br from-purple-500 to-purple-600'
                      }`}>
                        {message.type === 'user' ? (
                          <User className="w-7 h-7 text-white" />
                        ) : (
                          <Bot className="w-7 h-7 text-white" />
                        )}
                      </div>

                      {/* 消息气泡 */}
                      <div className={`flex-1 max-w-[75%] ${message.type === 'user' ? 'text-right' : 'text-left'}`}>
                        <div className={`inline-block px-5 py-3 rounded-2xl ${
                          message.type === 'user'
                            ? 'bg-blue-500 text-white'
                            : 'bg-slate-700 text-white'
                        }`}>
                          {message.isTranscribing ? (
                            <div className="flex items-center gap-2">
                              <span style={{ fontSize: '18px' }}>语音转文字中</span>
                              <div className="flex gap-1">
                                <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce"></div>
                                <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                              </div>
                            </div>
                          ) : (
                            <p style={{ fontSize: '18px', lineHeight: '1.5' }}>{message.content}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 连接中提示 */}
            {callStatus === 'connecting' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-black/60 backdrop-blur-sm rounded-3xl px-10 py-6 text-center">
                  <p className="text-white mb-3" style={{ fontSize: '24px' }}>正在建立语音通道</p>
                  <p className="text-blue-200" style={{ fontSize: '18px' }}>请稍候...</p>
                </div>
              </div>
            )}

            {/* 通话结束提示 */}
            {callStatus === 'ended' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <div className="bg-slate-800 rounded-3xl px-12 py-8 text-center">
                  <p className="text-white mb-6" style={{ fontSize: '28px' }}>通话已结束</p>
                  <p className="text-slate-300 mb-2" style={{ fontSize: '18px' }}>通话时长: {formatDuration(callDuration)}</p>
                  <p className="text-slate-400" style={{ fontSize: '16px' }}>即将返回首页...</p>
                </div>
              </div>
            )}
          </div>

          {/* 右侧控制栏 */}
          <div className="w-[20%] bg-black/40 backdrop-blur-sm border-l border-white/10 flex flex-col items-center justify-center gap-8 py-8">
            
            {/* 挂断按钮 */}
            <button
              onClick={handleHangup}
              disabled={callStatus === 'ended'}
              className="flex flex-col items-center gap-2 disabled:opacity-50"
            >
              <div className="w-20 h-20 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center shadow-lg hover:shadow-red-500/50 transition-all active:scale-95 disabled:hover:bg-red-500">
                <Phone className="w-10 h-10 text-white rotate-[135deg]" />
              </div>
              <span className="text-white" style={{ fontSize: '16px' }}>挂断</span>
            </button>

            {/* 音量控制 */}
            <div className="flex flex-col items-center gap-3 w-full px-4">
              <VolumeX className="w-6 h-6 text-slate-400" />
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                style={{ writingMode: 'vertical-lr', height: '120px' }}
                disabled={callStatus !== 'active'}
              />
              <Volume2 className="w-6 h-6 text-blue-400" />
              <span className="text-slate-300" style={{ fontSize: '14px' }}>{volume}%</span>
            </div>

            {/* 静音按钮 */}
            <button
              onClick={toggleMute}
              disabled={callStatus !== 'active'}
              className="flex flex-col items-center gap-2 disabled:opacity-50"
            >
              <div className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 ${
                isMuted 
                  ? 'bg-slate-600 border-2 border-red-500' 
                  : 'bg-slate-700 hover:bg-slate-600'
              }`}>
                {isMuted ? (
                  <MicOff className="w-10 h-10 text-red-400" />
                ) : (
                  <Mic className="w-10 h-10 text-white" />
                )}
              </div>
              <span className={`${isMuted ? 'text-red-400' : 'text-white'}`} style={{ fontSize: '14px' }}>
                {isMuted ? '已静音' : '麦克风'}
              </span>
            </button>

            {/* 返回按钮 */}
            <button
              onClick={() => navigate('/')}
              className="flex flex-col items-center gap-2 mt-4"
            >
              <div className="w-16 h-16 bg-slate-700 hover:bg-slate-600 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95">
                <Home className="w-8 h-8 text-white" />
              </div>
              <span className="text-white" style={{ fontSize: '14px' }}>返回</span>
            </button>

            {/* 测试按钮 - 模拟对话 */}
            {callStatus === 'active' && (
              <button
                onClick={simulateConversation}
                className="mt-auto px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-xl text-white transition-all active:scale-95"
                style={{ fontSize: '13px' }}
              >
                模拟对话
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}