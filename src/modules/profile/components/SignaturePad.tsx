import React, { useRef, useState, useEffect } from 'react';

interface SignaturePadProps {
  onSave: (file: File) => void;
  onCancel?: () => void;
  saving?: boolean;
}

export default function SignaturePad({ onSave, onCancel, saving = false }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  // 캔버스 초기 설정 (고해상도 대응 및 펜 스타일 설정)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 투명 배경 대신 투명 PNG 출력 위해 기본 렌더링 방식 설정
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#1e293b'; // 남색 슬레이트 잉크 톤
  }, []);

  // 그리기 시작 (마우스)
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  // 그리는 중 (마우스)
  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  // 그리기 종료 (마우스)
  const stopDrawing = () => {
    setIsDrawing(false);
  };

  // 그리기 시작 (터치 모바일)
  const startDrawingTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = (touch.clientX - rect.left) * (canvas.width / rect.width);
    const y = (touch.clientY - rect.top) * (canvas.height / rect.height);

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  // 그리는 중 (터치 모바일)
  const drawTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = (touch.clientX - rect.left) * (canvas.width / rect.width);
    const y = (touch.clientY - rect.top) * (canvas.height / rect.height);

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  // 그리기 종료 (터치 모바일)
  const stopDrawingTouch = () => {
    setIsDrawing(false);
  };

  // 지우기 (초기화)
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  // 현재 서명 저장 처리
  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;

    // 캔버스 데이터를 PNG Blob으로 추출
    canvas.toBlob((blob) => {
      if (!blob) return;
      // Blob을 File 객체로 래핑하여 기존 업로드 비즈니스 로직과 통일시킴
      const file = new File([blob], 'signature.png', { type: 'image/png' });
      onSave(file);
    }, 'image/png');
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="relative w-[300px]">
        <canvas
          ref={canvasRef}
          width={300}
          height={150}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawingTouch}
          onTouchMove={drawTouch}
          onTouchEnd={stopDrawingTouch}
          className="block touch-none rounded-lg border border-border-hi bg-panel-alt cursor-crosshair"
          style={{ width: '300px', height: '150px' }}
        />
        {/* 점선 십자 가이드라인 그리드 (pointer-events-none 적용으로 마우스 드래그 방해 차단) */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-lg">
          {/* 가로 중앙 점선 */}
          <div className="absolute left-0 right-0 top-1/2 h-0 border-t border-dashed border-border-hi/75 -translate-y-1/2" />
          {/* 세로 중앙 점선 */}
          <div className="absolute top-0 bottom-0 left-1/2 w-0 border-l border-dashed border-border-hi/75 -translate-x-1/2" />
        </div>
        {!hasDrawn && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-[11px] text-ink3 z-10">
            여기에 마우스나 손가락으로 서명해 주세요.
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={!hasDrawn || saving}
          className="rounded-lg bg-teal px-3 py-1.5 text-[11.5px] font-bold text-white hover:opacity-90 disabled:opacity-50"
        >
          {saving ? '저장 중…' : '서명 저장'}
        </button>
        <button
          onClick={clearCanvas}
          disabled={!hasDrawn || saving}
          className="rounded-lg border border-border-hi bg-panel px-3 py-1.5 text-[11.5px] font-semibold text-ink hover:bg-border-hi/20 disabled:opacity-50"
        >
          지우기
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            disabled={saving}
            className="rounded-lg border border-border-hi bg-panel px-3 py-1.5 text-[11.5px] font-semibold text-ink hover:bg-border-hi/20 disabled:opacity-50"
          >
            취소
          </button>
        )}
      </div>
    </div>
  );
}
