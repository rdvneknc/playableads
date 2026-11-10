import Phaser from 'phaser';
import { COLORS } from '../config.js';

// Bundle is fully inlined, so Boot only sets the stage and hands off to Preload.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.scene.start('Preload');
  }
}
