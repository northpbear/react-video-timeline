import classNames from 'classnames';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useDragInteraction } from '../hooks/use-drag-interaction';
import { useFrameExtractor } from '../hooks/use-frame-extractor';
import { TimeRange, VideoTimelineProps, VideoTimelineRef } from '../types';
import { formatTimePrecise } from '../utils/time-format';
import { TimelineRenderer } from '../utils/timeline-renderer';
import './video-timeline.less';

/** 默认配置 */
const DEFAULT_WIDTH = 420;
const DEFAULT_HEIGHT = 97;
const DEFAULT_FRAME_INTERVAL = 0.2;
const DEFAULT_FRAME_HEIGHT = 50;
const DEFAULT_SCALE_HEIGHT = 27;
const DEFAULT_HANDLE_WIDTH = 16;
const DEFAULT_MIN_DURATION = 0.1;

/**
 * 视频时间轴组件（内部实现）
 */
const VideoTimelineInner = forwardRef<VideoTimelineRef, VideoTimelineProps>(
  (props, ref) => {
    const {
      videoSrc,
      duration: propDuration,
      currentTime: propCurrentTime = 0,
      selectedRange: propSelectedRange,
      defaultSelectedRange,
      width = DEFAULT_WIDTH,
      height = DEFAULT_HEIGHT,
      frameInterval = DEFAULT_FRAME_INTERVAL,
      frameHeight = DEFAULT_FRAME_HEIGHT,
      showTimeScale = true,
      disabled = false,
      minDuration = DEFAULT_MIN_DURATION,
      theme,
      style,
      className,
      onTimeChange,
      onRangeChange,
      onDragStart,
      onDragEnd,
      onFramesExtracted,
      onFrameExtractProgress,
      onError,
    } = props;

    // Canvas 引用
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<TimelineRenderer | null>(null);

    // 内部状态
    const [internalCurrentTime, setInternalCurrentTime] =
      useState(propCurrentTime);
    const [internalSelectedRange, setInternalSelectedRange] =
      useState<TimeRange>(
        propSelectedRange || defaultSelectedRange || { start: 0, end: 0 },
      );

    // 计算实际使用的值（受控 vs 非受控）
    const currentTime =
      propCurrentTime !== undefined ? propCurrentTime : internalCurrentTime;
    const selectedRange = propSelectedRange || internalSelectedRange;

    // 计算布局参数
    const scaleHeight = showTimeScale ? DEFAULT_SCALE_HEIGHT : 0;
    const handleWidth = DEFAULT_HANDLE_WIDTH;

    // 合并主题配置
    const mergedTheme = useMemo(
      () => ({
        backgroundColor: theme?.backgroundColor ?? 'transparent',
        handleColor: theme?.handleColor ?? '#FFFFFF',
        handleStripeColor: theme?.handleStripeColor ?? '#E5E4E4',
        scaleTextColor: theme?.scaleTextColor ?? '#888888',
        scaleLineColor: theme?.scaleLineColor ?? '#444444',
        cursorColor: theme?.cursorColor ?? '#FFFFFF',
        selectionBorderColor: theme?.selectionBorderColor ?? '#FFFFFF',
      }),
      [
        theme?.backgroundColor,
        theme?.handleColor,
        theme?.handleStripeColor,
        theme?.scaleTextColor,
        theme?.scaleLineColor,
        theme?.cursorColor,
        theme?.selectionBorderColor,
      ],
    );

    // 帧提取
    const {
      frames,
      videoDuration,
      loading,
      progress,
      error,
      refresh: refreshFrames,
    } = useFrameExtractor({
      videoSrc,
      duration: propDuration,
      frameInterval,
      frameHeight,
      onProgress: onFrameExtractProgress,
      onComplete: onFramesExtracted,
      onError,
    });

    // 实际时长
    const duration = propDuration || videoDuration || 10;

    console.log('currentTime', currentTime);
    console.log('duration', duration);
    console.log('videoDuration', videoDuration);
    console.log('propDuration', propDuration);

    // 初始化选中范围
    useEffect(() => {
      if (!propSelectedRange && !defaultSelectedRange && videoDuration > 0) {
        const initialRange = { start: 0, end: videoDuration };
        setInternalSelectedRange(initialRange);
        onRangeChange?.(initialRange);
      }
    }, [videoDuration, propSelectedRange, defaultSelectedRange, onRangeChange]);

    // 时间变化处理
    const handleTimeChange = useCallback(
      (time: number) => {
        setInternalCurrentTime(time);
        onTimeChange?.(time);
      },
      [onTimeChange],
    );

    // 范围变化处理
    const handleRangeChange = useCallback(
      (range: TimeRange) => {
        setInternalSelectedRange(range);
        onRangeChange?.(range);
      },
      [onRangeChange],
    );

    // 拖拽交互
    const { isDragging, dragType } = useDragInteraction({
      canvasRef,
      duration,
      currentTime,
      selectedRange,
      scaleHeight,
      frameHeight,
      handleWidth,
      minDuration,
      disabled,
      onTimeChange: handleTimeChange,
      onRangeChange: handleRangeChange,
      onDragStart,
      onDragEnd,
    });

    // 计算 tooltip 位置和时间（根据拖拽类型）
    const tooltipInfo = useMemo(() => {
      if (duration <= 0 || !isDragging || !dragType) {
        return { show: false, position: 0, time: 0 };
      }

      const effectiveWidth = width - handleWidth * 2;
      let time = 0;

      switch (dragType) {
        case 'cursor':
          time = currentTime;
          break;
        case 'start':
          time = selectedRange.start;
          break;
        case 'end':
          time = selectedRange.end;
          break;
        default:
          return { show: false, position: 0, time: 0 };
      }

      const position = handleWidth + (time / duration) * effectiveWidth;
      return { show: true, position, time };
    }, [
      duration,
      isDragging,
      dragType,
      currentTime,
      selectedRange.start,
      selectedRange.end,
      width,
      handleWidth,
    ]);

    // 初始化渲染器
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const renderer = new TimelineRenderer(canvas);
      renderer.init(width, height);
      rendererRef.current = renderer;

      return () => {
        renderer.dispose();
        rendererRef.current = null;
      };
    }, [width, height]);

    // 渲染时间轴
    useEffect(() => {
      const renderer = rendererRef.current;
      if (!renderer || duration <= 0) return;

      renderer.render({
        frames,
        duration,
        currentTime,
        selectedRange,
        width,
        height,
        scaleHeight,
        frameHeight,
        handleWidth,
        showTimeScale,
        theme: mergedTheme,
      });
    }, [
      frames,
      duration,
      currentTime,
      selectedRange,
      width,
      height,
      scaleHeight,
      frameHeight,
      handleWidth,
      showTimeScale,
      mergedTheme,
    ]);

    // 暴露 ref 方法
    useImperativeHandle(
      ref,
      () => ({
        setCurrentTime: (time: number) => {
          setInternalCurrentTime(time);
          onTimeChange?.(time);
        },
        setSelectedRange: (range: TimeRange) => {
          setInternalSelectedRange(range);
          onRangeChange?.(range);
        },
        refreshFrames,
        getFrames: () => frames,
        getCanvas: () => canvasRef.current,
      }),
      [frames, refreshFrames, onTimeChange, onRangeChange],
    );

    // 计算容器类名
    const containerClassName = useMemo(
      () =>
        classNames('vt-timeline', className, {
          'vt-timeline--disabled': disabled,
          'vt-timeline--loading': loading,
          'vt-timeline--dragging': isDragging,
        }),
      [className, disabled, loading, isDragging],
    );

    return (
      <div
        className={containerClassName}
        style={{
          width,
          height,
          ...style,
        }}
      >
        <canvas ref={canvasRef} className='vt-timeline-canvas' />

        {/* 拖拽时间 tooltip */}
        {tooltipInfo.show && (
          <div
            className='vt-timeline-tooltip'
            style={{
              left: tooltipInfo.position,
            }}
          >
            {formatTimePrecise(tooltipInfo.time)}
          </div>
        )}

        {/* 加载状态 */}
        {loading && (
          <div className='vt-timeline-loading'>
            <div className='vt-timeline-loading-bar'>
              <div
                className='vt-timeline-loading-progress'
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className='vt-timeline-loading-text'>
              加载中 {Math.round(progress)}%
            </span>
          </div>
        )}

        {/* 错误状态 */}
        {error && (
          <div className='vt-timeline-error'>
            <span>{error.message}</span>
            <button onClick={refreshFrames} className='vt-timeline-retry-btn'>
              重试
            </button>
          </div>
        )}
      </div>
    );
  },
);

VideoTimelineInner.displayName = 'VideoTimelineInner';

/**
 * 视频时间轴组件
 *
 * 使用原生 Canvas + Video API 实现的视频帧预览与时间选择组件
 *
 * 当 videoSrc 变化时，组件会强制重新挂载，确保状态完全重置
 *
 * @example
 * ```tsx
 * <VideoTimeline
 *   videoSrc="/path/to/video.mp4"
 *   currentTime={currentTime}
 *   selectedRange={{ start: 0, end: 5 }}
 *   onTimeChange={handleTimeChange}
 *   onRangeChange={handleRangeChange}
 * />
 * ```
 */
export const VideoTimeline = forwardRef<VideoTimelineRef, VideoTimelineProps>(
  (props, ref) => {
    // 生成稳定的 key：File 对象使用 name+size+lastModified，字符串直接使用
    const videoKey =
      props.videoSrc instanceof File
        ? `${props.videoSrc.name}_${props.videoSrc.size}_${props.videoSrc.lastModified}`
        : props.videoSrc;

    return <VideoTimelineInner key={videoKey} ref={ref} {...props} />;
  },
);

VideoTimeline.displayName = 'VideoTimeline';

