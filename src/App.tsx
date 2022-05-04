import { useEffect, useState } from 'react'
import { socket } from './Api'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import SelectScreen from './SelectScreen'
import Game from './Game'
import WaitingRoom from './WaitingRoom'

import {
  Player,
  Fruit,
  EVENT,
  State,
  Settings,
  Input,
  JoinRoomInput,
  CreateRoomInput,
  Color,
  ReadyInput,
} from './shared-types'

function App() {
  const [socketStatus, setSocketStatus] = useState<State | 'Disconnected'>(State.Disconnected)
  const [socketId, setSocektId] = useState<string | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [fruit, setFruit] = useState<Fruit | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [roomId, setRoomId] = useState<string | undefined>(undefined)
  const [input, setInput] = useState<Input>({ color: null, name: '' })

  useEffect(() => {
    // Connected to server

    socket.on(EVENT.CONNECT, () => {
      setSocketStatus(State.Loading)
      setSocektId(socket.id)

      socket.emit(EVENT.INITIALIZE, { roomId: roomId })

      // We have handshake, retrieve game settings and go into select screen
      socket.on(
        EVENT.SELECT_GAME,
        ({ state, roomId, settings }: { state: State; roomId: string; settings: Settings }) => {
          setSocketStatus(state)
          setSettings(settings)
          setRoomId(roomId)
        }
      )

      // Listen to game updates and save them in our state
      socket.on(EVENT.GAME_UPDATE, ({ state, players, fruit }: { state: State; players: Player[]; fruit: Fruit }) => {
        setSocketStatus(state)
        setPlayers(players)
        setFruit(fruit)
      })
    })

    // Server assignes us a room
    socket.on(EVENT.JOIN_ROOM, ({ state, roomId, players }) => {
      setSocketStatus(state)
      setRoomId(roomId)
      setPlayers(players)
    })

    // If we lose connection with server - reset app
    socket.on(EVENT.DISCONNECT, () => {
      setSocketStatus(State.Disconnected)
      setSocektId(null)
      setPlayers([])
      setFruit(null)
      setSettings(null)
    })

    // Listen and emit keydown events
    window.addEventListener('keydown', (event) => {
      socket.emit(EVENT.DIRECTION_UPDATE, {
        playerId: socket.id,
        keyDown: event.key,
      })
    })
  }, [])

  const defaultColor = Color.Blue

  function createRoom({ color, name }: Input) {
    const payload: CreateRoomInput = { playerId: socket.id, color: color || defaultColor, name }
    socket.emit(EVENT.CREATE_ROOM, payload)
  }

  function joinRoom(roomId: string, { color, name }: Input) {
    const payload: JoinRoomInput = { roomId, playerId: socket.id, color: color || defaultColor, name }
    socket.emit(EVENT.JOIN_ROOM, payload)
  }

  function ready(playerId: string, roomId: string) {
    const payload: ReadyInput = { playerId, roomId }
    socket.emit(EVENT.READY, payload)
  }

  function exitGame() {
    socket.emit(EVENT.EXIT_GAME)
  }

  const clientHasServerConfigs = socketId && settings
  const isConnectedToServer =
    socketStatus === State.Playing || socketStatus === State.Select || socketStatus === State.WaitingRoom

  return (
    <div className="App">
      {socketStatus === State.Loading || socketStatus === State.Init ? (
        <div>Loading...</div>
      ) : socketStatus === State.Disconnected ? (
        <div>Disconnected from server</div>
      ) : isConnectedToServer && clientHasServerConfigs ? (
        <BrowserRouter>
          <Routes>
            <Route
              path="/"
              element={
                <SelectScreen
                  input={input}
                  setInput={setInput}
                  settings={settings}
                  roomId={roomId}
                  createRoom={createRoom}
                  joinRoom={joinRoom}
                />
              }
            />
            <Route
              path="/:id"
              element={
                socketStatus === State.Select ? (
                  <SelectScreen input={input} setInput={setInput} settings={settings} joinRoom={joinRoom} />
                ) : socketStatus === State.WaitingRoom ? (
                  <WaitingRoom socketId={socketId} settings={settings} players={players} ready={ready} />
                ) : State.Playing ? (
                  <Game socketId={socketId} settings={settings} players={players} fruit={fruit} exitGame={exitGame} />
                ) : (
                  <div>Error: Unexpected id: {roomId}</div>
                )
              }
            />
          </Routes>
        </BrowserRouter>
      ) : (
        <div>Error: Unexpected state {socketStatus}</div>
      )}
    </div>
  )
}

export default App
