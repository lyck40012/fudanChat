import React from 'react';
import { User, Bot } from 'lucide-react';
import styles from '../../../components/VoiceMessages.module.scss';

// 与 VoiceCallPage 中保持一致的消息类型定义
export interface Message {
  id: number;
  type: 'user' | 'ai';
  content: string;
  isTranscribing?: boolean;
}

interface VoiceMessagesProps {
  messages: Message[];
}

// 语音通话页面的对话消息展示组件
// 只负责渲染 UI，不包含业务逻辑
const VoiceMessages: React.FC<VoiceMessagesProps> = ({ messages }) => {
  if (!messages.length) return null;

  return (
    <div className={styles.messagesWrapper}>
      {messages.map(message => (
        <div
          key={message.id}
          className={`${styles.messageRow} ${
            message.type === 'user' ? styles.messageRowUser : styles.messageRowAi
          }`}
        >
          {/* AI 头像在左侧 */}
          {message.type === 'ai' && (
            <div className={styles.avatarCircleAi}>
              <Bot className="w-5 h-5 text-white" />
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
            {message.isTranscribing ? (
              <div className={styles.transcribingText}>
                <span className={styles.messageText}>语音转文字中</span>
                <div className={styles.dotGroup}>
                  <div className={styles.dot} />
                  <div className={styles.dot} />
                  <div className={styles.dot} />
                </div>
              </div>
            ) : (
              <p className={styles.messageText}>{message.content}</p>
            )}
          </div>

          {/* 用户头像在右侧 */}
          {message.type === 'user' && (
            <div className={styles.avatarCircleUser}>
              <User className="w-5 h-5 text-white" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default VoiceMessages;
