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

// 首页组件：使用 Sass 模块进行样式管理
export function Home() {
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      {/* 9:16 容器 */}
      <div className={styles.phone}>
        <div className={styles.contentWrapper}>
          {/* 顶部品牌区 */}
          <div className={styles.header}>
            <div className={styles.headerMain}>
              <div className={styles.logo}>
                  <DoubleRightOutlined />
              </div>
            </div>
            <h1 className={styles.title}>AI 数字人助手</h1>
            <p className={styles.subtitle}>语音 & 文字智能问答</p>
          </div>

          {/* 中部主操作区 */}
          <div className={styles.actions}>
            {/* 语音通话按钮 */}
            <button
              onClick={() => navigate('/voice-call')}
              className={`${styles.actionButton} ${styles.actionButtonPrimary}`}
            >
              <div className={`${styles.actionIconWrapper} ${styles.primaryIcon}`}>
                  <AudioOutlined />
              </div>
              <div className={styles.actionContent}>
                <h2 className={styles.actionTitle}>语音通话</h2>
                <p className={styles.actionDesc}>点击开始与数字人实时语音对话，体验自然交互</p>
              </div>
            </button>

            {/* AI 问答按钮 */}
            <button
              onClick={() => navigate('/ai-qa')}
              className={`${styles.actionButton} ${styles.actionButtonSecondary}`}
            >
              <div className={`${styles.actionIconWrapper} ${styles.secondaryIcon}`}>
                  <WechatWorkOutlined />
              </div>
              <div className={styles.actionContent}>
                <h2 className={styles.actionTitle}>AI 问答</h2>
                <p className={styles.actionDesc}>文字聊天模式，支持复杂问题深度解析</p>
              </div>
            </button>
          </div>

          {/* 底部产品介绍区 */}
          <div className={styles.featuresSection}>
            <div className={styles.featuresCard}>
              <h2 className={styles.featuresTitle}>智能互动能力</h2>

              {/* 能力点 */}
              <div className={styles.featuresList}>
                <div className={styles.featureItem}>
                  <div className={`${styles.featureIcon} ${styles.iconBlue}`}>
                    <ThunderboltOutlined />
                  </div>
                  <div className={styles.featureContent}>
                    <h3 className={styles.featureContentTitle}>实时响应</h3>
                    <p className={styles.featureContentDesc}>毫秒级语音识别与回答</p>
                  </div>
                </div>

                <div className={styles.featureItem}>
                  <div className={`${styles.featureIcon} ${styles.iconPurple}`}>
                    <MessageOutlined />
                  </div>
                  <div className={styles.featureContent}>
                    <h3 className={styles.featureContentTitle}>多轮对话</h3>
                    <p className={styles.featureContentDesc}>具备上下文记忆能力</p>
                  </div>
                </div>

                <div className={styles.featureItem}>
                  <div className={`${styles.featureIcon} ${styles.iconIndigo}`}>
                    <FileTextOutlined />
                  </div>
                  <div className={styles.featureContent}>
                    <h3 className={styles.featureContentTitle}>知识问答</h3>
                    <p className={styles.featureContentDesc}>覆盖广泛的业务知识库</p>
                  </div>
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