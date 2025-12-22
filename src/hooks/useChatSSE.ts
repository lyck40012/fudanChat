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
    const audioChunksRef = useRef<string[]>([]) // 收集原始 base64 字符串（不做任何处理）
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

    // 收集音频数据块（完全按照 Go 代码的方式，不做任何处理）
    const collectAudioChunk = (base64AudioStr: string) => {
        console.log('🎵 收集音频数据块')
        console.log('  - 类型:', typeof base64AudioStr)
        console.log('  - 长度:', base64AudioStr?.length)
        console.log('  - 前50字符:', base64AudioStr?.substring(0, 50))

        // 直接收集，不做任何清理
        audioChunksRef.current.push(base64AudioStr)
        console.log('  - 当前总块数:', audioChunksRef.current.length)
    }

    // 参考 Go 代码的 writeWav 函数，将收集的所有音频数据合并并播放
    const playCollectedAudio = () => {
        console.log('\n====== 开始处理音频 ======')
        console.log('收集到的数据块数量:', audioChunksRef.current.length)

        if (audioChunksRef.current.length === 0) {
            console.log('⚠️ 没有音频数据可播放')
            return
        }

        try {
            // 参考 Go 代码: pcmData := make([]byte, 0)
            const allPcmBytes: number[] = []

            // 参考 Go 代码: 逐个解码 base64 字符串并合并字节
            for (let i = 0; i < audioChunksRef.current.length; i++) {
                const base64AudioStr = audioChunksRef.current[i]

                console.log(`\n处理第 ${i + 1}/${audioChunksRef.current.length} 个数据块:`)
                console.log('  - Base64 长度:', base64AudioStr.length)

                try {
                    // 参考 Go 代码: base64.StdEncoding.DecodeString(base64AudioStr.(string))
                    // 使用 atob 解码 base64
                    const binaryString = atob(base64AudioStr)
                    console.log('  - 解码后字节长度:', binaryString.length)

                    // 将二进制字符串转换为字节数组
                    for (let j = 0; j < binaryString.length; j++) {
                        allPcmBytes.push(binaryString.charCodeAt(j))
                    }

                    console.log('  - ✅ 成功解码')
                } catch (decodeError) {
                    console.error(`  - ❌ 第 ${i + 1} 块解码失败:`, decodeError)
                    console.error('  - Base64 内容前200字符:', base64AudioStr.substring(0, 200))
                    // 跳过这个块，继续处理下一个
                    continue
                }
            }

            console.log('\n所有数据块处理完成:')
            console.log('  - 合并后总字节数:', allPcmBytes.length)

            if (allPcmBytes.length === 0) {
                console.error('❌ 没有有效的音频数据')
                audioChunksRef.current = []
                return
            }

            // 参考 Go 代码: 将字节转换为 int16 PCM 数据
            // intData = append(intData, int(uint16(pcmData[i])|uint16(pcmData[i+1])<<8))
            const pcmData = new Int16Array(allPcmBytes.length / 2)
            for (let i = 0; i < allPcmBytes.length; i += 2) {
                if (i + 1 < allPcmBytes.length) {
                    // 小端序: 低字节在前，高字节在后
                    const low = allPcmBytes[i]
                    const high = allPcmBytes[i + 1]
                    pcmData[i / 2] = (low | (high << 8)) << 16 >> 16 // 转为有符号 int16
                }
            }

            console.log('  - PCM 样本数:', pcmData.length)

            // 转换为 Float32Array (Web Audio API 需要)
            const float32Data = new Float32Array(pcmData.length)
            for (let i = 0; i < pcmData.length; i++) {
                float32Data[i] = pcmData[i] / 32768.0 // 归一化到 [-1, 1]
            }

            console.log('  - Float32 样本数:', float32Data.length)

            // 创建 AudioContext
            const audioContext = initAudioContext()

            // 参考 Go 代码的参数: sampleRate = 24000, bitDepth = 16, numChannels = 1
            const sampleRate = 24000
            const numChannels = 1
            const audioBuffer = audioContext.createBuffer(numChannels, float32Data.length, sampleRate)
            audioBuffer.getChannelData(0).set(float32Data)

            console.log('  - 音频时长:', audioBuffer.duration.toFixed(2), '秒')

            // 创建音频源并播放
            const source = audioContext.createBufferSource()
            source.buffer = audioBuffer
            source.connect(audioContext.destination)

            isPlayingAudioRef.current = true
            setIsAudioPlaying(true)

            source.onended = () => {
                console.log('🎵 音频播放完成\n')
                isPlayingAudioRef.current = false
                setIsAudioPlaying(false)
            }

            source.start(0)
            audioSourceRef.current = source

            console.log('🎵 开始播放音频\n')
            console.log('====== 音频处理完成 ======\n')

            // 清空已播放的音频数据
            audioChunksRef.current = []

        } catch (error) {
            console.error('\n❌ 音频播放失败:', error)
            console.error('错误详情:', (error as Error).message)
            console.error('错误堆栈:', (error as Error).stack)
            isPlayingAudioRef.current = false
            setIsAudioPlaying(false)
            audioChunksRef.current = []
        }
    }

    // 停止音频播放
    const stopAudio = () => {
        if (audioSourceRef.current) {
            try {
                audioSourceRef.current.stop()
            } catch (e) {
                // 忽略已经停止的错误
            }
            audioSourceRef.current = null
        }
        audioChunksRef.current = [] // 清空收集的音频数据
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

        console.log('🚀 发送请求到 /v3/chat:', {
            url: requestUrl,
            body: requestBody,
            messageContent: requestMessageArr.length > 0 && requestMessageArr[0].content_type === 'object_string'
                ? JSON.parse(requestMessageArr[0].content)
                : requestMessageArr
        })

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
                console.error('❌ 请求失败:', {
                    status: response.status,
                    statusText: response.statusText,
                    errorBody: errorText,
                    requestBody: requestBody
                })
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

                    console.log('📨 收到 SSE 事件:', { event, data })

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
                            // 音频流式数据 - 只收集，不播放
                            console.log('📨 收到 audio.delta 事件，完整 data:', JSON.stringify(data, null, 2))
                            console.log('📨 data 的所有键:', Object.keys(data))

                            // 尝试多个可能的字段名
                            let audioData = null

                            // 优先尝试常见字段
                            if (data.content) {
                                console.log('📨 data.content 类型:', typeof data.content)
                                console.log('📨 data.content 值:', data.content)
                                audioData = data.content
                            } else if (data.audio) {
                                console.log('📨 data.audio 类型:', typeof data.audio)
                                console.log('📨 data.audio 值:', data.audio)
                                audioData = data.audio
                            } else if (data.delta) {
                                console.log('📨 data.delta 类型:', typeof data.delta)
                                console.log('📨 data.delta 值:', data.delta)
                                audioData = data.delta
                            }

                            if (audioData) {
                                // 如果是对象，尝试提取 base64 字符串
                                if (typeof audioData === 'object') {
                                    console.log('📨 audioData 是对象，尝试提取 base64 字符串')
                                    console.log('📨 audioData 的键:', Object.keys(audioData))

                                    // 尝试常见的 base64 字段名
                                    if (audioData.content) {
                                        audioData = audioData.content
                                    } else if (audioData.data) {
                                        audioData = audioData.data
                                    } else if (audioData.audio) {
                                        audioData = audioData.audio
                                    } else {
                                        console.error('❌ 无法从对象中提取 base64 字符串')
                                        console.error('audioData 完整内容:', JSON.stringify(audioData))
                                    }
                                }

                                // 确保是字符串
                                if (typeof audioData === 'string') {
                                    collectAudioChunk(audioData)
                                } else {
                                    console.error('❌ audioData 不是字符串类型:', typeof audioData)
                                }
                            } else {
                                console.warn('⚠️ audio.delta 事件中没有找到音频数据')
                            }
                            break

                        case 'conversation.message.completed':
                            // ✅ 单条消息完成（一般可忽略）
                            break

                        case 'conversation.chat.completed':
                            console.log('✅ 对话完成，开始播放收集的音频')
                            // 对话完成后播放收集的音频
                            playCollectedAudio()
                            setLoading(false)
                            controller.abort()
                            return

                        case 'conversation.chat.failed':
                            setError(data?.last_error?.msg || '对话失败')
                            setLoading(false)
                            controller.abort()
                            return

                        default:
                            console.log('⚠️ 未处理的事件类型:', event)
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
