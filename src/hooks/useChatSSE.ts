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

export function useChatSSE({url, headers = {}}) {
    const [messages, setMessages] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
   const isConversationRef = useRef<boolean>(false)
    const  conversationIdRef = useRef<number>('')
    const controllerRef = useRef<AbortController | null>(null)
    const assistantIdRef = useRef<string | null>(null)
    const chatIdRef = useRef<string | null>(null)
    const userIdRef = useRef<number | null>(null)

    const start = useCallback(async (userMessage) => {
        controllerRef.current?.abort()

        const controller = new AbortController()
        controllerRef.current = controller

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

        let requestMessageArr = []
        if (userMessage?.imageUrls && userMessage?.imageUrls.length) {
            let arr = [{
                type: 'text',
                text: userMessage?.content || '',
            }]

            userMessage.imageUrls.forEach(x => {
                let obj = {
                    type: x.type.includes('image') ? "image" : 'file',
                }
                if (x?.isShoot) {
                    obj['file_url'] = x.url
                } else {
                    obj['file_id'] = x.response.id
                }
                arr.push(obj)
            })
            requestMessageArr.push({
                role: userMessage.role,
                content_type: 'object_string',
                content: JSON.stringify(arr)
            })
        } else {
            requestMessageArr.push(userMessage)
        }

        const requestUrl =  `${url}?conversation_id=${conversationIdRef.current}`
        userIdRef.current = userIdRef.current || formatDateTime()
        try {
            const response = await fetch(requestUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    "Authorization": 'Bearer pat_hD3fk5ygNuFPLz5ndwIKYWmwY8qgET9DrruIA3Ean8cCEPfSi6o40EZmMg03TS5P',
                    ...headers
                },
                body: JSON.stringify({
                    bot_id: "7574375637029273609",
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
                    additional_messages: requestMessageArr
                }),
                signal: controller.signal
            })

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

                        case 'conversation.message.completed':
                            // ✅ 单条消息完成（一般可忽略）
                            break

                        case 'conversation.chat.completed':
                            setLoading(false)
                            controller.abort()
                            return

                        case 'conversation.chat.failed':
                            setError(data?.last_error?.msg || '对话失败')
                            setLoading(false)
                            controller.abort()
                            return
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

    return {
        messages,
        loading,
        error,
        start,
        stop
    }
}
