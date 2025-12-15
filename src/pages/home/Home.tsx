import { useNavigate } from 'react-router-dom';
import styles from './Home.module.scss';
import {
  FileTextOutlined,
  MessageOutlined,
  DoubleRightOutlined,
} from "@ant-design/icons";

// 首页组件：医疗智能体风格
export function Home() {
  const navigate = useNavigate();

  // 预设问题列表
  const presetQuestions = [
    '便秘怎么办？',
    '最近总是胃痛，还拉肚子？',
    '我有肠癌家族史，怎么查？',
  ];

  // 处理预设问题点击
  const handlePresetClick = (question: string) => {
    navigate('/ai-qa', { state: { initialQuestion: question } });
  };

  return (
    <div className={styles.page}>
      <div className={styles.phone}>
        <div className={styles.contentWrapper}>
          {/* 顶部品牌区 */}
          <div className={styles.header}>
            <div className={styles.logoCircle}>
              <DoubleRightOutlined className={styles.logoIcon} />
            </div>
            <h1 className={styles.title}>镜观智能体</h1>
            <p className={styles.subtitle}>消化内镜AI全流程辅助</p>
          </div>

          {/* 主功能入口 - 语音通话和问答助手 */}
          <div className={styles.mainActions}>
            <button
              onClick={() => navigate('/voice-call')}
              className={`${styles.mainButton} ${styles.mainButtonVoice}`}
            >
              <div className={styles.mainButtonIcon}>📞</div>
              <div className={styles.mainButtonContent}>
                <h2 className={styles.mainButtonTitle}>语音通话</h2>
                <p className={styles.mainButtonDesc}>实时语音对话 · 智能诊断</p>
              </div>
            </button>
          </div>

          {/* 次要功能卡片区 */}
          <div className={styles.secondaryCards}>
            {/* 上传报告卡片 */}
            <button
              onClick={()=>{
                  handlePresetClick('你好')
              }}
              className={`${styles.card} ${styles.cardPrimary}`}
            >
              <div className={styles.cardBorder}></div>
              <FileTextOutlined className={styles.cardIcon} />
              <span className={styles.cardText}>上传报告,立即解读!</span>
              <div className={styles.cardArrow}>→</div>
            </button>

            {/* 随便问问卡片 */}
            <button
              onClick={()=>{
                  handlePresetClick('你好')
              }}
              className={`${styles.card} ${styles.cardSecondary}`}
            >
              <div className={styles.cardBorder}></div>
              <MessageOutlined className={styles.cardIcon} />
              <span className={styles.cardText}>没有报告,随便问问!</span>
              <div className={styles.cardArrow}>→</div>
            </button>
          </div>

          {/* 预设问题区 */}
          <div className={styles.presetSection}>
            <p className={styles.presetLabel}>您可以问:</p>
            <div className={styles.presetQuestions}>
              {presetQuestions.map((question, index) => (
                <button
                  key={index}
                  onClick={() => handlePresetClick(question)}
                  className={styles.presetButton}
                >
                  <span className={styles.presetIcon}>?</span>
                  <span className={styles.presetText}>{question}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
