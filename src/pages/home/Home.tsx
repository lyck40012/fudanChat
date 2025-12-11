import { useNavigate } from 'react-router-dom';
import styles from './Home.module.scss';
import {
  AudioOutlined,
  DoubleRightOutlined,
  WechatWorkOutlined
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

        </div>
      </div>
    </div>
  );
}

export default Home;
