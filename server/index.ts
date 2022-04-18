import { createServer } from 'http'
import { Server, Socket } from 'socket.io'
import { EVENT, Player, Model, PlayerDirection, Color, State } from '../src/shared-types'
import { SERVER_PORT, TICK_LENGTH_MS, CANVAS_SIZE, CELL_SIZE, PLAYER_NAME_MAX_LENGTH } from './Constants'
import { defaultModel, hourTimeMs, createPlayer, createFruit, parseKeyDown, getHHMMSSduration } from './Utils'
import { updatePoint, updateFruit, updatePlayerPosition, updateTailPositions, updatePlayerDirection } from './Update'
import { v4 as uuidv4 } from 'uuid'

process.title = 'SnakeIOGame'

const httpServer = createServer()
const io = new Server(httpServer)

let loop = { tick: 0, previousClock: hourTimeMs(), debug: true }
let model: Model = defaultModel()

type Msg =
  | { type: 'Init'; socketId: string }
  | { type: 'NewPlayer'; socketId: string; roomId: string; player: Player }
  | { type: 'NewGame'; socketId: string; player: Player }
  | { type: 'Playing' }
  | { type: 'Loading' }
  | { type: 'Disconnect'; socketId: string }
  | { type: 'UpdatePlayerDirection'; playerId: string; direction: PlayerDirection }
  | { type: 'UpdatePlayer'; player: Player }
  | { type: 'CheckForCollision'; player: Player }

function updateModel(prevModel: Model, msg: Msg) {
  switch (msg.type) {
    case 'Init':
      model = { ...defaultModel(), state: State.Select }
      break
    case 'NewPlayer':
      model = {
        ...prevModel,
        state: State.WaitingRoom,
        players: prevModel.players.concat(createPlayer(msg.socketId, msg.roomId, msg.player.color, msg.player.name)),
      }
      break
    case 'NewGame':
      model = {
        ...prevModel,
        state: State.Playing,
        // players: prevModel.players.concat(
        //   createPlayer(msg.socketId, msg.player.roomId, msg.player.color, msg.player.name)
        // ),
        fruit: createFruit(),
      }
      break
    case 'Playing':
      model = { ...prevModel, state: State.Playing }
      break
    case 'Disconnect':
      model = {
        ...prevModel,
        state: State.Loading,
        players: prevModel.players.filter((player) => player.id !== msg.socketId),
      }
      break
    case 'UpdatePlayerDirection':
      model = {
        ...prevModel,
        state: State.Playing,
        players: prevModel.players.map((player) =>
          player.id === msg.playerId
            ? {
                ...player,
                direction: updatePlayerDirection(msg.direction, player.direction),
              }
            : player
        ),
      }
      break
    case 'UpdatePlayer':
      model = {
        ...prevModel,
        state: State.Playing,
        players: prevModel.players.map((player) =>
          player.id === msg.player.id
            ? {
                ...player,
                position: updatePlayerPosition(player.position, player.direction),
                positions: updateTailPositions(player, prevModel.fruit),
                length: updatePoint(player, prevModel.fruit),
              }
            : player
        ),
        fruit: updateFruit(msg.player, prevModel.fruit),
      }
      break
    case 'CheckForCollision':
      if (
        msg.player.positions.some(
          (tailCell) => tailCell.x === msg.player.position.x && tailCell.y === msg.player.position.y
        )
      ) {
        model = {
          ...prevModel,
          state: State.Playing,
          players: [createPlayer(msg.player.id, msg.player.roomId, msg.player.color, msg.player.name)],
          fruit: createFruit(),
        }
      } else {
        model = prevModel
      }
      break
    case 'Loading':
      model = { ...prevModel, ...defaultModel }
      break
    default:
      model = prevModel
      break
  }
}

// Server Logic
io.sockets.on(EVENT.CONNECT, (socket: Socket) => {
  console.info('New connection established:', socket.id)

  socket.on(EVENT.CREATE_ROOM, (player: Player) => {
    const newRoomId = uuidv4().substring(0, 6)
    updateModel(model, { type: 'NewPlayer', socketId: socket.id, roomId: newRoomId, player: player })
    io.emit(EVENT.CREATE_ROOM, { state: model.state, roomId: newRoomId, players: model.players })
  })

  socket.on(EVENT.INITIALIZE, ({ playerId, roomId }: { playerId: string; roomId: string | null }) => {
    // Client wants to init a new game
    updateModel(model, { type: 'Init', socketId: socket.id })

    // Emit that game is ready
    io.emit(EVENT.SELECT_GAME, {
      state: model.state,
      // Should probably more like: if findRoomId(roomId) || createNewRoom(uuidv4())
      roomId: roomId || [].length > 0 || '',
      settings: {
        canvasSize: CANVAS_SIZE,
        cellSize: CELL_SIZE,
        color: { red: Color.Red, green: Color.Green, blue: Color.Blue, orange: Color.Orange, purple: Color.Purple },
        playerNameMaxLength: PLAYER_NAME_MAX_LENGTH,
      },
    })
  })

  socket.on(EVENT.START_GAME, (player: Player) => {
    // Client wants to start a new game
    updateModel(model, { type: 'NewGame', socketId: socket.id, player })

    if (model.state === State.Playing && model.players.length >= 1) {
      gameLoop()
    } else {
      updateModel(model, { type: 'Loading' })
    }
  })

  socket.on(EVENT.DIRECTION_UPDATE, ({ playerId, keyDown }: { playerId: string; keyDown: string }) => {
    // Client wants to update the player.direction
    const parsedKeyDown = parseKeyDown(keyDown.toUpperCase())
    if (parsedKeyDown !== 'ILLIGAL_KEY') {
      updateModel(model, { type: 'UpdatePlayerDirection', playerId: playerId, direction: parsedKeyDown })
    } else {
      loop.debug && console.info('Illigal key')
    }
  })

  socket.on(EVENT.EXIT_GAME, () => {
    updateModel(model, { type: 'Init', socketId: socket.id })
  })

  socket.on(EVENT.DISCONNECT, () => {
    updateModel(model, { type: 'Disconnect', socketId: socket.id })
  })
})

function gameLoop() {
  if (model.state === State.Playing && model.players.length > 0) {
    setTimeout(gameLoop, TICK_LENGTH_MS)
  } else {
    updateModel(model, { type: 'Loading' })
  }

  const nowClock = hourTimeMs()
  const delta = (nowClock - loop.previousClock) / 1000

  // Game updates
  for (let index = 0; index < model.players.length; index++) {
    const player = model.players[index]
    updateModel(model, { type: 'UpdatePlayer', player })
    updateModel(model, { type: 'CheckForCollision', player })
  }

  // Then emit
  io.emit(EVENT.GAME_UPDATE, { state: model.state, players: model.players, fruit: model.fruit })

  if (loop.debug) {
    console.debug(
      JSON.stringify(
        {
          delta,
          tick: loop.tick,
          cpu: process.cpuUsage(),
          upTime: getHHMMSSduration(process.uptime()),
          pid: process.pid,
          model,
        },
        null,
        2
      )
    )
  }

  loop.previousClock = nowClock
  loop.tick++
}

console.info('Server now running on port', SERVER_PORT)
httpServer.listen(SERVER_PORT)
