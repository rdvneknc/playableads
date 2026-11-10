import Phaser from 'phaser';
import { makeTextures } from '../art/Textures.js';
import yeniceri from '../assets/yeniceri.webp';
import azap from '../assets/azap.webp';
import tufekci from '../assets/tufekci.webp';
import akinci from '../assets/akinci.webp';
import tatar from '../assets/tatar.webp';
import top from '../assets/top.webp';
import kale from '../assets/kale.webp';
import kaleYikik from '../assets/kale-yikik.webp';
import logo from '../assets/logo.webp';
import kart from '../assets/kart.webp';
import buton from '../assets/buton.webp';
import akce from '../assets/akce.webp';
import zeminYatay from '../assets/zemin-yatay.webp';

const IMAGES = { yeniceri, azap, tufekci, akinci, tatar, top, kale, 'kale-yikik': kaleYikik, logo, kart, buton, akce, 'zemin-yatay': zeminYatay };

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    Object.entries(IMAGES).forEach(([k, url]) => this.load.image(k, url));
  }

  create() {
    makeTextures(this);
    this.scene.start('Game');
  }
}
