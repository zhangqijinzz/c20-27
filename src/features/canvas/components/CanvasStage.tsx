import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Eye, EyeOff, MessageSquarePlus, Move, RotateCw } from 'lucide-react'
import type {
  AnnotationAnchorInput,
  DeskItem,
  LayoutAnalysis,
  PlanAnnotation,
  WorkspacePlan,
} from '../../../shared/models'
import { getDeviceDefinition } from '../../../shared/models'
import { getItemBounds } from '../../../shared/layoutRules'
import { getAnnotationPosition } from '../../annotations/annotationViewModel'
import { AnnotationCard } from '../../annotations/components/AnnotationCard'
import { AnnotationLayer } from '../../annotations/components/AnnotationLayer'

interface AnnotationLayerConfig {
  visible: boolean
  pinMode: boolean
  selectedId: string | null
  onSelect: (id: string | null) => void
  onCreate: (anchor: AnnotationAnchorInput) => void
  onUpdate: (id: string, patch: Partial<Pick<PlanAnnotation, 'text' | 'color' | 'resolved'>>) => void
  onRemove: (id: string) => void
  onMove: (id: string, x: number, y: number) => void
  onTogglePinMode: () => void
  onToggleVisible: () => void
}

interface CanvasStageProps {
  plan: WorkspacePlan
  selectedItemId: string | null
  analysis: LayoutAnalysis
  onSelect: (id: string | null) => void
  onMove: (id: string, x: number, y: number) => void
  annotations?: AnnotationLayerConfig
}

interface DragState { id: string; offsetX: number; offsetY: number }
interface NoteDragState { id: string }

const PIN_MARGIN = 18

export function CanvasStage({ plan, selectedItemId, analysis, onSelect, onMove, annotations }: CanvasStageProps) {
  const stageRef = useRef<SVGSVGElement>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [noteDrag, setNoteDrag] = useState<NoteDragState | null>(null)
  const readOnly = !annotations
  const annotationVisible = annotations?.visible ?? false
  const pinMode = annotations?.pinMode ?? false
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
    if (!noteDrag || !annotations) return
    const handleMove = (event: PointerEvent) => {
      const point = scaleToMm(event.clientX, event.clientY)
      if (!point) return
      annotations.onMove(noteDrag.id, point.x, point.y)
    }
    const handleUp = () => setNoteDrag(null)
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    return () => { window.removeEventListener('pointermove', handleMove); window.removeEventListener('pointerup', handleUp) }
  }, [noteDrag, annotations, scaleToMm])

  const startDrag = (event: ReactPointerEvent<SVGGElement>, item: DeskItem) => {
    event.stopPropagation()
    if (pinMode) {
      const point = scaleToMm(event.clientX, event.clientY)
      if (!point || !annotations) return
      const dx = point.x - (item.x + item.widthMm / 2)
      const dy = point.y - (item.y + item.heightMm / 2)
      annotations.onCreate({ kind: 'item', itemId: item.id, dx, dy })
      return
    }
    const point = scaleToMm(event.clientX, event.clientY)
    if (!point) return
    onSelect(item.id)
    setDrag({ id: item.id, offsetX: point.x - item.x, offsetY: point.y - item.y })
  }

  const startNoteDrag = (event: ReactPointerEvent<SVGGElement>, annotation: PlanAnnotation) => {
    if (readOnly) return
    event.stopPropagation()
    setNoteDrag({ id: annotation.id })
  }

  const handleStagePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!pinMode || !annotations) {
      onSelect(null)
      annotations?.onSelect(null)
      return
    }
    const point = scaleToMm(event.clientX, event.clientY)
    if (!point) return
    const x = Math.min(plan.deskWidthMm - PIN_MARGIN, Math.max(PIN_MARGIN, point.x))
    const y = Math.min(plan.deskHeightMm - PIN_MARGIN, Math.max(PIN_MARGIN, point.y))
    annotations.onCreate({ kind: 'free', x, y })
  }

  const selectedAnnotation = annotationVisible && annotations?.selectedId
    ? plan.annotations.find((annotation) => annotation.id === annotations.selectedId) ?? null
    : null
  const selectedAnnotationPoint = selectedAnnotation ? getAnnotationPosition(selectedAnnotation, plan.items) : null
  const unresolvedCount = plan.annotations.filter((annotation) => !annotation.resolved).length

  return (
    <div className="canvas-wrap">
      <div className="canvas-toolbar">
        <span><Move size={14} /> {pinMode ? '点击设备或空白处，钉下批注' : '拖动设备调整位置'}</span>
        <span className="canvas-toolbar-right">
          {!pinMode && <span className="canvas-hint"><RotateCw size={14} /> 旋转请在右侧操作</span>}
          {annotations && <>
            <button
              type="button"
              className={`canvas-mini-button ${pinMode ? 'is-active' : ''}`}
              onClick={annotations.onTogglePinMode}
              disabled={!annotationVisible}
            ><MessageSquarePlus size={13} /> 钉批注</button>
            <button
              type="button"
              className="canvas-mini-button"
              onClick={annotations.onToggleVisible}
              aria-pressed={annotationVisible}
            >
              {annotationVisible ? <Eye size={13} /> : <EyeOff size={13} />}
              {annotationVisible ? '批注开' : '批注关'}
              {unresolvedCount > 0 && <i className="annotation-count">{unresolvedCount}</i>}
            </button>
          </>}
        </span>
      </div>
      <div className="canvas-stage-holder">
        <svg ref={stageRef} className={`desk-canvas ${pinMode ? 'is-pin-mode' : ''}`} viewBox={`0 0 ${plan.deskWidthMm} ${plan.deskHeightMm}`} role="img" aria-label={`桌面布局画布，${plan.deskWidthMm}乘${plan.deskHeightMm}毫米`} onPointerDown={handleStagePointerDown}>
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
          {plan.items.length === 0 && <g><circle cx={plan.deskWidthMm / 2} cy={plan.deskHeightMm / 2 - 12} r="32" fill="#e8eef6" /><text x={plan.deskWidthMm / 2} y={plan.deskHeightMm / 2 + 2} textAnchor="middle" fill="#8493a8" fontSize="22">+</text><text x={plan.deskWidthMm / 2} y={plan.deskHeightMm / 2 + 48} textAnchor="middle" fill="#8493a8" fontSize="22">从左侧添加第一件设备</text></g>}
          {annotations && annotationVisible && (
            <AnnotationLayer
              plan={plan}
              selectedId={annotations.selectedId}
              interactive={!readOnly}
              onSelect={annotations.onSelect}
              onDragStart={startNoteDrag}
            />
          )}
        </svg>
        {annotations && selectedAnnotation && selectedAnnotationPoint && (
          <AnnotationCard
            annotation={selectedAnnotation}
            position={selectedAnnotationPoint}
            deskWidthMm={plan.deskWidthMm}
            deskHeightMm={plan.deskHeightMm}
            onUpdate={annotations.onUpdate}
            onRemove={annotations.onRemove}
            onClose={() => annotations.onSelect(null)}
          />
        )}
      </div>
      <div className="canvas-legend"><span><i className="legend-dot clear-dot" /> 可用空间</span><span><i className="legend-dot issue-dot" /> 冲突 / 越界</span>{annotations && <span><i className="legend-dot note-dot" /> 批注（不参与布局检查）</span>}<span className="canvas-scale">网格：50 mm</span></div>
    </div>
  )
}
