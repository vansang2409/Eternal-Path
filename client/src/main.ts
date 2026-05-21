import Phaser from "phaser";
import { GameScene } from "./game/GameScene";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 960,
  height: 640,
  pixelArt: true,
  backgroundColor: "#18202a",
  physics: {
    default: "arcade",
    arcade: { debug: false }
  },
  scene: [GameScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
});
