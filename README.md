# Snake game with socket.io

Install
```sh
  yarn install
```

Run server and client
```sh
  yarn dev
```

Or run them as separate processes

```sh
  yarn server
  yarn client
```

### Todo
- [x] Basic client setup
- [x] Basic server setup
- [x] Implement actual Snake gameplay
  - [x] Continues movement
  - [x] Make Snake stay in bound
  - [x] Eat fruit
  - [x] Gain length / earn point
  - [x] Snake self-collision
- [ ] Make it possible to input custom Snake color
- [ ] Bug: Make is impossible for fruit to spawn at Snake position
- [ ] Unit tests for core game features
  - [ ] Continues movement
  - [ ] Teleportation
  - [ ] Gain length / earn point
  - [ ] Self collision
  - [ ] Snake.position[] logic
- [ ] Snake multiplayer?
