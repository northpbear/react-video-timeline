import { RenderOptions, TimeRange, TimelineTheme, VideoFrame } from '../types';

/**
 * 时间轴 Canvas 渲染器
 *
 * 负责绘制时间刻度、视频帧、选中区域、拖拽手柄和播放指针
 */
export class TimelineRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dpr: number;
  private frameImages: Map<string, HTMLImageElement> = new Map();
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private offscreenCtx: CanvasRenderingContext2D | null = null;
  private lastFramesHash = '';

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('无法创建 Canvas 2D 上下文');
    }
    this.ctx = ctx;
    this.dpr = window.devicePixelRatio || 1;
  }

  /**
   * 初始化 Canvas（处理高清屏）
   */
  init(width: number, height: number): void {
    this.canvas.width = width * this.dpr;
    this.canvas.height = height * this.dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.scale(this.dpr, this.dpr);

    // 创建离屏 Canvas 用于缓存帧
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCanvas.width = width * this.dpr;
    this.offscreenCanvas.height = height * this.dpr;
    this.offscreenCtx = this.offscreenCanvas.getContext('2d');
    if (this.offscreenCtx) {
      this.offscreenCtx.scale(this.dpr, this.dpr);
    }
  }

  /**
   * 渲染时间轴
   */
  async render(options: RenderOptions): Promise<void> {
    const {
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
      theme,
    } = options;

    // 清空画布
    this.ctx.clearRect(0, 0, width, height);

    // 1. 绘制时间刻度
    if (showTimeScale) {
      this.drawTimeScale(
        duration,
        width,
        scaleHeight,
        handleWidth,
        theme,
      );
    }

    // 2. 绘制视频帧背景
    this.drawFrameBackground(
      width,
      showTimeScale ? scaleHeight : 0,
      frameHeight,
      theme.backgroundColor,
    );

    // 3. 绘制视频帧
    if (frames.length > 0) {
      await this.drawFrames(
        frames,
        duration,
        width,
        showTimeScale ? scaleHeight : 0,
        frameHeight,
        handleWidth,
      );
    }

    // 4. 绘制选中区域遮罩
    this.drawSelectionMask(
      selectedRange,
      duration,
      width,
      showTimeScale ? scaleHeight : 0,
      frameHeight,
      handleWidth,
      theme,
    );

    // 5. 绘制开始/结束手柄
    this.drawHandles(
      selectedRange,
      duration,
      width,
      showTimeScale ? scaleHeight : 0,
      frameHeight,
      handleWidth,
      theme,
    );

    // 6. 绘制播放指针（上下各超出帧区域 10px）
    const cursorOverflow = 10;
    const cursorOffsetY = (showTimeScale ? scaleHeight : 0) - cursorOverflow;
    const cursorHeight = frameHeight + cursorOverflow * 2;
    this.drawCursor(
      currentTime,
      duration,
      width,
      cursorOffsetY,
      cursorHeight,
      handleWidth,
      theme,
    );
  }

  /**
   * 绘制时间刻度
   */
  private drawTimeScale(
    duration: number,
    width: number,
    scaleHeight: number,
    handleWidth: number,
    theme: Required<TimelineTheme>,
  ): void {
    const effectiveWidth = width - handleWidth * 2;
    
    // 根据时长计算合适的刻度间隔
    const interval = this.calculateScaleInterval(duration);
    const tickCount = Math.floor(duration / interval);
    
    // 刻度样式
    this.ctx.fillStyle = theme.scaleTextColor;
    this.ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'top';
    
    // 绘制刻度线和时间标签
    for (let i = 0; i <= tickCount; i++) {
      const time = i * interval;
      if (time > duration) break;
      
      const x = handleWidth + (time / duration) * effectiveWidth;
      
      // 绘制刻度线
      this.ctx.strokeStyle = theme.scaleLineColor;
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(x, scaleHeight - 6);
      this.ctx.lineTo(x, scaleHeight);
      this.ctx.stroke();
      
      // 绘制时间标签
      const label = this.formatScaleTime(time);
      this.ctx.fillText(label, x, 2);
    }
    
    // 绘制最后一个刻度（视频结尾）
    const endX = handleWidth + effectiveWidth;
    this.ctx.strokeStyle = theme.scaleLineColor;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(endX, scaleHeight - 6);
    this.ctx.lineTo(endX, scaleHeight);
    this.ctx.stroke();
    
    // 只有当最后一个常规刻度与结尾相差较远时才显示结尾时间标签
    const lastRegularTick = tickCount * interval;
    if (duration - lastRegularTick > interval * 0.3) {
      this.ctx.fillText(this.formatScaleTime(duration), endX, 2);
    }
  }

  /**
   * 计算合适的刻度间隔
   */
  private calculateScaleInterval(duration: number): number {
    // 期望显示 5-10 个刻度
    const targetTicks = 7;
    const rawInterval = duration / targetTicks;
    
    // 取整到合适的间隔（1, 2, 5, 10, 15, 30, 60 秒等）
    const intervals = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
    for (const interval of intervals) {
      if (rawInterval <= interval) {
        return interval;
      }
    }
    return 600; // 默认 10 分钟
  }

  /**
   * 格式化刻度时间
   */
  private formatScaleTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    if (m > 0) {
      return `${m}:${s.toString().padStart(2, '0')}`;
    }
    return `${s}s`;
  }

  /**
   * 绘制帧区域背景
   */
  private drawFrameBackground(
    width: number,
    offsetY: number,
    frameHeight: number,
    backgroundColor: string,
  ): void {
    // 只有非透明背景才绘制
    if (backgroundColor !== 'transparent') {
      this.ctx.fillStyle = backgroundColor;
      this.ctx.fillRect(0, offsetY, width, frameHeight);
    }
  }

  /**
   * 绘制视频帧
   */
  private async drawFrames(
    frames: VideoFrame[],
    duration: number,
    width: number,
    offsetY: number,
    frameHeight: number,
    handleWidth: number,
  ): Promise<void> {
    const effectiveWidth = width - handleWidth * 2;
    const frameWidth = effectiveWidth / frames.length;

    // 预加载所有帧图像
    await this.preloadFrameImages(frames);

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      const img = this.frameImages.get(frame.imageData);
      if (img) {
        const x = handleWidth + i * frameWidth;
        this.ctx.drawImage(img, x, offsetY, frameWidth, frameHeight);
      }
    }
  }

  /**
   * 预加载帧图像
   */
  private async preloadFrameImages(frames: VideoFrame[]): Promise<void> {
    const loadPromises = frames.map(async (frame) => {
      if (!this.frameImages.has(frame.imageData)) {
        const img = await this.loadImage(frame.imageData);
        this.frameImages.set(frame.imageData, img);
      }
    });
    await Promise.all(loadPromises);
  }

  /**
   * 绘制选中区域遮罩
   */
  private drawSelectionMask(
    range: TimeRange,
    duration: number,
    width: number,
    offsetY: number,
    frameHeight: number,
    handleWidth: number,
    theme: Required<TimelineTheme>,
  ): void {
    const effectiveWidth = width - handleWidth * 2;
    const startX = handleWidth + (range.start / duration) * effectiveWidth;
    const endX = handleWidth + (range.end / duration) * effectiveWidth;

    // 左侧遮罩
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    this.ctx.fillRect(handleWidth, offsetY, startX - handleWidth, frameHeight);

    // 右侧遮罩
    this.ctx.fillRect(endX, offsetY, width - handleWidth - endX, frameHeight);

    // 选中区域边框
    this.ctx.strokeStyle = theme.selectionBorderColor;
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(startX, offsetY, endX - startX, frameHeight);
  }

  /**
   * 绘制拖拽手柄
   */
  private drawHandles(
    range: TimeRange,
    duration: number,
    width: number,
    offsetY: number,
    frameHeight: number,
    handleWidth: number,
    theme: Required<TimelineTheme>,
  ): void {
    const effectiveWidth = width - handleWidth * 2;
    const startX = handleWidth + (range.start / duration) * effectiveWidth;
    const endX = handleWidth + (range.end / duration) * effectiveWidth;

    // 手柄高度与选中区域边框一致（边框 lineWidth=2，上下各扩展 1px）
    const handleOffsetY = offsetY - 1;
    const handleHeight = frameHeight + 2;

    // 开始手柄（左侧圆角）
    this.drawHandle(
      startX - handleWidth,
      handleOffsetY,
      handleWidth,
      handleHeight,
      'left',
      theme,
    );

    // 结束手柄（右侧圆角）
    this.drawHandle(endX, handleOffsetY, handleWidth, handleHeight, 'right', theme);
  }

  /**
   * 绘制单个手柄
   * @param side - 圆角位置：'left' 左侧圆角，'right' 右侧圆角
   */
  private drawHandle(
    x: number,
    y: number,
    width: number,
    height: number,
    side: 'left' | 'right',
    theme: Required<TimelineTheme>,
  ): void {
    const radius = 2;

    // 手柄背景
    this.ctx.fillStyle = theme.handleColor;
    this.roundRect(x, y, width, height, radius, side);
    this.ctx.fill();

    // 手柄边框
    this.ctx.strokeStyle = theme.handleColor;
    this.ctx.lineWidth = 1;
    this.roundRect(x + 0.5, y + 0.5, width - 1, height - 1, radius, side);
    this.ctx.stroke();

    // 手柄条纹
    this.ctx.fillStyle = theme.handleStripeColor;
    const stripeWidth = 2;
    const stripeHeight = 28;
    const stripeX = x + (width - stripeWidth) / 2;
    const stripeY = y + (height - stripeHeight) / 2;
    this.roundRect(stripeX, stripeY, stripeWidth, stripeHeight, 1);
    this.ctx.fill();
  }

  /**
   * 绘制播放指针
   */
  private drawCursor(
    currentTime: number,
    duration: number,
    width: number,
    offsetY: number,
    cursorHeight: number,
    handleWidth: number,
    theme: Required<TimelineTheme>,
  ): void {
    const effectiveWidth = width - handleWidth * 2;
    const x = handleWidth + (currentTime / duration) * effectiveWidth;
    const cursorWidth = 6;

    // 指针阴影
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    this.ctx.shadowBlur = 16;
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 0;

    // 指针主体
    this.ctx.fillStyle = theme.cursorColor;
    this.roundRect(x - cursorWidth / 2, offsetY, cursorWidth, cursorHeight, 3);
    this.ctx.fill();

    // 重置阴影
    this.ctx.shadowColor = 'transparent';
    this.ctx.shadowBlur = 0;
  }

  /**
   * 绘制圆角矩形
   * @param side - 圆角位置：'both' 四角都有圆角，'left' 只有左侧圆角，'right' 只有右侧圆角
   */
  private roundRect(
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    side: 'both' | 'left' | 'right' = 'both',
  ): void {
    this.ctx.beginPath();

    if (side === 'left') {
      // 左侧圆角：左上、左下有圆角，右上、右下是直角
      this.ctx.moveTo(x + radius, y);
      this.ctx.lineTo(x + width, y);
      this.ctx.lineTo(x + width, y + height);
      this.ctx.lineTo(x + radius, y + height);
      this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
      this.ctx.lineTo(x, y + radius);
      this.ctx.quadraticCurveTo(x, y, x + radius, y);
    } else if (side === 'right') {
      // 右侧圆角：右上、右下有圆角，左上、左下是直角
      this.ctx.moveTo(x, y);
      this.ctx.lineTo(x + width - radius, y);
      this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
      this.ctx.lineTo(x + width, y + height - radius);
      this.ctx.quadraticCurveTo(
        x + width,
        y + height,
        x + width - radius,
        y + height,
      );
      this.ctx.lineTo(x, y + height);
      this.ctx.lineTo(x, y);
    } else {
      // 四角都有圆角
      this.ctx.moveTo(x + radius, y);
      this.ctx.lineTo(x + width - radius, y);
      this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
      this.ctx.lineTo(x + width, y + height - radius);
      this.ctx.quadraticCurveTo(
        x + width,
        y + height,
        x + width - radius,
        y + height,
      );
      this.ctx.lineTo(x + radius, y + height);
      this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
      this.ctx.lineTo(x, y + radius);
      this.ctx.quadraticCurveTo(x, y, x + radius, y);
    }

    this.ctx.closePath();
  }

  /**
   * 加载图像
   */
  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('图像加载失败'));
      img.src = src;
    });
  }

  /**
   * 清理缓存
   */
  clearCache(): void {
    this.frameImages.clear();
    this.lastFramesHash = '';
  }

  /**
   * 销毁渲染器
   */
  dispose(): void {
    this.clearCache();
    this.offscreenCanvas = null;
    this.offscreenCtx = null;
  }
}
