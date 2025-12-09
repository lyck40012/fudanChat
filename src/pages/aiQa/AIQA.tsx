import React, {useState, useRef, useEffect} from 'react';
import {useNavigate} from 'react-router-dom';
import {Home, Mic, Camera, Keyboard, User, Bot, Send} from 'lucide-react';
import {message, Upload, Image, Typography} from 'antd';
import {UploadOutlined, CloseCircleFilled, FileTextOutlined} from '@ant-design/icons';
import type {UploadFile, UploadProps} from 'antd';
const { Text } = Typography;
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
    id: number;
    role: 'user' | 'ai' | 'system';
    content: string;
    imageUrl?: string;
    fileName?: string;
}

const PHOTO_API_BASE = 'http://127.0.0.1:5000';

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
    const {
        messages,
        loading,
        error,
        start,
        stop
    } = useChatSSE({
        url: 'https://api.coze.cn/v3/chat',
    })
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
        setCurrentMode('text');
    };

    const handleFileUpload: UploadProps['onChange'] = (info) => {
        let newFileList = [...info.fileList];

        // 限制最多上传3个文件
        newFileList = newFileList.slice(-3);

        setFileList(newFileList);

        if (info.file.status === 'uploading') {
            console.log('文件上传中:', info.file.name);
        } else if (info.file.status === 'done') {
            console.log('上传成功,服务器响应:', info.file.response);
            message.success(`${info.file.name} 文件上传成功`);

            // 保存文件ID供后续使用
            if (info.file.response && info.file.response.data) {
                const fileId = info.file.response.data.id;
                console.log('文件ID:', fileId);
                // 可以在这里保存 fileId 到 state 中
            }
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
        action: 'https://api.coze.cn/v1/files/upload',
        headers: {
            'Authorization': 'Bearer pat_hD3fk5ygNuFPLz5ndwIKYWmwY8qgET9DrruIA3Ean8cCEPfSi6o40EZmMg03TS5P'
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
        const content = textInput.trim();
        // loading 中或无输入时不触发
        if (loading || !content) return;

        const userMsg = {
            id: Date.now(),
            role: 'user',
            content,
            content_type: 'text'
        };

        setTextInput('');

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

                        <div className={styles.messageList}>
                            <div className={styles.messageListInner}>
                                {messages.map((message, index) => {
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
                                                    {message.imageUrl && (
                                                        <img src={message.imageUrl} alt="上传的图片"
                                                             className={styles.messageImage}/>
                                                    )}
                                                    <p className={styles.messageText}>{showLoadingBubble ? 'AI 正在生成...' : message.content}</p>
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

                            <Upload {...uploadProps}>
                                <button
                                    className={getToolbarButtonClasses('file')}
                                >
                                    <div className={styles.toolbarIconWrapper}>
                                        <UploadOutlined style={{fontSize: '28px'}}/>
                                    </div>
                                    <div className={styles.toolbarText}>
                                        <h3>上传文件</h3>
                                        <p>支持PDF、图片等文件</p>
                                    </div>
                                </button>
                            </Upload>

                            <button onClick={openCamera} className={getToolbarButtonClasses('camera')}>
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
            </div>
        </div>
        <CameraCaptureModal
            visible={cameraModalVisible}
            onClose={closeCamera}
            onCaptured={handleCapturedImage}
            baseUrl={PHOTO_API_BASE}
        />
        </>
    );
};

export default AIQA;
