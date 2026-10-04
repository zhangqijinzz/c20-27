import { Check, Trash2 } from 'lucide-react'
import { ANNOTATION_COLORS, getDeviceDefinition, type PlanAnnotation, type WorkspacePlan } from '../../../shared/models'

interface AnnotationEditorProps {
  plan: WorkspacePlan
  annotation: PlanAnnotation
  onUpdate: (id: string, patch: Partial<Pick<PlanAnnotation, 'text' | 'color' | 'resolved'>>) => void
  onRemove: (id: string) => void
}

export function AnnotationEditor({ plan, annotation, onUpdate, onRemove }: AnnotationEditorProps) {
  const target = annotation.targetItemId ? plan.items.find((item) => item.id === annotation.targetItemId) ?? null : null
  return (
    <div className="annotation-editor">
      <div className="selected-item-heading">
        <span className="selected-swatch" style={{ backgroundColor: annotation.color }} />
        <div>
          <strong>画布批注</strong>
          <small>{target ? `挂在「${getDeviceDefinition(target.type).label}」上，随设备移动` : '钉在桌面位置，不随设备移动'}</small>
        </div>
        <span className="item-code">NOTE</span>
      </div>
      <div className="field-heading"><span>批注内容</span><span className={`field-status ${annotation.resolved ? '' : 'field-status-open'}`}>{annotation.resolved ? '已处理' : '待处理'}</span></div>
      <textarea
        className="annotation-textarea"
        value={annotation.text}
        placeholder="写下要留在图上的意见，例如：这里要留插座"
        onChange={(event) => onUpdate(annotation.id, { text: event.currentTarget.value })}
      />
      <div className="field-heading"><span>标记颜色</span></div>
      <div className="annotation-colors">
        {ANNOTATION_COLORS.map((color) => (
          <button
            aria-label={`使用颜色 ${color}`}
            aria-pressed={annotation.color === color}
            className={`annotation-color ${annotation.color === color ? 'is-active' : ''}`}
            key={color}
            onClick={() => onUpdate(annotation.id, { color })}
            style={{ backgroundColor: color }}
            type="button"
          />
        ))}
      </div>
      <button className={`resolve-toggle ${annotation.resolved ? 'is-resolved' : ''}`} onClick={() => onUpdate(annotation.id, { resolved: !annotation.resolved })} type="button">
        <Check size={15} /> {annotation.resolved ? '已处理，点击重新打开' : '标记为已处理'}
      </button>
      <button className="remove-item-button" onClick={() => onRemove(annotation.id)} type="button"><Trash2 size={15} /> 删除这条批注</button>
    </div>
  )
}
