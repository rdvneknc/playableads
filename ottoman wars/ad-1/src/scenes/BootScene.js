import Phaser from 'phaser';
import { makeTextures } from '../art/Textures.js';
import yeniceriUrl from '../assets/yeniceri.webp';
import azapUrl from '../assets/azap.webp';
import akinciUrl from '../assets/akinci.webp';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    this.load.image('yeniceri', yeniceriUrl);
    this.load.image('azap', azapUrl);
    this.load.image('akinci', akinciUrl);
  }

  create() {
    makeTextures(this);
    this.scene.start('Game');
  }
}
