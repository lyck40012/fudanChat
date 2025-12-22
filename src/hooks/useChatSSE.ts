import {useCallback, useRef, useState} from 'react'
const formatDateTime = () => {
    const now = new Date();
    const pad = (num) => String(num).padStart(2, '0');
    const yyyy = now.getFullYear();
    const MM = pad(now.getMonth() + 1);
    const dd = pad(now.getDate());
    const HH = pad(now.getHours());
    const mm = pad(now.getMinutes());
    const ss = pad(now.getSeconds());
    return `${yyyy}${MM}${dd}_${HH}${mm}${ss}`;
};

export function useChatSSE({url, headers = {}, botId = '7586122118481002502'}) {
    const [messages, setMessages] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isAudioPlaying, setIsAudioPlaying] = useState(false)
   const isConversationRef = useRef<boolean>(false)
    const  conversationIdRef = useRef<number>('')
    const controllerRef = useRef<AbortController | null>(null)
    const assistantIdRef = useRef<string | null>(null)
    const chatIdRef = useRef<string | null>(null)
    const userIdRef = useRef<number | null>(null)

    // 音频相关的 refs
    const audioContextRef = useRef<AudioContext | null>(null)
    const audioBuffersRef = useRef<AudioBuffer[]>([])
    const audioSourceRef = useRef<AudioBufferSourceNode | null>(null)
    const isPlayingAudioRef = useRef(false)
    const nextPlayTimeRef = useRef(0)

    // 初始化 AudioContext
    const initAudioContext = () => {
        if (!audioContextRef.current) {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
            audioContextRef.current = new AudioCtx()
            nextPlayTimeRef.current = 0
        }
        return audioContextRef.current
    }

    // 实时播放音频数据块
    const playAudioChunkRealtime = async (base64AudioStr: string) => {
        try {
            console.log(`🎵 收到音频块，长度: ${base64AudioStr?.length}`)

            // 解码 base64
            const binaryString = atob(base64AudioStr)
            const pcmBytes: number[] = []

            for (let j = 0; j < binaryString.length; j++) {
                pcmBytes.push(binaryString.charCodeAt(j))
            }

            // 转换为 int16 PCM 数据
            const pcmData = new Int16Array(pcmBytes.length / 2)
            for (let i = 0; i < pcmBytes.length; i += 2) {
                if (i + 1 < pcmBytes.length) {
                    const low = pcmBytes[i]
                    const high = pcmBytes[i + 1]
                    pcmData[i / 2] = (low | (high << 8)) << 16 >> 16
                }
            }

            // 转换为 Float32Array
            const float32Data = new Float32Array(pcmData.length)
            for (let i = 0; i < pcmData.length; i++) {
                float32Data[i] = pcmData[i] / 32768.0
            }

            // 初始化 AudioContext
            const audioContext = initAudioContext()

            // 创建 AudioBuffer
            const sampleRate = 24000
            const numChannels = 1
            const audioBuffer = audioContext.createBuffer(numChannels, float32Data.length, sampleRate)
            audioBuffer.getChannelData(0).set(float32Data)

            // 创建音频源
            const source = audioContext.createBufferSource()
            source.buffer = audioBuffer
            source.connect(audioContext.destination)

            // 计算播放时间
            const currentTime = audioContext.currentTime
            const startTime = Math.max(currentTime, nextPlayTimeRef.current)

            // 第一个音频块
            if (!isPlayingAudioRef.current) {
                console.log(`🎵 开始播放第一个音频块，时长: ${audioBuffer.duration.toFixed(3)} 秒`)
                isPlayingAudioRef.current = true
                setIsAudioPlaying(true)
                nextPlayTimeRef.current = currentTime + audioBuffer.duration
            } else {
                console.log(`🎵 连续播放音频块，时长: ${audioBuffer.duration.toFixed(3)} 秒，调度时间: ${(startTime - currentTime).toFixed(3)} 秒后`)
                nextPlayTimeRef.current = startTime + audioBuffer.duration
            }

            // 播放
            source.start(startTime)
            audioSourceRef.current = source

            // 监听播放结束
            source.onended = () => {
                console.log('🎵 音频块播放完成')
            }

        } catch (error) {
            console.error('❌ 音频块播放失败:', error)
        }
    }

    // 完成音频播放
    const finishAudioPlayback = () => {
        // 等待所有音频块播放完成
        const audioContext = audioContextRef.current
        if (audioContext && isPlayingAudioRef.current) {
            const waitTime = Math.max(0, nextPlayTimeRef.current - audioContext.currentTime)
            console.log(`🎵 等待最后的音频块播放完成，剩余时间: ${waitTime.toFixed(3)} 秒`)

            setTimeout(() => {
                console.log('🎵 所有音频播放完成')
                isPlayingAudioRef.current = false
                setIsAudioPlaying(false)
                nextPlayTimeRef.current = 0
            }, waitTime * 1000)
        }
    }

    // 停止音频播放
    const stopAudio = () => {
        const wasPlaying = isPlayingAudioRef.current
        if (audioSourceRef.current) {
            try {
                audioSourceRef.current.stop()
                console.log('⚠️ 音频播放被手动停止')
            } catch (e) {
                // 忽略已经停止的错误
            }
            audioSourceRef.current = null
        }
        if (wasPlaying) {
            console.log('⚠️ 清空音频播放状态（播放未完成）')
        }
        isPlayingAudioRef.current = false
        setIsAudioPlaying(false)
        nextPlayTimeRef.current = 0
    }

    const start = useCallback(async (userMessage) => {
        controllerRef.current?.abort()

        const controller = new AbortController()
        controllerRef.current = controller

        // 停止之前的音频播放并清空音频数据
        stopAudio()

        setLoading(true)
        setError(null)

        // ✅ 1. 推入 user 消息
        setMessages(prev => [...prev, userMessage])

        // ✅ 2. 准备 assistant 占位
        const assistantId = crypto.randomUUID()
        assistantIdRef.current = assistantId

        setMessages(prev => [
            ...prev,
            {
                id: assistantId,
                role: 'ai',
                type: 'answer',
                content: '',
                content_type: 'text'
            }
        ])

        // 始终使用 object_string 格式
        let requestMessageArr = []

        // 构建消息内容数组，始终包含文字部分
        let arr = [{
            type: 'text',
            text: userMessage?.content || '',
        }]

        // 如果有附件（图片或音频），追加到数组中
        if (userMessage?.imageUrls && userMessage?.imageUrls.length) {
            userMessage.imageUrls.forEach(x => {
                let obj = {
                    type: x.isAudio ? 'audio' : 'file', // 根据是否为音频文件使用不同的 type
                }
                obj['file_id'] = x.response.id
                console.log('📎 添加文件到消息:', { type: obj.type, file_id: obj['file_id'], isAudio: x.isAudio })
                arr.push(obj)
            })
        }

        // 始终使用 object_string 格式
        requestMessageArr.push({
            role: userMessage.role,
            content_type: 'object_string',
            content: JSON.stringify(arr)
        })

        const requestUrl =  `${url}?conversation_id=${conversationIdRef.current}`
        userIdRef.current = userIdRef.current || formatDateTime()

        const requestBody = {
            bot_id: botId,
            user_id:userIdRef.current,
            stream: true,
            auto_save_history: true,
            parameters: {
                user: [
                    {
                        user_id: userIdRef.current,
                        user_name: "user"
                    }
                ]
            },
            additional_messages: requestMessageArr,
            // 添加音频输出配置，确保服务器返回音频流
            output_audio: {
                voice_id: '7426725529589661723', // 指定音色 ID
                format: 'pcm' // 音频格式
            }
        }

        try {
            const response = await fetch(requestUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    "Authorization": 'Bearer pat_zkUh7PgT34IDtE2y4VBBgnTZjBc3nZ2yZ9gXIwia6cYxpzfMMiwELEf3sZyjceYE',
                    ...headers
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            })

            // 检查响应状态
            if (!response.ok) {
                const errorText = await response.text()
                console.error('请求失败:', response.status, errorText)
                try {
                    const errorJson = JSON.parse(errorText)
                    setError(errorJson.msg || `请求失败: ${response.status}`)
                } catch {
                    setError(`请求失败: ${response.status} ${response.statusText}`)
                }
                setLoading(false)
                controller.abort()
                return
            }

            const reader = response.body!.getReader()
            const decoder = new TextDecoder()

            let buffer = ''

            while (true) {
                const {value, done} = await reader.read()
                if (done) break

                buffer += decoder.decode(value, {stream: true})
                const events = buffer.split('\n\n')
                buffer = events.pop() || ''

                for (const raw of events) {
                    if (!raw.trim()) continue

                    const lines = raw.split('\n')
                    const event = lines.find(l => l.startsWith('event:'))?.slice(6).trim()
                    const dataLine = lines.find(l => l.startsWith('data:'))

                    if (!dataLine) continue
                    const dataRaw = dataLine.slice(5).trim()

                    // ✅ DONE
                    if (dataRaw === '"[DONE]"') {
                        setLoading(false)
                        controller.abort()
                        return
                    }

                    const data = JSON.parse(dataRaw)
        if(!isConversationRef.current){
            conversationIdRef.current = data.conversation_id
            isConversationRef.current = true
        }

                    switch (event) {
                        case 'conversation.chat.created':
                            chatIdRef.current = data.id
                            break

                        case 'conversation.message.delta':
                            if (data.content) {
                                setMessages(prev =>
                                    prev.map(m =>
                                        m.id === assistantIdRef.current
                                            ? {
                                                ...m,
                                                content: m.content + data.content,
                                                chat_id: data.chat_id,
                                                section_id: data.section_id
                                            }
                                            : m
                                    )
                                )
                            }
                            break

                        case 'conversation.audio.delta':
                            // 音频流式数据 - 实时播放
                            if (data.content) {
                                playAudioChunkRealtime(data.content)
                            }
                            break

                        case 'conversation.message.completed':
                            // ✅ 单条消息完成（一般可忽略）
                            break

                        case 'conversation.chat.completed':
                            // 对话完成后，确保所有音频播放完成
                            finishAudioPlayback()
                            setLoading(false)
                            controller.abort()
                            return

                        case 'conversation.chat.failed':
                            setError(data?.last_error?.msg || '对话失败')
                            setLoading(false)
                            controller.abort()
                            return

                        default:
                            break
                    }
                }
            }
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                setError('网络或服务异常')
                setLoading(false)
            }
        }
    }, [url, headers])

    const stop = useCallback(() => {
        controllerRef.current?.abort()
        setLoading(false)
    }, [])

    // 清空对话历史，开始新对话
    const reset = useCallback(() => {
        controllerRef.current?.abort()
        stopAudio() // 停止音频播放
        setMessages([])
        setLoading(false)
        setError(null)
        isConversationRef.current = false
        conversationIdRef.current = ''
        assistantIdRef.current = null
        chatIdRef.current = null
        // 注意：不重置 userIdRef，保持用户 ID 一致
    }, [])

    return {
        messages,
        loading,
        error,
        isAudioPlaying,
        start,
        stop,
        reset,
        stopAudio
    }
}
