import { Check, Trash2, X } from 'lucide-react'
import { ANNOTATION_COLORS, type AnnotationColor, type PlanAnnotation } from '../../../shared/models'

interface AnnotationCardProps {
  annotation: PlanAnnotation
  position: { x: number; y: number }
  deskWidthMm: number
  deskHeightMm: number
  onUpdate: (id: string, patch: Partial<Pick<PlanAnnotation, 'text' | 'color' | 'resolved'>>) => void
  onRemove: (id: string) => void
  onClose: () => void
}

export function AnnotationCard({ annotation, position, deskWidthMm, deskHeightMm, onUpdate, onRemove, onClose }: AnnotationCardProps) {
  const left = Math.min(96, Math.max(4, (position.x / deskWidthMm) * 100))
  const top = Math.min(98, Math.max(6, (position.y / deskHeightMm) * 100))
  const flipBelow = top > 62
  return (
    <div
      className={`annotation-card ${flipBelow ? 'is-below' : ''}`}
      style={{ left: `${left}%`, top: `${top}%` }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="annotation-card-head">
        <span className="annotation-card-title">画布批注</span>
        <span className={`annotation-state ${annotation.resolved ? 'is-done' : ''}`}>{annotation.resolved ? '已处理' : '待处理'}</span>
        <button className="annotation-card-close" aria-label="收起批注" onClick={onClose} type="button"><X size={13} /></button>
      </div>
      <textarea
        className="annotation-text"
        value={annotation.text}
        placeholder="写点什么，比如：这里要留插座 / 设备再往左一点"
        rows={3}
        autoFocus
        onChange={(event) => onUpdate(annotation.id, { text: event.currentTarget.value })}
      />
      <div className="annotation-colors">
        {ANNOTATION_COLORS.map((color) => (
          <button
            key={color.value}
            type="button"
            className={`annotation-swatch ${annotation.color === color.value ? 'is-active' : ''}`}
            style={{ backgroundColor: color.hex }}
            aria-label={`标记为${color.label}`}
            aria-pressed={annotation.color === color.value}
            onClick={() => onUpdate(annotation.id, { color: color.value as AnnotationColor })}
          />
        ))}
      </div>
      <div className="annotation-card-foot">
        <button
          type="button"
          className={`annotation-resolve ${annotation.resolved ? 'is-done' : ''}`}
          onClick={() => onUpdate(annotation.id, { resolved: !annotation.resolved })}
        >
          <Check size={13} /> {annotation.resolved ? '已处理完' : '标记已处理'}
        </button>
        <button type="button" className="annotation-delete" aria-label="删除批注" onClick={() => onRemove(annotation.id)}><Trash2 size={13} /></button>
      </div>
    </div>
  )
}
