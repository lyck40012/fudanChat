import React, {useState, useRef, useEffect} from 'react';
import {useNavigate} from 'react-router-dom';
import {Home, Mic, Camera, Keyboard, User, Bot, Send, StopCircle, Volume1, Volume2, FileUp} from 'lucide-react';
import {message, Upload, Image, Typography, Slider} from 'antd';
import {CloseCircleFilled, FileTextOutlined} from '@ant-design/icons';
import type {UploadFile, UploadProps} from 'antd';
const { Text } = Typography;
import markdownit from 'markdown-it';
import styles from './AIQA.module.scss';
import {
    AIDenoiserProcessorLevel,
    AIDenoiserProcessorMode,
    WsToolsUtils,
    WsTranscriptionClient
} from "@coze/api/ws-tools";

import {CommonErrorEvent, TranscriptionsMessageUpdateEvent, WebsocketsEventType} from "@coze/api";
import { useChatSSE } from '../../hooks/useChatSSE'
import { CameraCaptureModal } from './CameraCaptureModal'
type InputMode = 'voice' | 'file' | 'camera' | 'text';
type VoiceStatus = 'idle' | 'recording' | 'processing';

interface Message {
    id: number | string;
    role: 'user' | 'ai' | 'system';
    content: string;
    imageUrl?: string;
    imageUrls?: string[];  // 支持多张图片
    fileName?: string;
}
const md = markdownit({ html: true, breaks: true });

const renderMarkdown: any = (content) => {
    let result = content.trim()
    return <div dangerouslySetInnerHTML={{ __html: md.render(result) }} />;
};

const AIQA = () => {
    const navigate = useNavigate();
    const [currentMode, setCurrentMode] = useState<InputMode>('text');
    const [textInput, setTextInput] = useState('');
    const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle');
    const [fileList, setFileList] = useState<UploadFile[]>([]);
    const pressStartTimeRef = useRef<number | null>(null);
    const [selectedInputDevice, setSelectedInputDevice] = useState<string>('');
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [denoiserSupported, setDenoiserSupported] = useState<boolean>(false);
    const [recognizeResult,setRecognizeResult] = useState<Message>({} as Message) //暂存语音识别结果
    const [cameraModalVisible, setCameraModalVisible] = useState(false);
    const clientRef = useRef<WsTranscriptionClient>();
    const messageListRef = useRef<HTMLDivElement | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [spokenMessageId, setSpokenMessageId] = useState<string | number | null>(null);
    const [voiceId, setVoiceId] = useState<string>('');
    const [isAudioPlaying, setIsAudioPlaying] = useState(false);
    const [audioVolume, setAudioVolume] = useState<number>(80);
    const {
        messages,
        loading,
        error,
        start,
        stop
    } = useChatSSE({
        url: '/api/v3/chat',
    })
    useEffect(() => {
        //获取权限
        checkRequirements()
        //获取麦克风设备
        getDevices();
    }, []);

    useEffect(() => {
        if (messageListRef.current) {
            messageListRef.current.scrollTo({
                top: messageListRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, [messages]);

    // 拉取可用音色列表
    useEffect(() => {
        const fetchVoices = async () => {
            try {
                const res = await fetch('/api/v1/audio/voices', {
                    method: 'GET',
                    headers: {
                        Authorization: 'Bearer pat_hD3fk5ygNuFPLz5ndwIKYWmwY8qgET9DrruIA3Ean8cCEPfSi6o40EZmMg03TS5P'
                    },
                })
                if (!res.ok) throw new Error(`拉取音色失败: ${res.status}`)
                const data = await res.json()
                const id = data?.data?.voice_list?.[0]?.voice_id
                if (id) setVoiceId(id)
            } catch (err) {
                console.error('获取音色失败', err)
            }
        }
        fetchVoices()
    }, [])

    // 组件卸载时清理音频资源
    useEffect(() => () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
        setIsAudioPlaying(false)
    }, []);

    // 音量变化时同步到当前音频
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = audioVolume / 100
        }
    }, [audioVolume]);

    const playSpeech = async (text: string) => {
        if (!voiceId) return
        if (!text?.trim()) return;
        try {
            // 先停止上一段音频
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            setIsAudioPlaying(false)
            const res = await fetch('https://api.coze.cn/v1/audio/speech', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer pat_hD3fk5ygNuFPLz5ndwIKYWmwY8qgET9DrruIA3Ean8cCEPfSi6o40EZmMg03TS5P'
                },
                body: JSON.stringify({
                    voice_id: voiceId || '',
                    response_format: 'wav',
                    input: text,
                }),
            })
            if (!res.ok) {
                throw new Error(`TTS 请求失败: ${res.status}`)
            }
            const buffer = await res.arrayBuffer()
            const blob = new Blob([buffer], {type: 'audio/wav'})
            const url = URL.createObjectURL(blob)
            const audio = new Audio(url)
            audio.volume = audioVolume / 100
            audioRef.current = audio
            audio.onended = () => {
                setIsAudioPlaying(false)
                URL.revokeObjectURL(url)
            }
            audio.onerror = () => {
                setIsAudioPlaying(false)
                URL.revokeObjectURL(url)
            }
            await audio.play()
            setIsAudioPlaying(true)
        } catch (err) {
            console.error('语音播放失败', err)
            message.error('语音播放失败')
            setIsAudioPlaying(false)
        }
    }

    const stopSpeech = () => {
        if (audioRef.current) {
            audioRef.current.pause()
            audioRef.current.currentTime = 0
            audioRef.current = null
        }
        setIsAudioPlaying(false)
    }

    // 对话结束后自动播报最后一条 AI 回复
    useEffect(() => {
        if (loading) return
        const lastAi = [...messages].reverse().find(m => m.role === 'ai' && m.content?.trim())
        if (!lastAi) return
        if (spokenMessageId === lastAi.id) return
        playSpeech(lastAi.content)
        setSpokenMessageId(lastAi.id)
    }, [messages, loading, voiceId])

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
        client.on(WebsocketsEventType.TRANSCRIPTIONS_MESSAGE_UPDATE,(event: any) => {
                const userMsg: Message = {
                    logid: event.detail.logid,
                    id:event.id,
                    role: 'user',
                    content: event.data.content,
                    content_type:'text'
                };
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
    };


    const startRecording = () => {
        // 正在生成回答时不允许再次录音
        if (loading) return;
        if (currentMode !== 'voice') return;
        pressStartTimeRef.current = Date.now();
        clientRef.current.start()
        setVoiceStatus('recording');
    };

    const stopRecording = async () => {
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
        console.log("recognizeResult=======>",recognizeResult)
        // 调用 /v3/chat 接口
        try {
            start(recognizeResult)
        } catch (error) {
            console.error('调用chat接口失败:', error);
            message.error('请求失败');
        }
        setVoiceStatus('idle');
        setRecognizeResult({} as Message)

    };

    const openCamera = () => {
        // setCurrentMode('camera');
        setCameraModalVisible(true);
    };

    const closeCamera = () => {
        setCameraModalVisible(false);
    };

    const handleCapturedImage = (url: string) => {
        console.log("Captured image URL:", url);
        setFileList([...fileList, {
            uid: Date.now().toString(),
            url,
            isShoot: true,
            type: 'image/jpeg',
        }])
        setCurrentMode('text');
    };

    const handleFileUpload: UploadProps['onChange'] = (info) => {
        let newFileList = [...info.fileList];
        console.log("info.fileList===>",newFileList)
        setFileList(newFileList);
        if (info.file.status === 'uploading') {
            console.log('文件上传中:', info.file.name);
        } else if (info.file.status === 'done') {
            message.success(`${info.file.name} 文件上传成功`);

        } else if (info.file.status === 'error') {
            console.error('上传失败:', info.file.error);
            message.error(`${info.file.name} 文件上传失败: ${info.file.error?.message || '未知错误'}`);
        }
    };

    // 移除文件
    const handleRemoveFile = (file: UploadFile) => {
        const newFileList = fileList.filter(item => item.uid !== file.uid);
        setFileList(newFileList);
        message.info(`已移除 ${file.name}`);
    };

    // 判断文件是否为图片
    const isImageFile = (file: UploadFile) => {
        return file.type?.startsWith('image/');
    };

    // 获取文件预览URL
    const getFilePreviewUrl = (file: UploadFile) => {

        if (file.originFileObj) {
            return URL.createObjectURL(file.originFileObj);
        }
        return file.url || '';
    };

    const uploadProps: UploadProps = {
        fileList,
        onChange: handleFileUpload,
        action: '/api/v1/files/upload',
        headers: {
            'Authorization': 'Bearer pat_hD3fk5ygNuFPLz5ndwIKYWmwY8qgET9DrruIA3Ean8cCEPfSi6o40EZmMg03TS5P',
        },
        name: 'file',
        data: (file) => {
            const formData = new FormData();
            formData.append('file', file);
            return formData;
        },
        beforeUpload: (file) => {
            const isValidType = [
                'application/pdf',
                'image/jpeg',
                'image/jpg',
                'image/png',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            ].includes(file.type);
            if (!isValidType) {
                message.error('只支持上传 PDF、图片、Word 文件!');
                return Upload.LIST_IGNORE;
            }
            const isLt10M = file.size / 1024 / 1024 < 10;
            if (!isLt10M) {
                message.error('文件大小不能超过 10MB!');
                return Upload.LIST_IGNORE;
            }
            return true;
        },
        showUploadList: false,
        maxCount: 3,
        multiple: true,
    };

    const handleSendText = async () => {
        const content = textInput?.trim();
        // loading 中或无输入时不触发
        if (loading || !content) return;
        const userMsg = {
            id: Date.now(),
            role: 'user',
            content,
            content_type: 'text',
            imageUrls: fileList.length > 0 ? fileList : undefined
        };

        setTextInput('');
        // 清空文件列表
        setFileList([]);

        try {
            await start(userMsg);
        } catch (error) {
            console.error('调用chat接口失败:', error);
            message.error('请求失败');
        }
    };

    const handleKeyPress = async (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            await handleSendText();
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

    return (
        <>
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

                            <div className={styles.messageList} ref={messageListRef}>
                                <div className={styles.messageListInner}>
                                    {messages.map((message, index) => {
                                        console.log('message=======>',message)
                                        const isLast = index === messages.length - 1;
                                        const hasContent = !!message.content?.trim();
                                        const showLoadingBubble = loading && isLast && message.role === 'ai' && !hasContent;
                                        return (
                                            <div key={message.id} className={`${styles.messageRow} ${styles[message.role]} ${showLoadingBubble ? styles.loadingMessage : ''}`}>
                                                {message.role !== 'system' && (
                                                    <div className={`${styles.avatar} ${styles[message.role]}`}>
                                                        {message.role === 'user' ? <User/> : <Bot/>}
                                                    </div>
                                                )}
                                                <div className={`${styles.messageContentWrapper} ${styles[message.role]}`}>
                                                    {message.role === 'system' ? (
                                                        <div className={`${styles.messageBubble} ${styles.system}`}>
                                                            <p>📄 {message.content}</p>
                                                        </div>
                                                    ) : (
                                                        <div className={`${styles.messageBubble} ${styles[message.role]} ${showLoadingBubble ? styles.loadingBubble : ''}`}>
                                                            {showLoadingBubble && <div className={styles.bubbleSpinner}></div>}
                                                            {message.imageUrls && message.imageUrls.length > 0 && (
                                                                <div className={styles.messageImagesGrid}>
                                                                    <Image.PreviewGroup>
                                                                        {message.imageUrls.map((url, idx) => (
                                                                            <Image
                                                                                key={idx}
                                                                                src={getFilePreviewUrl(url)}
                                                                                alt={`图片 ${idx + 1}`}
                                                                                className={styles.messageImage}
                                                                                preview={{
                                                                                    mask: '预览'
                                                                                }}
                                                                            />
                                                                        ))}
                                                                    </Image.PreviewGroup>
                                                                </div>
                                                            )}
                                                            <p className={styles.messageText}>{showLoadingBubble ? 'AI 正在生成...' : renderMarkdown(message.content)}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )})}
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
                                    <div className={styles.textInputWrapper}>
                                        {/* 文件列表显示区域 */}
                                        {fileList.length > 0 && (
                                            <div className={styles.fileListContainer}>
                                                {fileList.map((file) => (
                                                    <div key={file.uid} className={styles.fileItem}>
                                                        {isImageFile(file) ? (
                                                            <Image
                                                                width={32}
                                                                height={32}
                                                                src={getFilePreviewUrl(file)}
                                                                alt={file.name}
                                                                style={{ borderRadius: '6px', objectFit: 'cover' }}
                                                                preview={{
                                                                    mask: '预览'
                                                                }}
                                                            />
                                                        ) : (
                                                            <div className={styles.filePreview}>
                                                                <FileTextOutlined className={styles.fileIcon} />
                                                            </div>
                                                        )}
                                                        <div className={styles.fileInfo}>
                                                            <Text className={styles.fileName} ellipsis={{ tooltip: file.name }}>
                                                                {file.name}
                                                            </Text>
                                                            <Text className={styles.fileSize}>
                                                                {file.size ? `${(file.size / 1024).toFixed(1)} KB` : ''}
                                                            </Text>
                                                        </div>
                                                        <CloseCircleFilled
                                                            className={styles.removeFileButton}
                                                            onClick={() => handleRemoveFile(file)}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* 输入框区域 */}
                                        <div className={styles.textInputContainer}>
                                        <textarea
                                            value={textInput}
                                            onChange={(e) => setTextInput(e.target.value)}
                                            onKeyPress={handleKeyPress}
                                            placeholder="请输入您的问题..."
                                            className={styles.textInput}
                                            disabled={loading}
                                            rows={2}
                                        />
                                            <button onClick={handleSendText} className={styles.sendButton} disabled={loading}>
                                                <Send/>
                                            </button>
                                        </div>
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
                            <button onClick={() => navigate('/')} className={styles.homeButton}>
                                <Home/>
                                <span>返回</span>
                            </button>

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
                                    <span>语音</span>
                                </button>

                                <Upload {...uploadProps} style={{ width: '100%' }}>
                                    <button
                                        className={getToolbarButtonClasses('file')}
                                    >
                                        <div className={styles.toolbarIconWrapper}>
                                            <FileUp />
                                        </div>
                                        <span>上传</span>
                                    </button>
                                </Upload>

                                <button onClick={openCamera} className={getToolbarButtonClasses('camera')}>
                                    <div className={styles.toolbarIconWrapper}>
                                        <Camera/>
                                    </div>
                                    <span>拍摄</span>
                                </button>

                                <button onClick={() => switchMode('text')} className={getToolbarButtonClasses('text')}>
                                    <div className={styles.toolbarIconWrapper}>
                                        <Keyboard/>
                                    </div>
                                    <span>输入</span>
                                </button>

                                <button
                                    onClick={stopSpeech}
                                    className={`${styles.toolbarButton} ${styles.stopAudioToolbar}`}
                                    disabled={!isAudioPlaying}
                                >
                                    <div className={styles.toolbarIconWrapper}>
                                        <StopCircle/>
                                    </div>
                                    <span>停止</span>
                                </button>
                            </div>

                            <div className={styles.volumeCard}>
                                <Volume2 className={styles.volumeIconHigh} size={16} />
                                <div className={styles.sliderWrapper}>
                                    <Slider
                                        vertical
                                        min={0}
                                        max={100}
                                        value={audioVolume}
                                        onChange={(value) => setAudioVolume(value as number)}
                                        tooltip={{ formatter: (value) => `${value}%`, placement: 'left' }}
                                    />
                                </div>
                                <Volume1 className={styles.volumeIconLow} size={16} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <CameraCaptureModal
                visible={cameraModalVisible}
                onClose={closeCamera}
                onCaptured={handleCapturedImage}
            />
        </>
    );
};

export default AIQA;
