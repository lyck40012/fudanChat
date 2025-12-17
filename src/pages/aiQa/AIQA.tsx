import React, {useState, useRef, useEffect} from 'react';
import {useNavigate, useLocation} from 'react-router-dom';
import {Home, Mic, Camera, Keyboard, User, Bot, Send, StopCircle, Volume1, Volume2, FileUp, MessageSquarePlus, Phone, PhoneOff} from 'lucide-react';
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

import { WebsocketsEventType, CozeAPI} from "@coze/api";
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
    const location = useLocation();

    // 从路由获取 botId，默认使用预问诊的 botId
    const botIdFromRoute = (location.state as { botId?: string })?.botId || '7574375637029273609';

    // 创建 Coze API 客户端实例
    const cozeClient = useRef(new CozeAPI({
        token: 'pat_hD3fk5ygNuFPLz5ndwIKYWmwY8qgET9DrruIA3Ean8cCEPfSi6o40EZmMg03TS5P',
        allowPersonalAccessTokenInBrowser: true,
        baseURL: 'https://api.coze.cn',
    })).current;
    const recognizeResult = useRef<Message>({} as Message);
    const [currentMode, setCurrentMode] = useState<InputMode>('text');
    const [textInput, setTextInput] = useState('');
    const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle');
    const [fileList, setFileList] = useState<UploadFile[]>([]);
    const fileListRef = useRef<UploadFile[]>([]); // 使用 ref 解决闭包问题
    const pressStartTimeRef = useRef<number | null>(null);
    const [selectedInputDevice, setSelectedInputDevice] = useState<string>('');
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [denoiserSupported, setDenoiserSupported] = useState<boolean>(false);
    const [cameraModalVisible, setCameraModalVisible] = useState(false);
    const clientRef = useRef<WsTranscriptionClient>();
    const messageListRef = useRef<HTMLDivElement | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const speechAbortRef = useRef<AbortController | null>(null);
    const initialQuestionRef = useRef<string | null>(null);
    const [spokenMessageId, setSpokenMessageId] = useState<string | number | null>(null);
    const [voiceId, setVoiceId] = useState<string>('');
    const [isAudioPlaying, setIsAudioPlaying] = useState(false);
    const [audioVolume, setAudioVolume] = useState<number>(80);
    const [isUploading, setIsUploading] = useState(false); // 是否有文件正在上传
    // 触摸手势相关状态
    const [showMask, setShowMask] = useState(false); // 是否显示遮罩层
    const [touchStartY, setTouchStartY] = useState<number>(0); // 触摸起始Y坐标
    const [currentTouchY, setCurrentTouchY] = useState<number>(0); // 当前触摸Y坐标
    const [isCanceling, setIsCanceling] = useState(false); // 是否在取消区域
    const [isMouseDown, setIsMouseDown] = useState(false); // 鼠标是否按下
    // 语音通话相关状态
    const [isVoiceCallActive, setIsVoiceCallActive] = useState(false); // 是否处于语音通话模式
    const isVoiceCallActiveRef = useRef(false); // 使用 ref 解决闭包问题
    const silenceTimerRef = useRef<NodeJS.Timeout | null>(null); // 静默检测定时器
    const lastContentRef = useRef<string>(''); // 上次识别的内容，用于检测变化
    const {
        messages,
        loading,
        error,
        start,
        stop,
        reset
    } = useChatSSE({
        url: `${import.meta.env.VITE_API_BASE_URL}/v3/chat`,
        botId: botIdFromRoute,
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
                const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/v1/audio/voices`, {
                    method: 'GET',
                    headers: {
                        Authorization: 'Bearer pat_hD3fk5ygNuFPLz5ndwIKYWmwY8qgET9DrruIA3Ean8cCEPfSi6o40EZmMg03TS5P'
                    },
                })
                if (!res.ok) throw new Error(`拉取音色失败: ${res.status}`)
                const data = await res.json()
              let findItem = data?.data?.voice_list?.find(x=>x.voice_id=='7426725529589661723')
                const id = findItem?.voice_id
                if (id) setVoiceId(id)
            } catch (err) {
                console.error('获取音色失败', err)
            }
        }
        fetchVoices()
    }, [])

    // 组件卸载时彻底清理语音链路，防止残留播放/录制/请求
    useEffect(() => () => {
        if (audioRef.current) {
            const src = audioRef.current.src;
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current = null;
            if (src?.startsWith('blob:')) URL.revokeObjectURL(src);
        }
        if (clientRef.current) {
            try {
                clientRef.current.stop();
            } catch (err) {
                console.error('停止语音客户端失败', err);
            }
            clientRef.current = undefined;
        }
        if (speechAbortRef.current) {
            speechAbortRef.current.abort();
            speechAbortRef.current = null;
        }
        // 清理语音通话的定时器
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }
        pressStartTimeRef.current = null;
        setVoiceStatus('idle');
        recognizeResult.current = {}
        stop?.();
        setIsAudioPlaying(false);
        setIsVoiceCallActive(false);
        isVoiceCallActiveRef.current = false; // 同步更新 ref
    }, []);

    // 音量变化时同步到当前音频
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = audioVolume / 100
        }
    }, [audioVolume]);

    // 同步 fileList state 到 ref，解决语音通话中的闭包问题
    useEffect(() => {
        fileListRef.current = fileList;
    }, [fileList]);

    useEffect(() => {
        stopAudio()
    }, [currentMode]);
    const playSpeech = async (text: string) => {
        if (!voiceId) return
        if (!text?.trim()) return;
        try {
            // 若已有语音请求在飞行，则先中止
            if (speechAbortRef.current) {
                speechAbortRef.current.abort();
            }
            const controller = new AbortController();
            speechAbortRef.current = controller;

            // 先停止上一段音频
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            setIsAudioPlaying(false)
            const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/v1/audio/speech`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer pat_hD3fk5ygNuFPLz5ndwIKYWmwY8qgET9DrruIA3Ean8cCEPfSi6o40EZmMg03TS5P'
                },
                signal: controller.signal,
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
            if ((err as any)?.name === 'AbortError') return;
            console.error('语音播放失败', err)
            message.error('语音播放失败')
            setIsAudioPlaying(false)
        } finally {
            speechAbortRef.current = null;
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

    // 监听 loading 状态变化，在语音通话模式下 AI 回答完成后自动重新开始录音
    useEffect(() => {
        if (!loading && isVoiceCallActive) {
            // AI 回答完成，重新开始录音
            if (clientRef.current) {
                try {
                    clientRef.current.start();
                } catch (err) {
                    console.error('重新开始录音失败', err);
                }
            }
        }
    }, [loading, isVoiceCallActive])

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
            recognizeResult.current =userMsg;
            console.log(event, isVoiceCallActiveRef.current)
            // 如果处于语音通话模式，触发静默检测
            if (isVoiceCallActiveRef.current) {
                handleVoiceCallContentUpdate(event.data.content);
            }
            },
        );

        // 监听错误事件
        client.on(WebsocketsEventType.ERROR, (error: unknown) => {
            console.error(error);
            // message.error((error as CommonErrorEvent).data.msg);
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


    // 开始语音通话
    const startVoiceCall = () => {
        stopAudio();

        // 如果有文件正在上传，不允许开始通话
        if (isUploading) {
            message.warning('文件正在上传中，请稍候...');
            return;
        }

        // 正在生成回答时不允许开始通话
        if (loading) {
            message.warning('AI正在回答中，请稍候...');
            return;
        }

        // 初始化语音客户端
        try {
            if (!clientRef.current) {
                initClient();
            }
        } catch (error) {
            console.error(error);
            message.error((error as Error).message || '语音初始化失败');
            return;
        }

        // 清空上次的识别内容
        lastContentRef.current = '';
        recognizeResult.current = {} as Message;

        // 设置通话状态
        setIsVoiceCallActive(true);
        isVoiceCallActiveRef.current = true; // 同步更新 ref

        // 开始录音（语音通话模式不改变 voiceStatus）
        clientRef.current.start();

        message.success('语音通话已开启，请开始说话');
    };

    // 停止语音通话
    const stopVoiceCall = () => {
        // 清除静默定时器
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }

        // 停止录音
        if (clientRef.current) {
            try {
                clientRef.current.stop();
            } catch (err) {
                console.error('停止录音失败', err);
            }
        }

        // 重置状态（不改变 voiceStatus 和 currentMode）
        setIsVoiceCallActive(false);
        isVoiceCallActiveRef.current = false; // 同步更新 ref
        lastContentRef.current = '';
        recognizeResult.current = {} as Message;

        message.info('语音通话已结束');
    };

    // 处理语音通话中的内容更新，触发静默检测
    const handleVoiceCallContentUpdate = (content: string) => {
        // 清除之前的定时器
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }
        // 如果内容有变化，说明用户还在说话
        if (content && content !== lastContentRef.current) {
            lastContentRef.current = content;

            // 设置新的静默检测定时器（1秒）
            silenceTimerRef.current = setTimeout(() => {
                // 1秒后如果没有新的内容更新，则自动发送
                handleAutoSendInVoiceCall();
            }, 1000);
        }
    };

    // 语音通话模式下的自动发送
    const handleAutoSendInVoiceCall = async () => {
        if (!isVoiceCallActiveRef.current) return;

        // 检查是否有内容
        const content = recognizeResult.current?.content?.trim();
        if (!content) {
            // 没有内容，重新开始录音
            lastContentRef.current = '';
            return;
        }

        // 停止当前录音
        if (clientRef.current) {
            try {
                clientRef.current.stop();
            } catch (err) {
                console.error('停止录音失败', err);
            }
        }

        // 发送消息（使用 ref 获取最新的文件列表）
        const messageToSend = {
            ...recognizeResult.current,
            imageUrls: fileListRef.current.length > 0 ? fileListRef.current : undefined
        };
        console.log(messageToSend, fileListRef.current)
        try {
            await start(messageToSend);
            // 发送后清空文件列表和识别结果
            setFileList([]);
            recognizeResult.current = {} as Message;
            lastContentRef.current = '';

            // 等待 AI 回答完成后，自动重新开始录音
            // 这个逻辑会在 loading 状态变化时处理
        } catch (error) {
            console.error('自动发送失败:', error);
            message.error('发送失败');
        }
    };

    const startRecording = () => {
        stopAudio()

        // 如果处于语音通话模式，不允许按住说话
        if (isVoiceCallActive) {
            message.warning('语音通话进行中，请先结束通话');
            return;
        }

        // 如果有文件正在上传，不允许录音
        if (isUploading) {
            message.warning('文件正在上传中，请稍候...');
            return;
        }
        // 正在生成回答时不允许再次录音
        if (loading) return;

        // 自动切换到语音模式并初始化客户端
        if (currentMode !== 'voice') {
            try {
                if (!clientRef.current) {
                    initClient();
                }
                setCurrentMode('voice');
            } catch (error) {
                console.error(error);
                message.error((error as Error).message || '语音初始化失败');
                return;
            }
        }

        pressStartTimeRef.current = Date.now();
        clientRef.current.start()
        setVoiceStatus('recording');
    };

    const stopRecording = async () => {
        if (currentMode !== 'voice' || voiceStatus !== 'recording'){

            return
        };

        // 立即重置UI状态，让用户看到已停止录音
        setVoiceStatus('idle');

        // 如果有文件正在上传，不允许发送
        if (isUploading) {
            message.warning('文件正在上传中，请稍候...');
            return;
        }
        const pressDuration = pressStartTimeRef.current ? Date.now() - pressStartTimeRef.current : 0;
        pressStartTimeRef.current = null;

        if(!recognizeResult?.current?.content&&!fileList.length){
            clientRef?.current?.stop()
            return;
        }
        if (pressDuration < 500) {
            clientRef?.current?.stop()
            message.warning('时间过短');
            return;
        }
        try {
            setTimeout(()=>{
                clientRef?.current?.stop()
                const messageWithImages = {
                    ...(recognizeResult?.current ||{}),
                    imageUrls: fileList.length > 0 ? fileList : undefined
                };
                start(messageWithImages)
                // 发送后清空文件列表和识别结果
                setFileList([]);
                recognizeResult.current = {}
            },1000)
            // 将上传的图片附加到语音识别结果中

        } catch (error) {
            console.error('调用chat接口失败:', error);
            message.error('请求失败');
            // 发生错误时也要清空
            recognizeResult.current = {}
        }
    };

    // 触摸手势处理函数
    const handleVoiceTouchStart = (e: React.TouchEvent) => {
        e.preventDefault();
        const touch = e.touches[0];
        setTouchStartY(touch.clientY);
        setCurrentTouchY(touch.clientY);
        setShowMask(true);
        setIsCanceling(false);
        startRecording();
    };

    const handleVoiceTouchMove = (e: React.TouchEvent) => {
        e.preventDefault();
        const touch = e.touches[0];
        setCurrentTouchY(touch.clientY);

        // 计算滑动距离，向上滑动为负值
        const distance = touchStartY - touch.clientY;
        // 如果向上滑动超过100px，则进入取消区域
        const CANCEL_THRESHOLD = 100;
        setIsCanceling(distance > CANCEL_THRESHOLD);
    };

    const handleVoiceTouchEnd = (e: React.TouchEvent) => {
        e.preventDefault();
        setShowMask(false);
        setIsMouseDown(false);

        // 立即重置录音状态到 idle，让UI马上恢复
        setVoiceStatus('idle');

        // 如果在取消区域，则取消发送
        if (isCanceling) {
            // 取消录音
            if (clientRef.current) {
                try {
                    clientRef.current.stop();
                } catch (err) {
                    console.error('停止录音失败', err);
                }
            }
            recognizeResult.current = {} as Message;
            message.info('已取消发送');
            setIsCanceling(false);
        } else {
            // 否则触发发送
            const pressDuration = pressStartTimeRef.current ? Date.now() - pressStartTimeRef.current : 0;
            pressStartTimeRef.current = null;

            if(!recognizeResult?.current?.content && !fileList.length){
                if (clientRef.current) {
                    try {
                        clientRef.current.stop();
                    } catch (err) {
                        console.error('停止录音失败', err);
                    }
                }
            } else if (pressDuration < 500) {
                if (clientRef.current) {
                    try {
                        clientRef.current.stop();
                    } catch (err) {
                        console.error('停止录音失败', err);
                    }
                }
                message.warning('时间过短');
            } else if (!isUploading) {
                // 正常发送
                setTimeout(()=>{
                    if (clientRef.current) {
                        try {
                            clientRef.current.stop();
                        } catch (err) {
                            console.error('停止录音失败', err);
                        }
                    }
                    const messageWithImages = {
                        ...(recognizeResult?.current ||{}),
                        imageUrls: fileList.length > 0 ? fileList : undefined
                    };
                    start(messageWithImages);
                    // 发送后清空文件列表和识别结果
                    setFileList([]);
                    recognizeResult.current = {};
                }, 1000);
            } else {
                message.warning('文件正在上传中，请稍候...');
            }
        }

        setTouchStartY(0);
        setCurrentTouchY(0);
    };

    // 鼠标手势处理函数
    const handleVoiceMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsMouseDown(true);
        setTouchStartY(e.clientY);
        setCurrentTouchY(e.clientY);
        setShowMask(true);
        setIsCanceling(false);
        startRecording();

        // 保存起始位置，用于计算距离
        const startY = e.clientY;
        let currentCanceling = false;

        // 在 document 上添加事件监听，这样即使鼠标移出元素也能监听到
        const handleDocumentMouseMove = (e: MouseEvent) => {
            e.preventDefault();
            setCurrentTouchY(e.clientY);

            // 计算滑动距离，向上滑动为负值
            const dist = startY - e.clientY;
            // 如果向上滑动超过100px，则进入取消区域
            const CANCEL_THRESHOLD = 100;
            currentCanceling = dist > CANCEL_THRESHOLD;
            setIsCanceling(currentCanceling);
        };

        const handleDocumentMouseUp = (e: MouseEvent) => {
            e.preventDefault();
            setIsMouseDown(false);
            setShowMask(false);

            // 移除 document 事件监听
            document.removeEventListener('mousemove', handleDocumentMouseMove);
            document.removeEventListener('mouseup', handleDocumentMouseUp);

            // 立即重置录音状态到 idle，让UI马上恢复
            setVoiceStatus('idle');

            // 如果在取消区域，则取消发送
            if (currentCanceling) {
                // 取消录音
                if (clientRef.current) {
                    try {
                        clientRef.current.stop();
                    } catch (err) {
                        console.error('停止录音失败', err);
                    }
                }
                recognizeResult.current = {} as Message;
                message.info('已取消发送');
                setIsCanceling(false);
            } else {
                // 否则触发发送（此时状态已经是 idle，stopRecording 内部检查需要调整）
                // 直接处理发送逻辑
                const pressDuration = pressStartTimeRef.current ? Date.now() - pressStartTimeRef.current : 0;
                pressStartTimeRef.current = null;

                if(!recognizeResult?.current?.content && !fileList.length){
                    if (clientRef.current) {
                        try {
                            clientRef.current.stop();
                        } catch (err) {
                            console.error('停止录音失败', err);
                        }
                    }
                } else if (pressDuration < 500) {
                    if (clientRef.current) {
                        try {
                            clientRef.current.stop();
                        } catch (err) {
                            console.error('停止录音失败', err);
                        }
                    }
                    message.warning('时间过短');
                } else if (!isUploading) {
                    // 正常发送
                    setTimeout(()=>{
                        if (clientRef.current) {
                            try {
                                clientRef.current.stop();
                            } catch (err) {
                                console.error('停止录音失败', err);
                            }
                        }
                        const messageWithImages = {
                            ...(recognizeResult?.current ||{}),
                            imageUrls: fileList.length > 0 ? fileList : undefined
                        };
                        start(messageWithImages);
                        // 发送后清空文件列表和识别结果
                        setFileList([]);
                        recognizeResult.current = {};
                    }, 1000);
                } else {
                    message.warning('文件正在上传中，请稍候...');
                }
            }

            setTouchStartY(0);
            setCurrentTouchY(0);
        };

        // 添加 document 事件监听
        document.addEventListener('mousemove', handleDocumentMouseMove);
        document.addEventListener('mouseup', handleDocumentMouseUp);
    };

    const openCamera = () => {
        // setCurrentMode('camera');
        stopAudio()
        setCameraModalVisible(true);
    };

    const closeCamera = () => {
        setCameraModalVisible(false);
    };

    const handleCapturedImage = (url: string) => {
        setFileList([...fileList, {
            uid: Date.now().toString(),
            url,
            isShoot: true,
            type: 'image/jpeg',
        }])
        setCurrentMode('text');
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
    // 使用扣子 SDK 上传文件
    const uploadFileWithFetch = async (file: UploadFile) => {
        try {
            // 标记开始上传
            setIsUploading(true);

            // 更新文件状态为上传中
            setFileList(prev => prev.map(f =>
                f.uid === file.uid ? { ...f, status: 'uploading' } : f
            ));

            // 使用 Coze SDK 上传文件
            const result = await cozeClient.files.upload({
                file: file.originFileObj as File,
            });


            // 更新文件状态为成功
            setFileList(prev => prev.map(f =>
                f.uid === file.uid ? { ...f, status: 'done', response: result } : f
            ));
            message.success(`${file.name} 文件上传成功`);

        } catch (error) {
            console.error('上传失败:', error);
            // 上传失败时从列表中移除该文件
            setFileList(prev => prev.filter(f => f.uid !== file.uid));
            message.error(`${file.name} 文件上传失败: ${(error as Error).message || '未知错误'}`);
        } finally {
            // 标记上传结束
            setIsUploading(false);
        }
    };

    const handleFileUpload: UploadProps['onChange'] = (info) => {
        console.log('文件变化:', info.fileList);
    };
    const uploadProps: UploadProps = {
        fileList,
        onChange: handleFileUpload,
        beforeUpload: (file) => {
            // 验证文件类型
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

            // 验证文件大小
            const isLt10M = file.size / 1024 / 1024 < 10;
            if (!isLt10M) {
                message.error('文件大小不能超过 10MB!');
                return Upload.LIST_IGNORE;
            }

            // 添加到文件列表
            const newFile: UploadFile = {
                uid: file.uid,
                name: file.name,
                status: 'uploading',
                originFileObj: file,
                type: file.type,
            };
            setFileList(prev => [...prev, newFile]);

            // 使用 fetch 手动上传
            uploadFileWithFetch(newFile);

            // 返回 false 阻止 antd 的自动上传
            return false;
        },
        showUploadList: false,
        maxCount: 3,
        multiple: true,
    };

    const stopAudio =()=>{
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current = null;
        }
        setIsAudioPlaying(false);
        // 终止正在进行的 TTS 请求
        if (speechAbortRef.current) {
            speechAbortRef.current.abort();
            speechAbortRef.current = null;
        }
    }

    // 新建对话
    const handleNewConversation = () => {
        // 停止音频播放
        stopAudio();
        // 停止语音通话
        if (isVoiceCallActive) {
            stopVoiceCall();
        }
        // 停止语音识别
        if (clientRef.current && voiceStatus === 'recording') {
            clientRef.current.stop();
            setVoiceStatus('idle');
        }
        // 清空文件列表
        setFileList([]);
        // 清空文本输入
        setTextInput('');
        // 清空识别结果
        recognizeResult.current = {} as Message;
        // 重置已播报消息ID
        setSpokenMessageId(null);
        // 清空对话历史
        reset();
        // 自动发送"你好"
        handleSendText('你好');
    };

    const handleSendText = async (contentOverride?: string) => {

        // 如果有文件正在上传，不允许发送
        if (isUploading) {
            message.warning('文件正在上传中，请稍候...');
            return;
        }

        const content = (contentOverride || textInput).trim();
        // loading 中或无输入时不触发
        if(!fileList.length){
            if (loading || !content ) return;
        }
        stopAudio()


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


    // 处理从首页预设问题跳转时自动提问
    useEffect(() => {
        const state = location.state as { initialQuestion?: string } | undefined;
        const rawQuestion = state?.initialQuestion;

        // 严格检查：确保 initialQuestion 是字符串类型
        if (typeof rawQuestion !== 'string') {
            if (rawQuestion !== undefined) {
                console.warn('initialQuestion 不是字符串类型，已忽略', rawQuestion);
            }
            return;
        }

        const question = rawQuestion.trim();
        if (!question) return;
        if (initialQuestionRef.current === question) return;

        initialQuestionRef.current = question;
        setCurrentMode('text');
        setTextInput(question);
        handleSendText(question);
    }, [location.state]);

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
    return (
        <>
            {/* 全屏语音遮罩层 */}
            {showMask && (
                <div className={styles.voiceMask}>
                    <div className={styles.maskContent}>
                        <div className={styles.maskIcon}>
                            <Mic size={60} />
                        </div>
                        <div className={styles.maskText}>
                            {isCanceling ? '松开，取消发送' : '上划取消'}
                        </div>
                        <div className={styles.maskHint}>
                            {isCanceling ? '' : '松开，发送消息'}
                        </div>
                    </div>
                </div>
            )}

            <div className={styles.container}>
                <div className={styles.phone}>
                    {/* Corner Decorations */}
                    <div className={styles.cornerTL}></div>
                    <div className={styles.cornerTR}></div>
                    <div className={styles.cornerBL}></div>
                    <div className={styles.cornerBR}></div>

                    <div className={styles.contentWrapper}>
                        <div className={styles.topNav}>
                            <h1>AI 智能问答</h1>
                            <div className={styles.topNavStatus}>在线</div>
                        </div>

                        <div className={styles.mainContent}>
                            <div className={styles.chatArea}>
                                <div className={styles.modeInfo}>
                                    <p>
                                        {isVoiceCallActive && '>>> 语音通话进行中...'}
                                        {!isVoiceCallActive && currentMode === 'voice' && '>>> 语音输入模式已激活'}
                                        {!isVoiceCallActive && currentMode === 'text' && '>>> 文字指令输入就绪'}
                                        {!isVoiceCallActive && currentMode === 'file' && '>>> 文件解析模块加载完毕'}
                                        {!isVoiceCallActive && currentMode === 'camera' && '>>> 视觉传感器已连接'}
                                    </p>
                                </div>

                                <div className={styles.messageList} ref={messageListRef}>
                                    <div className={styles.messageListInner}>
                                        {messages.map((message, index) => {
                                            const isLast = index === messages.length - 1;
                                            const hasContent = !!message.content?.trim();
                                            const showLoadingBubble = loading && isLast && message.role === 'ai' && !hasContent;
                                            return (
                                                <div key={message.id} className={`${styles.messageRow} ${styles[message.role]} ${showLoadingBubble ? styles.loadingMessage : ''}`}>
                                                    {message.role !== 'system' && (
                                                        <div className={`${styles.avatar} ${styles[message.role]}`}>
                                                            {message.role === 'user' ? <User size={20}/> : <Bot size={20}/>}
                                                        </div>
                                                    )}
                                                    <div className={`${styles.messageContentWrapper} ${styles[message.role]}`}>
                                                        {message.role === 'system' ? (
                                                            <div className={`${styles.messageBubble} ${styles.system}`}>
                                                                <p>系统消息: {message.content}</p>
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
                                                                                    alt={`图片数据_${idx}`}
                                                                                    className={styles.messageImage}
                                                                                    preview={{
                                                                                        mask: '预览'
                                                                                    }}
                                                                                />
                                                                            ))}
                                                                        </Image.PreviewGroup>
                                                                    </div>
                                                                )}
                                                                <p className={styles.messageText}>{showLoadingBubble ? 'AI识别中...' : renderMarkdown(message.content ||'')}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )})}
                                    </div>
                                </div>

                                <div className={styles.statusBar}>
                                    {/* 文件列表显示区域 - 统一渲染，不重复 */}
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
                                                            style={{ borderRadius: '2px', objectFit: 'cover' }}
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
                                                    </div>
                                                    <CloseCircleFilled
                                                        className={styles.removeFileButton}
                                                        onClick={() => handleRemoveFile(file)}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {voiceStatus === 'idle' && (
                                        <>
                                            {/* 输入区域 */}
                                            <div className={styles.textInputWrapper}>
                                                <div className={styles.textInputContainer}>
                                                    {/* 语音通话模式 */}
                                                    {isVoiceCallActive ? (
                                                        <div className={`${styles.voicePrompt} ${styles.calling}`}>
                                                            <Phone className={styles.voiceIcon} size={20} />
                                                            <span className={styles.voiceText}>
                                                                {loading ? 'AI正在回答...' : '语音通话中...'}
                                                            </span>
                                                        </div>
                                                    ) : currentMode === 'voice' ? (
                                                        /* 按住说话模式 */
                                                        <div
                                                            className={`${styles.voicePrompt} ${voiceStatus === 'recording' ? styles.recording : ''}`}
                                                            onMouseDown={handleVoiceMouseDown}
                                                            onTouchStart={handleVoiceTouchStart}
                                                            onTouchMove={handleVoiceTouchMove}
                                                            onTouchEnd={handleVoiceTouchEnd}
                                                        >
                                                            <Mic className={styles.voiceIcon} size={20} />
                                                            <span className={styles.voiceText}>
                                                                长按此处开始说话
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        /* 文本模式显示输入框 */
                                                        <textarea
                                                            value={textInput}
                                                            onChange={(e) => setTextInput(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                                    e.preventDefault();
                                                                    handleSendText();
                                                                }
                                                            }}
                                                            placeholder="请输入指令..."
                                                            className={styles.textInput}
                                                            disabled={loading || isUploading}
                                                            rows={1}
                                                        />
                                                    )}

                                                    {/* 根据模式显示不同的按钮 */}
                                                    {!isVoiceCallActive && (
                                                        <>
                                                            {currentMode === 'voice' ? (
                                                                /* 语音模式：显示键盘按钮切换回文本 */
                                                                <button
                                                                    onClick={() => switchMode('text')}
                                                                    className={styles.inputModeButton}
                                                                    title="切换到键盘模式"
                                                                >
                                                                    <Keyboard size={18} />
                                                                </button>
                                                            ) : (
                                                                /* 文本模式：显示麦克风按钮切换到语音 */
                                                                <button
                                                                    onClick={() => switchMode('voice')}
                                                                    className={styles.inputModeButton}
                                                                    title="切换到语音模式"
                                                                >
                                                                    <Mic size={18} />
                                                                </button>
                                                            )}

                                                            <button
                                                                onClick={() => handleSendText()}
                                                                className={styles.sendButton}
                                                                disabled={loading || isUploading || currentMode === 'voice'}
                                                            >
                                                                <Send size={18} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {/* 录音中显示（仅在非语音通话模式下） */}
                                    {voiceStatus === 'recording' && !isVoiceCallActive && (
                                        <>
                                            {/* 输入区域 */}
                                            <div className={styles.textInputWrapper}>
                                                <div className={styles.textInputContainer}>
                                                    <div
                                                        className={`${styles.voicePrompt} ${styles.recording}`}
                                                        onMouseDown={handleVoiceMouseDown}
                                                        onTouchStart={handleVoiceTouchStart}
                                                        onTouchMove={handleVoiceTouchMove}
                                                        onTouchEnd={handleVoiceTouchEnd}
                                                    >
                                                        <Mic className={styles.voiceIcon} size={20} />
                                                        <span className={styles.voiceText}>
                                                            正在录音...松开发送
                                                        </span>
                                                    </div>

                                                    <button
                                                        onClick={() => switchMode('text')}
                                                        className={styles.inputModeButton}
                                                        title="切换到键盘模式"
                                                    >
                                                        <Keyboard size={18} />
                                                    </button>

                                                    <button
                                                        onClick={() => handleSendText()}
                                                        className={styles.sendButton}
                                                        disabled={loading || isUploading || currentMode === 'voice'}
                                                    >
                                                        <Send size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {/* 处理中显示（仅在非语音通话模式下） */}
                                    {voiceStatus === 'processing' && !isVoiceCallActive && (
                                        <>
                                            {/* 输入区域 */}
                                            <div className={styles.textInputWrapper}>
                                                <div className={styles.textInputContainer}>
                                                    <div className={`${styles.voicePrompt} ${styles.processing}`}>
                                                        <Mic className={styles.voiceIcon} size={20} />
                                                        <span className={styles.voiceText}>
                                                            正在处理...
                                                        </span>
                                                    </div>

                                                    <button
                                                        onClick={() => switchMode('text')}
                                                        className={styles.inputModeButton}
                                                        title="切换到键盘模式"
                                                    >
                                                        <Keyboard size={18} />
                                                    </button>

                                                    <button
                                                        onClick={() => handleSendText()}
                                                        className={styles.sendButton}
                                                        disabled={loading || isUploading || currentMode === 'voice'}
                                                    >
                                                        <Send size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                        </>
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
                                        onClick={handleNewConversation}
                                        className={styles.newConversationButton}
                                        disabled={loading}
                                    >
                                        <div className={styles.toolbarIconWrapper}>
                                            <MessageSquarePlus/>
                                        </div>
                                        <span>新对话</span>
                                    </button>

                                    <button
                                        onClick={isVoiceCallActive ? stopVoiceCall : startVoiceCall}
                                        className={`${styles.voiceCallButton} ${isVoiceCallActive ? styles.active : ''}`}
                                        disabled={loading || isUploading}
                                    >
                                        <div className={styles.toolbarIconWrapper}>
                                            {isVoiceCallActive ? <PhoneOff /> : <Phone />}
                                        </div>
                                        <span>{isVoiceCallActive ? '结束通话' : '语音通话'}</span>
                                    </button>

                                    <Upload {...uploadProps} style={{ width: '100%' }}>
                                        <button
                                            onClick={()=>{
                                                stopAudio()
                                            }}
                                            className={getToolbarButtonClasses('file')}
                                        >
                                            <div className={styles.toolbarIconWrapper}>
                                                <FileUp />
                                            </div>
                                            <span>文件</span>
                                        </button>
                                    </Upload>

                                    <button onClick={openCamera} className={getToolbarButtonClasses('camera')}>
                                        <div className={styles.toolbarIconWrapper}>
                                            <Camera/>
                                        </div>
                                        <span>拍摄</span>
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
                                    <Volume2 className={styles.volumeIconHigh} size={14} />
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
                                    <Volume1 className={styles.volumeIconLow} size={14} />
                                </div>
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
