import { VideoFrame } from '../types';

/**
 * 视频帧提取器
 *
 * 使用 Canvas + Video API 从视频中提取指定时间点的帧图像
 */
export class VideoFrameExtractor {
  private video: HTMLVideoElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private isDisposed = false;
  private currentSrc: string | File | null = null;
  private blobUrl: string | null = null;
  // 跟踪当前的事件监听器，以便在 dispose 时移除
  private currentLoadHandler: (() => void) | null = null;
  private currentErrorHandler: (() => void) | null = null;

  constructor() {
    this.video = document.createElement('video');
    this.canvas = document.createElement('canvas');
    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('无法创建 Canvas 2D 上下文');
    }
    this.ctx = ctx;

    // 配置视频元素（crossOrigin 在 loadVideo 时根据源类型动态设置）
    this.video.muted = true;
    this.video.preload = 'metadata';
    this.video.playsInline = true;
  }

  /**
   * 获取视频时长
   * @param src - 视频源
   */
  async getDuration(src: string | File): Promise<number> {
    await this.loadVideo(src);
    return this.video.duration;
  }

  /**
   * 提取指定时间点的帧
   * @param src - 视频源
   * @param timePoints - 时间点数组（秒）
   * @param frameHeight - 帧高度
   * @param onProgress - 进度回调
   */
  async extractFrames(
    src: string | File,
    timePoints: number[],
    frameHeight: number,
    onProgress?: (progress: number) => void,
  ): Promise<VideoFrame[]> {
    if (this.isDisposed) {
      throw new Error('VideoFrameExtractor 已被销毁');
    }

    await this.loadVideo(src);

    const frames: VideoFrame[] = [];
    const aspectRatio = this.video.videoWidth / this.video.videoHeight;
    const frameWidth = Math.round(frameHeight * aspectRatio);

    this.canvas.width = frameWidth;
    this.canvas.height = frameHeight;

    for (let i = 0; i < timePoints.length; i++) {
      if (this.isDisposed) break;

      const time = timePoints[i];
      const imageData = await this.captureFrame(time);
      frames.push({ time, imageData });
      onProgress?.(((i + 1) / timePoints.length) * 100);
    }

    return frames;
  }

  /**
   * 清理当前的事件监听器
   */
  private cleanupListeners(): void {
    if (this.currentLoadHandler) {
      this.video.removeEventListener('loadedmetadata', this.currentLoadHandler);
      this.currentLoadHandler = null;
    }
    if (this.currentErrorHandler) {
      this.video.removeEventListener('error', this.currentErrorHandler);
      this.currentErrorHandler = null;
    }
  }

  /**
   * 加载视频
   */
  private async loadVideo(src: string | File): Promise<void> {
    // 如果已被销毁，直接返回
    if (this.isDisposed) {
      throw new Error('VideoFrameExtractor 已被销毁');
    }

    // 如果是同一个源且视频已经加载，直接返回
    if (this.currentSrc === src && this.video.readyState >= 1) {
      return;
    }

    // 清理之前的事件监听器
    this.cleanupListeners();

    // 清理之前的 blob URL
    if (this.blobUrl) {
      URL.revokeObjectURL(this.blobUrl);
      this.blobUrl = null;
    }

    return new Promise((resolve, reject) => {
      const handleLoad = () => {
        this.cleanupListeners();
        this.currentSrc = src;
        resolve();
      };

      const handleError = () => {
        this.cleanupListeners();
        // 如果已被销毁，不报错（避免 dispose 触发的空 src 错误）
        if (this.isDisposed) {
          return;
        }
        const videoError = this.video.error;
        const errorMsg = videoError
          ? `视频加载失败: ${videoError.message} (code: ${videoError.code})`
          : '视频加载失败: 未知错误';
        reject(new Error(errorMsg));
      };

      // 保存监听器引用以便后续清理
      this.currentLoadHandler = handleLoad;
      this.currentErrorHandler = handleError;

      this.video.addEventListener('loadedmetadata', handleLoad);
      this.video.addEventListener('error', handleError);

      if (src instanceof File) {
        // 本地文件不需要设置 crossOrigin，否则会导致 Canvas 被污染
        this.video.removeAttribute('crossOrigin');
        this.blobUrl = URL.createObjectURL(src);
        this.video.src = this.blobUrl;
      } else if (src.startsWith('http://') || src.startsWith('https://')) {
        // 远程 URL 需要设置 crossOrigin 以支持 CORS
        this.video.crossOrigin = 'anonymous';
        this.video.src = src;
      } else {
        // 同源 URL（如 /video.mp4）不需要 crossOrigin
        this.video.removeAttribute('crossOrigin');
        this.video.src = src;
      }
    });
  }

  /**
   * 捕获单帧
   */
  private async captureFrame(time: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const handleSeeked = () => {
        this.video.removeEventListener('seeked', handleSeeked);
        this.video.removeEventListener('error', handleError);

        try {
          this.ctx.drawImage(
            this.video,
            0,
            0,
            this.canvas.width,
            this.canvas.height,
          );
          resolve(this.canvas.toDataURL('image/jpeg', 0.8));
        } catch (error) {
          reject(error);
        }
      };

      const handleError = () => {
        this.video.removeEventListener('seeked', handleSeeked);
        this.video.removeEventListener('error', handleError);
        reject(new Error(`无法捕获 ${time}s 处的帧`));
      };

      this.video.addEventListener('seeked', handleSeeked);
      this.video.addEventListener('error', handleError);
      this.video.currentTime = time;
    });
  }

  /**
   * 销毁提取器，释放资源
   */
  dispose(): void {
    this.isDisposed = true;
    
    // 先清理事件监听器，避免触发错误回调
    this.cleanupListeners();
    
    // 清理 blob URL
    if (this.blobUrl) {
      URL.revokeObjectURL(this.blobUrl);
      this.blobUrl = null;
    }
    
    this.currentSrc = null;
    
    // 暂停视频并清除 src（不调用 load() 避免触发错误事件）
    this.video.pause();
    this.video.removeAttribute('src');
  }
}

/**
 * 生成帧提取的时间点数组
 * @param duration - 视频总时长（秒）
 * @param interval - 帧间隔（秒）
 */
export function generateTimePoints(
  duration: number,
  interval: number,
): number[] {
  const points: number[] = [];
  for (let t = 0; t < duration; t += interval) {
    points.push(t);
  }
  // 确保包含最后一帧
  if (points[points.length - 1] < duration - 0.1) {
    points.push(duration - 0.01);
  }
  return points;
}
