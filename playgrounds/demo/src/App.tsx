import {
  useRef,
  useState,
  useCallback,
  useMemo,
  useEffect,
  useLayoutEffect,
} from "react";
import {
  VideoTimeline,
  VideoTimelineRef,
  TimeRange,
  VideoFrame,
} from "react-video-timeline";
import "./App.css";

// 示例视频 URL（使用本地 public 目录下的视频）
const SAMPLE_VIDEO_URL = "/video.mp4";

// 默认宽度（当容器宽度无法获取时使用）
const DEFAULT_WIDTH = 800;

// 默认主题配置
const DEFAULT_THEME = {
  backgroundColor: "#1a1a1a",
  handleColor: "#FFFFFF",
  handleStripeColor: "#E5E4E4",
  scaleTextColor: "#888888",
  scaleLineColor: "#444444",
  cursorColor: "#FFFFFF",
  selectionBorderColor: "#FFFFFF",
};

// 主题配置项定义
const THEME_CONFIG = [
  { key: "backgroundColor", label: "背景色" },
  { key: "handleColor", label: "把手颜色" },
  { key: "handleStripeColor", label: "把手条纹" },
  { key: "scaleTextColor", label: "刻度文字" },
  { key: "scaleLineColor", label: "刻度线" },
  { key: "cursorColor", label: "播放指针" },
  { key: "selectionBorderColor", label: "选区边框" },
] as const;

function App() {
  const timelineRef = useRef<VideoTimelineRef>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineContainerRef = useRef<HTMLDivElement>(null);

  // 状态
  const [videoSrc, setVideoSrc] = useState<string | File>(SAMPLE_VIDEO_URL);

  // 为 File 类型创建稳定的 blob URL，避免每次渲染都创建新的
  const videoUrl = useMemo(() => {
    if (typeof videoSrc === "string") {
      return videoSrc;
    }
    return URL.createObjectURL(videoSrc);
  }, [videoSrc]);

  // 清理 blob URL
  useEffect(() => {
    return () => {
      if (typeof videoSrc !== "string") {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl, videoSrc]);
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedRange, setSelectedRange] = useState<TimeRange>({
    start: 0,
    end: 10,
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [extractProgress, setExtractProgress] = useState(0);
  const [isExtracting, setIsExtracting] = useState(true);

  // 配置选项
  const [width, setWidth] = useState<number | null>(null); // 初始为 null，等待容器测量
  const [height, setHeight] = useState(97);
  const [frameInterval, setFrameInterval] = useState(1);
  const [showTimeScale, setShowTimeScale] = useState(true);
  const [disabled, setDisabled] = useState(false);
  const [theme, setTheme] = useState(DEFAULT_THEME);

  // 更新单个主题配置项
  const updateTheme = useCallback(
    (key: keyof typeof DEFAULT_THEME, value: string) => {
      setTheme((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  // 首次加载时根据容器宽度设置时间轴宽度
  useLayoutEffect(() => {
    if (timelineContainerRef.current && width === null) {
      const containerWidth = timelineContainerRef.current.clientWidth;
      setWidth(containerWidth > 0 ? containerWidth - 32 : DEFAULT_WIDTH);
    }
  }, [width]);

  // 时间变化处理
  const handleTimeChange = useCallback((time: number) => {
    setCurrentTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  }, []);

  // 范围变化处理
  const handleRangeChange = useCallback((range: TimeRange) => {
    setSelectedRange(range);
    // 拖动范围时暂停播放
    if (videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  // 帧提取进度
  const handleFrameExtractProgress = useCallback((progress: number) => {
    setExtractProgress(progress);
    setIsExtracting(progress < 100);
  }, []);

  // 帧提取完成
  const handleFramesExtracted = useCallback((frames: VideoFrame[]) => {
    console.log(`提取完成，共 ${frames.length} 帧`);
    setIsExtracting(false);
  }, []);

  // 视频元数据加载
  const handleVideoLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setSelectedRange({ start: 0, end: videoRef.current.duration });
    }
  }, []);

  // 使用 requestAnimationFrame 实现高频时间更新（替代 onTimeUpdate 的低频更新）
  useLayoutEffect(() => {
    if (!isPlaying || !videoRef.current) return;

    let animationFrameId: number;

    const updateTime = () => {
      if (videoRef.current) {
        const time = videoRef.current.currentTime;
        setCurrentTime(time);

        // 检查是否到达选中范围结束位置
        if (time >= selectedRange.end) {
          videoRef.current.pause();
          videoRef.current.currentTime = selectedRange.start;
          setCurrentTime(selectedRange.start);
          setIsPlaying(false);
          return;
        }
      }
      animationFrameId = requestAnimationFrame(updateTime);
    };

    animationFrameId = requestAnimationFrame(updateTime);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, selectedRange.start, selectedRange.end]);

  // 播放/暂停
  const togglePlay = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        // 如果当前时间不在选中范围内，从范围开始播放
        if (
          currentTime < selectedRange.start ||
          currentTime >= selectedRange.end
        ) {
          videoRef.current.currentTime = selectedRange.start;
          setCurrentTime(selectedRange.start);
        }
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying, currentTime, selectedRange]);

  // 文件选择
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setVideoSrc(file);
        setCurrentTime(0);
        setSelectedRange({ start: 0, end: 0 });
        setIsPlaying(false);
        setIsExtracting(true);
        setExtractProgress(0);
      }
    },
    []
  );

  // 重置为示例视频
  const resetToSample = useCallback(() => {
    setVideoSrc(SAMPLE_VIDEO_URL);
    setCurrentTime(0);
    setSelectedRange({ start: 0, end: 10 });
    setIsPlaying(false);
    setIsExtracting(true);
    setExtractProgress(0);
  }, []);

  // 格式化时间
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${m.toString().padStart(2, "0")}:${s
      .toString()
      .padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
  };

  return (
    <div className="app">
      <header className="header">
        <h1>🎬 React Video Timeline</h1>
        <p>视频帧预览与时间选择组件演示</p>
      </header>

      <main className="main">
        {/* 左侧：视频预览和时间轴 */}
        <section className="preview-section">
          {/* 视频播放器 */}
          <div className="video-container">
            <video
              ref={videoRef}
              src={videoUrl}
              onLoadedMetadata={handleVideoLoadedMetadata}
              onTimeUpdate={() => {
                // 仅在非播放状态时通过 onTimeUpdate 更新时间（如用户拖动进度条）
                // 播放状态下使用 requestAnimationFrame 实现更流畅的更新
                if (!isPlaying && videoRef.current) {
                  setCurrentTime(videoRef.current.currentTime);
                }
              }}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onError={(e) => {
                const video = e.currentTarget;
                if (video.error) {
                  console.error(
                    "视频播放器错误:",
                    video.error.message,
                    "(code:",
                    video.error.code,
                    ")"
                  );
                }
              }}
              // 只有远程 URL 才需要 crossOrigin，本地文件和同源 URL 不需要
              crossOrigin={
                typeof videoSrc === "string" && videoSrc.startsWith("http")
                  ? "anonymous"
                  : undefined
              }
            />
            <div className="video-controls">
              <button className="play-btn" onClick={togglePlay}>
                {isPlaying ? "⏸️ 暂停" : "▶️ 播放"}
              </button>
              <span className="time-display">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>
          </div>

          {/* 时间轴组件 */}
          <div className="timeline-container" ref={timelineContainerRef}>
            {width !== null && (
              <VideoTimeline
                ref={timelineRef}
                videoSrc={videoSrc}
                currentTime={currentTime}
                selectedRange={selectedRange}
                width={width}
                height={height}
                frameInterval={frameInterval}
                showTimeScale={showTimeScale}
                disabled={disabled}
                theme={theme}
                onTimeChange={handleTimeChange}
                onRangeChange={handleRangeChange}
                onFrameExtractProgress={handleFrameExtractProgress}
                onFramesExtracted={handleFramesExtracted}
                onDragStart={(type) => console.log("开始拖拽:", type)}
                onDragEnd={(type) => console.log("结束拖拽:", type)}
                onError={(error) => console.error("错误:", error)}
              />
            )}
          </div>

          {/* 状态信息 */}
          <div className="status-panel">
            <div className="status-item">
              <span className="label">选中范围:</span>
              <span className="value">
                {formatTime(selectedRange.start)} -{" "}
                {formatTime(selectedRange.end)}
                <span className="duration">
                  (时长: {formatTime(selectedRange.end - selectedRange.start)})
                </span>
              </span>
            </div>
            <div className="status-item">
              <span className="label">当前位置:</span>
              <span className="value">{formatTime(currentTime)}</span>
            </div>
            {isExtracting && (
              <div className="status-item">
                <span className="label">帧提取进度:</span>
                <span className="value">{Math.round(extractProgress)}%</span>
              </div>
            )}
          </div>
        </section>

        {/* 右侧：控制面板 */}
        <aside className="control-panel">
          <h2>⚙️ 配置选项</h2>

          {/* 视频源 */}
          <div className="control-group">
            <h3>视频源</h3>
            <div className="file-input-wrapper">
              <input
                type="file"
                accept="video/mp4,video/webm,video/ogg"
                onChange={handleFileChange}
                id="video-file"
              />
              <label htmlFor="video-file">选择本地视频</label>
            </div>
            <p className="format-hint">支持格式: MP4 (H.264), WebM, Ogg</p>
            <button className="reset-btn" onClick={resetToSample}>
              使用示例视频
            </button>
          </div>

          {/* 尺寸设置 */}
          <div className="control-group">
            <h3>尺寸</h3>
            <label>
              宽度: {width ?? DEFAULT_WIDTH}px
              <input
                type="range"
                min="300"
                max="1200"
                value={width ?? DEFAULT_WIDTH}
                onChange={(e) => setWidth(Number(e.target.value))}
              />
            </label>
            <label>
              高度: {height}px
              <input
                type="range"
                min="60"
                max="150"
                value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
              />
            </label>
          </div>

          {/* 帧设置 */}
          <div className="control-group">
            <h3>帧提取</h3>
            <label>
              帧间隔: {frameInterval}s
              <input
                type="range"
                min="0.1"
                max="5"
                step="0.1"
                value={frameInterval}
                onChange={(e) => setFrameInterval(Number(e.target.value))}
              />
            </label>
          </div>

          {/* 主题设置 */}
          <div className="control-group">
            <h3>主题</h3>
            <div className="theme-colors">
              {THEME_CONFIG.map(({ key, label }) => (
                <label key={key}>
                  <input
                    type="color"
                    value={theme[key]}
                    onChange={(e) => updateTheme(key, e.target.value)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* 开关选项 */}
          <div className="control-group">
            <h3>选项</h3>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={showTimeScale}
                onChange={(e) => setShowTimeScale(e.target.checked)}
              />
              显示时间刻度
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={disabled}
                onChange={(e) => setDisabled(e.target.checked)}
              />
              禁用交互
            </label>
          </div>

          {/* Ref 方法 */}
          <div className="control-group">
            <h3>Ref 方法</h3>
            <button
              onClick={() =>
                timelineRef.current?.setCurrentTime(selectedRange.start)
              }
            >
              跳转到开始
            </button>
            <button
              onClick={() =>
                timelineRef.current?.setCurrentTime(selectedRange.end)
              }
            >
              跳转到结束
            </button>
            <button onClick={() => timelineRef.current?.refreshFrames()}>
              重新提取帧
            </button>
            <button
              onClick={() => {
                const frames = timelineRef.current?.getFrames();
                console.log("当前帧数据:", frames);
                alert(`共 ${frames?.length || 0} 帧，已输出到控制台`);
              }}
            >
              获取帧数据
            </button>
          </div>
        </aside>
      </main>

      <footer className="footer">
        <p>React Video Timeline - 使用原生 Canvas + Video API 实现</p>
      </footer>
    </div>
  );
}

export default App;
