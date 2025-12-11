import { useNavigate } from 'react-router-dom';
import styles from './Home.module.scss';
import {
  AudioOutlined,
  DoubleRightOutlined,
  WechatWorkOutlined,
  ThunderboltOutlined,
  MessageOutlined,
  FileTextOutlined
} from "@ant-design/icons";

// 首页组件：医疗风格重构
export function Home() {
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      <div className={styles.phone}>
        <div className={styles.contentWrapper}>
          {/* 顶部品牌区 */}
          <div className={styles.header}>
            <div className={styles.headerMain}>
              <div className={styles.logo}>
                  <DoubleRightOutlined />
              </div>
            </div>
            <h1 className={styles.title}>复旦医疗助手</h1>
            <p className={styles.subtitle}>智能语音 & 文字问诊系统</p>
          </div>

          {/* 中部主操作区 */}
          <div className={styles.actions}>
            {/* 语音通话按钮 */}
            <button
              onClick={() => navigate('/voice-call')}
              className={`${styles.actionButton} ${styles.actionButtonPrimary}`}
            >
              <div className={styles.actionIconWrapper}>
                  <AudioOutlined />
              </div>
              <div className={styles.actionTextGroup}>
                <h2 className={styles.actionTitle}>语音问诊</h2>
                <p className={styles.actionDesc}>实时语音沟通 · 快速诊断</p>
              </div>
            </button>

            {/* AI 问答按钮 */}
            <button
              onClick={() => navigate('/ai-qa')}
              className={`${styles.actionButton} ${styles.actionButtonSecondary}`}
            >
              <div className={styles.actionIconWrapper}>
                  <WechatWorkOutlined />
              </div>
              <div className={styles.actionTextGroup}>
                <h2 className={styles.actionTitle}>智能问答</h2>
                <p className={styles.actionDesc}>全科知识库 · 深度解析</p>
              </div>
            </button>
          </div>

          {/* 底部产品介绍区 - 简洁的功能展示 */}
          <div className={styles.featuresSection}>
            <div className={styles.featuresCard}>
              <div className={styles.featuresList}>
                <div className={styles.featureItem}>
                  <div className={styles.featureIcon}>
                    <ThunderboltOutlined />
                  </div>
                  <h3 className={styles.featureContentTitle}>快速响应</h3>
                  <p className={styles.featureContentDesc}>秒级回复</p>
                </div>

                <div className={styles.featureItem}>
                  <div className={styles.featureIcon}>
                    <MessageOutlined />
                  </div>
                  <h3 className={styles.featureContentTitle}>多轮问诊</h3>
                  <p className={styles.featureContentDesc}>上下文记忆</p>
                </div>

                <div className={styles.featureItem}>
                  <div className={styles.featureIcon}>
                    <FileTextOutlined />
                  </div>
                  <h3 className={styles.featureContentTitle}>专业知识</h3>
                  <p className={styles.featureContentDesc}>权威数据库</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
