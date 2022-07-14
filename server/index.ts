import { createServer } from 'http'
import { Server, Socket } from 'socket.io'
import { SERVER_PORT, ENV, TICK_LENGTH_MS, CANVAS_SIZE, CELL_SIZE, PLAYER_NAME_MAX_LENGTH } from './Constants'
import { defaultModel, hourTimeMs, createPlayer, createFruit, parseKeyDown, getHHMMSSduration } from './Utils'
import { updatePoints, updateFruit, updatePlayerPosition, updateTailPositions, updatePlayerDirection } from './Update'
import { v4 as uuidv4 } from 'uuid'

import {
  Game,
  EVENT,
  Player,
  Model,
  PlayerDirection,
  Color,
  State,
  NewPlayerInput,
  CreateRoomInput,
  JoinRoomInput,
  ReadyInput,
} from '../src/shared-types'

process.title = 'snake-with-socket'

const httpServer = createServer()
const io = new Server(httpServer)

let loop = { tick: 0, previousClock: hourTimeMs(), debug: process.env.APP_ENV === ENV.DEVELOPMENT }
let model: Model = defaultModel()

type Msg =
  | { type: 'Init'; playerId: string }
  | { type: 'NewPlayer'; playerId: string; roomId: string; input: NewPlayerInput }
  | { type: 'NewGame'; playerId: string; roomId: string }
  | { type: 'Playing' }
  | { type: 'Loading' }
  | { type: 'Disconnect'; playerId: string }
  | { type: 'PlayerIsReady'; playerId: string }
  | { type: 'UpdatePlayerDirection'; playerId: string; direction: PlayerDirection }
  | { type: 'UpdatePlayer'; player: Player }
  | { type: 'CheckForCollision'; player: Player }

function updateModel(prevModel: Model, msg: Msg) {
  const game = model[0] // Todo: How do we determine which game to update?

  // Todo: Instead of iterating all games, we should be able to cherry pick the game we want to update
  model = prevModel.map((existingGame) => (existingGame.roomId === game.roomId ? updateGame(game, msg) : existingGame))
}

function updateGame(game: Game, msg: Msg): Game {
  switch (msg.type) {
    case 'Init':
      return { ...game, state: State.Select }
    case 'NewPlayer':
      return {
        ...game,
        roomId: msg.roomId,
        state: State.WaitingRoom,
        players: game.players.concat(createPlayer(msg.playerId, msg.roomId, msg.input.color, msg.input.name)),
      }
    case 'NewGame':
      return { ...game, roomId: game.roomId, state: State.Playing, fruit: createFruit() }
    case 'Playing':
      return { ...game, state: State.Playing }
    case 'Disconnect':
      return {
        ...game,
        state: State.Select,
        players: game.players.filter((player) => player.id !== msg.playerId),
      }
    case 'UpdatePlayerDirection':
      return {
        ...game,
        state: State.Playing,
        players: game.players.map((player) =>
          player.id === msg.playerId
            ? {
                ...player,
                direction: updatePlayerDirection(msg.direction, player.direction),
              }
            : player
        ),
      }
    case 'PlayerIsReady':
      return {
        ...game,
        state: State.WaitingRoom,
        players: game.players.map((player) =>
          player.id === msg.playerId
            ? {
                ...player,
                ready: !player.ready,
              }
            : player
        ),
      }
    case 'UpdatePlayer':
      return {
        ...game,
        state: State.Playing,
        players: game.players.map((player) =>
          player.id === msg.player.id
            ? {
                ...player,
                position: updatePlayerPosition(player.position, player.direction),
                positions: updateTailPositions(player, game.fruit),
                points: updatePoints(player, game.fruit),
              }
            : player
        ),
        fruit: updateFruit(msg.player, game.fruit),
      }
    case 'CheckForCollision':
      if (
        msg.player.positions.some(
          (tailCell) => tailCell.x === msg.player.position.x && tailCell.y === msg.player.position.y
        )
      ) {
        return {
          ...game,
          state: State.Playing,
          players: [createPlayer(msg.player.id, msg.player.roomId, msg.player.color, msg.player.name)],
          fruit: createFruit(),
        }
      } else {
        return game
      }
    case 'Loading':
      return { ...game, state: State.Loading }
    default:
      return game
  }
}

// Server Logic
io.sockets.on(EVENT.CONNECT, (socket: Socket) => {
  console.info('New connection established:', socket.id)

  socket.on(EVENT.CREATE_ROOM, (input: CreateRoomInput) => {
    const newRoomId = model[0].roomId
    updateModel(model, { type: 'NewPlayer', playerId: socket.id, roomId: newRoomId, input })
    const game = model[0]

    io.emit(EVENT.JOIN_ROOM, { state: game.state, roomId: game.roomId, players: game.players })
  })

  socket.on(EVENT.JOIN_ROOM, (input: JoinRoomInput) => {
    // Todo: search for joinRoomId and valdiate before joining
    updateModel(model, { type: 'NewPlayer', playerId: socket.id, roomId: input.roomId, input })
    const game = model[0]
    io.emit(EVENT.JOIN_ROOM, { state: game.state, roomId: input.roomId, players: game.players })
  })

  socket.on(EVENT.INITIALIZE, ({ roomId: requestedRoomId }: { roomId: string | null }) => {
    // Client wants to init a new game
    const game = model[0]
    updateModel(model, { type: 'Init', playerId: socket.id })

    // Emit that game is ready
    io.emit(EVENT.SELECT_GAME, {
      state: game.state,
      // Should probably more like: findRoomId(roomId) || createNewRoom(uuidv4())
      roomId: requestedRoomId || [].length > 0 || '',
      settings: {
        canvasSize: CANVAS_SIZE,
        cellSize: CELL_SIZE,
        color: { red: Color.Red, green: Color.Green, blue: Color.Blue, orange: Color.Orange, purple: Color.Purple },
        playerNameMaxLength: PLAYER_NAME_MAX_LENGTH,
      },
    })
  })

  socket.on(EVENT.READY, (input: ReadyInput) => {
    updateModel(model, { type: 'PlayerIsReady', playerId: input.playerId })
    console.log(JSON.stringify(model, null, 2))
    io.emit(EVENT.JOIN_ROOM, { state: model[0].state, roomId: input.roomId, players: model[0].players })

    if (model[0].players.every((player) => player.ready === true)) {
      updateModel(model, { type: 'NewGame', playerId: socket.id, roomId: input.roomId })
    }

    if (model[0].state === State.Playing && model[0].players.length >= 1) {
      gameLoop()
    } else {
      updateModel(model, { type: 'Loading' })
    }
  })

  socket.on(EVENT.DIRECTION_UPDATE, ({ playerId, keyDown }: { playerId: string; keyDown: string }) => {
    const game = model[0]
    if (game.state !== State.Playing) {
      return
    }

    const parsedKeyDown = parseKeyDown(keyDown.toUpperCase())
    if (parsedKeyDown !== 'ILLIGAL_KEY') {
      updateModel(model, { type: 'UpdatePlayerDirection', playerId: playerId, direction: parsedKeyDown })
    } else {
      loop.debug && console.info('Illigal key')
    }
  })

  socket.on(EVENT.EXIT_GAME, () => {
    // Todo: What should happen? Respawn in same game or send to lobby or throw out of lobby?
    updateModel(model, { type: 'Disconnect', playerId: socket.id })
  })

  socket.on(EVENT.DISCONNECT, () => {
    updateModel(model, { type: 'Disconnect', playerId: socket.id })
  })
})

function gameLoop() {
  const game = model[0]
  if (game.state === State.Playing && game.players.length > 0) {
    setTimeout(gameLoop, TICK_LENGTH_MS)
  } else {
    updateModel(model, { type: 'Loading' })
  }

  const nowClock = hourTimeMs()
  const delta = (nowClock - loop.previousClock) / 1000

  // Game updates
  for (let index = 0; index < game.players.length; index++) {
    const player = game.players[index]
    updateModel(model, { type: 'UpdatePlayer', player })
    updateModel(model, { type: 'CheckForCollision', player })
  }

  // Then emit
  io.emit(EVENT.GAME_UPDATE, { state: game.state, players: game.players, fruit: game.fruit })

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
