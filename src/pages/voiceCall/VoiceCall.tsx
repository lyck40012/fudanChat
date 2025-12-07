import {useState, useEffect, useRef, ReactNode} from 'react';
import { useNavigate } from 'react-router-dom';
import { Volume2, VolumeX, Mic, MicOff, Home } from 'lucide-react';
import styles from './VoiceCall.module.scss';
import VoiceMessages from './component/VoiceMessages';

// Coze WebSocket 语音聊天 SDK 相关依赖
import { WsChatClient, WsChatEventNames, WsToolsUtils } from '@coze/api/ws-tools';
import type {
  CommonErrorEvent,
  ConversationAudioTranscriptUpdateEvent,
} from '@coze/api';
import {Button, message, Slider} from "antd";

type CallStatus = 'connecting' | 'active' | 'ended';


const COZE_BASE_WS_URL = 'wss://ws.coze.cn';
const COZE_PERSONAL_ACCESS_TOKEN = 'pat_hD3fk5ygNuFPLz5ndwIKYWmwY8qgET9DrruIA3Ean8cCEPfSi6o40EZmMg03TS5P';
const COZE_BOT_ID = '7574375637029273609';


const VoiceCall = () => {
  const clientRef = useRef<WsChatClient>(); // Coze 语音聊天客户端实例

  const navigate = useNavigate();
  const [callStatus, setCallStatus] = useState<CallStatus>('connecting');
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(70);
    const [audioEnabled, setAudioEnabled] = useState(true);
  const [isAISpeaking, setIsAISpeaking] = useState(false);

  // Coze 相关状态
  const [isConnecting, setIsConnecting] = useState(false); // 是否正在连接 Coze
  const [isConnected, setIsConnected] = useState(false); // Coze WS 是否已连接
  const [transcript, setTranscript] = useState(''); // 实时语音转写结果

  // 页面加载2秒后触发事件
  useEffect(() => {
    const timer = setTimeout(() => {
      // 在这里写你想要执行的事件逻辑
      console.log('页面加载2秒后触发的事件');
        setCallStatus('active')
        handleStartCozeCall()
    }, 2000); // 2秒 = 2000毫秒

    // 清理定时器，防止内存泄漏
    return () => clearTimeout(timer);
  }, []); // 空依赖数组表示只在组件挂载时执行一次

  // 通话计时器
  useEffect(() => {
    if (callStatus === 'active') {
      const timer = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 2000);
      return () => clearInterval(timer);
    }
  }, [callStatus]);

  // 格式化通话时长
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // 挂断当前通话
  const handleHangup = () => {
    // 如果已经和 Coze 建立连接，优先断开 WebSocket
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = undefined;
      setIsConnected(false);
    }

    // 标记通话结束，但不再自动跳转首页，方便用户在当前页重新开始对话
    setCallStatus('ended');
  };

  // 构造最简版 chatUpdate 配置（只保留通话所需的核心音频参数）
  const getChatUpdateConfig = () => ({
    data: {
      input_audio: {
        format: 'pcm',
        codec: 'pcm',
        sample_rate: 48000,
      },
      output_audio: {
        codec: 'pcm',
        pcm_config: {
          sample_rate: 24000,
        },
        // 这里暂时不指定 voice_id，后续你需要的话可以自行补充
      },
      // 默认使用服务端 VAD 进行轮次检测
      turn_detection: {
        type: 'server_vad',
      },
      need_play_prologue: true,
    },
  });

  // 初始化 Coze 语音聊天客户端
  async function initCozeClient() {
    // 1. 检查麦克风权限
    const permission = await WsToolsUtils.checkDevicePermission();
    if (!permission.audio) {
      throw new Error('需要麦克风访问权限，请在浏览器中开启麦克风权限');
    }

    // 2. 校验必须配置项（留空时直接抛出错误，方便你在本地修改常量）
    if (!COZE_PERSONAL_ACCESS_TOKEN) {
      throw new Error('请在 VoiceCall.tsx 中填写 COZE_PERSONAL_ACCESS_TOKEN');
    }
    if (!COZE_BOT_ID) {
      throw new Error('请在 VoiceCall.tsx 中填写 COZE_BOT_ID');
    }
    if (!COZE_BASE_WS_URL) {
      throw new Error('请在 VoiceCall.tsx 中填写 COZE_BASE_WS_URL');
    }

    // 3. 创建 WsChatClient 实例（先使用最精简配置，后续再逐步补充音频参数）
    const client = new WsChatClient({
      token: COZE_PERSONAL_ACCESS_TOKEN,
      baseWsURL: COZE_BASE_WS_URL,
      botId: COZE_BOT_ID,
      allowPersonalAccessTokenInBrowser: true,
    });

    clientRef.current = client;

    // 4. 绑定基础事件
    bindCozeEvents();
  }


  // 语音转写处理：将当前转写推入/合并到最后一条用户消息中
  const handleTransformation = (_: string, data: unknown) => {
    const event = data as ConversationAudioTranscriptUpdateEvent;
    const content = event?.data?.content;
    if (!content) return;
    // 保存最新的转写结果
    setTranscript(content);

  };

  // 绑定 Coze 事件（语音转写、静音状态、错误处理）
  const bindCozeEvents = ()=> {
    if (!clientRef.current) return;

    // 语音转写更新：多次触发时会合并到最后一条用户消息中
    clientRef.current.on(
      WsChatEventNames.CONVERSATION_AUDIO_TRANSCRIPT_UPDATE,
      handleTransformation,
    );

    // 麦克风静音 / 取消静音
    clientRef.current.on(WsChatEventNames.AUDIO_MUTED, () => {
      console.log('[voice-call] 麦克风已关闭');
      setIsMuted(true);
    });

    clientRef.current.on(WsChatEventNames.AUDIO_UNMUTED, () => {
      console.log('[voice-call] 麦克风已打开');
      setIsMuted(false);
    });

    // 服务端错误
    clientRef.current.on(
      WsChatEventNames.SERVER_ERROR,
      (_: string, event: unknown) => {
        console.error('[voice-call] Coze SERVER_ERROR', event);
        const err = event as CommonErrorEvent;
        alert(
          `发生错误：${err?.data?.msg ?? '未知错误'}\nlogid: ${
            err?.detail?.logid ?? '-'
          }`,
        );
        clientRef.current?.disconnect();
        clientRef.current = undefined;
        setIsConnected(false);
      },
    );
  }

  // 点击“开始对话”时调用：建立与 Coze 的 WebSocket 连接
  const handleStartCozeCall = async () => {
    try {
      setIsConnecting(true);

      // 如果还没有客户端实例，先初始化
      if (!clientRef.current) {
        await initCozeClient();
      }

      const chatUpdate = getChatUpdateConfig();

      await clientRef.current?.connect({ chatUpdate });
      setIsConnected(true);

      // 同步当前页面上的音量到 SDK 播放通道
      if (clientRef.current) {
        clientRef.current.setPlaybackVolume(volume / 100);
      }

      // 真实连接成功后，将通话状态切换为 active
      setCallStatus('active');
    } catch (error) {
      console.error('[voice-call] 连接 Coze 失败', error);
      alert(`连接错误：${(error as Error).message}`);
      setIsConnected(false);
    } finally {
      setIsConnecting(false);
    }
  };

  // 打断当前对话（停止智能体正在讲话）
  const handleInterruptCall = async () => {
    if (!clientRef.current) return;
    try {
      await clientRef.current.interrupt();
      // 打断后可以认为 AI 暂时不在说话，更新一下本地动画状态
      setIsAISpeaking(false);
    } catch (error) {
      console.error('[voice-call] 打断对话失败', error);
      alert(`打断失败：${(error as Error).message}`);
    }
  };

  // 切换静音
  const toggleMute = async () => {
      try {
          await clientRef.current?.setAudioEnable(!audioEnabled);
          setAudioEnabled(!audioEnabled);
      } catch (error) {
          message.error(`切换麦克风状态失败：${error}`);
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
              </div>
              {isAISpeaking && (
                <>
                  <div className={styles.waveRingOuter} />
                  <div className={styles.waveRingInner} />
                </>
              )}
            </div>

            <VoiceMessages  clientRef={clientRef}  />


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

          <div className={styles.rightPane}>
            <Button
              type="primary"
              onClick={isConnected ? handleHangup : handleStartCozeCall}
              loading={!isConnected && isConnecting}
            >
              {isConnected
                ? '挂断'
                : callStatus === 'ended'
                  ? '重新开始对话'
                  : '开始对话'}
            </Button>
            <Button
              type="primary"
              onClick={handleInterruptCall}
              disabled={!isConnected || callStatus !== 'active'}
            >
              打断对话
            </Button>

            {/* 音量控制 */}
            <div className={styles.volumeControl}>
              <Volume2 className={styles.volumeIconMax} />
              <Slider
                vertical
                min={0}
                max={100}
                value={volume}
                onChange={(value) => {
                  setVolume(value);
                  if (clientRef.current && isConnected) {
                    clientRef.current.setPlaybackVolume(value / 100);
                  }
                }}
                disabled={callStatus !== 'active'}
                tooltip={{ formatter: (value) => `${value}%` }}
                style={{ height: '120px' }}
              />
              <VolumeX className={styles.volumeIconMute} />
            </div>

            {/* 静音按钮 */}
            <button
              onClick={toggleMute}
              disabled={callStatus !== 'active'}
              className={styles.muteButton}
            >
              <div
                className={`${styles.muteCircle} ${
                    !audioEnabled ? styles.muteCircleActive : styles.muteCircleInactive
                }`}
              >
                {!audioEnabled ? (
                  <MicOff className="w-10 h-10 text-red-400" />
                ) : (
                  <Mic className="w-10 h-10 text-white" />
                )}
              </div>
              <span className={!audioEnabled ? styles.muteLabelActive : styles.muteLabel}>
                {!audioEnabled ? '已静音' : '麦克风'}
              </span>
            </button>

            {/* 返回按钮 */}
            <button onClick={() => navigate('/')} className={styles.backButton}>
              <div className={styles.backCircle}>
                <Home className="w-8 h-8 text-white" />
              </div>
              <span className={styles.backLabel}>返回</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceCall;
