import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createAnnotation,
  createId,
  createInitialDocument,
  createPlan,
  type DeskItem,
  type DeviceType,
  type LayoutAnalysis,
  type PlanAnnotation,
  type WorkspaceDocument,
  type WorkspacePlan,
  type WorkspaceStatus,
} from '../../shared/models'
import { clampDeskSize, clampItemDimension } from '../../shared/layoutRules'
import { moveCanvasItem, rotateCanvasItem } from '../canvas/canvasViewModel'
import { createMaterialDraft } from '../materials/materialsViewModel'
import { inspectPlan } from '../inspection/inspectionViewModel'
import {
  clampToDesk,
  detachAnnotationsFromItems,
  duplicatePlanAnnotations,
  moveAnnotationTo,
} from '../annotations/annotationsViewModel'
import { LocalWorkspaceRepository, type WorkspaceRepository } from './workspaceRepository'

export interface WorkspaceViewModel {
  status: WorkspaceStatus
  document: WorkspaceDocument | null
  activePlan: WorkspacePlan | null
  selectedItem: DeskItem | null
  selectedAnnotation: PlanAnnotation | null
  annotationsVisible: boolean
  analysis: LayoutAnalysis
  issueIds: string[]
  issueCount: number
  feedback: string
  isPreviewOpen: boolean
  selectItem: (id: string | null) => void
  addItem: (type: DeviceType) => void
  removeItem: (id: string) => void
  moveItem: (id: string, x: number, y: number) => void
  rotateItem: (id: string, delta: number) => void
  updateItem: (id: string, patch: Partial<Pick<DeskItem, 'widthMm' | 'heightMm' | 'x' | 'y'>>) => void
  updateDesk: (field: 'deskWidthMm' | 'deskHeightMm', value: number) => void
  selectAnnotation: (id: string | null) => void
  addAnnotationAt: (x: number, y: number) => void
  addAnnotationForItem: (itemId: string) => void
  updateAnnotation: (id: string, patch: Partial<Pick<PlanAnnotation, 'text' | 'color' | 'resolved'>>) => void
  moveAnnotation: (id: string, x: number, y: number) => void
  removeAnnotation: (id: string) => void
  toggleAnnotations: () => void
  createNewPlan: () => void
  duplicatePlan: () => void
  selectPlan: (id: string) => void
  deleteCurrentPlan: () => void
  openPreview: () => void
  closePreview: () => void
}

const emptyInspection = { analysis: { overlapIds: [], outOfBoundsIds: [], coveragePercent: 0, status: 'clear' as const }, issueIds: [], issueCount: 0 }

export function useWorkspaceViewModel(repository?: WorkspaceRepository): WorkspaceViewModel {
  const repositoryRef = useRef(repository ?? new LocalWorkspaceRepository())
  const [status, setStatus] = useState<WorkspaceStatus>('loading')
  const [document, setDocument] = useState<WorkspaceDocument | null>(null)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null)
  const [annotationsVisible, setAnnotationsVisible] = useState(true)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [feedback, setFeedback] = useState('正在准备你的工作台…')

  useEffect(() => {
    let active = true
    void repositoryRef.current.load().then((loaded) => {
      if (!active) return
      const nextDocument = loaded ?? createInitialDocument()
      setDocument(nextDocument)
      setStatus('ready')
      setFeedback(loaded ? '已恢复上次编辑状态' : '已创建示例工作台，可以直接拖动设备')
    }).catch(() => {
      if (!active) return
      setDocument(createInitialDocument())
      setStatus('error')
      setFeedback('本地数据读取失败，当前使用临时工作台')
    })
    return () => { active = false }
  }, [])

  const activePlan = useMemo(
    () => document?.plans.find((plan) => plan.id === document.activePlanId) ?? null,
    [document],
  )
  const selectedItem = activePlan?.items.find((item) => item.id === selectedItemId) ?? null
  const selectedAnnotation = activePlan?.annotations.find((annotation) => annotation.id === selectedAnnotationId) ?? null
  const inspection = useMemo(() => activePlan ? inspectPlan(activePlan) : emptyInspection, [activePlan])
  const { analysis, issueIds, issueCount } = inspection

  const persist = useCallback(async (nextDocument: WorkspaceDocument, message: string) => {
    setDocument(nextDocument)
    setStatus('saving')
    setFeedback(message)
    try {
      await repositoryRef.current.save(nextDocument)
      setStatus('ready')
    } catch {
      setStatus('error')
      setFeedback('自动保存失败，请检查浏览器本地存储权限')
    }
  }, [])

  const updateActivePlan = useCallback((updater: (plan: WorkspacePlan) => WorkspacePlan, message: string) => {
    if (!document || !activePlan) return
    const nextPlan = { ...updater(activePlan), updatedAt: new Date().toISOString() }
    const nextDocument = { ...document, plans: document.plans.map((plan) => plan.id === nextPlan.id ? nextPlan : plan) }
    void persist(nextDocument, message)
  }, [activePlan, document, persist])

  const selectItem = useCallback((id: string | null) => {
    setSelectedItemId(id)
    if (id) setSelectedAnnotationId(null)
  }, [])

  const selectAnnotation = useCallback((id: string | null) => {
    setSelectedAnnotationId(id)
    if (id) setSelectedItemId(null)
  }, [])

  const addItem = useCallback((type: DeviceType) => {
    if (!activePlan) return
    const draft = createMaterialDraft(type, activePlan.items.length)
    updateActivePlan((plan) => ({ ...plan, items: [...plan.items, draft.item] }), draft.feedback)
    setSelectedItemId(draft.item.id)
  }, [activePlan, updateActivePlan])

  const removeItem = useCallback((id: string) => {
    const hasAttached = activePlan?.annotations.some((annotation) => annotation.targetItemId === id) ?? false
    updateActivePlan((plan) => ({
      ...plan,
      items: plan.items.filter((item) => item.id !== id),
      annotations: detachAnnotationsFromItems(plan.annotations, plan.items, [id]),
    }), hasAttached ? '设备已移除，挂在它身上的批注已留在原位置' : '设备已移除')
    setSelectedItemId((current) => current === id ? null : current)
  }, [activePlan, updateActivePlan])

  const moveItem = useCallback((id: string, x: number, y: number) => {
    updateActivePlan((plan) => ({ ...plan, items: moveCanvasItem(plan.items, id, x, y) }), '位置已更新')
  }, [updateActivePlan])

  const rotateItem = useCallback((id: string, delta: number) => {
    updateActivePlan((plan) => ({ ...plan, items: rotateCanvasItem(plan.items, id, delta) }), '角度已更新')
  }, [updateActivePlan])

  const updateItem = useCallback((id: string, patch: Partial<Pick<DeskItem, 'widthMm' | 'heightMm' | 'x' | 'y'>>) => {
    updateActivePlan((plan) => ({
      ...plan,
      items: plan.items.map((item) => item.id === id ? {
        ...item,
        ...patch,
        widthMm: patch.widthMm === undefined ? item.widthMm : clampItemDimension(patch.widthMm, item.widthMm),
        heightMm: patch.heightMm === undefined ? item.heightMm : clampItemDimension(patch.heightMm, item.heightMm),
      } : item),
    }), '尺寸参数已更新')
  }, [updateActivePlan])

  const updateDesk = useCallback((field: 'deskWidthMm' | 'deskHeightMm', value: number) => {
    if (!activePlan) return
    updateActivePlan((plan) => ({ ...plan, [field]: clampDeskSize(value, plan[field]) }), '桌面尺寸已更新')
  }, [activePlan, updateActivePlan])

  const addAnnotationAt = useCallback((x: number, y: number) => {
    if (!activePlan) return
    const point = clampToDesk(activePlan, x, y)
    const annotation = createAnnotation({ x: Math.round(point.x), y: Math.round(point.y) })
    updateActivePlan((plan) => ({ ...plan, annotations: [...plan.annotations, annotation] }), '批注已钉在画布上')
    setSelectedAnnotationId(annotation.id)
    setSelectedItemId(null)
  }, [activePlan, updateActivePlan])

  const addAnnotationForItem = useCallback((itemId: string) => {
    if (!activePlan) return
    const target = activePlan.items.find((item) => item.id === itemId)
    if (!target) return
    const anchor = clampToDesk(activePlan, target.x + target.widthMm + 60, target.y + target.heightMm / 2)
    const annotation = createAnnotation({
      targetItemId: itemId,
      x: Math.round(anchor.x - target.x),
      y: Math.round(anchor.y - target.y),
    })
    updateActivePlan((plan) => ({ ...plan, annotations: [...plan.annotations, annotation] }), '批注已挂在设备上，会跟随设备移动')
    setSelectedAnnotationId(annotation.id)
    setSelectedItemId(null)
  }, [activePlan, updateActivePlan])

  const updateAnnotation = useCallback((id: string, patch: Partial<Pick<PlanAnnotation, 'text' | 'color' | 'resolved'>>) => {
    updateActivePlan((plan) => ({
      ...plan,
      annotations: plan.annotations.map((annotation) => annotation.id === id ? { ...annotation, ...patch } : annotation),
    }), '批注已更新')
  }, [updateActivePlan])

  const moveAnnotation = useCallback((id: string, x: number, y: number) => {
    updateActivePlan((plan) => {
      const point = clampToDesk(plan, x, y)
      return { ...plan, annotations: moveAnnotationTo(plan, id, point.x, point.y) }
    }, '批注位置已更新')
  }, [updateActivePlan])

  const removeAnnotation = useCallback((id: string) => {
    updateActivePlan((plan) => ({ ...plan, annotations: plan.annotations.filter((annotation) => annotation.id !== id) }), '批注已删除')
    setSelectedAnnotationId((current) => current === id ? null : current)
  }, [updateActivePlan])

  const toggleAnnotations = useCallback(() => {
    setAnnotationsVisible((current) => !current)
    setFeedback(annotationsVisible ? '批注已隐藏，画布恢复纯净查看' : '批注已显示')
  }, [annotationsVisible])

  const createNewPlan = useCallback(() => {
    if (!document) return
    const plan = createPlan(`工作台 ${document.plans.length + 1}`, false)
    void persist({ ...document, plans: [...document.plans, plan], activePlanId: plan.id }, '已创建空白方案')
    setSelectedItemId(null)
    setSelectedAnnotationId(null)
  }, [document, persist])

  const duplicatePlan = useCallback(() => {
    if (!document || !activePlan) return
    const itemIdMap = new Map(activePlan.items.map((item) => [item.id, createId('item')]))
    const copy: WorkspacePlan = {
      ...activePlan,
      id: createId('plan'),
      name: `${activePlan.name} · 副本`,
      items: activePlan.items.map((item) => ({ ...item, id: itemIdMap.get(item.id) ?? createId('item') })),
      annotations: duplicatePlanAnnotations(activePlan.annotations, itemIdMap),
      updatedAt: new Date().toISOString(),
    }
    void persist({ ...document, plans: [...document.plans, copy], activePlanId: copy.id }, '方案已复制，批注一并带走')
    setSelectedItemId(null)
    setSelectedAnnotationId(null)
  }, [activePlan, document, persist])

  const selectPlan = useCallback((id: string) => {
    if (!document || !document.plans.some((plan) => plan.id === id)) return
    void persist({ ...document, activePlanId: id }, '已切换方案')
    setSelectedItemId(null)
    setSelectedAnnotationId(null)
  }, [document, persist])

  const deleteCurrentPlan = useCallback(() => {
    if (!document || !activePlan || document.plans.length <= 1) {
      setFeedback('至少保留一个工作台方案')
      return
    }
    const remaining = document.plans.filter((plan) => plan.id !== activePlan.id)
    void persist({ ...document, plans: remaining, activePlanId: remaining[0].id }, '方案已删除')
    setSelectedItemId(null)
    setSelectedAnnotationId(null)
  }, [activePlan, document, persist])

  const openPreview = useCallback(() => setIsPreviewOpen(true), [])
  const closePreview = useCallback(() => setIsPreviewOpen(false), [])

  return {
    status,
    document,
    activePlan,
    selectedItem,
    selectedAnnotation,
    annotationsVisible,
    analysis,
    issueIds,
    issueCount,
    feedback,
    isPreviewOpen,
    selectItem,
    addItem,
    removeItem,
    moveItem,
    rotateItem,
    updateItem,
    updateDesk,
    selectAnnotation,
    addAnnotationAt,
    addAnnotationForItem,
    updateAnnotation,
    moveAnnotation,
    removeAnnotation,
    toggleAnnotations,
    createNewPlan,
    duplicatePlan,
    selectPlan,
    deleteCurrentPlan,
    openPreview,
    closePreview,
  }
}
