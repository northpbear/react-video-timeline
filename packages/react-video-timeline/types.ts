import { CSSProperties } from 'react';

/**
 * 时间范围
 */
export interface TimeRange {
  /** 开始时间（秒） */
  start: number;
  /** 结束时间（秒） */
  end: number;
}

/**
 * 视频帧数据
 */
export interface VideoFrame {
  /** 帧对应的时间点（秒） */
  time: number;
  /** 帧图像数据（base64 或 blob URL） */
  imageData: string;
}

/**
 * 拖拽类型
 */
export type DragType = 'cursor' | 'start' | 'end';

/**
 * 点击区域类型
 */
export type HitAreaType = DragType | 'track' | null;

/**
 * 时间轴主题配置
 */
export interface TimelineTheme {
  /** 帧区域背景色，默认 'transparent' */
  backgroundColor?: string;
  /** 拖拽把手背景色，默认 '#FFFFFF' */
  handleColor?: string;
  /** 拖拽把手条纹颜色，默认 '#E5E4E4' */
  handleStripeColor?: string;
  /** 时间刻度文字颜色，默认 '#888888' */
  scaleTextColor?: string;
  /** 时间刻度线颜色，默认 '#444444' */
  scaleLineColor?: string;
  /** 播放指针颜色，默认 '#FFFFFF' */
  cursorColor?: string;
  /** 选中区域边框颜色，默认 '#FFFFFF' */
  selectionBorderColor?: string;
}

/**
 * VideoTimeline 组件 Props
 */
export interface VideoTimelineProps {
  /** 视频源 URL */
  videoSrc: string | File;

  /** 视频总时长（秒），如果不传则自动从视频获取 */
  duration?: number;

  /** 当前播放时间（秒） */
  currentTime?: number;

  /** 选中的时间范围 */
  selectedRange?: TimeRange;

  /** 默认选中的时间范围 */
  defaultSelectedRange?: TimeRange;

  /** 时间轴宽度（像素），默认 420 */
  width?: number;

  /** 时间轴高度（像素），默认 97 */
  height?: number;

  /** 帧提取间隔（秒），默认 1 */
  frameInterval?: number;

  /** 帧缩略图高度（像素），默认 50 */
  frameHeight?: number;

  /** 是否显示时间刻度，默认 true */
  showTimeScale?: boolean;

  /** 是否禁用交互，默认 false */
  disabled?: boolean;

  /** 最小选择时长（秒），默认 0.1 */
  minDuration?: number;

  /** 主题配置 */
  theme?: TimelineTheme;

  /** 自定义样式 */
  style?: CSSProperties;

  /** 自定义类名 */
  className?: string;

  /**
   * 播放时间变化回调
   * @param time - 当前时间（秒）
   */
  onTimeChange?: (time: number) => void;

  /**
   * 选中范围变化回调
   * @param range - 选中的时间范围
   */
  onRangeChange?: (range: TimeRange) => void;

  /**
   * 开始拖拽回调
   * @param type - 拖拽类型：'cursor' | 'start' | 'end'
   */
  onDragStart?: (type: DragType) => void;

  /**
   * 结束拖拽回调
   * @param type - 拖拽类型
   */
  onDragEnd?: (type: DragType) => void;

  /**
   * 帧提取完成回调
   * @param frames - 提取的帧数据数组
   */
  onFramesExtracted?: (frames: VideoFrame[]) => void;

  /**
   * 帧提取进度回调
   * @param progress - 进度百分比 0-100
   */
  onFrameExtractProgress?: (progress: number) => void;

  /**
   * 错误回调
   * @param error - 错误信息
   */
  onError?: (error: Error) => void;
}

/**
 * VideoTimeline Ref 方法
 */
export interface VideoTimelineRef {
  /** 设置当前播放时间 */
  setCurrentTime: (time: number) => void;

  /** 设置选中范围 */
  setSelectedRange: (range: TimeRange) => void;

  /** 重新提取视频帧 */
  refreshFrames: () => Promise<void>;

  /** 获取当前帧数据 */
  getFrames: () => VideoFrame[];

  /** 获取 Canvas 元素 */
  getCanvas: () => HTMLCanvasElement | null;
}

/**
 * 渲染选项
 */
export interface RenderOptions {
  frames: VideoFrame[];
  duration: number;
  currentTime: number;
  selectedRange: TimeRange;
  width: number;
  height: number;
  scaleHeight: number;
  frameHeight: number;
  handleWidth: number;
  showTimeScale: boolean;
  /** 主题配置 */
  theme: Required<TimelineTheme>;
}
