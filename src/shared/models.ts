export type DeviceType = 'monitor' | 'keyboard' | 'lamp' | 'speaker' | 'stand'

export type WorkspaceStatus = 'loading' | 'ready' | 'saving' | 'error'

export interface DeskItem {
  id: string
  type: DeviceType
  widthMm: number
  heightMm: number
  x: number
  y: number
  rotation: number
}

export type AnnotationColor = 'amber' | 'red' | 'blue' | 'green' | 'violet'

/**
 * 批注不是设备：它要么钉在画布坐标上（free），
 * 要么挂在某件设备上（item），跟随设备移动。
 */
export interface PlanAnnotation {
  id: string
  text: string
  color: AnnotationColor
  resolved: boolean
  anchor:
    | { kind: 'free'; x: number; y: number }
    | { kind: 'item'; itemId: string; dx: number; dy: number }
  createdAt: string
  updatedAt: string
}

export interface WorkspacePlan {
  id: string
  name: string
  deskWidthMm: number
  deskHeightMm: number
  items: DeskItem[]
  /** 批注独立于设备存放，不参与任何布局计算 */
  annotations: PlanAnnotation[]
  updatedAt: string
}

export interface WorkspaceDocument {
  version: 1
  plans: WorkspacePlan[]
  activePlanId: string
  /** 批注层的全局开关：关掉后画布只呈现设备，和普通查看完全一样 */
  annotationsHidden: boolean
}

export interface ItemBounds {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

export interface LayoutAnalysis {
  overlapIds: string[]
  outOfBoundsIds: string[]
  coveragePercent: number
  status: 'clear' | 'attention'
}

export interface DeviceDefinition {
  type: DeviceType
  label: string
  shortLabel: string
  widthMm: number
  heightMm: number
  color: string
  hint: string
}

export const DEVICE_DEFINITIONS: DeviceDefinition[] = [
  { type: 'monitor', label: '显示器', shortLabel: 'MON', widthMm: 540, heightMm: 210, color: '#93b7ff', hint: '主屏 / 副屏' },
  { type: 'keyboard', label: '键盘', shortLabel: 'KEY', widthMm: 440, heightMm: 150, color: '#b5ead7', hint: '全尺寸 / 75%' },
  { type: 'lamp', label: '桌面灯', shortLabel: 'LAMP', widthMm: 180, heightMm: 180, color: '#ffd58e', hint: '灯座占用' },
  { type: 'speaker', label: '音箱', shortLabel: 'SPK', widthMm: 150, heightMm: 150, color: '#f4b7d4', hint: '左右声道' },
  { type: 'stand', label: '支架', shortLabel: 'STAND', widthMm: 260, heightMm: 180, color: '#cbb7f7', hint: '支架 / 坞站' },
]

export const DEFAULT_DESK = { widthMm: 1600, heightMm: 800 }

export const ANNOTATION_COLORS: { value: AnnotationColor; label: string; hex: string }[] = [
  { value: 'amber', label: '黄色', hex: '#f5b53e' },
  { value: 'red', label: '红色', hex: '#ef6a6a' },
  { value: 'blue', label: '蓝色', hex: '#5b8def' },
  { value: 'green', label: '绿色', hex: '#46a97c' },
  { value: 'violet', label: '紫色', hex: '#9277e6' },
]

export function getAnnotationColor(color: AnnotationColor): { value: AnnotationColor; label: string; hex: string } {
  return ANNOTATION_COLORS.find((entry) => entry.value === color) ?? ANNOTATION_COLORS[0]
}

export function getDeviceDefinition(type: DeviceType): DeviceDefinition {
  return DEVICE_DEFINITIONS.find((device) => device.type === type) ?? DEVICE_DEFINITIONS[0]
}

export function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}-${crypto.randomUUID()}`
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export type AnnotationAnchorInput =
  | { kind: 'free'; x: number; y: number }
  | { kind: 'item'; itemId: string; dx?: number; dy?: number }

export function createAnnotation(text: string, anchorInput: AnnotationAnchorInput, color: AnnotationColor = 'amber'): PlanAnnotation {
  const now = new Date().toISOString()
  const anchor = anchorInput.kind === 'free'
    ? { kind: 'free' as const, x: anchorInput.x, y: anchorInput.y }
    : { kind: 'item' as const, itemId: anchorInput.itemId, dx: anchorInput.dx ?? 0, dy: anchorInput.dy ?? 0 }
  return { id: createId('note'), text, color, resolved: false, anchor, createdAt: now, updatedAt: now }
}

export function createItem(type: DeviceType, index = 0): DeskItem {
  const definition = getDeviceDefinition(type)
  const columns = 3
  const x = 80 + (index % columns) * 280
  const y = 90 + Math.floor(index / columns) * 240
  return {
    id: createId('item'),
    type,
    widthMm: definition.widthMm,
    heightMm: definition.heightMm,
    x,
    y,
    rotation: 0,
  }
}

export function createPlan(name = '我的工作台', withDemo = true): WorkspacePlan {
  const items = withDemo ? [createItem('monitor', 0), createItem('keyboard', 1)] : []
  if (withDemo) {
    items[0].x = 530
    items[0].y = 105
    items[1].x = 580
    items[1].y = 470
  }
  return {
    id: createId('plan'),
    name,
    deskWidthMm: DEFAULT_DESK.widthMm,
    deskHeightMm: DEFAULT_DESK.heightMm,
    items,
    annotations: [],
    updatedAt: new Date().toISOString(),
  }
}

/** 兼容旧数据：没有批注字段的历史方案补上空数组 */
export function normalizePlan(plan: WorkspacePlan): WorkspacePlan {
  return Array.isArray(plan.annotations) ? plan : { ...plan, annotations: [] }
}

export function createInitialDocument(): WorkspaceDocument {
  const plan = createPlan('我的工作台', true)
  return { version: 1, plans: [plan], activePlanId: plan.id, annotationsHidden: false }
}

/** 兼容没有批注字段的旧文档 */
export function normalizeDocument(document: WorkspaceDocument): WorkspaceDocument {
  return {
    ...document,
    annotationsHidden: document.annotationsHidden ?? false,
    plans: document.plans.map(normalizePlan),
  }
}
