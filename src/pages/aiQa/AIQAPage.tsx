import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, Mic, Upload, Camera, Keyboard, User, Bot, Send, X, RotateCcw, Check } from 'lucide-react';

type InputMode = 'voice' | 'file' | 'camera' | 'text';
type VoiceStatus = 'idle' | 'recording' | 'processing';
type CameraStatus = 'closed' | 'preview' | 'captured';

interface Message {
  id: number;
  type: 'user' | 'ai' | 'system';
  content: string;
  imageUrl?: string;
  fileName?: string;
}

const  AIQAPage=()=> {
  const navigate = useNavigate();
  const [currentMode, setCurrentMode] = useState<InputMode>('voice');
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, type: 'ai', content: '您好！我是AI数字人助手，您可以通过语音、文字、上传文件或拍照来向我提问。' }
  ]);
  const [textInput, setTextInput] = useState('');
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle');
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('closed');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 切换输入模式
  const switchMode = (mode: InputMode) => {
    setCurrentMode(mode);
    if (mode === 'camera') {
      setCameraStatus('preview');
    } else {
      setCameraStatus('closed');
    }
  };

  // 按住说话 - 开始录音
  const startRecording = () => {
    setVoiceStatus('recording');
  };

  // 按住说话 - 停止录音
  const stopRecording = () => {
    setVoiceStatus('processing');
    
    // 模拟语音识别
    setTimeout(() => {
      const userMsg: Message = {
        id: messages.length + 1,
        type: 'user',
        content: '请问你们的营业时间是几点到几点？'
      };
      setMessages(prev => [...prev, userMsg]);
      setVoiceStatus('idle');

      // 模拟AI回复
      setTimeout(() => {
        const aiMsg: Message = {
          id: messages.length + 2,
          type: 'ai',
          content: '我们的营业时间是每天上午9:00到晚上9:00，节假日正常营业。如有特殊情况会提前通知。'
        };
        setMessages(prev => [...prev, aiMsg]);
      }, 1000);
    }, 1500);
  };

  // 上传文件
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const systemMsg: Message = {
        id: messages.length + 1,
        type: 'system',
        content: `已上传文件：${file.name}`,
        fileName: file.name
      };
      setMessages(prev => [...prev, systemMsg]);

      // 模拟AI分析文件
      setTimeout(() => {
        const aiMsg: Message = {
          id: messages.length + 2,
          type: 'ai',
          content: '我已经收到您的文件。您可以问我：\n• 帮我总结文件要点\n• 提取关键时间\n• 找出费用明细'
        };
        setMessages(prev => [...prev, aiMsg]);
      }, 1000);
    }
  };

  // 拍照
  const handleCapture = () => {
    // 模拟拍照
    setCameraStatus('captured');
    setCapturedImage('https://images.unsplash.com/photo-1554224311-beee460c201f?w=400');
  };

  // 确认上传照片
  const confirmUpload = () => {
    if (capturedImage) {
      const userMsg: Message = {
        id: messages.length + 1,
        type: 'user',
        content: '已上传图片',
        imageUrl: capturedImage
      };
      setMessages(prev => [...prev, userMsg]);

      setCameraStatus('closed');
      setCapturedImage(null);

      // 模拟AI分析图片
      setTimeout(() => {
        const aiMsg: Message = {
          id: messages.length + 2,
          type: 'ai',
          content: '我已经看到您的图片了。您可以问我：\n• 帮我解读下报告\n• 图片中有什么内容\n• 分析图片中的数据'
        };
        setMessages(prev => [...prev, aiMsg]);
      }, 1000);
    }
  };

  // 重新拍照
  const retakePhoto = () => {
    setCameraStatus('preview');
    setCapturedImage(null);
  };

  // 取消拍照
  const cancelCamera = () => {
    setCameraStatus('closed');
    setCapturedImage(null);
    setCurrentMode('voice');
  };

  // 发送文字消息
  const handleSendText = () => {
    if (textInput.trim()) {
      const userMsg: Message = {
        id: messages.length + 1,
        type: 'user',
        content: textInput
      };
      setMessages(prev => [...prev, userMsg]);
      setTextInput('');

      // 模拟AI回复
      setTimeout(() => {
        const aiMsg: Message = {
          id: messages.length + 2,
          type: 'ai',
          content: '感谢您的提问！这是一个示例回复。在实际应用中，这里会显示AI的智能回答。'
        };
        setMessages(prev => [...prev, aiMsg]);
      }, 1000);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      {/* 9:16 容器 */}
      <div className="w-full max-w-[56.25vh] h-screen bg-gradient-to-b from-slate-900 via-purple-900 to-slate-900 flex flex-col overflow-hidden">
        
        {/* 顶部导航 */}
        <div className="h-[8%] flex items-center justify-between px-8 bg-black/30 backdrop-blur-sm border-b border-white/10">
          <h1 className="text-white" style={{ fontSize: '32px' }}>AI问答</h1>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all"
          >
            <Home className="w-7 h-7 text-white" />
            <span className="text-white" style={{ fontSize: '20px' }}>返回</span>
          </button>
        </div>

        {/* 主内容区 */}
        <div className="flex-1 flex overflow-hidden">
          {/* 左侧对话区 */}
          <div className="flex-1 flex flex-col relative">
            {/* 会话说明 */}
            <div className="px-6 py-3 bg-purple-900/30 border-b border-white/10">
              <p className="text-purple-200 text-center" style={{ fontSize: '16px' }}>
                {currentMode === 'voice' && '当前模式：语音优先'}
                {currentMode === 'text' && '当前模式：文字输入'}
                {currentMode === 'file' && '本轮对话基于您上传的文件'}
                {currentMode === 'camera' && '图片识别模式'}
              </p>
            </div>

            {/* 对话列表 */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <div className="space-y-5">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-4 ${message.type === 'user' ? 'flex-row-reverse' : 'flex-row'} ${message.type === 'system' ? 'justify-center' : ''}`}
                  >
                    {message.type !== 'system' && (
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                        message.type === 'user'
                          ? 'bg-gradient-to-br from-blue-500 to-blue-600'
                          : 'bg-gradient-to-br from-purple-500 to-purple-600'
                      }`}>
                        {message.type === 'user' ? (
                          <User className="w-8 h-8 text-white" />
                        ) : (
                          <Bot className="w-8 h-8 text-white" />
                        )}
                      </div>
                    )}

                    <div className={`${message.type === 'system' ? 'max-w-[80%]' : 'flex-1 max-w-[70%]'} ${message.type === 'user' ? 'text-right' : 'text-left'}`}>
                      {message.type === 'system' ? (
                        <div className="inline-block px-6 py-3 bg-amber-600/80 text-white rounded-2xl">
                          <p style={{ fontSize: '17px' }}>📄 {message.content}</p>
                        </div>
                      ) : (
                        <div className={`inline-block p-5 rounded-3xl ${
                          message.type === 'user'
                            ? 'bg-blue-500 text-white'
                            : 'bg-white/95 text-slate-800'
                        }`}>
                          {message.imageUrl && (
                            <img src={message.imageUrl} alt="上传的图片" className="rounded-2xl mb-3 max-w-full" />
                          )}
                          <p style={{ fontSize: '19px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{message.content}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 底部状态条 */}
            <div className="px-6 py-4 border-t border-white/10">
              {voiceStatus === 'recording' && (
                <div className="flex items-center justify-center gap-3 py-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-white" style={{ fontSize: '20px' }}>🎙 正在录音...</span>
                </div>
              )}
              {voiceStatus === 'processing' && (
                <div className="flex items-center justify-center gap-3 py-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <span className="text-white" style={{ fontSize: '20px' }}>⌛ 正在识别语音...</span>
                </div>
              )}
              {currentMode === 'text' && voiceStatus === 'idle' && (
                <div className="flex gap-3">
                  <textarea
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="请输入您的问题..."
                    className="flex-1 bg-slate-800 text-white rounded-2xl px-5 py-4 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                    style={{ fontSize: '19px' }}
                    rows={2}
                  />
                  <button
                    onClick={handleSendText}
                    className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center hover:shadow-lg transition-all active:scale-95"
                  >
                    <Send className="w-8 h-8 text-white" />
                  </button>
                </div>
              )}
              {voiceStatus === 'idle' && currentMode !== 'text' && (
                <div className="text-center">
                  <p className="text-slate-400" style={{ fontSize: '17px' }}>
                    {currentMode === 'voice' && '长按右侧"按住说话"开始语音提问'}
                    {currentMode === 'file' && '文件已就绪，可以开始提问'}
                    {currentMode === 'camera' && '准备拍照或继续提问'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 右侧工具栏 */}
          <div className="w-[20%] bg-black/40 backdrop-blur-sm border-l border-white/10 flex flex-col gap-4 py-8 px-4 overflow-y-auto">
            
            {/* 按住说话 */}
            <button
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onMouseLeave={() => voiceStatus === 'recording' && stopRecording()}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              onClick={() => switchMode('voice')}
              className={`rounded-3xl p-3 flex flex-col items-center gap-2 transition-all border-2 ${
                currentMode === 'voice'
                  ? 'bg-gradient-to-br from-blue-500 to-blue-600 border-blue-400 shadow-lg shadow-blue-500/50'
                  : 'bg-slate-800/50 border-transparent hover:bg-slate-700/50'
              } ${voiceStatus === 'recording' ? 'scale-95 shadow-2xl' : ''}`}
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                voiceStatus === 'recording' 
                  ? 'bg-red-500 animate-pulse' 
                  : currentMode === 'voice' 
                  ? 'bg-white/20' 
                  : 'bg-slate-700'
              }`}>
                <Mic className="w-7 h-7 text-white" />
              </div>
              <div className="text-center">
                <h3 className={`mb-1 ${currentMode === 'voice' ? 'text-white' : 'text-slate-300'}`} style={{ fontSize: '16px' }}>
                  按住说话
                </h3>
                <p className={`${currentMode === 'voice' ? 'text-blue-100' : 'text-slate-500'}`} style={{ fontSize: '12px' }}>
                  {voiceStatus === 'recording' ? '录音中...' : '按住开始录音，松开发送'}
                </p>
              </div>
            </button>

            {/* 上传文件 */}
            <button
              onClick={() => {
                switchMode('file');
                fileInputRef.current?.click();
              }}
              className={`rounded-3xl p-3 flex flex-col items-center gap-2 transition-all border-2 ${
                currentMode === 'file'
                  ? 'bg-gradient-to-br from-purple-500 to-purple-600 border-purple-400 shadow-lg shadow-purple-500/50'
                  : 'bg-slate-800/50 border-transparent hover:bg-slate-700/50'
              }`}
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                currentMode === 'file' ? 'bg-white/20' : 'bg-slate-700'
              }`}>
                <Upload className="w-7 h-7 text-white" />
              </div>
              <div className="text-center">
                <h3 className={`mb-1 ${currentMode === 'file' ? 'text-white' : 'text-slate-300'}`} style={{ fontSize: '16px' }}>
                  上传文件
                </h3>
                <p className={`${currentMode === 'file' ? 'text-purple-100' : 'text-slate-500'}`} style={{ fontSize: '12px' }}>
                  支持PDF、图片等文件
                </p>
              </div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={handleFileUpload}
              className="hidden"
            />

            {/* 拍摄 */}
            <button
              onClick={() => switchMode('camera')}
              className={`rounded-3xl p-3 flex flex-col items-center gap-2 transition-all border-2 ${
                currentMode === 'camera'
                  ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 border-indigo-400 shadow-lg shadow-indigo-500/50'
                  : 'bg-slate-800/50 border-transparent hover:bg-slate-700/50'
              }`}
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                currentMode === 'camera' ? 'bg-white/20' : 'bg-slate-700'
              }`}>
                <Camera className="w-7 h-7 text-white" />
              </div>
              <div className="text-center">
                <h3 className={`mb-1 ${currentMode === 'camera' ? 'text-white' : 'text-slate-300'}`} style={{ fontSize: '16px' }}>
                  拍摄
                </h3>
                <p className={`${currentMode === 'camera' ? 'text-indigo-100' : 'text-slate-500'}`} style={{ fontSize: '12px' }}>
                  拍照上传报告
                </p>
              </div>
            </button>

            {/* 打字 */}
            <button
              onClick={() => switchMode('text')}
              className={`rounded-3xl p-3 flex flex-col items-center gap-2 transition-all border-2 ${
                currentMode === 'text'
                  ? 'bg-gradient-to-br from-green-500 to-green-600 border-green-400 shadow-lg shadow-green-500/50'
                  : 'bg-slate-800/50 border-transparent hover:bg-slate-700/50'
              }`}
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                currentMode === 'text' ? 'bg-white/20' : 'bg-slate-700'
              }`}>
                <Keyboard className="w-7 h-7 text-white" />
              </div>
              <div className="text-center">
                <h3 className={`mb-1 ${currentMode === 'text' ? 'text-white' : 'text-slate-300'}`} style={{ fontSize: '16px' }}>
                  打字
                </h3>
                <p className={`${currentMode === 'text' ? 'text-green-100' : 'text-slate-500'}`} style={{ fontSize: '12px' }}>
                  使用键盘输入问题
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* 相机预览弹窗 - 只覆盖在左侧对话区上方 */}
        {cameraStatus !== 'closed' && (
          <div className="absolute left-0 top-0 w-[80%] h-full bg-black/95 backdrop-blur-sm z-50 flex items-center justify-center">
            {cameraStatus === 'preview' && (
              <div className="w-[73.5%] aspect-[9/16] flex flex-col bg-slate-900 rounded-3xl overflow-hidden shadow-2xl">
                <div className="flex-1 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                  <div className="text-center">
                    <Camera className="w-32 h-32 text-slate-600 mx-auto mb-6" />
                    <p className="text-slate-400" style={{ fontSize: '22px' }}>摄像头预览</p>
                    <p className="text-slate-500 mt-2" style={{ fontSize: '17px' }}>（实际应用中这里会显示摄像头画面）</p>
                  </div>
                </div>
                <div className="h-[15%] flex items-center justify-center gap-6 bg-black/80">
                  <button
                    onClick={cancelCamera}
                    className="w-16 h-16 bg-slate-700 hover:bg-slate-600 rounded-full flex items-center justify-center transition-all"
                  >
                    <X className="w-9 h-9 text-white" />
                  </button>
                  <button
                    onClick={handleCapture}
                    className="w-24 h-24 bg-white hover:bg-gray-200 rounded-full flex items-center justify-center transition-all border-4 border-slate-700"
                  >
                    <div className="w-20 h-20 bg-white rounded-full"></div>
                  </button>
                </div>
              </div>
            )}
            {cameraStatus === 'captured' && capturedImage && (
              <div className="w-[73.5%] aspect-[9/16] flex flex-col bg-slate-900 rounded-3xl overflow-hidden shadow-2xl">
                <div className="flex-1 flex items-center justify-center bg-black p-6">
                  <img src={capturedImage} alt="拍摄的照片" className="max-w-full max-h-full rounded-2xl object-contain" />
                </div>
                <div className="h-[15%] flex items-center justify-center gap-8 bg-black/80">
                  <button
                    onClick={retakePhoto}
                    className="flex flex-col items-center gap-2"
                  >
                    <div className="w-20 h-20 bg-slate-700 hover:bg-slate-600 rounded-full flex items-center justify-center transition-all">
                      <RotateCcw className="w-10 h-10 text-white" />
                    </div>
                    <span className="text-white" style={{ fontSize: '16px' }}>重拍</span>
                  </button>
                  <button
                    onClick={confirmUpload}
                    className="flex flex-col items-center gap-2"
                  >
                    <div className="w-20 h-20 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center transition-all">
                      <Check className="w-10 h-10 text-white" />
                    </div>
                    <span className="text-white" style={{ fontSize: '16px' }}>确认上传</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export  default  AIQAPage