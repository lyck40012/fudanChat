import React, {useState} from 'react'
import {message, Modal} from 'antd'
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
    baseUrl = DEFAULT_BASE
}) => {
    const [loading, setLoading] = useState(false)

    if (!visible) return null

    const handleCapture = async () => {
        setLoading(true)
        try {
            const res = await fetch(`${baseUrl}/api/capture`, { method: 'POST' })
            if (!res.ok) throw new Error('请求失败')
            const json = await res.json()
            if (json.code === 0 && json.data?.url) {
                const fullUrl = `${baseUrl}${json.data.url}`
                onCaptured(fullUrl)
                message.success('拍摄成功，已加入输入框')
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
            width={720}
            centered
            maskClosable={false}
            bodyStyle={{ padding: 0, display: 'flex', justifyContent: 'center' }}
        >
            <div className={styles.cameraPreview}>
                <div className={styles.cameraView}>
                    <img src={`${baseUrl}/video_feed`} alt="摄像头画面" className={styles.cameraStream}/>
                </div>
                <div className={styles.cameraControls}>
                    <button className={styles.cancelButton} onClick={onClose} disabled={loading}>
                        <span>取消</span>
                    </button>
                    <button className={styles.captureButton} onClick={handleCapture} disabled={loading}>
                        {loading ? '拍摄中...' : '拍摄'}
                    </button>
                </div>
            </div>
        </Modal>
    )
}
