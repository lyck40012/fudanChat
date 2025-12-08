# 摄像头拍照系统前端接口文档

- 基础地址：`http://127.0.0.1:5000`（开发环境）
- 所有 JSON 接口返回统一格式：`{ "code": 0, "data": ..., "msg": "ok" }`；非 0 时表示错误。
- 已开启 CORS，前端可直接 `fetch`。

## 1) 服务状态
- `GET /`
  - 作用：健康检查，返回 `{ "message": "Camera capture API is running" }`。

## 2) 预览流
- `GET /video_feed`
  - 作用：MJPEG 实时视频流，供 `<img>` 或 `<video>` 使用。
  - 响应类型：`multipart/x-mixed-replace; boundary=frame`。

## 3) 照片列表
- `GET /api/photos`
  - 作用：获取已拍照片列表，按时间倒序。
  - 响应 `data` 示例：
    ```json
    [
      {
        "filename": "photo_20241206_120000_abcd1234.jpg",
        "url": "/photos/photo_20241206_120000_abcd1234.jpg",
        "timestamp": "2024-12-06T12:00:00",
        "size": 123456
      }
    ]
    ```

## 4) 拍照
- `POST /api/capture`
  - 作用：立即拍照并保存。
  - 请求体：无。
  - 响应 `data` 示例：
    ```json
    {
      "id": "abcd1234",
      "filename": "photo_20241206_120000_abcd1234.jpg",
      "url": "/photos/photo_20241206_120000_abcd1234.jpg",
      "timestamp": "2024-12-06T12:00:00",
      "width": 1920,
      "height": 1080
    }
    ```

## 5) 删除照片
- `DELETE /api/photos/{filename}`
  - 作用：删除指定照片。
  - 路径参数：`filename`（文件名，不含路径）。
  - 成功返回：`{ "code": 0, "data": { "filename": "xxx.jpg" }, "msg": "deleted" }`。

## 6) 访问单张照片
- `GET /photos/{filename}`
  - 作用：获取已保存照片的文件内容（`image/jpeg`），可直接作为 `<img>` 源。

## 错误提示
- 摄像头不可用或保存失败会返回 HTTP 500，`msg/detail` 说明原因。
- 找不到照片时返回 HTTP 404。
