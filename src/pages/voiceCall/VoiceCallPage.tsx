import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, Volume2, VolumeX, Mic, MicOff, Home, User, Bot } from 'lucide-react';
import styles from './VoiceCallPage.module.scss';

type CallStatus = 'connecting' | 'active' | 'ended';

interface Message {
  id: number;
  type: 'user' | 'ai';
  content: string;
  isTranscribing?: boolean;
}

const VoiceCall = () => {
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
        setCallDuration((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [callStatus]);

  // 模拟连接过程
  useEffect(() => {
    const connectTimer = setTimeout(() => {
      setCallStatus('active');
      // 添加欢迎消息
      setMessages([
        {
          id: 1,
          type: 'ai',
          content: '您好！我是AI数字人助手，很高兴为您服务。',
        },
      ]);
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
        isTranscribing: true,
      };
      setMessages((prev) => [...prev, userMsg]);

      setTimeout(() => {
        setMessages((prev) =>
          prev.map((msg) => (msg.id === userMsg.id ? { ...msg, isTranscribing: false } : msg))
        );

        setIsAISpeaking(true);
        const aiMsg: Message = {
          id: messages.length + 2,
          type: 'ai',
          content: '我可以回答您关于产品、门店、活动等各类问题，还可以为您提供智能建议。',
          isTranscribing: true,
        };
        setMessages((prev) => [...prev, aiMsg]);

        setTimeout(() => {
          setMessages((prev) =>
            prev.map((msg) => (msg.id === aiMsg.id ? { ...msg, isTranscribing: false } : msg))
          );
          setIsAISpeaking(false);
        }, 2000);
      }, 1500);
    }
  };

  return (
    <div className={styles.page}>
      {/* 9:16 容器 */}
      <div className={styles.phone}>
        {/* 顶部状态栏 */}
        <div className={styles.headerBar}>
          <div className={styles.headerLeft}>
            {callStatus === 'connecting' && (
              <>
                <div className={`${styles.statusDot} ${styles.statusDotConnecting}`} />
                <span className={styles.statusText}>正在连接数字人...</span>
              </>
            )}
            {callStatus === 'active' && (
              <>
                <div className={`${styles.statusDot} ${styles.statusDotActive}`} />
                <span className={styles.statusText}>语音通话中 · 数字人助手</span>
              </>
            )}
            {callStatus === 'ended' && (
              <>
                <div className={`${styles.statusDot} ${styles.statusDotEnded}`} />
                <span className={styles.statusText}>通话已结束</span>
              </>
            )}
          </div>
          {callStatus === 'active' && <span className={styles.duration}>{formatDuration(callDuration)}</span>}
        </div>

        {/* 主内容区 */}
        <div className={styles.main}>
          {/* 左侧：数字人动画 + 对话区 */}
          <div className={styles.leftPane}>
            {/* 数字人动画背景 */}
            <div className={styles.leftBackground}>
              <div
                className={`${styles.aiAvatarWrapper} ${
                  isAISpeaking ? styles.aiAvatarWrapperSpeaking : ''
                }`}
              >
                <Bot className={styles.aiAvatarIcon} />
              </div>
              {isAISpeaking && (
                <>
                  <div className={styles.waveRingOuter} />
                  <div className={styles.waveRingInner} />
                </>
              )}
            </div>

            {/* 对话文字区域 */}
            {messages.length > 0 && (
              <div className={styles.messagesWrapper}>
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`${styles.messageRow} ${
                      message.type === 'user' ? styles.messageRowUser : styles.messageRowAi
                    }`}
                  >
                    {message.type === 'ai' && (
                      <div className={styles.avatarCircleAi}>
                        <Bot className="w-5 h-5 text-white" />
                      </div>
                    )}
                    <div
                      className={`${styles.messageBubble} ${
                        message.type === 'user'
                          ? styles.messageBubbleUser
                          : styles.messageBubbleAi
                      }`}
                    >
                      {message.isTranscribing ? (
                        <div className={styles.transcribingText}>
                          <span className={styles.messageText}>语音转文字中</span>
                          <div className={styles.dotGroup}>
                            <div className={styles.dot} />
                            <div className={styles.dot} />
                            <div className={styles.dot} />
                          </div>
                        </div>
                      ) : (
                        <p className={styles.messageText}>{message.content}</p>
                      )}
                    </div>
                    {message.type === 'user' && (
                      <div className={styles.avatarCircleUser}>
                        <User className="w-5 h-5 text-white" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 连接中提示 */}
            {callStatus === 'connecting' && (
              <div className={styles.overlayCenter}>
                <div className={styles.overlayPanel}>
                  <p className={styles.overlayTitle}>正在建立语音通道</p>
                  <p className={styles.overlayDesc}>请稍候...</p>
                </div>
              </div>
            )}

            {/* 通话结束提示 */}
            {callStatus === 'ended' && (
              <div className={styles.overlayEnd}>
                <div className={styles.overlayPanelEnd}>
                  <p className={styles.overlayTitle}>通话已结束</p>
                  <p className={styles.overlayDesc}>通话时长: {formatDuration(callDuration)}</p>
                  <p className={styles.overlaySubDesc}>即将返回首页...</p>
                </div>
              </div>
            )}
          </div>

          {/* 右侧控制栏 */}
          <div className={styles.rightPane}>
            {/* 挂断按钮 */}
            <button
              onClick={handleHangup}
              disabled={callStatus === 'ended'}
              className={styles.hangupButton}
            >
              <div className={styles.hangupCircle}>
                <Phone className="w-10 h-10 text-white rotate-[135deg]" />
              </div>
              <span className={styles.hangupLabel}>挂断</span>
            </button>

            {/* 音量控制 */}
            <div className={styles.volumeControl}>
              <VolumeX className={styles.volumeIconMute} />
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className={styles.volumeSlider}
                style={{ writingMode: 'vertical-lr', height: '120px' }}
                disabled={callStatus !== 'active'}
              />
              <Volume2 className={styles.volumeIconMax} />
              <span className={styles.volumePercent}>{volume}%</span>
            </div>

            {/* 静音按钮 */}
            <button
              onClick={toggleMute}
              disabled={callStatus !== 'active'}
              className={styles.muteButton}
            >
              <div
                className={`${styles.muteCircle} ${
                  isMuted ? styles.muteCircleActive : styles.muteCircleInactive
                }`}
              >
                {isMuted ? (
                  <MicOff className="w-10 h-10 text-red-400" />
                ) : (
                  <Mic className="w-10 h-10 text-white" />
                )}
              </div>
              <span className={isMuted ? styles.muteLabelActive : styles.muteLabel}>
                {isMuted ? '已静音' : '麦克风'}
              </span>
            </button>

            {/* 返回按钮 */}
            <button onClick={() => navigate('/')} className={styles.backButton}>
              <div className={styles.backCircle}>
                <Home className="w-8 h-8 text-white" />
              </div>
              <span className={styles.backLabel}>返回</span>
            </button>

            {/* 测试按钮 - 模拟对话 */}
            {callStatus === 'active' && (
              <button onClick={simulateConversation} className={styles.simulateButtonPrimary}>
                模拟对话
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceCall;
