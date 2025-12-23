import React, {useState, useRef, useEffect} from 'react';
import {useNavigate, useLocation} from 'react-router-dom';
import {Home, Mic, Camera, User, Bot, Send, StopCircle, Volume1, Volume2, FileUp, MessageSquarePlus, Phone, PhoneOff} from 'lucide-react';
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

// 全局配置类型声明
declare global {
    interface Window {
        APP_CONFIG?: {
            voiceCallSilenceTimeout?: number;
        };
    }
}

// 获取语音通话静默检测时长（毫秒），默认 1000ms
const getVoiceCallSilenceTimeout = () => {
    return window.APP_CONFIG?.voiceCallSilenceTimeout ?? 1000;
};
console.log("当前秒数为", getVoiceCallSilenceTimeout() +'秒');

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
    let timeerRef = useRef(null);
    useEffect(()=>{
        if(timeerRef.current){
            timeerRef.current = null
            clearTimeout(timeerRef.current);
        }else {
            timeerRef.current =   setInterval(()=>{
                const now = new Date();
                const hour = now.getHours();
                const minute = now.getMinutes();
                const second = now.getSeconds();
                console.log(`${hour}:${minute}:${second}`);

            },1000)
        }
    },[])


    const navigate = useNavigate();
    const location = useLocation();

    // 从路由获取 botId，默认使用预问诊的 botId
    const botIdFromRoute = (location.state as { botId?: string })?.botId || '7574375637029273609';
    const pageTitle = botIdFromRoute === '7574375637029273609' ? '病史采集小助理' : '报告解读小助手';

    // 创建 Coze API 客户端实例
    const cozeClient = useRef(new CozeAPI({
        token: 'pat_zkUh7PgT34IDtE2y4VBBgnTZjBc3nZ2yZ9gXIwia6cYxpzfMMiwELEf3sZyjceYE',
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
    const [denoiserSupported, setDenoiserSupported] = useState<boolean>(false);
    const [cameraModalVisible, setCameraModalVisible] = useState(false);
    const clientRef = useRef<WsTranscriptionClient>();
    const messageListRef = useRef<HTMLDivElement | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const speechAbortRef = useRef<AbortController | null>(null);
    // Web Audio RMS 语音检测相关
    const micStreamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const rmsDataArrayRef = useRef<Uint8Array | null>(null);
    const rmsRafRef = useRef<number | null>(null);
    const initialQuestionRef = useRef<string | null>(null);
    const initialQuestionSentRef = useRef<boolean>(false);
    const [voiceId, setVoiceId] = useState<string>('');
    // 注意：isAudioPlaying 现在从 useChatSSE 获取，用于服务器音频流
    const [audioVolume, setAudioVolume] = useState<number>(80);
    const [isUploading, setIsUploading] = useState(false); // 是否有文件正在上传
    const isUploadingRef = useRef(false); // 使用 ref 解决闭包问题
    // 触摸手势相关状态
    const [showMask, setShowMask] = useState(false); // 是否显示遮罩层
    const [touchStartX, setTouchStartX] = useState<number>(0); // 触摸起始X坐标
    const [isCanceling, setIsCanceling] = useState(false); // 是否在取消区域
    // 语音通话相关状态
    const [isVoiceCallActive, setIsVoiceCallActive] = useState(false); // 是否处于语音通话模式
    const isVoiceCallActiveRef = useRef(false); // 使用 ref 解决闭包问题
    const silenceTimerRef = useRef<NodeJS.Timeout | null>(null); // 静默检测定时器
    const lastContentRef = useRef<string>(''); // 上次识别的内容，用于检测变化
    // 快捷键相关状态
    const isShortcutRecordingRef = useRef(false); // 是否通过快捷键触发的录音
    const shortcutPressStartTimeRef = useRef<number | null>(null); // 快捷键按下的时间
    const {
        messages,
        loading,
        error,
        isAudioPlaying, // 从 useChatSSE 获取音频播放状态
        start,
        stop,
        reset,
        stopAudio: stopStreamAudio // 停止服务器音频流的函数
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

    // 添加键盘快捷键监听
    useEffect(() => {
        // 添加键盘事件监听器
        window.addEventListener('keydown', handleShortcutKeyDown);
        window.addEventListener('keyup', handleShortcutKeyUp);

        // 清理函数：组件卸载时移除监听器
        return () => {
            window.removeEventListener('keydown', handleShortcutKeyDown);
            window.removeEventListener('keyup', handleShortcutKeyUp);
            // 确保清理快捷键状态
            if (isShortcutRecordingRef.current) {
                isShortcutRecordingRef.current = false;
                shortcutPressStartTimeRef.current = null;
                safeStopTranscription();
            }
        };
    }, []); // 空依赖数组，只在挂载和卸载时执行

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
                        Authorization: 'Bearer pat_zkUh7PgT34IDtE2y4VBBgnTZjBc3nZ2yZ9gXIwia6cYxpzfMMiwELEf3sZyjceYE'
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
        // isAudioPlaying 现在由 useChatSSE 管理，不需要手动设置
        stopVoiceActivityDetection();
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

    // 同步 isUploading state 到 ref，解决语音通话中的闭包问题
    useEffect(() => {
        isUploadingRef.current = isUploading;
    }, [isUploading]);

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
            // 注意：这是 TTS 备用播放，不影响服务器音频流的 isAudioPlaying 状态
            const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/v1/audio/speech`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer pat_zkUh7PgT34IDtE2y4VBBgnTZjBc3nZ2yZ9gXIwia6cYxpzfMMiwELEf3sZyjceYE'
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
                console.log('TTS 语音播报完成');
                URL.revokeObjectURL(url)
            }
            audio.onerror = () => {
                console.log('TTS 语音播报出错');
                URL.revokeObjectURL(url)
            }
            await audio.play()
            console.log('开始 TTS 语音播报')
        } catch (err) {
            if ((err as any)?.name === 'AbortError') return;
            console.error('TTS 语音播放失败', err)

        } finally {
            speechAbortRef.current = null;
        }
    }



    // 将文字转换为音频并上传到服务器，返回包含 file_id 的对象
    const convertTextToAudioAndUpload = async (text: string) => {
        if (!voiceId) {
            throw new Error('语音音色未设置');
        }
        if (!text?.trim()) {
            throw new Error('文本内容为空');
        }

        try {
            // 1. 调用 TTS API 将文字转换为音频
            const ttsRes = await fetch(`${import.meta.env.VITE_API_BASE_URL}/v1/audio/speech`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer pat_zkUh7PgT34IDtE2y4VBBgnTZjBc3nZ2yZ9gXIwia6cYxpzfMMiwELEf3sZyjceYE'
                },
                body: JSON.stringify({
                    voice_id: voiceId,
                    response_format: 'wav',
                    input: text,
                }),
            });

            if (!ttsRes.ok) {
                throw new Error(`TTS 转换失败: ${ttsRes.status}`);
            }

            // 2. 将音频数据转换为 Blob
            const buffer = await ttsRes.arrayBuffer();
            const audioBlob = new Blob([buffer], { type: 'audio/wav' });

            // 3. 创建 File 对象（模拟用户上传的文件）
            const timestamp = Date.now();
            const audioFile = new File([audioBlob], `voice_${timestamp}.wav`, {
                type: 'audio/wav',
                lastModified: timestamp
            });

            // 4. 使用 Coze SDK 上传音频文件
            const uploadResult = await cozeClient.files.upload({
                file: audioFile,
            });

            console.log('🎵 音频文件上传成功:', {
                file_id: uploadResult.id,
                file_name: audioFile.name,
                file_type: audioFile.type,
                file_size: audioFile.size,
                upload_result: uploadResult
            });

            // 5. 返回上传结果，格式与图片上传保持一致，但标记为音频文件
            return {
                uid: `audio_${timestamp}`,
                name: audioFile.name,
                status: 'done',
                type: 'audio/wav',
                originFileObj: audioFile,
                response: uploadResult,
                isAudio: true // 标记为音频文件，用于区分图片文件
            };

        } catch (error) {
            console.error('文字转音频上传失败:', error);
            throw error;
        }
    }


    // 监听 loading 状态变化，在语音通话模式下 AI 回答完成后自动重新开始录音
    useEffect(() => {
        if (!loading && isVoiceCallActive) {
            // AI 回答完成，延迟一小段时间后重新开始录音（等待播报开始）
            const timer = setTimeout(() => {
                if (clientRef.current && isVoiceCallActiveRef.current) {
                    try {
                        clientRef.current.start();
                        console.log('AI回答完成，重新开始录音（播报期间也可录音）');
                    } catch (err) {
                        console.error('重新开始录音失败', err);
                    }
                }
            }, 500); // 延迟500ms，确保播报已经开始

            return () => clearTimeout(timer);
        }
    }, [loading, isVoiceCallActive])

    // 监听音频播放状态，播放完成后如果有转写内容则重新触发静默检测
    useEffect(() => {
        if (!isAudioPlaying && isVoiceCallActive && lastContentRef.current) {
            console.log('音频播放完成，重新触发静默检测');
            handleVoiceCallContentUpdate(lastContentRef.current);
        }
    }, [isAudioPlaying, isVoiceCallActive])

    const checkRequirements = async () => {

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

    // 使用 Web Audio + RMS 检测用户是否在说话，打断正在播报的 TTS
    const startVoiceActivityDetection = async () => {
        if (audioContextRef.current || rmsRafRef.current) return;
        try {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioCtx) {
                console.warn('当前环境不支持 Web Audio API，无法启用 RMS 检测');
                return;
            }
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    deviceId: selectedInputDevice ? { exact: selectedInputDevice } : undefined,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                }
            });
            micStreamRef.current = stream;
            const audioCtx = new AudioCtx();
            audioContextRef.current = audioCtx;
            const source = audioCtx.createMediaStreamSource(stream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 1024;
            source.connect(analyser);
            analyserRef.current = analyser;
            const buffer = new Uint8Array(analyser.fftSize);
            rmsDataArrayRef.current = buffer;

            const detect = () => {
                if (!analyserRef.current || !rmsDataArrayRef.current) return;
                analyserRef.current.getByteTimeDomainData(rmsDataArrayRef.current);
                let sumSquares = 0;
                for (let i = 0; i < rmsDataArrayRef.current.length; i++) {
                    const v = (rmsDataArrayRef.current[i] - 128) / 128;
                    sumSquares += v * v;
                }
                const rms = Math.sqrt(sumSquares / rmsDataArrayRef.current.length);
                // 简单门限，检测到明显发声时中断播报
                const RMS_THRESHOLD = 0.06;
                // 临时禁用 RMS 打断，用于测试服务器音频流播放
                if (rms > RMS_THRESHOLD && audioRef.current && !audioRef.current.paused) {
                    console.log('RMS 检测到用户说话，打断语音播报', rms);
                    stopAudio();
                }
                rmsRafRef.current = requestAnimationFrame(detect);
            };
            rmsRafRef.current = requestAnimationFrame(detect);
        } catch (err) {
            console.error('启动 RMS 语音检测失败', err);
        }
    };

    const stopVoiceActivityDetection = () => {
        if (rmsRafRef.current) {
            cancelAnimationFrame(rmsRafRef.current);
            rmsRafRef.current = null;
        }
        if (analyserRef.current) {
            try {
                analyserRef.current.disconnect();
            } catch (err) {
                console.error('断开 analyser 失败', err);
            }
            analyserRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close().catch(() => {});
            audioContextRef.current = null;
        }
        if (micStreamRef.current) {
            micStreamRef.current.getTracks().forEach(track => track.stop());
            micStreamRef.current = null;
        }
        rmsDataArrayRef.current = null;
    };

    const initClient = () => {
        // 移除严格的权限预检查，让 WsTranscriptionClient 自动处理权限请求
        // WsTranscriptionClient 会在初始化时自动请求麦克风权限
        const client = new WsTranscriptionClient({
            token: 'pat_zkUh7PgT34IDtE2y4VBBgnTZjBc3nZ2yZ9gXIwia6cYxpzfMMiwELEf3sZyjceYE',
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
            console.log("监听到说话====>",event.data.content)
            recognizeResult.current = userMsg;

            // 如果处于语音通话模式，触发静默检测
            if (isVoiceCallActiveRef.current) {
                handleVoiceCallContentUpdate(event.data.content);
            }
        });


        // 监听错误事件
        client.on(WebsocketsEventType.ERROR, (error: unknown) => {
            console.error(error);
            // message.error((error as CommonErrorEvent).data.msg);
        });
        clientRef.current = client;
        // 启动 RMS 语音检测，独立于转写结果
        startVoiceActivityDetection();
    }
    const switchMode = (mode: InputMode) => {
        if (mode === 'voice' && !clientRef.current) {
            try {
                initClient();
            } catch (error) {
                console.error(error);

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
        stopAudio()
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
        // 每次内容更新先停止所有播报（TTS + 服务器流式音频），避免语音与新录音冲突
        stopAudio()

        // 如果图片正在上传，不触发静默检测
        if (isUploadingRef.current) {
            console.log('图片正在上传中，暂不触发自动发送');
            return;
        }

        // 清除之前的定时器
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
            console.log("重置定时器")
        }
        // 如果内容有变化，说明用户还在说话
        if (content && content !== lastContentRef.current) {
            lastContentRef.current = content;

            // 设置新的静默检测定时器（从全局配置读取时长）
            silenceTimerRef.current = setTimeout(() => {
                // N秒后如果没有新的内容更新，则自动发送
                handleAutoSendInVoiceCall();

            }, getVoiceCallSilenceTimeout());
        }
    };

    // 语音通话模式下的自动发送
    const handleAutoSendInVoiceCall = async () => {
        console.log("触发发送")
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
                clientRef.current.start();
            } catch (err) {
                console.error('停止录音失败', err);
            }
        }

        try {
            console.log('=== handleAutoSendInVoiceCall 开始发送 ===');
            console.log('语音内容:', content);
            console.log('voiceId:', voiceId);
            console.log('图片列表:', fileListRef.current);

            // 1. 构建基础消息，先更新消息列表
            const filesSnapshot = [...fileListRef.current];
            const messageToSend = {
                ...recognizeResult.current,
                imageUrls: filesSnapshot.length > 0 ? filesSnapshot : undefined
            };
            console.log('实时通话发送消息:', messageToSend, filesSnapshot);
            setFileList([]);
            await start(messageToSend, {
                prepareFiles: async () => {
                    const attachments = [...filesSnapshot];
                    if (content && voiceId) {
                        try {
                            console.log('开始生成音频文件...');
                            const audioFileObj = await convertTextToAudioAndUpload(content);
                            message.destroy();
                            console.log('实时通话：语音生成成功', audioFileObj);
                            attachments.push(audioFileObj);
                        } catch (error) {
                            message.destroy();
                            console.error('语音生成失败，将仅发送文字:', error);
                            message.warning('语音生成失败，仅发送文字');
                        }
                    } else {
                        console.log('跳过音频生成 - content:', content, 'voiceId:', voiceId);
                    }
                    return attachments;
                }
            });
            console.log('消息发送完成');


            recognizeResult.current = {} as Message;
            lastContentRef.current = '';
            console.log("lastContentRef.current", lastContentRef.current);

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
            // 重置快捷键状态
            if (isShortcutRecordingRef.current) {
                isShortcutRecordingRef.current = false;
                shortcutPressStartTimeRef.current = null;
            }
            return;
        }

        // 如果有文件正在上传，不允许录音
        if (isUploading) {
            message.warning('文件正在上传中，请稍候...');
            // 重置快捷键状态
            if (isShortcutRecordingRef.current) {
                isShortcutRecordingRef.current = false;
                shortcutPressStartTimeRef.current = null;
            }
            return;
        }
        // 正在生成回答时不允许再次录音
        if (loading) {
            // 重置快捷键状态
            if (isShortcutRecordingRef.current) {
                isShortcutRecordingRef.current = false;
                shortcutPressStartTimeRef.current = null;
            }
            return;
        }

        // 自动切换到语音模式并初始化客户端
        // WsTranscriptionClient 会自动请求麦克风权限
        if (currentMode !== 'voice') {
            try {
                if (!clientRef.current) {
                    initClient();
                }
                setCurrentMode('voice');
            } catch (error) {
                console.error(error);
                message.error((error as Error).message || '语音初始化失败');
                // 重置快捷键状态
                if (isShortcutRecordingRef.current) {
                    isShortcutRecordingRef.current = false;
                    shortcutPressStartTimeRef.current = null;
                }
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
            setTimeout(async ()=>{
                try {
                    clientRef?.current?.stop()

                    console.log('=== stopRecording 开始发送 ===');
                    console.log('语音内容:', recognizeResult?.current?.content);
                    console.log('voiceId:', voiceId);
                    console.log('图片列表:', fileList);

                    // 1. 构建基础消息，先更新消息列表
                    const voiceContent = recognizeResult?.current?.content?.trim();
                    const filesSnapshot = [...fileList];
                    const messageWithImages = {
                        ...(recognizeResult?.current ||{}),
                        imageUrls: filesSnapshot.length > 0 ? filesSnapshot : undefined
                    };

                    console.log('准备发送的消息:', messageWithImages);
                    // 发送后清空文件列表和识别结果
                    setFileList([]);
                    await start(messageWithImages, {
                        prepareFiles: async () => {
                            const attachments = [...filesSnapshot];
                            if (voiceContent && voiceId) {
                                try {
                                    console.log('开始生成音频文件...');

                                    const audioFileObj = await convertTextToAudioAndUpload(voiceContent);
                                    message.destroy();
                                    console.log('按住说话：语音生成成功', audioFileObj);
                                    attachments.push(audioFileObj);
                                } catch (error) {
                                    message.destroy();
                                    console.error('语音生成失败，将仅发送文字:', error);
                                    message.warning('语音生成失败，仅发送文字');
                                }
                            } else {
                                console.log('跳过音频生成 - voiceContent:', voiceContent, 'voiceId:', voiceId);
                            }
                            return attachments;
                        }
                    });
                    console.log('消息发送完成');


                    recognizeResult.current = {}
                } catch (error) {
                    console.error('按住说话发送失败:', error);
                    message.error('发送失败');
                    recognizeResult.current = {}
                }
            },1000)

        } catch (error) {
            console.error('调用chat接口失败:', error);
            message.error('请求失败');
            // 发生错误时也要清空
            recognizeResult.current = {}
        }
    };

    // 处理快捷键按下（Shift + R）
    const handleShortcutKeyDown = (e: KeyboardEvent) => {
        // 检测 Shift + R 组合键（不区分大小写）
        if (e.shiftKey && (e.key === 'r' || e.key === 'R')) {
            // 防止重复触发
            if (isShortcutRecordingRef.current) return;

            // 防止默认行为
            e.preventDefault();

            console.log('快捷键 Shift+R 触发录音');

            // 标记为快捷键触发的录音
            isShortcutRecordingRef.current = true;
            shortcutPressStartTimeRef.current = Date.now();

            // 触发录音开始（复用现有逻辑，WsTranscriptionClient 会自动处理权限）
            startRecording();
        }
    };

    // 处理快捷键松开
    const handleShortcutKeyUp = (e: KeyboardEvent) => {
        // 如果是通过快捷键触发的录音，松开任何键都停止录音
        if (isShortcutRecordingRef.current) {
            // 防止默认行为
            e.preventDefault();

            console.log('快捷键松开，停止录音');

            // 获取按下时长
            const pressDuration = shortcutPressStartTimeRef.current
                ? Date.now() - shortcutPressStartTimeRef.current
                : 0;

            // 重置快捷键状态
            isShortcutRecordingRef.current = false;
            shortcutPressStartTimeRef.current = null;

            // 立即重置UI状态
            setVoiceStatus('idle');

            // 如果有文件正在上传，不允许发送（使用 ref 获取最新状态）
            if (isUploadingRef.current) {
                message.warning('文件正在上传中，请稍候...');
                safeStopTranscription();
                return;
            }

            // 无内容且无图片：仅停止录音（使用 ref 获取最新的文件列表）
            if (!recognizeResult?.current?.content && fileListRef.current.length === 0) {
                safeStopTranscription();
                return;
            }

            // 录音时间过短
            if (pressDuration < 500) {
                safeStopTranscription();
                message.warning('时间过短');
                return;
            }

            // 触发发送（使用 ref 获取最新的文件列表）
            const fileListSnapshot = [...fileListRef.current];
            finalizePressToTalk({
                cancel: false,
                pressDuration,
                fileListSnapshot
            });
        }
    };

    // 安全停止录音：避免在多个分支里重复 try/catch
    const safeStopTranscription = () => {
        if (!clientRef.current) return;
        try {
            clientRef.current.stop();
        } catch (err) {
            console.error('停止录音失败', err);
        }
    };

    // 统一组装“语音识别结果 + 图片”消息体（保持现有字段结构不变）
    const buildMessageWithImages = (baseMessage: any, images: UploadFile[]) => {
        return {
            ...(baseMessage || {}),
            imageUrls: images.length > 0 ? images : undefined
        };
    };

    // 统一处理：按住说话松手后的发送/取消逻辑（触摸/鼠标共用）
    const finalizePressToTalk = async (options: {
        cancel: boolean;
        pressDuration: number;
        fileListSnapshot: UploadFile[];
    }) => {
        const { cancel, pressDuration, fileListSnapshot } = options;

        // 取消发送
        if (cancel) {
            safeStopTranscription();
            recognizeResult.current = {} as Message;
            message.info('已取消发送');
            setIsCanceling(false);
            return;
        }

        // 无语音内容且无图片：仅停止录音，不触发发送
        if (!recognizeResult?.current?.content && fileListSnapshot.length === 0) {
            safeStopTranscription();
            return;
        }

        // 录音时间过短
        if (pressDuration < 500) {
            safeStopTranscription();
            message.warning('时间过短');
            return;
        }

        // 文件上传中不允许发送
        if (isUploading) {
            message.warning('文件正在上传中，请稍候...');
            return;
        }

        // 延迟发送：保留原逻辑，给语音识别一个收尾时间
        setTimeout(async () => {
            try {
                safeStopTranscription();

                console.log('=== finalizePressToTalk 开始发送 ===');
                console.log('语音内容:', recognizeResult?.current?.content);
                console.log('voiceId:', voiceId);
                console.log('图片列表:', fileListSnapshot);

                // 1. 构建基础消息，先更新消息列表
                const voiceContent = recognizeResult?.current?.content?.trim();
                const filesSnapshot = [...fileListSnapshot];
                const messageWithImages = buildMessageWithImages(
                    recognizeResult?.current || {},
                    filesSnapshot
                );
                console.log('准备发送的消息:', messageWithImages);
                // 发送后清空文件列表和识别结果
                setFileList([]);
                await start(messageWithImages, {
                    prepareFiles: async () => {
                        const attachments = [...filesSnapshot];
                        if (voiceContent && voiceId) {
                            try {
                                console.log('开始生成音频文件...');
                                const audioFileObj = await convertTextToAudioAndUpload(voiceContent);
                                message.destroy();
                                console.log('音频文件生成成功:', audioFileObj);
                                attachments.push(audioFileObj);
                            } catch (error) {
                                message.destroy();
                                console.error('语音生成失败，将仅发送文字:', error);
                                message.warning('语音生成失败，仅发送文字');
                            }
                        } else {
                            console.log('跳过音频生成 - voiceContent:', voiceContent, 'voiceId:', voiceId);
                        }
                        return attachments;
                    }
                });
                console.log('消息发送完成');


                recognizeResult.current = {} as Message;
            } catch (error) {
                console.error('按住说话发送失败:', error);
                message.error('发送失败');
            }
        }, 1000);
    };

    // 触摸手势处理函数
    const handleVoiceTouchStart = (e: React.TouchEvent) => {
        e.preventDefault();
        const touch = e.touches[0];
        setTouchStartX(touch.clientX);
        setShowMask(true);
        setIsCanceling(false);
        startRecording();
    };

    const handleVoiceTouchMove = (e: React.TouchEvent) => {
        e.preventDefault();
        const touch = e.touches[0];

        // 计算滑动距离，向左滑动为负值
        const distance = touchStartX - touch.clientX;
        // 如果向左滑动超过100px，则进入取消区域
        const CANCEL_THRESHOLD = 100;
        setIsCanceling(distance > CANCEL_THRESHOLD);
    };

    const handleVoiceTouchEnd = (e: React.TouchEvent) => {
        e.preventDefault();
        setShowMask(false);

        // 立即重置录音状态到 idle，让UI马上恢复
        setVoiceStatus('idle');

        // 如果在取消区域，则取消发送；否则触发发送
        if (isCanceling) {
            finalizePressToTalk({
                cancel: true,
                pressDuration: 0,
                fileListSnapshot: []
            });
        } else {
            const pressDuration = pressStartTimeRef.current
                ? Date.now() - pressStartTimeRef.current
                : 0;
            pressStartTimeRef.current = null;
            const fileListSnapshot = [...fileList];
            finalizePressToTalk({
                cancel: false,
                pressDuration,
                fileListSnapshot
            });
        }

        setTouchStartX(0);
    };

    // 鼠标手势处理函数
    const handleVoiceMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setTouchStartX(e.clientX);
        setShowMask(true);
        setIsCanceling(false);
        startRecording();

        // 保存起始位置，用于计算距离
        const startX = e.clientX;
        let currentCanceling = false;

        // 在 document 上添加事件监听，这样即使鼠标移出元素也能监听到
        const handleDocumentMouseMove = (e: MouseEvent) => {
            e.preventDefault();

            // 计算滑动距离，向左滑动为负值
            const dist = startX - e.clientX;
            // 如果向左滑动超过100px，则进入取消区域
            const CANCEL_THRESHOLD = 100;
            currentCanceling = dist > CANCEL_THRESHOLD;
            setIsCanceling(currentCanceling);
        };

        const handleDocumentMouseUp = (e: MouseEvent) => {
            e.preventDefault();
            setShowMask(false);

            // 移除 document 事件监听
            document.removeEventListener('mousemove', handleDocumentMouseMove);
            document.removeEventListener('mouseup', handleDocumentMouseUp);

            // 立即重置录音状态到 idle，让UI马上恢复
            setVoiceStatus('idle');

            // 如果在取消区域，则取消发送；否则触发发送
            if (currentCanceling) {
                finalizePressToTalk({
                    cancel: true,
                    pressDuration: 0,
                    fileListSnapshot: []
                });
            } else {
                const pressDuration = pressStartTimeRef.current
                    ? Date.now() - pressStartTimeRef.current
                    : 0;
                pressStartTimeRef.current = null;
                const fileListSnapshot = [...fileList];
                finalizePressToTalk({
                    cancel: false,
                    pressDuration,
                    fileListSnapshot
                });
            }

            setTouchStartX(0);
        };

        // 添加 document 事件监听
        document.addEventListener('mousemove', handleDocumentMouseMove);
        document.addEventListener('mouseup', handleDocumentMouseUp);
    };

    const openCamera = () => {
        stopAudio()
        setCameraModalVisible(true);
    };

    const closeCamera = () => {
        setCameraModalVisible(false);
    };

    // 拍摄结果：先展示在列表，再调用上传
    const handleCapturedImage = async (url: string) => {
        try {
            // URL → Blob → File
            const res = await fetch(url);
            const blob = await res.blob();
            const fileName = `capture_${Date.now()}.jpg`;
            const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' });

            const uploadFile: UploadFile = {
                uid: `camera_${Date.now()}`,
                name: fileName,
                originFileObj: file,
                type: file.type,
                url,
                status: 'uploading',
            };

            // 先写入列表以展示缩略图/进度
            setFileList(prev => [...prev, uploadFile]);

            await uploadFileWithFetch(uploadFile);
        } catch (err) {
            console.error('上传拍摄图片失败', err);
            message.error('拍摄图片上传失败');
        } finally {
            setCurrentMode('text');
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

            // 图片上传完成后，如果处于语音通话模式且有待发送的内容，重新触发静默检测
            if (isVoiceCallActiveRef.current && lastContentRef.current) {
                console.log('图片上传完成，重新触发静默检测');
                handleVoiceCallContentUpdate(lastContentRef.current);
            }
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
        console.log("停止 TTS 播报")
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current = null;
        }
        stopStreamAudio()
        // 终止正在进行的 TTS 请求
        if (speechAbortRef.current) {
            speechAbortRef.current.abort();
            speechAbortRef.current = null;
        }
    }

    // 新建对话
    const handleNewConversation = () => {
        // 停止 TTS 音频播放
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

        try {
            console.log('=== handleSendText 开始发送 ===');
            console.log('文字内容:', content);
            console.log('voiceId:', voiceId);
            console.log('图片列表:', fileList);

            // 1. 先构建基础消息并更新列表
            const filesSnapshot = [...fileList];
            const userMsg = {
                id: Date.now(),
                role: 'user',
                content,
                content_type: 'text',
                imageUrls: filesSnapshot.length > 0 ? filesSnapshot : undefined
            };

            setTextInput('');
            // 清空文件列表
            setFileList([]);

            console.log('准备发送的消息:', userMsg);
            // 2. 发送消息到 /v3/chat，音频生成放在 prepareFiles
            await start(userMsg, {
                prepareFiles: async () => {
                    const attachments = [...filesSnapshot];
                    if (voiceId) {
                        try {
                            console.log('开始生成音频文件...');
                            const audioFileObj = await convertTextToAudioAndUpload(content || '请分析图片');
                            message.destroy(); // 关闭 loading 提示
                            console.log('文字输入：语音生成成功', audioFileObj);
                            attachments.push(audioFileObj);
                        } catch (error) {
                            message.destroy();
                            console.error('语音生成失败，将仅发送文字:', error);
                            message.warning('语音生成失败，仅发送文字');
                        }
                    } else {
                        console.log('跳过音频生成 - content:', content, 'voiceId:', voiceId);
                    }
                    return attachments;
                }
            });
            console.log('消息发送完成');
        } catch (error) {
            console.error('调用chat接口失败:', error);
            message.error('请求失败');
        }
    };


    // 处理从首页预设问题跳转时自动提问（等待音色加载后再发送）
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

        // 如果路由问题变更，重置发送标记
        if (initialQuestionRef.current !== question) {
            initialQuestionRef.current = question;
            initialQuestionSentRef.current = false;
        }

        // 已发送则不重复
        if (initialQuestionSentRef.current) return;

        // 无音色时先等待，确保首条消息也能先生成并上传音频
        if (!voiceId) {
            console.log('等待音色加载后再发送首条自动消息');
            return;
        }

        initialQuestionSentRef.current = true;
        setCurrentMode('text');
        setTextInput(question);
        handleSendText(question);
    }, [location.state, voiceId]);

    // 统一渲染输入区域：仅保留文本输入模式
    const renderInputArea = () => {
        const sendDisabled = loading || isUploading;

        // 语音通话模式：仅展示状态提示，不展示输入按钮
        if (isVoiceCallActive) {
            return (
                <div className={styles.textInputWrapper}>
                    <div className={styles.textInputContainer}>
                        <div className={`${styles.voicePrompt} ${styles.calling}`}>
                            <Phone className={styles.voiceIcon} size={20} />
                            <span className={styles.voiceText}>
                                {loading ? 'AI正在回答...' : '语音通话中...'}
                            </span>
                        </div>
                    </div>
                </div>
            );
        }

        // 文本输入模式
        return (
            <div className={styles.textInputWrapper}>
                <div className={styles.textInputContainer}>
                    <textarea
                        value={textInput}
                        onChange={(e) => setTextInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendText();
                            }
                        }}
                        placeholder={fileList.some(isImageFile)
                            ? '上传/拍好报告后，请说“这是我的报告。”'
                            : '请输入指令...'}
                        className={styles.textInput}
                        disabled={loading || isUploading}
                        rows={1}
                    />

                    <button
                        onClick={() => handleSendText()}
                        className={styles.sendButton}
                        disabled={sendDisabled}
                    >
                        <Send size={18} />
                    </button>
                </div>
            </div>
        );
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
    return (
        <>
            {/* 全屏语音遮罩层 */}
            {showMask && (
                <div className={styles.voiceMask}>
                    <div className={styles.maskContent}>
                       {/* <div className={styles.maskIcon}>
                            <Mic size={60} />
                        </div>
                        <div className={styles.maskText}>
                            {isCanceling ? '松开，取消发送' : '左滑取消'}
                        </div>
                        <div className={styles.maskHint}>
                            {isCanceling ? '' : '松开，发送消息'}
                        </div>*/}
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
                            <h1>{pageTitle}</h1>
                            <div className={styles.topNavStatus}>在线</div>
                        </div>

                        <div className={styles.mainContent}>
                            <div className={styles.chatArea}>
                        {/*        <div className={styles.modeInfo}>
                                    <p>
                                        {isVoiceCallActive && '>>> 语音通话进行中...'}
                                        {!isVoiceCallActive && currentMode === 'voice' && '>>> 语音输入模式已激活'}
                                        {!isVoiceCallActive && currentMode === 'text' && '>>> 文字指令输入就绪'}
                                        {!isVoiceCallActive && currentMode === 'file' && '>>> 文件解析模块加载完毕'}
                                        {!isVoiceCallActive && currentMode === 'camera' && '>>> 视觉传感器已连接'}
                                    </p>
                                </div>*/}

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
                                                                {message.imageUrls && message.imageUrls.filter(url => !url.isAudio).length > 0 && (
                                                                    <div className={styles.messageImagesGrid}>
                                                                        <Image.PreviewGroup>
                                                                            {message.imageUrls.filter(url => !url.isAudio).map((url, idx) => (
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
                                    {/* 文件列表显示区域 - 统一渲染，不重复（不显示音频文件） */}
                                    {fileList.filter(file => !file.isAudio).length > 0 && (
                                        <div className={styles.fileListContainer}>
                                            {fileList.filter(file => !file.isAudio).map((file) => (
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
                                    {renderInputArea()}
                                </div>
                            </div>

                            <div className={styles.toolbar}>
                                <div className={styles.topButtons}>
                                    <button onClick={() => navigate('/')} className={styles.homeButton}>
                                        <Home/>
                                        <span>返回</span>
                                    </button>

                                    <button
                                        onClick={handleNewConversation}
                                        className={styles.homeButton}
                                        disabled={loading}
                                    >
                                        <MessageSquarePlus/>
                                        <span>新对话</span>
                                    </button>
                                </div>

                                <div className={styles.toolbarButtons}>
                                    <button
                                        onMouseDown={handleVoiceMouseDown}
                                        onTouchStart={handleVoiceTouchStart}
                                        onTouchMove={handleVoiceTouchMove}
                                        onTouchEnd={handleVoiceTouchEnd}
                                        className={`${getToolbarButtonClasses('voice')} ${voiceStatus === 'recording' ? styles.recording : ''}`}
                                        disabled={loading || isUploading || isVoiceCallActive}
                                    >
                                        <div className={styles.toolbarIconWrapper}>
                                            <Mic />
                                        </div>
                                        <span>语音</span>
                                    </button>

                                    <button
                                        onClick={isVoiceCallActive ? stopVoiceCall : startVoiceCall}
                                        className={`${styles.voiceCallButton} ${isVoiceCallActive ? styles.active : ''}`}
                                        disabled={loading || isUploading}
                                    >
                                        <div className={styles.toolbarIconWrapper}>
                                            {isVoiceCallActive ? <PhoneOff /> : <Phone />}
                                        </div>
                                        <span>{isVoiceCallActive ? '结束通话' : '实时通话'}</span>
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
                                        onClick={stopAudio}
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
