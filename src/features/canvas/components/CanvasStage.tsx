import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Eye, EyeOff, MapPin, Move, RotateCw } from 'lucide-react'
import type { DeskItem, LayoutAnalysis, PlanAnnotation, WorkspacePlan } from '../../../shared/models'
import { getDeviceDefinition } from '../../../shared/models'
import { getItemBounds } from '../../../shared/layoutRules'
import { getAnnotationAnchor } from '../../annotations/annotationsViewModel'

interface CanvasStageProps {
  plan: WorkspacePlan
  selectedItemId: string | null
  analysis: LayoutAnalysis
  annotationsVisible: boolean
  selectedAnnotationId: string | null
  readonly?: boolean
  onSelect: (id: string | null) => void
  onMove: (id: string, x: number, y: number) => void
  onSelectAnnotation: (id: string | null) => void
  onMoveAnnotation: (id: string, x: number, y: number) => void
  onAddAnnotationAt: (x: number, y: number) => void
  onAddAnnotationForItem: (itemId: string) => void
  onToggleAnnotations: () => void
}

interface DragState { id: string; offsetX: number; offsetY: number }

const PIN_RADIUS = 26

function clampPinCoordinate(value: number, max: number): number {
  return Math.min(Math.max(value, PIN_RADIUS), Math.max(PIN_RADIUS, max - PIN_RADIUS))
}

function truncateLabel(text: string): string {
  return text.length > 12 ? `${text.slice(0, 12)}…` : text
}

export function CanvasStage({ plan, selectedItemId, analysis, annotationsVisible, selectedAnnotationId, readonly = false, onSelect, onMove, onSelectAnnotation, onMoveAnnotation, onAddAnnotationAt, onAddAnnotationForItem, onToggleAnnotations }: CanvasStageProps) {
  const stageRef = useRef<SVGSVGElement>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [annotationDrag, setAnnotationDrag] = useState<DragState | null>(null)
  const [placing, setPlacing] = useState(false)
  const scaleToMm = useCallback((clientX: number, clientY: number) => {
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect) return null
    return { x: ((clientX - rect.left) / rect.width) * plan.deskWidthMm, y: ((clientY - rect.top) / rect.height) * plan.deskHeightMm }
  }, [plan.deskHeightMm, plan.deskWidthMm])

  useEffect(() => {
    if (!drag) return
    const handleMove = (event: PointerEvent) => {
      const point = scaleToMm(event.clientX, event.clientY)
      if (!point) return
      onMove(drag.id, point.x - drag.offsetX, point.y - drag.offsetY)
    }
    const handleUp = () => setDrag(null)
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    return () => { window.removeEventListener('pointermove', handleMove); window.removeEventListener('pointerup', handleUp) }
  }, [drag, onMove, scaleToMm])

  useEffect(() => {
    if (!annotationDrag) return
    const handleMove = (event: PointerEvent) => {
      const point = scaleToMm(event.clientX, event.clientY)
      if (!point) return
      onMoveAnnotation(annotationDrag.id, point.x - annotationDrag.offsetX, point.y - annotationDrag.offsetY)
    }
    const handleUp = () => setAnnotationDrag(null)
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    return () => { window.removeEventListener('pointermove', handleMove); window.removeEventListener('pointerup', handleUp) }
  }, [annotationDrag, onMoveAnnotation, scaleToMm])

  const startDrag = (event: ReactPointerEvent<SVGGElement>, item: DeskItem) => {
    event.stopPropagation()
    if (placing) {
      onAddAnnotationForItem(item.id)
      setPlacing(false)
      return
    }
    const point = scaleToMm(event.clientX, event.clientY)
    if (!point) return
    onSelect(item.id)
    setDrag({ id: item.id, offsetX: point.x - item.x, offsetY: point.y - item.y })
  }

  const startAnnotationDrag = (event: ReactPointerEvent<SVGGElement>, annotation: PlanAnnotation) => {
    event.stopPropagation()
    onSelectAnnotation(annotation.id)
    if (readonly) return
    const point = scaleToMm(event.clientX, event.clientY)
    if (!point) return
    const anchor = getAnnotationAnchor(plan, annotation)
    setAnnotationDrag({ id: annotation.id, offsetX: point.x - anchor.x, offsetY: point.y - anchor.y })
  }

  const handleBackgroundPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (placing) {
      const point = scaleToMm(event.clientX, event.clientY)
      if (point) onAddAnnotationAt(point.x, point.y)
      setPlacing(false)
      return
    }
    onSelect(null)
    onSelectAnnotation(null)
  }

  const openAnnotationCount = plan.annotations.filter((annotation) => !annotation.resolved).length

  return (
    <div className="canvas-wrap">
      <div className="canvas-toolbar">
        <span><Move size={14} /> 拖动设备调整位置</span>
        {!readonly && (
          <div className="canvas-toolbar-actions">
            <button className={placing ? 'is-active' : ''} onClick={() => setPlacing((current) => !current)} type="button">
              <MapPin size={13} /> {placing ? '点击画布或设备放置批注' : '钉批注'}
            </button>
            <button aria-pressed={annotationsVisible} onClick={onToggleAnnotations} type="button">
              {annotationsVisible ? <Eye size={13} /> : <EyeOff size={13} />} 批注{plan.annotations.length > 0 ? ` ${plan.annotations.length}` : ''}{annotationsVisible && openAnnotationCount > 0 ? ` · ${openAnnotationCount} 待处理` : ''}
            </button>
          </div>
        )}
        <span><RotateCw size={14} /> 旋转请在右侧操作</span>
      </div>
      <svg ref={stageRef} className={`desk-canvas ${placing ? 'is-placing' : ''}`} viewBox={`0 0 ${plan.deskWidthMm} ${plan.deskHeightMm}`} role="img" aria-label={`桌面布局画布，${plan.deskWidthMm}乘${plan.deskHeightMm}毫米`} onPointerDown={handleBackgroundPointerDown}>
        <defs>
          <pattern id="desk-grid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M 50 0 L 0 0 0 50" fill="none" stroke="#d8e1ed" strokeWidth="1" /></pattern>
          <filter id="item-shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#20304a" floodOpacity=".12" /></filter>
        </defs>
        <rect width={plan.deskWidthMm} height={plan.deskHeightMm} rx="22" fill="#f8fafc" />
        <rect width={plan.deskWidthMm} height={plan.deskHeightMm} rx="22" fill="url(#desk-grid)" />
        <text x="34" y="48" fill="#a0aec0" fontSize="20" letterSpacing="3">FOCUS ZONE / {plan.deskWidthMm} × {plan.deskHeightMm} MM</text>
        {plan.items.map((item) => {
          const definition = getDeviceDefinition(item.type)
          const isSelected = selectedItemId === item.id
          const hasIssue = analysis.overlapIds.includes(item.id) || analysis.outOfBoundsIds.includes(item.id)
          const cx = item.x + item.widthMm / 2
          const cy = item.y + item.heightMm / 2
          return <g className={`desk-item ${isSelected ? 'is-selected' : ''} ${hasIssue ? 'has-issue' : ''}`} key={item.id} onPointerDown={(event) => startDrag(event, item)} role="button" tabIndex={0} aria-label={`${definition.label}，${item.widthMm}乘${item.heightMm}毫米`}>
            <g transform={`translate(${cx} ${cy}) rotate(${item.rotation})`}>
              <rect x={-item.widthMm / 2} y={-item.heightMm / 2} width={item.widthMm} height={item.heightMm} rx={Math.min(24, item.heightMm / 5)} fill={definition.color} filter="url(#item-shadow)" />
              <rect className="item-inner-line" x={-item.widthMm / 2 + 12} y={-item.heightMm / 2 + 12} width={Math.max(0, item.widthMm - 24)} height={Math.max(0, item.heightMm - 24)} rx={12} fill="none" />
              <text x="0" y="5" textAnchor="middle" fill="#1f2e44" fontWeight="700" fontSize={Math.max(18, Math.min(32, item.widthMm / 16))}>{definition.shortLabel}</text>
              <text x="0" y="30" textAnchor="middle" fill="#44546b" fontSize="16">{item.widthMm} × {item.heightMm}</text>
            </g>
            {isSelected && <rect className="selection-box" x={getItemBounds(item).left - 8} y={getItemBounds(item).top - 8} width={getItemBounds(item).width + 16} height={getItemBounds(item).height + 16} rx="12" fill="none" />}
            {hasIssue && <g transform={`translate(${Math.max(18, getItemBounds(item).right - 4)} ${Math.max(18, getItemBounds(item).top - 4)}`}><circle r="18" fill="#ef6a6a" /><text textAnchor="middle" y="7" fill="white" fontSize="22" fontWeight="700">!</text></g>}
          </g>
        })}
        {annotationsVisible && plan.annotations.map((annotation) => {
          const anchor = getAnnotationAnchor(plan, annotation)
          const x = clampPinCoordinate(anchor.x, plan.deskWidthMm)
          const y = clampPinCoordinate(anchor.y, plan.deskHeightMm)
          const isSelected = selectedAnnotationId === annotation.id
          return (
            <g className={`annotation-pin ${annotation.resolved ? 'is-resolved' : ''}`} key={annotation.id} transform={`translate(${x} ${y})`} onPointerDown={(event) => startAnnotationDrag(event, annotation)} role="button" tabIndex={0} aria-label={`批注，${annotation.text || '未填写内容'}`}>
              {isSelected && <circle className="annotation-selection" r={PIN_RADIUS + 9} fill="none" />}
              <circle r={PIN_RADIUS} fill={annotation.color} stroke="#ffffff" strokeWidth="5" filter="url(#item-shadow)" />
              {annotation.resolved
                ? <path d="M -11 1 L -3 9 L 12 -9" fill="none" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
                : <g stroke="#ffffff" strokeWidth="5" strokeLinecap="round"><line x1="-10" y1="-7" x2="10" y2="-7" /><line x1="-10" y1="0" x2="10" y2="0" /><line x1="-10" y1="7" x2="4" y2="7" /></g>}
              {annotation.text.length > 0 && <text className="annotation-label" x={PIN_RADIUS + 10} y="7">{truncateLabel(annotation.text)}</text>}
            </g>
          )
        })}
        {plan.items.length === 0 && <g><circle cx={plan.deskWidthMm / 2} cy={plan.deskHeightMm / 2 - 12} r="32" fill="#e8eef6" /><text x={plan.deskWidthMm / 2} y={plan.deskHeightMm / 2 + 2} textAnchor="middle" fill="#8493a8" fontSize="22">+</text><text x={plan.deskWidthMm / 2} y={plan.deskHeightMm / 2 + 48} textAnchor="middle" fill="#8493a8" fontSize="22">从左侧添加第一件设备</text></g>}
      </svg>
      <div className="canvas-legend"><span><i className="legend-dot clear-dot" /> 可用空间</span><span><i className="legend-dot issue-dot" /> 冲突 / 越界</span>{annotationsVisible && plan.annotations.length > 0 && <span><i className="legend-dot note-dot" /> 批注</span>}<span className="canvas-scale">网格：50 mm</span></div>
    </div>
  )
}
