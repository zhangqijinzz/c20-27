import { describe, expect, it } from 'vitest'
import { createAnnotation, createItem, createPlan, type WorkspacePlan } from '../../../shared/models'
import {
  clampToDesk,
  detachAnnotationsFromItems,
  duplicatePlanAnnotations,
  getAnnotationAnchor,
  moveAnnotationTo,
  normalizeAnnotations,
  normalizeWorkspaceDocument,
} from '../annotationsViewModel'

describe('annotations module', () => {
  it('resolves anchors for pinned and device-attached annotations', () => {
    const item = { ...createItem('monitor'), x: 200, y: 100 }
    const pinned = createAnnotation({ x: 500, y: 300 })
    const attached = createAnnotation({ targetItemId: item.id, x: 40, y: -20 })
    const plan = { ...createPlan('批注', false), items: [item], annotations: [pinned, attached] }
    expect(getAnnotationAnchor(plan, pinned)).toMatchObject({ x: 500, y: 300, targetItemId: null })
    expect(getAnnotationAnchor(plan, attached)).toMatchObject({ x: 240, y: 80, targetItemId: item.id })
  })

  it('keeps annotations on the desk at the last position when the device is deleted', () => {
    const item = { ...createItem('lamp'), x: 300, y: 200 }
    const attached = createAnnotation({ targetItemId: item.id, x: 50, y: 30 })
    const detached = detachAnnotationsFromItems([attached], [item], [item.id])
    expect(detached[0]).toMatchObject({ targetItemId: null, x: 350, y: 230 })
  })

  it('moves attached annotations by converting absolute points into offsets', () => {
    const item = { ...createItem('monitor'), x: 100, y: 100 }
    const attached = createAnnotation({ targetItemId: item.id, x: 10, y: 10 })
    const plan = { ...createPlan('批注', false), items: [item], annotations: [attached] }
    const moved = moveAnnotationTo(plan, attached.id, 250, 180)
    expect(moved[0]).toMatchObject({ targetItemId: item.id, x: 150, y: 80 })
  })

  it('copies annotations with new ids and remaps device references', () => {
    const item = createItem('speaker')
    const attached = createAnnotation({ targetItemId: item.id, x: 5, y: 5 })
    const pinned = createAnnotation({ x: 10, y: 10 })
    const copies = duplicatePlanAnnotations([attached, pinned], new Map([[item.id, 'item-copy']]))
    expect(copies[0]).toMatchObject({ targetItemId: 'item-copy', x: 5, y: 5 })
    expect(copies[0].id).not.toBe(attached.id)
    expect(copies[1].targetItemId).toBeNull()
  })

  it('repairs orphan annotations and missing annotation arrays when normalizing', () => {
    const orphan = createAnnotation({ targetItemId: 'ghost-item', x: 12, y: 8 })
    const plan = { ...createPlan('批注', false), items: [], annotations: [orphan] }
    expect(normalizeAnnotations(plan)[0].targetItemId).toBeNull()
    const legacyPlan = { ...createPlan('旧方案', false), annotations: undefined } as unknown as WorkspacePlan
    const normalized = normalizeWorkspaceDocument({ version: 1, plans: [legacyPlan], activePlanId: legacyPlan.id })
    expect(normalized.plans[0].annotations).toEqual([])
  })

  it('clamps points to the desk surface', () => {
    const plan = createPlan('批注', false)
    expect(clampToDesk(plan, -50, 99999)).toEqual({ x: 0, y: plan.deskHeightMm })
  })
})
