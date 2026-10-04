import type { PointerEvent as ReactPointerEvent } from 'react'
import { getAnnotationColor, type PlanAnnotation, type WorkspacePlan } from '../../../shared/models'
import { getAnnotationPosition } from '../annotationViewModel'

interface AnnotationLayerProps {
  plan: WorkspacePlan
  selectedId: string | null
  interactive: boolean
  onSelect: (id: string | null) => void
  onDragStart: (event: ReactPointerEvent<SVGGElement>, annotation: PlanAnnotation) => void
}

const PIN_RADIUS = 16

export function AnnotationLayer({ plan, selectedId, interactive, onSelect, onDragStart }: AnnotationLayerProps) {
  return (
    <g className="annotation-layer">
      {plan.annotations.map((annotation) => {
        const position = getAnnotationPosition(annotation, plan.items)
        if (!position) return null
        const color = getAnnotationColor(annotation.color)
        const isSelected = selectedId === annotation.id
        const attached = annotation.anchor.kind === 'item'
        const item = attached ? plan.items.find((entry) => entry.id === annotation.anchor.itemId) : undefined
        const anchorX = item ? item.x + item.widthMm / 2 : position.x
        const anchorY = item ? item.y + item.heightMm / 2 : position.y
        return (
          <g
            key={annotation.id}
            className={`annotation-pin ${annotation.resolved ? 'is-resolved' : ''} ${isSelected ? 'is-selected' : ''} ${interactive ? 'is-interactive' : ''}`}
            transform={`translate(${position.x} ${position.y})`}
            onPointerDown={interactive ? (event) => {
              event.stopPropagation()
              onSelect(annotation.id)
              onDragStart(event, annotation)
            } : (event) => event.stopPropagation()}
            role={interactive ? 'button' : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-label={`批注：${annotation.text || '未填写内容'}${annotation.resolved ? '，已处理' : ''}`}
          >
            <title>{annotation.text || '未填写批注'}{annotation.resolved ? '（已处理）' : ''}</title>
            {item && (
              <line
                className="annotation-connector"
                x1={0}
                y1={0}
                x2={anchorX - position.x}
                y2={anchorY - position.y}
                stroke={color.hex}
                strokeWidth={2}
                strokeDasharray="6 6"
                pointerEvents="none"
              />
            )}
            {isSelected && <circle className="pin-selection" r={PIN_RADIUS + 6} fill="none" stroke={color.hex} strokeWidth={3} strokeDasharray="8 6" pointerEvents="none" />}
            <circle r={PIN_RADIUS} fill={color.hex} stroke="#ffffff" strokeWidth={3} />
            {annotation.resolved ? (
              <path d="M20 6 9 17l-5-5" transform="translate(-11 -11) scale(0.96)" fill="none" stroke="#ffffff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />
            ) : (
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" transform="translate(-11 -11) scale(0.96)" fill="none" stroke="#ffffff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />
            )}
          </g>
        )
      })}
    </g>
  )
}
