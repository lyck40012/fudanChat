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

// 首页组件：科技风格重构
export function Home() {
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      <div className={styles.phone}>
        {/* 装饰性角标 */}
        <div className={styles.cornerTL}></div>
        <div className={styles.cornerTR}></div>
        <div className={styles.cornerBL}></div>
        <div className={styles.cornerBR}></div>

        <div className={styles.contentWrapper}>
          {/* 顶部品牌区 */}
          <div className={styles.header}>
            <div className={styles.headerMain}>
              <div className={styles.logo}>
                  <DoubleRightOutlined />
              </div>
            </div>
            <h1 className={styles.title}>AI 数字人助手</h1>
            <p className={styles.subtitle}>智能语音 & 文字问答系统</p>
          </div>

          {/* 中部主操作区 */}
          <div className={styles.actions}>
            {/* 语音通话按钮 */}
            <button
              onClick={() => navigate('/voice-call')}
              className={`${styles.actionButton} ${styles.actionButtonPrimary}`}
            >
              <div className={styles.actionContentInternal}>
                  <div className={styles.actionIconWrapper}>
                      <AudioOutlined />
                  </div>
                  <div className={styles.actionTextGroup}>
                    <h2 className={styles.actionTitle}>语音通话</h2>
                    <p className={styles.actionDesc}>建立语音神经链路 · 实时交互</p>
                  </div>
              </div>
            </button>

            {/* AI 问答按钮 */}
            <button
              onClick={() => navigate('/ai-qa')}
              className={`${styles.actionButton} ${styles.actionButtonSecondary}`}
            >
              <div className={styles.actionContentInternal}>
                  <div className={styles.actionIconWrapper}>
                      <WechatWorkOutlined />
                  </div>
                  <div className={styles.actionTextGroup}>
                    <h2 className={styles.actionTitle}>AI 问答</h2>
                    <p className={styles.actionDesc}>接入全域知识数据库 · 深度解析</p>
                  </div>
              </div>
            </button>
          </div>

          {/* 底部产品介绍区 - 系统状态面板 */}
          <div className={styles.featuresSection}>
            <div className={styles.featuresCard}>
              <div className={styles.featuresList}>
                <div className={styles.featureItem}>
                  <div className={styles.featureIcon}>
                    <ThunderboltOutlined />
                  </div>
                  <h3 className={styles.featureContentTitle}>系统延迟</h3>
                  <p className={styles.featureContentDesc}>12ms</p>
                </div>

                <div className={styles.featureItem}>
                  <div className={styles.featureIcon}>
                    <MessageOutlined />
                  </div>
                  <h3 className={styles.featureContentTitle}>多轮记忆</h3>
                  <p className={styles.featureContentDesc}>已激活</p>
                </div>

                <div className={styles.featureItem}>
                  <div className={styles.featureIcon}>
                    <FileTextOutlined />
                  </div>
                  <h3 className={styles.featureContentTitle}>知识库</h3>
                  <p className={styles.featureContentDesc}>已同步</p>
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