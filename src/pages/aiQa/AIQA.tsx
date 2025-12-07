import React, {useState, useRef, useEffect} from 'react';
import {useNavigate} from 'react-router-dom';
import {Home, Mic, Upload, Camera, Keyboard, User, Bot, Send, X, RotateCcw, Check} from 'lucide-react';
import {message} from 'antd';
import styles from './AIQA.module.scss';
import {
    AIDenoiserProcessorLevel,
    AIDenoiserProcessorMode,
    WsToolsUtils,
    WsTranscriptionClient
} from "@coze/api/ws-tools";

import {CommonErrorEvent, TranscriptionsMessageUpdateEvent, WebsocketsEventType} from "@coze/api";

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

const AIQA = () => {
    const navigate = useNavigate();
    const [currentMode, setCurrentMode] = useState<InputMode>('text');
    const [messages, setMessages] = useState<Message[]>([
        {id: 1, type: 'ai', content: '您好！我是AI数字人助手，您可以通过语音、文字、上传文件或拍照来向我提问。'}
    ]);
    const [textInput, setTextInput] = useState('');
    const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle');
    const [cameraStatus, setCameraStatus] = useState<CameraStatus>('closed');
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pressStartTimeRef = useRef<number | null>(null);
    const [selectedInputDevice, setSelectedInputDevice] = useState<string>('');
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [denoiserSupported, setDenoiserSupported] = useState<boolean>(false);
    const [recognizeResult,setRecognizeResult] = useState<Message>({}) //暂存语音识别结果
    const clientRef = useRef<WsTranscriptionClient>();
    useEffect(() => {
        //获取权限
        checkRequirements()
        //获取麦克风设备
        getDevices();
    }, []);

    const checkRequirements = async () => {
        // 检查麦克风权限
        const permission = await WsToolsUtils.checkDevicePermission();
        setHasPermission(permission.audio);

        // 检查是否支持AI降噪
        const isDenoiserSupported = WsToolsUtils.checkDenoiserSupport();
        setDenoiserSupported(isDenoiserSupported);
    };
    const getDevices = async () => {
        const devices = await WsToolsUtils.getAudioDevices();
        if (devices.audioInputs.length > 0) {
            setSelectedInputDevice(devices.audioInputs[0].deviceId);
        }
    };

    const initClient = () => {
        if (!hasPermission) {
            throw new Error('麦克风权限未授予');
        }
        const client = new WsTranscriptionClient({
            token: 'pat_hD3fk5ygNuFPLz5ndwIKYWmwY8qgET9DrruIA3Ean8cCEPfSi6o40EZmMg03TS5P',
            baseWsURL: 'wss://ws.coze.cn',
            allowPersonalAccessTokenInBrowser: true,
            debug: false,
            deviceId: selectedInputDevice,
            // AI降噪配置 - 仅当浏览器支持并且选择使用时开启
            aiDenoisingConfig: denoiserSupported
                ? {
                    mode: AIDenoiserProcessorMode.NSNG, // AI降噪模式
                    level: AIDenoiserProcessorLevel.SOFT, // 舒缓降噪
                    assetsPath:
                        'https://lf3-static.bytednsdoc.com/obj/eden-cn/613eh7lpqvhpeuloz/websocket',
                }
                : undefined,
            // 音频捕获配置
            audioCaptureConfig: {
                echoCancellation: true,
                noiseSuppression: !denoiserSupported, // 如果支持AI降噪，则禁用浏览器内置降噪
                autoGainControl: true,
            },
        });
        // 如果使用AI降噪但浏览器不支持，则提示用户
        if (!denoiserSupported) {
            message.info('当前浏览器不支持AI降噪，将使用浏览器内置降噪');
        }
        // 监听转录结果更新
        client.on(WebsocketsEventType.TRANSCRIPTIONS_MESSAGE_UPDATE,(event: unknown) => {
            const userMsg: Message = {
                id: event.detail.logid,
                type: 'user',
                content: event.data.content,
            };
            console.log(userMsg)
            setRecognizeResult(userMsg)
            },
        );

        // 监听错误事件
        client.on(WebsocketsEventType.ERROR, (error: unknown) => {
            console.error(error);
            message.error((error as CommonErrorEvent).data.msg);
        });
        clientRef.current = client;
    }
    const switchMode = (mode: InputMode) => {
        if (mode === 'voice' && !clientRef.current) {
            try {
                initClient();
            } catch (error) {
                console.error(error);
                message.error((error as Error).message || '语音初始化失败');
                return;
            }
        }
        setCurrentMode(mode);
        if (mode === 'camera') {
            setCameraStatus('preview');
        } else {
            setCameraStatus('closed');
        }
    };


    const startRecording = () => {
        if (currentMode !== 'voice') return;
        pressStartTimeRef.current = Date.now();
        clientRef.current.start()
        setVoiceStatus('recording');
    };

    const stopRecording = () => {
        if (currentMode !== 'voice' || voiceStatus !== 'recording') return;
        const pressDuration = pressStartTimeRef.current ? Date.now() - pressStartTimeRef.current : 0;
        pressStartTimeRef.current = null;
        clientRef.current.stop()
        if (pressDuration < 500) {
            setVoiceStatus('idle');
            message.warning('时间过短');
            return;
        }
        setVoiceStatus('processing')
        setVoiceStatus('idle');
        if(Object.keys(recognizeResult).length) setMessages(prev => [...prev, recognizeResult]);
        setRecognizeResult({})
/*        setTimeout(() => {
            const userMsg: Message = {
                id: messages.length + 1,
                type: 'user',
                content: '请问你们的营业时间是几点到几点？'
            };
            setMessages(prev => [...prev, userMsg]);
            setVoiceStatus('idle');
            setTimeout(() => {
                const aiMsg: Message = {
                    id: messages.length + 2,
                    type: 'ai',
                    content: '我们的营业时间是每天上午9:00到晚上9:00，节假日正常营业。如有特殊情况会提前通知。'
                };
                setMessages(prev => [...prev, aiMsg]);
            }, 1000);
        }, 1500);*/
    };

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

    const handleCapture = () => {
        setCameraStatus('captured');
        setCapturedImage('https://images.unsplash.com/photo-1554224311-beee460c201f?w=400');
    };

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

    const retakePhoto = () => {
        setCameraStatus('preview');
        setCapturedImage(null);
    };

    const cancelCamera = () => {
        setCameraStatus('closed');
        setCapturedImage(null);
        setCurrentMode('voice');
    };

    const handleSendText = () => {
        if (textInput.trim()) {
            const userMsg: Message = {
                id: messages.length + 1,
                type: 'user',
                content: textInput
            };
            setMessages(prev => [...prev, userMsg]);
            setTextInput('');
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

    const getToolbarButtonClasses = (mode: InputMode) => {
        const classNames = [styles.toolbarButton];
        if (currentMode === mode) {
            classNames.push(styles.active, styles[mode]);
        }
        if (mode === 'voice' && voiceStatus === 'recording') {
            classNames.push(styles.recording);
        }
        return classNames.join(' ');
    };

    const getToolbarIconWrapperClasses = (mode: InputMode) => {
        const classNames = [styles.toolbarIconWrapper];
        if (mode === 'voice' && voiceStatus === 'recording') {
            classNames.push(styles.recording);
        }
        return classNames.join(' ');
    };

    console.log("messages=========>",messages)
    return (
        <div className={styles.container}>
            <div className={styles.contentWrapper}>
                <div className={styles.topNav}>
                    <h1>AI问答</h1>
                </div>

                <div className={styles.mainContent}>
                    <div className={styles.chatArea}>
                        <div className={styles.modeInfo}>
                            <p>
                                {currentMode === 'voice' && '当前模式：语音优先'}
                                {currentMode === 'text' && '当前模式：文字输入'}
                                {currentMode === 'file' && '本轮对话基于您上传的文件'}
                                {currentMode === 'camera' && '图片识别模式'}
                            </p>
                        </div>

                        <div className={styles.messageList}>
                            <div className={styles.messageListInner}>
                                {messages.map((message) => (
                                    <div key={message.id} className={`${styles.messageRow} ${styles[message.type]}`}>
                                        {message.type !== 'system' && (
                                            <div className={`${styles.avatar} ${styles[message.type]}`}>
                                                {message.type === 'user' ? <User/> : <Bot/>}
                                            </div>
                                        )}
                                        <div className={`${styles.messageContentWrapper} ${styles[message.type]}`}>
                                            {message.type === 'system' ? (
                                                <div className={`${styles.messageBubble} ${styles.system}`}>
                                                    <p>📄 {message.content}</p>
                                                </div>
                                            ) : (
                                                <div className={`${styles.messageBubble} ${styles[message.type]}`}>
                                                    {message.imageUrl && (
                                                        <img src={message.imageUrl} alt="上传的图片"
                                                             className={styles.messageImage}/>
                                                    )}
                                                    <p className={styles.messageText}>{message.content}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className={styles.statusBar}>
                            {voiceStatus === 'recording' && (
                                <div className={`${styles.statusIndicator} ${styles.recordingIndicator}`}>
                                    <div className={styles.dot}></div>
                                    <span>🎙 正在录音...</span>
                                </div>
                            )}
                            {voiceStatus === 'processing' && (
                                <div className={`${styles.statusIndicator} ${styles.processingIndicator}`}>
                                    <div className={styles.dots}>
                                        <div className={styles.dot}></div>
                                        <div className={styles.dot}></div>
                                        <div className={styles.dot}></div>
                                    </div>
                                    <span>⌛ 正在识别语音...</span>
                                </div>
                            )}
                            {currentMode === 'text' && voiceStatus === 'idle' && (
                                <div className={styles.textInputContainer}>
                  <textarea
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="请输入您的问题..."
                      className={styles.textInput}
                      rows={2}
                  />
                                    <button onClick={handleSendText} className={styles.sendButton}>
                                        <Send/>
                                    </button>
                                </div>
                            )}
                            {voiceStatus === 'idle' && currentMode !== 'text' && (
                                <div className={styles.idleText}>
                                    <p>
                                        {currentMode === 'voice' && '长按右侧"按住说话"开始语音提问'}
                                        {currentMode === 'file' && '文件已就绪，可以开始提问'}
                                        {currentMode === 'camera' && '准备拍照或继续提问'}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className={styles.toolbar}>
                        <div className={styles.toolbarButtons}>
                            <button
                                onMouseDown={startRecording}
                                onMouseUp={stopRecording}
                                onMouseLeave={() => voiceStatus === 'recording' && stopRecording()}
                                onTouchStart={startRecording}
                                onTouchEnd={stopRecording}
                                onClick={() => switchMode('voice')}
                                className={getToolbarButtonClasses('voice')}
                            >
                                <div className={getToolbarIconWrapperClasses('voice')}>
                                    <Mic/>
                                </div>
                                <div className={styles.toolbarText}>
                                    <h3>按住说话</h3>
                                    <p>{voiceStatus === 'recording' ? '录音中...' : '按住开始录音，松开发送'}</p>
                                </div>
                            </button>

                            <button
                                onClick={() => {
                                    switchMode('file');
                                    fileInputRef.current?.click();
                                }}
                                className={getToolbarButtonClasses('file')}
                            >
                                <div className={styles.toolbarIconWrapper}>
                                    <Upload/>
                                </div>
                                <div className={styles.toolbarText}>
                                    <h3>上传文件</h3>
                                    <p>支持PDF、图片等文件</p>
                                </div>
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                onChange={handleFileUpload}
                                className={styles.fileInput}
                            />

                            <button onClick={() => switchMode('camera')} className={getToolbarButtonClasses('camera')}>
                                <div className={styles.toolbarIconWrapper}>
                                    <Camera/>
                                </div>
                                <div className={styles.toolbarText}>
                                    <h3>拍摄</h3>
                                    <p>拍照上传报告</p>
                                </div>
                            </button>

                            <button onClick={() => switchMode('text')} className={getToolbarButtonClasses('text')}>
                                <div className={styles.toolbarIconWrapper}>
                                    <Keyboard/>
                                </div>
                                <div className={styles.toolbarText}>
                                    <h3>打字</h3>
                                    <p>使用键盘输入问题</p>
                                </div>
                            </button>
                        </div>
                        <button onClick={() => navigate('/')} className={styles.homeButton}>
                            <Home/>
                            <span>返回</span>
                        </button>
                    </div>
                </div>

                {cameraStatus !== 'closed' && (
                    <div className={styles.cameraOverlay}>
                        {cameraStatus === 'preview' && (
                            <div className={styles.cameraPreview}>
                                <div className={styles.cameraView}>
                                    <div className={styles.placeholder}>
                                        <Camera/>
                                        <p>摄像头预览</p>
                                        <p>（实际应用中这里会显示摄像头画面）</p>
                                    </div>
                                </div>
                                <div className={styles.cameraControls}>
                                    <button onClick={cancelCamera} className={styles.cancelButton}>
                                        <X/>
                                    </button>
                                    <button onClick={handleCapture} className={styles.captureButton}>
                                        <div className={styles.captureButtonInner}></div>
                                    </button>
                                </div>
                            </div>
                        )}
                        {cameraStatus === 'captured' && capturedImage && (
                            <div className={styles.capturedPreview}>
                                <div className={styles.capturedImageView}>
                                    <img src={capturedImage} alt="拍摄的照片"/>
                                </div>
                                <div className={styles.capturedControls}>
                                    <button onClick={retakePhoto}
                                            className={`${styles.controlButton} ${styles.retakeButton}`}>
                                        <div className={styles.controlButtonIcon}>
                                            <RotateCcw/>
                                        </div>
                                        <span>重拍</span>
                                    </button>
                                    <button onClick={confirmUpload}
                                            className={`${styles.controlButton} ${styles.confirmButton}`}>
                                        <div className={styles.controlButtonIcon}>
                                            <Check/>
                                        </div>
                                        <span>确认上传</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AIQA;
