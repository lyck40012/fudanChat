import { useNavigate } from 'react-router-dom';

import styles from './HomePage.module.scss';
import {AudioOutlined, DoubleRightOutlined, WechatWorkOutlined} from "@ant-design/icons";

// 首页组件：使用 Sass 模块进行样式管理
export function HomePage() {
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      {/* 9:16 容器 */}
      <div className={styles.phone}>
        {/* 顶部品牌区 - 15% */}
        <div className={styles.header}>
          <div className={styles.headerMain}>
            <div className={styles.logo}>
                <DoubleRightOutlined />
            </div>
            <h1 className={styles.title}>AI 数字人助手</h1>
          </div>
          <p className={styles.subtitle}>语音 & 文字智能问答</p>
        </div>

        {/* 中部主操作区 - 30% */}
        <div className={styles.actions}>
          <div className={styles.actionsInner}>
            {/* 语音通话按钮 */}
            <button
              onClick={() => navigate('/voice-call')}
              className={`${styles.actionButton} ${styles.actionButtonPrimary}`}
            >
              <div className={styles.actionIconWrapper}>
                  <AudioOutlined />
              </div>
              <div className="text-center">
                <h2 className={styles.actionTitle}>语音通话</h2>
                <p className={styles.actionDescPrimary}>点击开始与数字人语音对话</p>
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
              <div className="text-center">
                <h2 className={styles.actionTitle}>AI问答</h2>
                <p className={styles.actionDescSecondary}>点击进入AI问答界面</p>
              </div>
            </button>
          </div>
        </div>

        {/* 底部产品介绍区 - 55% */}
        <div className={styles.featuresSection}>
          <div className={styles.featuresCard}>
            <h2 className={styles.featuresTitle}>智能数字人互动系统</h2>

            <p className={styles.featuresIntro}>
              支持自然语音对话与文字对话
              <br />
              可回答产品、门店、活动等多种问题
            </p>

            {/* 能力点 */}
            <div className={styles.featuresList}>
              <div className={styles.featureItem}>
                <div className={styles.featureIconWrapperBlue}>

                </div>
                <div>
                  <h3 className={styles.featureContentTitle}>语音实时问答</h3>
                  <p className={styles.featureContentDesc}>自然流畅的语音交互体验</p>
                </div>
              </div>

              <div className={styles.featureItem}>
                <div className={styles.featureIconWrapperPurple}>

                </div>
                <div>
                  <h3 className={styles.featureContentTitle}>多轮智能对话</h3>
                  <p className={styles.featureContentDesc}>理解上下文，精准回答</p>
                </div>
              </div>

              <div className={styles.featureItem}>
                <div className={styles.featureIconWrapperIndigo}>

                </div>
                <div>
                  <h3 className={styles.featureContentTitle}>支持文件讲解</h3>
                  <p className={styles.featureContentDesc}>上传文档，智能解读</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
