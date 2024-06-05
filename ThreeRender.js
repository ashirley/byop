import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  LitElement,
  html,
  css,
  // @ts-ignore
} from "lit";

//https://stackoverflow.com/a/45046955/6950
function resizeCanvasToDisplaySize(renderer, camera) {
  const canvas = renderer.domElement;
  // look up the size the canvas is being displayed
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  // adjust displayBuffer size to match
  if (canvas.width !== width || canvas.height !== height) {
    // you must pass false here or three.js sadly fights the browser
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    // update any render target sizes here
  }
}

export class ThreeRender extends LitElement {
  constructor() {
    super();
    this.pixels = new PixelList();
  }
  static styles = css`
    canvas {
      width: 100%;
      height: 100%;
    }
  `;

  render() {
    const scene = new THREE.Scene();
    const group = new THREE.Group();
    scene.add(group);
    const renderer = new THREE.WebGLRenderer();
    renderer.setPixelRatio(window.devicePixelRatio);

    // this.pixels.addPixel(
    //   this.createPixel(),
    //   (p, timestamp) =>
    //     p.material.color.setRGB(0.5 + 0.5 * Math.sin(timestamp / 1000.0), 0, 0),
    //   scene
    // );

    // this.pixels.addPixel(
    //   this.createPixel(30, 50, 0),
    //   (p, timestamp) =>
    //     p.material.color.setRGB(0, 0.5 + 0.5 * Math.sin(timestamp / 1000.0), 0),
    //   scene
    // );

    //TODO: use maxX and minX instead
    const bbox = new THREE.Box3().setFromObject(group, true);
    const totalX = 1000; //bbox.max.x;
    const totalY = 1000; //bbox.max.y;

    // const spatialRainbow = (p, timestamp) => {
    //   // console.log(p.position, p.position.x, totalX, totalY);
    //   p.material.color.setHSL(
    //     0.5 +
    //       0.5 *
    //         Math.sin(
    //           timestamp / 5000.0 + p.position.x / totalX + p.position.y / totalY
    //         ),
    //     0.5,
    //     0.5
    //   );
    // };

    // this.pixels.addPixel(this.createPixel(60, 50, 0), spatialRainbow, scene);
    // this.pixels.addPixel(this.createPixel(90, 50, 0), spatialRainbow, scene);
    // this.pixels.addPixel(this.createPixel(120, 50, 0), spatialRainbow, scene);
    // this.pixels.addPixel(this.createPixel(60, 80, 0), spatialRainbow, scene);
    // this.pixels.addPixel(this.createPixel(90, 80, 0), spatialRainbow, scene);
    // this.pixels.addPixel(this.createPixel(120, 80, 0), spatialRainbow, scene);
    // this.pixels.addPixel(this.createPixel(60, 110, 0), spatialRainbow, scene);
    // this.pixels.addPixel(this.createPixel(90, 110, 0), spatialRainbow, scene);
    // this.pixels.addPixel(this.createPixel(120, 110, 0), spatialRainbow, scene);

    //TODO: make this dynamic
    const fieldMinX = 0;
    const fieldMaxX = 22000;
    const fieldMinY = 0;
    const fieldMaxY = 10000;
    var logged = 0;

    const tmpVector = new THREE.Vector3();
    const spatialRainbow = (p, timestamp) => {
      const t = timestamp / 10000.0;

      //TODO: make this dynamic
      const tentMinX = 0;
      const tentMaxX = 120;
      const tentMinY = 0;
      const tentMaxY = 120;

      const tentWeight = 1;

      // p.getWorldPosition(tmpVector);
      const tentX = (p.position.x - tentMinX) / (tentMaxX - tentMinX);
      const tentY = (p.position.y - tentMinY) / (tentMaxY - tentMinY);

      p.getWorldPosition(tmpVector);
      const fieldX = (tmpVector.x - fieldMinX) / (fieldMaxX - fieldMinX);
      const fieldY = (tmpVector.y - fieldMinY) / (fieldMaxY - fieldMinY);

      if (logged < 100) {
        console.log(logged);
        console.log(timestamp, t);
        console.log(p.position.x, p.position.y, tmpVector.x, tmpVector.y);
        console.log(p.position.x, tentMinX, tentMaxX);
        console.log(tmpVector.x, fieldMinX, fieldMaxX);
        console.log(tentX, tentY, fieldX, fieldY);
        logged = logged + 1;
      }
      p.material.color.setHSL(
        0.5 +
          0.5 *
            Math.sin(
              2 *
                Math.PI *
                (t +
                  (fieldX +
                    2 * fieldY +
                    2 * tentWeight * tentX +
                    tentWeight * tentY) /
                    (3 + 3 * tentWeight) /
                    2)
            ),
        0.5,
        0.5
      );
    };

    this.createAndAddTent(0, 0, spatialRainbow, scene);
    this.createAndAddTent(300, 100, spatialRainbow, scene);
    this.createAndAddTent(0, 200, spatialRainbow, scene);
    this.createAndAddTent(500, 0, spatialRainbow, scene);
    this.createAndAddTent(200, 600, spatialRainbow, scene);

    for (let i = 0; i < 1000; i++) {
      const tentX = Math.random() * fieldMaxX;
      const tentY = Math.random() * fieldMaxY;

      this.createAndAddTent(tentX, tentY, spatialRainbow, scene);
    }

    for (let i = 0; i < 1000; i++) {
      const pointX = Math.random() * fieldMaxX;
      const pointY = Math.random() * fieldMaxY;

      this.createAndAddSingle(pointX, pointY, spatialRainbow, scene);
    }

    //ground plane
    const planeGeometry = new THREE.PlaneGeometry(100000, 100000);
    const PlaneMaterial = new THREE.MeshBasicMaterial({
      color: 0x008800,
      side: THREE.DoubleSide,
    });
    const plane = new THREE.Mesh(planeGeometry, PlaneMaterial);
    plane.translateZ(-20);
    scene.add(plane);

    // const axesHelper = new THREE.AxesHelper(500);
    // group.add(axesHelper);

    // const box = new THREE.BoxHelper(mesh, 0xffff00);
    // group.add(box);

    const camera = new THREE.PerspectiveCamera(
      75,
      1, //start with 1 aspect-ratio as this will be resized dynamically in the animation loop
      0.1,
      100000
    );

    //TODO: zoom out by default

    camera.up.set(0, 0, 1);
    // camera.position.x = fieldMaxX / 2;
    // camera.position.y = fieldMaxY / 2;
    camera.position.z = 5000;
    // camera.translateX(-750);
    // camera.translateY(-150);
    // console.log(bbMin.x - bbc.x, bbMin.y - bbc.y);
    // camera.translateY(bbMin.y - bbc.y);
    // camera.translateX(bbMin.x - bbc.x);

    const controls = new OrbitControls(camera, renderer.domElement);
    // controls.target = new THREE.Vector3(fieldMaxX / 2, fieldMaxY / 2, 0);
    controls.target = new THREE.Vector3(fieldMaxX / 4, fieldMaxY / 4, 0);
    // controls.autoRotate = true;
    camera.lookAt(fieldMaxX / 2, fieldMaxY / 2, 0);

    function animate(timestamp) {
      resizeCanvasToDisplaySize(renderer, camera);
      this.pixels.updateAll(timestamp);

      requestAnimationFrame(animate);

      controls.update();

      renderer.render(scene, camera);
    }

    animate = animate.bind(this);

    animate();
    return renderer.domElement;
  }

  createPixel(d = 15, x = 0, y = 0, z = 0) {
    const geometry = new THREE.SphereGeometry(d, 32, 16);
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.translateX(x);
    sphere.translateY(y);
    sphere.translateZ(z);
    return sphere;
  }
  createAndAddTent(x, y, updateFunc, scene) {
    const group = new THREE.Group();
    group.translateX(x);
    group.translateY(y);
    scene.add(group);

    //pixel size
    const s = 7;
    this.pixels.addPixel(this.createPixel(s, 0, 0, 0), updateFunc, group);
    this.pixels.addPixel(this.createPixel(s, 10, 10, 17), updateFunc, group);
    this.pixels.addPixel(this.createPixel(s, 20, 20, 30), updateFunc, group);
    this.pixels.addPixel(this.createPixel(s, 30, 30, 43), updateFunc, group);
    this.pixels.addPixel(this.createPixel(s, 40, 40, 50), updateFunc, group);
    this.pixels.addPixel(this.createPixel(s, 50, 50, 57), updateFunc, group);
    this.pixels.addPixel(this.createPixel(s, 60, 60, 60), updateFunc, group);
    this.pixels.addPixel(this.createPixel(s, 70, 70, 57), updateFunc, group);
    this.pixels.addPixel(this.createPixel(s, 80, 80, 50), updateFunc, group);
    this.pixels.addPixel(this.createPixel(s, 90, 90, 43), updateFunc, group);
    this.pixels.addPixel(this.createPixel(s, 100, 100, 30), updateFunc, group);
    this.pixels.addPixel(this.createPixel(s, 110, 110, 17), updateFunc, group);
    this.pixels.addPixel(this.createPixel(s, 120, 120, 0), updateFunc, group);

    this.pixels.addPixel(this.createPixel(s, 120, 0, 0), updateFunc, group);
    this.pixels.addPixel(this.createPixel(s, 110, 10, 17), updateFunc, group);
    this.pixels.addPixel(this.createPixel(s, 100, 20, 30), updateFunc, group);
    this.pixels.addPixel(this.createPixel(s, 90, 30, 43), updateFunc, group);
    this.pixels.addPixel(this.createPixel(s, 80, 40, 50), updateFunc, group);
    this.pixels.addPixel(this.createPixel(s, 70, 50, 57), updateFunc, group);
    this.pixels.addPixel(this.createPixel(s, 50, 70, 57), updateFunc, group);
    this.pixels.addPixel(this.createPixel(s, 40, 80, 50), updateFunc, group);
    this.pixels.addPixel(this.createPixel(s, 30, 90, 43), updateFunc, group);
    this.pixels.addPixel(this.createPixel(s, 20, 100, 30), updateFunc, group);
    this.pixels.addPixel(this.createPixel(s, 10, 110, 17), updateFunc, group);
    this.pixels.addPixel(this.createPixel(s, 0, 120, 0), updateFunc, group);
    group.translateX(-60);
    group.translateY(-60);
  }

  createAndAddSingle(x, y, updateFunc, scene) {
    const group = new THREE.Group();
    group.translateX(x);
    group.translateY(y);
    scene.add(group);

    this.pixels.addPixel(this.createPixel(15, 60, 60, 0), updateFunc, group);
    group.translateX(-60);
    group.translateY(-60);
  }
}

customElements.define("three-render", ThreeRender);

class PixelList {
  constructor(scene) {
    this.pixels = [];
  }

  addPixel(shape, updateFunc, scene) {
    scene.add(shape);
    this.pixels.push([shape, updateFunc]);
  }

  updateAll(timestamp) {
    this.pixels.forEach((p) => p[1](p[0], timestamp));
  }
}
