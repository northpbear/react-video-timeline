import { useCallback, useEffect, useRef, useState } from 'react';
import { DragType, HitAreaType, TimeRange } from '../types';
import { roundToDecimals } from '../utils/time-format';

interface UseDragInteractionOptions {
  /** Canvas 元素引用 */
  canvasRef: React.RefObject<HTMLCanvasElement>;
  /** 视频时长（秒） */
  duration: number;
  /** 当前播放时间 */
  currentTime: number;
  /** 选中范围 */
  selectedRange: TimeRange;
  /** 时间刻度高度 */
  scaleHeight: number;
  /** 帧高度 */
  frameHeight: number;
  /** 手柄宽度 */
  handleWidth: number;
  /** 最小选择时长 */
  minDuration: number;
  /** 是否禁用 */
  disabled: boolean;
  /** 时间变化回调 */
  onTimeChange?: (time: number) => void;
  /** 范围变化回调 */
  onRangeChange?: (range: TimeRange) => void;
  /** 开始拖拽回调 */
  onDragStart?: (type: DragType) => void;
  /** 结束拖拽回调 */
  onDragEnd?: (type: DragType) => void;
}

interface UseDragInteractionResult {
  /** 是否正在拖拽 */
  isDragging: boolean;
  /** 当前拖拽类型 */
  dragType: DragType | null;
}

/**
 * 拖拽交互 Hook
 *
 * 处理时间轴的鼠标/触摸交互
 */
export function useDragInteraction(
  options: UseDragInteractionOptions,
): UseDragInteractionResult {
  const {
    canvasRef,
    duration,
    currentTime,
    selectedRange,
    scaleHeight,
    frameHeight,
    handleWidth,
    minDuration,
    disabled,
    onTimeChange,
    onRangeChange,
    onDragStart,
    onDragEnd,
  } = options;

  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState<DragType | null>(null);

  const dragTypeRef = useRef<DragType | null>(null);
  const startXRef = useRef(0);
  const startRangeRef = useRef<TimeRange>({ start: 0, end: 0 });
  const startTimeRef = useRef(0);

  /**
   * 检测点击区域
   */
  const detectHitArea = useCallback(
    (clientX: number, clientY: number): HitAreaType => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      // 检查是否在帧区域内（垂直范围）
      if (y < scaleHeight || y > scaleHeight + frameHeight) {
        // 如果在刻度区域点击，视为调整指针
        if (y >= 0 && y < scaleHeight) {
          return 'cursor';
        }
        return null;
      }

      const width = canvas.offsetWidth;
      const effectiveWidth = width - handleWidth * 2;
      const startX =
        handleWidth + (selectedRange.start / duration) * effectiveWidth;
      const endX =
        handleWidth + (selectedRange.end / duration) * effectiveWidth;

      // 检查开始手柄
      if (x >= startX - handleWidth && x <= startX) {
        return 'start';
      }

      // 检查结束手柄
      if (x >= endX && x <= endX + handleWidth) {
        return 'end';
      }

      // 检查选中区域（用于拖动播放指针）
      if (x >= startX && x <= endX) {
        return 'cursor';
      }

      // 点击未选中区域，也移动指针
      return 'cursor';
    },
    [canvasRef, duration, selectedRange, scaleHeight, frameHeight, handleWidth],
  );

  /**
   * 将像素位置转换为时间
   */
  const pixelToTime = useCallback(
    (clientX: number): number => {
      const canvas = canvasRef.current;
      if (!canvas || duration <= 0) return 0;

      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const width = canvas.offsetWidth;
      const effectiveWidth = width - handleWidth * 2;

      const time = ((x - handleWidth) / effectiveWidth) * duration;
      return roundToDecimals(Math.max(0, Math.min(duration, time)), 2);
    },
    [canvasRef, duration, handleWidth],
  );

  /**
   * 处理鼠标/触摸按下
   */
  const handleStart = useCallback(
    (clientX: number, clientY: number) => {
      if (disabled) return;

      const hitArea = detectHitArea(clientX, clientY);
      if (!hitArea || hitArea === 'track') return;

      dragTypeRef.current = hitArea;
      startXRef.current = clientX;
      startRangeRef.current = { ...selectedRange };
      startTimeRef.current = currentTime;

      setIsDragging(true);
      setDragType(hitArea);
      onDragStart?.(hitArea);

      const time = pixelToTime(clientX);

      // 根据点击区域更新指针位置
      if (hitArea === 'cursor') {
        onTimeChange?.(time);
      } else if (hitArea === 'start') {
        // 点击开始手柄时，指针对齐到开始位置
        onTimeChange?.(selectedRange.start);
      } else if (hitArea === 'end') {
        // 点击结束手柄时，指针对齐到结束位置
        onTimeChange?.(selectedRange.end);
      }
    },
    [
      disabled,
      detectHitArea,
      selectedRange,
      currentTime,
      pixelToTime,
      onDragStart,
      onTimeChange,
    ],
  );

  /**
   * 处理鼠标/触摸移动
   */
  const handleMove = useCallback(
    (clientX: number) => {
      if (!dragTypeRef.current) return;

      const time = pixelToTime(clientX);

      switch (dragTypeRef.current) {
        case 'cursor':
          onTimeChange?.(time);
          break;

        case 'start': {
          const newStart = Math.min(time, selectedRange.end - minDuration);
          const clampedStart = Math.max(0, newStart);
          if (clampedStart !== selectedRange.start) {
            onRangeChange?.({
              start: clampedStart,
              end: selectedRange.end,
            });
            // 指针跟随开始滑块移动
            onTimeChange?.(clampedStart);
          }
          break;
        }

        case 'end': {
          const newEnd = Math.max(time, selectedRange.start + minDuration);
          const clampedEnd = Math.min(duration, newEnd);
          if (clampedEnd !== selectedRange.end) {
            onRangeChange?.({
              start: selectedRange.start,
              end: clampedEnd,
            });
            // 指针跟随结束滑块移动
            onTimeChange?.(clampedEnd);
          }
          break;
        }
      }
    },
    [
      pixelToTime,
      selectedRange,
      duration,
      minDuration,
      onTimeChange,
      onRangeChange,
    ],
  );

  /**
   * 处理鼠标/触摸结束
   */
  const handleEnd = useCallback(() => {
    if (dragTypeRef.current) {
      onDragEnd?.(dragTypeRef.current);
    }

    dragTypeRef.current = null;
    setIsDragging(false);
    setDragType(null);
  }, [onDragEnd]);

  // 绑定事件
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 鼠标事件
    const handleMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      handleStart(e.clientX, e.clientY);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (dragTypeRef.current) {
        e.preventDefault();
        handleMove(e.clientX);
      }
    };

    const handleMouseUp = () => {
      handleEnd();
    };

    // 触摸事件
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        handleStart(touch.clientX, touch.clientY);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1 && dragTypeRef.current) {
        e.preventDefault();
        const touch = e.touches[0];
        handleMove(touch.clientX);
      }
    };

    const handleTouchEnd = () => {
      handleEnd();
    };

    // 绑定 Canvas 事件
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });

    // 绑定 window 事件（处理拖拽出 Canvas 的情况）
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [canvasRef, handleStart, handleMove, handleEnd]);

  // 更新光标样式
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || disabled) return;

    const updateCursor = (e: MouseEvent) => {
      const hitArea = detectHitArea(e.clientX, e.clientY);
      switch (hitArea) {
        case 'start':
        case 'end':
          canvas.style.cursor = 'ew-resize';
          break;
        case 'cursor':
        case 'track':
          canvas.style.cursor = 'pointer';
          break;
        default:
          canvas.style.cursor = 'default';
      }
    };

    canvas.addEventListener('mousemove', updateCursor);

    return () => {
      canvas.removeEventListener('mousemove', updateCursor);
    };
  }, [canvasRef, disabled, detectHitArea]);

  return {
    isDragging,
    dragType,
  };
}
