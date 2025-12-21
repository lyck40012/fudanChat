import React, {useState} from 'react'
import {message, Modal} from 'antd'
import { X } from 'lucide-react'
import styles from './CameraCaptureModal.module.scss'

interface CameraCaptureModalProps {
    visible: boolean
    onClose: () => void
    onCaptured: (url: string) => void
    baseUrl?: string
}

const DEFAULT_BASE = 'http://127.0.0.1:5000'

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
    visible,
    onClose,
    onCaptured,
}) => {
    const [loading, setLoading] = useState(false)

    if (!visible) return null

    const handleCapture = async () => {
        setLoading(true)
        try {
            const res = await fetch(`${DEFAULT_BASE}/api/capture`, { method: 'POST' })
            if (!res.ok) throw new Error('请求失败')
            const json = await res.json()
            if (json.code === 0 && json.data?.url) {
                const fullUrl = `${DEFAULT_BASE}${json.data.url}`
                onCaptured(fullUrl)
                onClose()
            } else {
                message.error(json.msg || '拍摄失败')
            }
        } catch (err) {
            console.error(err)
            message.error('无法连接拍摄服务')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Modal
            open={visible}
            onCancel={onClose}
            footer={null}
            width={600}
            centered
            maskClosable={false}
            styles={{
                container:{
                    padding: 0,
                    borderRadius:24,
                    overflow: 'hidden',
                }
            }}
            wrapClassName={styles.modalCustom}
            closeIcon={null} // 隐藏默认关闭图标，使用自定义的
        >
            <div className={styles.container}>
                {/* 顶部标题栏 */}
                <div className={styles.header}>
                    <h3>拍摄照片</h3>
                    <button onClick={onClose} className={styles.closeButton} disabled={loading}>
                        <X size={24} />
                    </button>
                </div>

                {/* 视频预览区 */}
                <div className={styles.cameraView}>
                    <img src={`${DEFAULT_BASE}/video_feed`} alt="摄像头画面" className={styles.cameraStream}/>
                </div>

                {/* 底部控制区 */}
                <div className={styles.cameraControls}>
                    <div className={styles.controlInner}>
                        <button 
                            className={`${styles.captureButton} ${loading ? styles.loading : ''}`} 
                            onClick={handleCapture} 
                            disabled={loading}
                        >
                            <div className={styles.shutterInner} />
                        </button>
                        <span className={styles.tipText}>{loading ? '处理中...' : '点击拍摄'}</span>
                    </div>
                </div>
            </div>
        </Modal>
    )
}
