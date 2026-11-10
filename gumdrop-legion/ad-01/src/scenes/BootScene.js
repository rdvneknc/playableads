import Phaser from 'phaser';
import { makeTextures } from '../art/Textures.js';

// Everything is procedural, so "loading" is just painting textures.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    makeTextures(this);
    this.scene.start('Game');
  }
}
