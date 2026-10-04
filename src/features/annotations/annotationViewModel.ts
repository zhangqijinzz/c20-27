import { normalizeRotation } from '../../shared/layoutRules'
import {
  createAnnotation,
  type AnnotationAnchorInput,
  type AnnotationColor,
  type DeskItem,
  type PlanAnnotation,
  type WorkspacePlan,
} from '../../shared/models'

export interface AnnotationPoint {
  x: number
  y: number
}

function rotateOffset(dx: number, dy: number, rotation: number): AnnotationPoint {
  const radians = (normalizeRotation(rotation) * Math.PI) / 180
  return {
    x: dx * Math.cos(radians) - dy * Math.sin(radians),
    y: dx * Math.sin(radians) + dy * Math.cos(radians),
  }
}

function itemCenter(item: DeskItem): AnnotationPoint {
  return { x: item.x + item.widthMm / 2, y: item.y + item.heightMm / 2 }
}

/** 解析批注在画布上的实际坐标；挂接设备已不存在时返回 null（属于需要脱落的异常态） */
export function getAnnotationPosition(annotation: PlanAnnotation, items: DeskItem[]): AnnotationPoint | null {
  if (annotation.anchor.kind === 'free') {
    return { x: annotation.anchor.x, y: annotation.anchor.y }
  }
  const item = items.find((entry) => entry.id === annotation.anchor.itemId)
  if (!item) return null
  const center = itemCenter(item)
  const offset = rotateOffset(annotation.anchor.dx, annotation.anchor.dy, item.rotation)
  return { x: center.x + offset.x, y: center.y + offset.y }
}

export function isAnnotationOrphan(annotation: PlanAnnotation, items: DeskItem[]): boolean {
  return annotation.anchor.kind === 'item' && !items.some((item) => item.id === annotation.anchor.itemId)
}

function touch(annotation: PlanAnnotation): PlanAnnotation {
  return { ...annotation, updatedAt: new Date().toISOString() }
}

export function addPlanAnnotation(
  plan: WorkspacePlan,
  anchorInput: AnnotationAnchorInput,
  text = '',
  color: AnnotationColor = 'amber',
): WorkspacePlan {
  return { ...plan, annotations: [...plan.annotations, createAnnotation(text, anchorInput, color)] }
}

export function updatePlanAnnotation(
  plan: WorkspacePlan,
  id: string,
  patch: Partial<Pick<PlanAnnotation, 'text' | 'color' | 'resolved'>>,
): WorkspacePlan {
  return {
    ...plan,
    annotations: plan.annotations.map((annotation) =>
      annotation.id === id ? touch({ ...annotation, ...patch }) : annotation,
    ),
  }
}

export function removePlanAnnotation(plan: WorkspacePlan, id: string): WorkspacePlan {
  return { ...plan, annotations: plan.annotations.filter((annotation) => annotation.id !== id) }
}

/**
 * 移动批注图钉。自由批注直接改坐标；挂在设备上的批注把画布坐标
 * 换算成设备自身坐标系下的偏移，这样设备移动、旋转后批注始终跟随。
 */
export function movePlanAnnotation(plan: WorkspacePlan, id: string, point: AnnotationPoint): WorkspacePlan {
  return {
    ...plan,
    annotations: plan.annotations.map((annotation) => {
      if (annotation.id !== id) return annotation
      if (annotation.anchor.kind === 'free') {
        return touch({ ...annotation, anchor: { kind: 'free', x: point.x, y: point.y } })
      }
      const item = plan.items.find((entry) => entry.id === annotation.anchor.itemId)
      if (!item) return touch({ ...annotation, anchor: { kind: 'free', x: point.x, y: point.y } })
      const center = itemCenter(item)
      const local = rotateOffset(point.x - center.x, point.y - center.y, -item.rotation)
      return touch({ ...annotation, anchor: { kind: 'item', itemId: item.id, dx: local.x, dy: local.y } })
    }),
  }
}

/** 设备即将被删除：挂在它身上的批注在原位置脱落为自由批注，不随设备消失 */
export function detachAnnotationsOfItem(
  annotations: PlanAnnotation[],
  removedItemId: string,
  itemsBeforeRemoval: DeskItem[],
): PlanAnnotation[] {
  return annotations.map((annotation) => {
    if (annotation.anchor.kind !== 'item' || annotation.anchor.itemId !== removedItemId) return annotation
    const position = getAnnotationPosition(annotation, itemsBeforeRemoval)
    return touch({ ...annotation, anchor: { kind: 'free', x: position?.x ?? 0, y: position?.y ?? 0 } })
  })
}

/** 加载历史/异常数据时的兜底：找不到设备的挂接批注落到画布左上角附近，绝不丢数据 */
export function reconcileAnnotations(plan: WorkspacePlan): WorkspacePlan {
  let changed = false
  const annotations = plan.annotations.map((annotation) => {
    if (!isAnnotationOrphan(annotation, plan.items)) return annotation
    changed = true
    return touch({ ...annotation, anchor: { kind: 'free', x: 60, y: 60 } })
  })
  return changed ? { ...plan, annotations } : plan
}

/** 复制方案时设备会换 ID，批注里的挂接关系按映射表一起搬家，并重新生成批注 ID */
export function duplicateAnnotations(
  annotations: PlanAnnotation[],
  itemIdMap: Map<string, string>,
): PlanAnnotation[] {
  return annotations.map((annotation) => ({
    ...annotation,
    id: createId('note'),
    anchor: annotation.anchor.kind === 'item'
      ? { kind: 'item', itemId: itemIdMap.get(annotation.anchor.itemId) ?? annotation.anchor.itemId, dx: annotation.anchor.dx, dy: annotation.anchor.dy }
      : { ...annotation.anchor },
  }))
}
