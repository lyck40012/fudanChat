import React, {useEffect, useRef, useState} from 'react';
import {User, Bot} from 'lucide-react';
import styles from './VoiceMessages.module.scss';
import {
    type WsChatClient,
    WsChatEventNames,
    type WsChatEventData,
    ClientEventType,
    type AudioSentencePlaybackStartEvent,
} from '@coze/api/ws-tools';

interface ChatMessage {
    type: 'user' | 'ai';
    timestamp: number;
    // 当前激活的句子索引
    activeSentenceIndex: number;
    // 句子列表
    sentences: string[];
}

import {
    AudioDumpEvent,
    type ConversationAudioTranscriptCompletedEvent,
    WebsocketsEventType,
} from '@coze/api';

interface VoiceMessagesProps {
    clientRef: any
}

const VoiceMessages: React.FC<VoiceMessagesProps> = ({ clientRef }) => {
    const [messageList, setMessageList] = useState<ChatMessage[]>([]);
    const [audioList, setAudioList] = useState<{ label: string; url: string }[]>(
        [],
    );
    const isFirstDeltaRef = useRef(true);
    const messagesWrapperRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        if (!clientRef.current) {
            return;
        }
        const handleMessageEvent = (eventName: string, event: WsChatEventData) => {
            if (eventName === WsChatEventNames.CONNECTED) {
                setMessageList([]);
                setAudioList([]);
                return;
            }
            if (!event) {
                return;
            }

            switch (event.event_type) {
                case 'audio.input.dump':
                    // 处理音频输入 dump 事件
                    setAudioList(prev => [
                        ...prev,
                        {
                            label: event.event_type,
                            url: URL.createObjectURL(event.data.wav),
                        },
                    ]);
                    break;
                case WebsocketsEventType.DUMP_AUDIO:
                    // 处理音频 dump 事件（仅限于开发环境返回）
                    setAudioList(prev => {
                        const newAudioList = [
                            ...prev,
                            {
                                label: 'server',
                                url: (event as AudioDumpEvent).data.url,
                            },
                        ];
                        return newAudioList;
                    });
                    break;
                case WebsocketsEventType.CONVERSATION_AUDIO_TRANSCRIPT_COMPLETED: {
                    const { content } = (
                        event as ConversationAudioTranscriptCompletedEvent
                    ).data;
                    setMessageList(prev => [
                        ...prev,
                        { content, type: 'user', timestamp: Date.now() },
                    ]);
                    break;
                }
                case WebsocketsEventType.CONVERSATION_MESSAGE_DELTA:
                    if (event.data.content) {
                        if (isFirstDeltaRef.current) {
                            // 第一次增量，创建新消息
                            setMessageList(prev => [
                                ...prev,
                                {
                                    content: event.data.content,
                                    type: 'ai',
                                    timestamp: Date.now(),
                                },
                            ]);
                            isFirstDeltaRef.current = false;
                        } else {
                            setMessageList(prev => {
                                // 后续增量，追加到最后一条消息
                                const lastMessage = prev[prev.length - 1];
                                if (lastMessage && lastMessage.type === 'ai') {
                                    lastMessage.content += event.data.content;
                                }
                                const newMessageList = [
                                    ...prev.slice(0, -1),
                                    { ...lastMessage },
                                ];
                                return newMessageList;
                            });
                        }
                    }
                    break;
                case WebsocketsEventType.CONVERSATION_MESSAGE_COMPLETED: {
                    // 收到完成事件，重置标记，下一次将创建新消息
                    isFirstDeltaRef.current = true;
                    break;
                }
                default:
                    break;
            }
        };

        clientRef.current?.on(WsChatEventNames.ALL, handleMessageEvent);

        return () => {
            clientRef.current?.off(WsChatEventNames.ALL, handleMessageEvent);
        };
    }, [clientRef.current]);

    useEffect(() => {
        if (messagesWrapperRef.current) {
            messagesWrapperRef.current.scrollTo({
                top: messagesWrapperRef.current.scrollHeight,
                behavior: 'smooth',
            });
        }
    }, [messageList]);

    return (
        <div className={styles.messagesWrapper} ref={messagesWrapperRef}>
            {messageList.map(message => (
                <div
                    key={message.timestamp}
                    className={`${styles.messageRow} ${
                        message.type === 'user' ? styles.messageRowUser : styles.messageRowAi
                    }`}
                >
                    {/* AI 头像在左侧 */}
                    {message.type === 'ai' && (
                        <div className={styles.avatarCircleAi}>
                            <Bot className="w-5 h-5 text-white"/>
                        </div>
                    )}

                    {/* 气泡主体 */}
                    <div
                        className={`${styles.messageBubble} ${
                            message.type === 'user'
                                ? styles.messageBubbleUser
                                : styles.messageBubbleAi
                        }`}
                    >
                 {/*       {message.isTranscribing ? (
                            <div className={styles.transcribingText}>
                                <span className={styles.messageText}>语音转文字中</span>
                                <div className={styles.dotGroup}>
                                    <div className={styles.dot}/>
                                    <div className={styles.dot}/>
                                    <div className={styles.dot}/>
                                </div>
                            </div>
                        ) : (
                            <p className={styles.messageText}>{message.content}</p>
                        )}*/}
                        <p className={styles.messageText}>{message.content}</p>
                    </div>

                    {/* 用户头像在右侧 */}
                    {message.type === 'user' && (
                        <div className={styles.avatarCircleUser}>
                            <User className="w-5 h-5 text-white"/>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

export default VoiceMessages;
