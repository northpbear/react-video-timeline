# VideoTimeline 视频时间轴组件

> 使用原生 Canvas + Video API 实现的视频帧预览与时间选择组件

## ✨ 功能特性

- 📹 **视频帧提取**：自动从视频中提取关键帧并展示
- 🎯 **时间区间选择**：可拖拽的开始/结束手柄，精确选择视频片段
- 📍 **播放指针**：可拖拽的播放指针，精确定位播放时间
- 💡 **时间提示**：拖拽时显示精确时间的 tooltip
- 🎨 **主题定制**：支持自定义颜色、边框等主题配置
- 📱 **触摸支持**：同时支持鼠标和触摸交互

## 📦 安装

```bash
npm install react-video-timeline
# 或
pnpm add react-video-timeline
# 或
yarn add react-video-timeline
```

## 📦 导入

```tsx
import {
  VideoTimeline,
  VideoTimelineRef,
  TimeRange,
  VideoFrame,
  TimelineTheme,
  DragType,
} from 'react-video-timeline';
```

## 🚀 快速开始

### 基础用法

```tsx
<VideoTimeline
  videoSrc='/path/to/video.mp4'
  onTimeChange={(time) => console.log('当前时间:', time)}
  onRangeChange={(range) => console.log('选中范围:', range)}
/>
```

### 与视频播放器联动

```tsx
import {
  VideoTimeline,
  VideoTimelineRef,
  TimeRange,
} from 'react-video-timeline';
import { useRef, useState } from 'react';

const VideoEditor: React.FC = () => {
  const timelineRef = useRef<VideoTimelineRef>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedRange, setSelectedRange] = useState<TimeRange>({
    start: 0,
    end: 5,
  });

  const handleTimeChange = (time: number) => {
    setCurrentTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  return (
    <div>
      <video
        ref={videoRef}
        src='/path/to/video.mp4'
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
      />
      <VideoTimeline
        ref={timelineRef}
        videoSrc='/path/to/video.mp4'
        currentTime={currentTime}
        selectedRange={selectedRange}
        onTimeChange={handleTimeChange}
        onRangeChange={setSelectedRange}
      />
    </div>
  );
};
```

## 📖 API

### Props

| 属性 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `videoSrc` | `string \| File` | - | **必填**，视频源 URL 或 File 对象 |
| `duration` | `number` | - | 视频总时长（秒），不传则自动获取 |
| `currentTime` | `number` | `0` | 当前播放时间（秒） |
| `selectedRange` | `TimeRange` | - | 选中的时间范围（受控模式） |
| `defaultSelectedRange` | `TimeRange` | - | 默认选中范围（非受控模式） |
| `width` | `number` | `420` | 时间轴宽度（像素） |
| `height` | `number` | `97` | 时间轴高度（像素） |
| `frameInterval` | `number` | `0.2` | 帧提取间隔（秒） |
| `frameHeight` | `number` | `50` | 帧缩略图高度（像素） |
| `showTimeScale` | `boolean` | `true` | 是否显示刻度区域 |
| `disabled` | `boolean` | `false` | 是否禁用交互 |
| `minDuration` | `number` | `0.1` | 最小选择时长（秒） |
| `theme` | `TimelineTheme` | - | 主题配置 |
| `style` | `CSSProperties` | - | 自定义样式 |
| `className` | `string` | - | 自定义类名 |

### 回调事件

| 事件 | 类型 | 说明 |
| --- | --- | --- |
| `onTimeChange` | `(time: number) => void` | 播放时间变化时触发 |
| `onRangeChange` | `(range: TimeRange) => void` | 选中范围变化时触发 |
| `onDragStart` | `(type: DragType) => void` | 开始拖拽时触发 |
| `onDragEnd` | `(type: DragType) => void` | 结束拖拽时触发 |
| `onFramesExtracted` | `(frames: VideoFrame[]) => void` | 帧提取完成时触发 |
| `onFrameExtractProgress` | `(progress: number) => void` | 帧提取进度变化时触发（0-100） |
| `onError` | `(error: Error) => void` | 发生错误时触发 |

### Ref 方法

```tsx
const timelineRef = useRef<VideoTimelineRef>(null);

// 设置当前播放时间
timelineRef.current?.setCurrentTime(5);

// 设置选中范围
timelineRef.current?.setSelectedRange({ start: 2, end: 8 });

// 重新提取视频帧
await timelineRef.current?.refreshFrames();

// 获取当前帧数据
const frames = timelineRef.current?.getFrames();

// 获取 Canvas 元素
const canvas = timelineRef.current?.getCanvas();
```

### 类型定义

```typescript
// 时间范围
interface TimeRange {
  start: number; // 开始时间（秒）
  end: number; // 结束时间（秒）
}

// 视频帧数据
interface VideoFrame {
  time: number; // 帧对应的时间点（秒）
  imageData: string; // 帧图像数据（base64 或 blob URL）
}

// 拖拽类型
type DragType = 'cursor' | 'start' | 'end';

// 点击区域类型
type HitAreaType = DragType | 'track' | null;

// 主题配置
interface TimelineTheme {
  backgroundColor?: string; // 帧区域背景色，默认 'transparent'
  handleColor?: string; // 拖拽把手背景色，默认 '#FFFFFF'
  handleStripeColor?: string; // 拖拽把手条纹颜色，默认 '#E5E4E4'
  scaleTextColor?: string; // 时间刻度文字颜色，默认 '#888888'
  scaleLineColor?: string; // 时间刻度线颜色，默认 '#444444'
  cursorColor?: string; // 播放指针颜色，默认 '#FFFFFF'
  selectionBorderColor?: string; // 选中区域边框颜色，默认 '#FFFFFF'
}
```

## 💡 使用建议

### 受控 vs 非受控模式

```tsx
// 受控模式：与外部播放器同步
<VideoTimeline
  currentTime={currentTime}
  selectedRange={selectedRange}
  onTimeChange={setCurrentTime}
  onRangeChange={setSelectedRange}
/>

// 非受控模式：独立使用
<VideoTimeline
  defaultSelectedRange={{ start: 0, end: 10 }}
  onRangeChange={(range) => console.log(range)}
/>
```

### 帧间隔建议

| 视频时长               | 建议帧间隔 |
| ---------------------- | ---------- |
| 短视频（<30s）         | 0.2 - 0.5s |
| 中等视频（30s - 5min） | 0.5 - 1s   |
| 长视频（>5min）        | 1 - 2s     |

### 自定义主题

```tsx
<VideoTimeline
  videoSrc={videoSrc}
  theme={{
    backgroundColor: '#141414',
    handleColor: '#FFFFFF',
    handleStripeColor: '#E5E4E4',
    scaleTextColor: '#888888',
    scaleLineColor: '#444444',
    cursorColor: '#FFFFFF',
    selectionBorderColor: '#FFFFFF',
  }}
/>
```

## ⚠️ 注意事项

1. **跨域视频**：确保视频服务器设置正确的 CORS 头（`Access-Control-Allow-Origin`）
2. **视频格式**：主要支持 MP4（H.264），WebM 作为备选
3. **浏览器支持**：Chrome 60+, Firefox 55+, Safari 11+, Edge 79+
4. **视频源切换**：当 `videoSrc` 变化时，组件会自动重新挂载以确保状态完全重置

## 📁 文件结构

```
react-video-timeline/
├── components/            # 组件实现
│   ├── index.ts
│   ├── video-timeline.tsx     # 主组件实现
│   └── video-timeline.less    # 样式文件
├── hooks/                 # React Hooks
│   ├── index.ts
│   ├── use-frame-extractor.ts  # 帧提取 Hook
│   └── use-drag-interaction.ts # 拖拽交互 Hook
├── utils/                 # 工具函数
│   ├── index.ts
│   ├── frame-extractor.ts    # 帧提取器
│   ├── timeline-renderer.ts  # Canvas 渲染器
│   └── time-format.ts        # 时间格式化
├── index.tsx              # 组件入口，导出所有类型和组件
├── types.ts               # 类型定义
```

## 🔧 依赖

- **React** >= 16.8.0（需要 Hooks 支持）
- **classnames** ^2.3.2
