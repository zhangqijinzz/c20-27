import { createId, type DeskItem, type PlanAnnotation, type WorkspaceDocument, type WorkspacePlan } from '../../shared/models'

export interface AnnotationAnchor {
  x: number
  y: number
  targetItemId: string | null
}

/** 解析批注在画布上的绝对坐标：挂在设备上的批注跟随设备当前位置。 */
export function getAnnotationAnchor(plan: WorkspacePlan, annotation: PlanAnnotation): AnnotationAnchor {
  if (annotation.targetItemId) {
    const target = plan.items.find((item) => item.id === annotation.targetItemId)
    if (target) return { x: target.x + annotation.x, y: target.y + annotation.y, targetItemId: target.id }
  }
  return { x: annotation.x, y: annotation.y, targetItemId: null }
}

/** 设备被删除时，挂在它身上的批注转为位置批注，留在设备最后所在的位置。 */
export function detachAnnotationsFromItems(annotations: PlanAnnotation[], items: DeskItem[], removedItemIds: string[]): PlanAnnotation[] {
  const removed = new Set(removedItemIds)
  return annotations.map((annotation) => {
    if (!annotation.targetItemId || !removed.has(annotation.targetItemId)) return annotation
    const target = items.find((item) => item.id === annotation.targetItemId)
    return {
      ...annotation,
      targetItemId: null,
      x: Math.round((target?.x ?? 0) + annotation.x),
      y: Math.round((target?.y ?? 0) + annotation.y),
    }
  })
}

/** 拖动批注到绝对坐标：挂设备的批注存相对偏移，位置批注存绝对坐标。 */
export function moveAnnotationTo(plan: WorkspacePlan, annotationId: string, x: number, y: number): PlanAnnotation[] {
  return plan.annotations.map((annotation) => {
    if (annotation.id !== annotationId) return annotation
    if (annotation.targetItemId) {
      const target = plan.items.find((item) => item.id === annotation.targetItemId)
      if (target) return { ...annotation, x: Math.round(x - target.x), y: Math.round(y - target.y) }
    }
    return { ...annotation, x: Math.round(x), y: Math.round(y) }
  })
}

/** 复制方案时批注一起走：换新 id，并把设备引用重映射到复制出的设备上。 */
export function duplicatePlanAnnotations(annotations: PlanAnnotation[], itemIdMap: Map<string, string>): PlanAnnotation[] {
  return annotations.map((annotation) => ({
    ...annotation,
    id: createId('note'),
    targetItemId: annotation.targetItemId ? itemIdMap.get(annotation.targetItemId) ?? null : null,
  }))
}

/** 修复数据：指向已不存在设备的批注转为位置批注，缺失的批注数组补空。 */
export function normalizeAnnotations(plan: WorkspacePlan): PlanAnnotation[] {
  const annotations = plan.annotations ?? []
  return annotations.map((annotation) => {
    if (!annotation.targetItemId) return annotation
    return plan.items.some((item) => item.id === annotation.targetItemId) ? annotation : { ...annotation, targetItemId: null }
  })
}

export function normalizeWorkspaceDocument(document: WorkspaceDocument): WorkspaceDocument {
  return { ...document, plans: document.plans.map((plan) => ({ ...plan, annotations: normalizeAnnotations(plan) })) }
}

export function clampToDesk(plan: WorkspacePlan, x: number, y: number): { x: number; y: number } {
  return {
    x: Math.min(Math.max(x, 0), plan.deskWidthMm),
    y: Math.min(Math.max(y, 0), plan.deskHeightMm),
  }
}
