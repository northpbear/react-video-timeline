import { useCallback, useEffect, useRef, useState } from 'react';
import { VideoFrame } from '../types';
import {
  generateTimePoints,
  VideoFrameExtractor,
} from '../utils/frame-extractor';

interface UseFrameExtractorOptions {
  /** 视频源 */
  videoSrc: string | File | undefined;
  /** 视频时长（秒） */
  duration?: number;
  /** 帧提取间隔（秒） */
  frameInterval: number;
  /** 帧高度（像素） */
  frameHeight: number;
  /** 进度回调 */
  onProgress?: (progress: number) => void;
  /** 完成回调 */
  onComplete?: (frames: VideoFrame[]) => void;
  /** 错误回调 */
  onError?: (error: Error) => void;
}

interface UseFrameExtractorResult {
  /** 提取的帧数据 */
  frames: VideoFrame[];
  /** 视频时长 */
  videoDuration: number;
  /** 是否正在加载 */
  loading: boolean;
  /** 加载进度 0-100 */
  progress: number;
  /** 错误信息 */
  error: Error | null;
  /** 重新提取帧 */
  refresh: () => Promise<void>;
}

/**
 * 视频帧提取 Hook
 *
 * 自动从视频中提取帧，并管理加载状态
 */
export function useFrameExtractor(
  options: UseFrameExtractorOptions,
): UseFrameExtractorResult {
  const {
    videoSrc,
    duration,
    frameInterval,
    frameHeight,
    onProgress,
    onComplete,
    onError,
  } = options;

  const [frames, setFrames] = useState<VideoFrame[]>([]);
  const [videoDuration, setVideoDuration] = useState(duration || 0);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);

  const extractorRef = useRef<VideoFrameExtractor | null>(null);
  const abortRef = useRef(false);
  
  // 使用 ref 存储回调，避免依赖变化导致循环
  const callbacksRef = useRef({ onProgress, onComplete, onError });
  callbacksRef.current = { onProgress, onComplete, onError };

  const extractFrames = useCallback(async () => {
    if (!videoSrc) return;

    // 取消之前的提取任务
    abortRef.current = true;
    extractorRef.current?.dispose();

    // 重置状态
    abortRef.current = false;
    setLoading(true);
    setProgress(0);
    setError(null);

    try {
      const extractor = new VideoFrameExtractor();
      extractorRef.current = extractor;

      // 获取视频时长
      let actualDuration = duration;
      if (!actualDuration) {
        actualDuration = await extractor.getDuration(videoSrc);
        setVideoDuration(actualDuration);
      }

      // 生成时间点
      const timePoints = generateTimePoints(actualDuration, frameInterval);

      // 提取帧
      const extractedFrames = await extractor.extractFrames(
        videoSrc,
        timePoints,
        frameHeight,
        (p) => {
          if (!abortRef.current) {
            setProgress(p);
            callbacksRef.current.onProgress?.(p);
          }
        },
      );

      if (!abortRef.current) {
        setFrames(extractedFrames);
        setLoading(false);
        callbacksRef.current.onComplete?.(extractedFrames);
      }
    } catch (err) {
      if (!abortRef.current) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        setLoading(false);
        callbacksRef.current.onError?.(error);
      }
    }
  }, [
    videoSrc,
    duration,
    frameInterval,
    frameHeight,
    // 回调函数使用 ref 存储，不需要作为依赖
  ]);

  // 视频源变化时重新提取
  useEffect(() => {
    extractFrames();

    return () => {
      abortRef.current = true;
      extractorRef.current?.dispose();
    };
  }, [extractFrames]);

  // 同步外部传入的 duration
  useEffect(() => {
    if (duration && duration !== videoDuration) {
      setVideoDuration(duration);
    }
  }, [duration, videoDuration]);

  const refresh = useCallback(async () => {
    await extractFrames();
  }, [extractFrames]);

  return {
    frames,
    videoDuration,
    loading,
    progress,
    error,
    refresh,
  };
}
