import (
    "log"
    "os"

    "github.com/go-audio/audio"
    "github.com/go-audio/wav"
)

func callCoze() {

    pcmData := make([]byte, 0)

    // 调用 coze ，从 http response 中一直拿返回的 event 和 data
    for {
        // 伪代码，从 http response 中流式读取 event 和 data
        event, data := resp.Recv()
        // 对于所有 event 为 conversation.audio.delta 的事件，取出 data 中的音频片段
        if event == "conversation.audio.delta" {
            audioData := make(map[string]interface{})
            err := json.Unmarshal([]byte(data), &audioData)
            if err != nil {
                log.Fatalf("Error Unmarshal: %v", err)
            }
            if base64AudioStr, exist := audioData["content"]; exist {
                pcmPart, err := base64.StdEncoding.DecodeString(base64AudioStr.(string))
                if err != nil {
                    log.Fatalf("Error DecodeString: %v", err)
                }
                pcmData = append(pcmData, pcmPart...)
            }
        }
        // 结束事件，退出循环
        if event == "done" {
            break
        }
    }

    writeWav(pcmData)
}

func writeWav(pcmData [][]byte) {
    // 采样率
    sampleRate := 24000
    // 位深
    bitDepth := 16
    // 通道数
    numChannels := 1
    f, err := os.Create("pcm-example.wav")
    if err != nil {
        log.Fatalf("Error Create: %v", err)
    }

    intData := make([]int, 0)
    for i := 0; i < len(pcmData); i += 2 {
        intData = append(intData, int(uint16(pcmData[i])|uint16(pcmData[i+1])<<8))
    }
    intBuffer := &audio.IntBuffer{
        Format: &audio.Format{
           NumChannels: numChannels,
           SampleRate:  sampleRate,
        },
        Data:           intData,
        SourceBitDepth: bitDepth,
    }

    e := wav.NewEncoder(f, sampleRate, bitDepth, numChannels, 1)
    defer e.Close()
    err = e.Write(intBuffer)
    if err != nil {
        log.Fatalf("Error Write: %v", err)
    }
    return
}
