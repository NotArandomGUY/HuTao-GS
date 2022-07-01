import Entity from '$/entity'
import Gadget from '$/entity/gadget'
import Monster from '$/entity/monster'
import Npc from '$/entity/npc'
import SceneData from '$/gameData/data/SceneData'
import WorldData from '$/gameData/data/WorldData'
import Vector from '$/utils/vector'
import { VisionTypeEnum } from '@/types/enum/entity'
import { SceneGadgetScriptConfig, SceneMonsterScriptConfig, SceneNpcScriptConfig, SceneSuiteScriptConfig } from '@/types/gameData/Script/SceneScriptConfig'
import { WaitOnBlock } from '@/utils/asyncWait'
import { performance } from 'perf_hooks'
import SceneBlock from './sceneBlock'

export default class SceneGroup {
  block: SceneBlock

  id: number
  pos: Vector
  dynamicLoad: boolean

  monsterList: Monster[]
  npcList: Npc[]
  gadgetList: Gadget[]

  private loaded: boolean

  constructor(block: SceneBlock, id: number, pos: Vector, dynamicLoad: boolean) {
    this.block = block

    this.id = id
    this.pos = pos
    this.dynamicLoad = !!dynamicLoad

    this.monsterList = []
    this.npcList = []
    this.gadgetList = []

    this.loaded = false
  }

  private async reloadList(entityList: Entity[]) {
    const { block } = this
    const { scene } = block
    const { entityManager } = scene

    if (entityList.length === 0) return false

    for (let entity of entityList) {
      if (entity.isDead()) continue
      await entityManager.add(entity, VisionTypeEnum.VISION_MEET, undefined, undefined, true)
    }

    return true
  }

  private async loadMonsters(monsters: SceneMonsterScriptConfig[]) {
    const { block, id: groupId, monsterList } = this
    const { id: blockId, scene } = block
    const { world, entityManager } = scene

    if (await this.reloadList(monsterList)) return

    const worldLevelData = WorldData.getWorldLevel(world.level)
    const levelOffset = worldLevelData == null ? 0 : (worldLevelData.MonsterLevel - 22)

    for (let monster of monsters) {
      const { MonsterId, ConfigId, PoseId, IsElite, Level, Pos, Rot } = monster
      const entity = new Monster(MonsterId)

      entity.groupId = groupId
      entity.configId = ConfigId || 0
      entity.blockId = blockId
      entity.poseId = PoseId || 0
      entity.isElite = !!IsElite

      const { motionInfo, bornPos } = entity
      const { pos, rot } = motionInfo

      pos.setData(Pos)
      rot.setData(Rot)
      bornPos.setData(Pos)

      entity.initNew(Math.max(1, Math.min(100, Level + levelOffset)))

      monsterList.push(entity)
      await entityManager.add(entity, undefined, undefined, undefined, true)
    }
  }

  private async loadNpcs(npcs: SceneNpcScriptConfig[], suites: SceneSuiteScriptConfig[]) {
    const { block, id: groupId, npcList } = this
    const { id: blockId, scene } = block
    const { entityManager } = scene

    if (await this.reloadList(npcList)) return

    for (let npc of npcs) {
      const { NpcId, ConfigId, Pos, Rot } = npc
      const entity = new Npc(NpcId)

      entity.groupId = groupId
      entity.configId = ConfigId || 0
      entity.blockId = blockId
      entity.suitIdList = suites
        .map((suite, index) => ({ index, suite }))
        .filter(e => e.suite?.Npcs?.includes(ConfigId))
        .map(e => e.index + 1)

      const { motionInfo, bornPos } = entity
      const { pos, rot } = motionInfo

      pos.setData(Pos)
      rot.setData(Rot)
      bornPos.setData(Pos)

      entity.initNew()

      npcList.push(entity)
      await entityManager.add(entity, undefined, undefined, undefined, true)
    }
  }

  private async loadGadgets(gadgets: SceneGadgetScriptConfig[]) {
    const { block, id: groupId, gadgetList } = this
    const { id: blockId, scene } = block
    const { entityManager } = scene

    if (await this.reloadList(gadgetList)) return

    for (let gadget of gadgets) {
      const { GadgetId, ConfigId, Level, Pos, Rot, InteractId } = gadget
      const entity = new Gadget(GadgetId)

      entity.groupId = groupId
      entity.configId = ConfigId || 0
      entity.blockId = blockId
      entity.interactId = InteractId || null

      const { motionInfo, bornPos } = entity
      const { pos, rot } = motionInfo

      pos.setData(Pos)
      rot.setData(Rot)
      bornPos.setData(Pos)

      entity.initNew(Level)

      gadgetList.push(entity)
      await entityManager.add(entity, undefined, undefined, undefined, true)
    }
  }

  private async unloadList(entityList: Entity[]) {
    const { block } = this
    const { scene } = block
    const { entityManager } = scene

    for (let entity of entityList) await entityManager.remove(entity, undefined, undefined, true)
  }

  async load(wob: WaitOnBlock) {
    const { block, id: groupId, loaded } = this
    const { id: sceneId } = block.scene

    if (loaded) return
    this.loaded = true

    const groupData = SceneData.getGroup(sceneId, groupId)
    if (!groupData) return

    performance.mark('GroupLoad')

    await wob.waitTick()
    await this.loadMonsters(Object.values(groupData.Monsters || {}))
    await wob.waitTick()
    await this.loadNpcs(Object.values(groupData.Npcs || {}), Object.values(groupData.Suites || {}))
    await wob.waitTick()
    await this.loadGadgets(Object.values(groupData.Gadgets || {}))

    performance.measure('Group load', 'GroupLoad')
  }

  async unload() {
    const { monsterList, npcList, gadgetList, loaded } = this

    if (!loaded) return
    this.loaded = false

    performance.mark('GroupUnload')

    await this.unloadList(monsterList)
    await this.unloadList(npcList)
    await this.unloadList(gadgetList)

    performance.measure('Group unload', 'GroupUnload')
  }
}