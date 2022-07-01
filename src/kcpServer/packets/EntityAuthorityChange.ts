import Packet, { PacketInterface, PacketContext } from '#/packet'
import Entity from '$/entity'
import { AuthorityChange } from '@/types/game/entity'

export interface EntityAuthorityChangeNotify {
  authorityChangeList: AuthorityChange[]
}

class EntityAuthorityChangePacket extends Packet implements PacketInterface {
  entityList: Entity[]

  constructor() {
    super('EntityAuthorityChange')

    this.entityList = []
  }

  async sendNotify(context: PacketContext): Promise<void> {
    const entityList = this.entityList.splice(0)

    if (entityList.length === 0) return

    const notifyData: EntityAuthorityChangeNotify = {
      authorityChangeList: entityList.map(entity => ({
        entityId: entity.entityId,
        authorityPeerId: entity.authorityPeerId,
        entityAuthorityInfo: entity.exportEntityAuthorityInfo()
      }))
    }

    await super.sendNotify(context, notifyData)
  }

  async broadcastNotify(contextList: PacketContext[]): Promise<void> {
    await super.broadcastNotify(contextList)
  }

  addEntity(entity: Entity) {
    const { entityList } = this
    if (!entityList.includes(entity)) entityList.push(entity)
  }
}

let packet: EntityAuthorityChangePacket
export default (() => packet = packet || new EntityAuthorityChangePacket())()