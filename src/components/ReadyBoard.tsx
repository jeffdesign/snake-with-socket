import { Player } from 'shared-types'
import hexRgb from 'hex-rgb'

interface Props {
  players: Player[]
  socketId: string
}

export default function ReadyBoard({ players, socketId }: Props) {
  return (
    <div className="Leaderboard">
      {[...players].map((player: Player, index: number) => (
        <div
          className="row"
          key={player.id}
          style={{ backgroundColor: hexRgb(player.color, { format: 'css', alpha: 0.25 }) }}
        >
          <span>
            {index + 1}. {player.name}
            {player.id === socketId && ' (You)'}
          </span>
          <span>{player.ready ? 'Ready' : 'Not ready'}</span>
        </div>
      ))}
    </div>
  )
}
