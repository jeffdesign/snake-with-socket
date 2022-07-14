export enum EVENT {
  CONNECT = 'connect', // This keyword is socket io magic
  DISCONNECT = 'disconnect',
  INITIALIZE = 'initialize',
  JOIN_ROOM = 'join_room',
  CREATE_ROOM = 'create_room',
  SELECT_GAME = 'select_game',
  READY = 'ready',
  DIRECTION_UPDATE = 'direction_update',
  GAME_UPDATE = 'game_update',
  EXIT_GAME = 'exit_game',
}

export enum PlayerDirection {
  Up = 'UP',
  Right = 'RIGHT',
  Left = 'LEFT',
  Down = 'DOWN',
}

export enum ArrowKey {
  ArrowUp = 'ARROWUP',
  ArrowRight = 'ARROWRIGHT',
  ArrowDown = 'ARROWDOWN',
  ArrowLeft = 'ARROWLEFT',
}

export enum CharacterKey {
  W = 'W',
  D = 'D',
  S = 'S',
  A = 'A',
}

export enum Color {
  Red = '#cc0000',
  Green = '#009a3e',
  Blue = '#3498db',
  Orange = '#ff8800',
  Purple = '#8e44ad',
}

export enum State {
  Loading = 'Loading',
  Init = 'Init',
  Playing = 'Playing',
  Select = 'Select',
  WaitingRoom = 'WaitingRoom',
  Error = 'Error',
  Disconnected = 'Disconnected',
}

export type Model = Game[]

export type Game = {
  roomId: string
  state: Loading | Init | Select | WaitingRoom | Playing | Error
  players: Player[]
  fruit: Fruit
}

type Loading = State.Loading
type Init = State.Init
type Playing = State.Playing
type Select = State.Select
type WaitingRoom = State.WaitingRoom
type Error = State.Error

export interface Input {
  color: Color
  name: string
}

export interface CreateRoomInput {
  playerId: string
  name: string
  color: Color
}

export interface JoinRoomInput {
  roomId: string
  playerId: string
  name: string
  color: Color
}

export interface ReadyInput {
  playerId: string
  roomId: string
}

export type NewPlayerInput = CreateRoomInput

export interface Position {
  x: number
  y: number
}

export interface Colors {
  red: Color
  green: Color
  blue: Color
  orange: Color
  purple: Color
}

export interface Fruit {
  color: Color
  size: number
  position: Position
}

export interface Player {
  id: string
  roomId: string
  ready: boolean
  name: string
  color: Color
  size: number
  points: number
  position: Position
  positions: Position[]
  direction: PlayerDirection
}

export interface Settings {
  canvasSize: number
  cellSize: number
  color: Colors
  playerNameMaxLength: number
}
