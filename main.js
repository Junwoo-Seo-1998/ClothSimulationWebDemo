import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Sky } from "three/addons/objects/Sky.js";
import { Timer } from "three/addons/misc/Timer.js";

const renderer = new THREE.WebGLRenderer({ antialias: true });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
const camControls = new OrbitControls(camera, renderer.domElement);
const timer = new Timer();
let pickingControls;
let numSubsteps = 10;
let mainObj;

let sky, sun;

let play = false;

function onPlayStop() {
  play = !play;
  if (play) document.getElementById("play").innerText = "Stop";
  else document.getElementById("play").innerText = "Play";
}

function onRestart() {
  location.reload();
}

//helper class for vector math
class Vector3 {
  constructor(verts, ith) {
    this.verts = verts;
    this.start = ith * 3;
  }
  getIndex() {
    return this.start / 3;
  }
  getX() {
    return this.verts[this.start];
  }
  getY() {
    return this.verts[this.start + 1];
  }
  getZ() {
    return this.verts[this.start + 2];
  }
  setX(val) {
    this.verts[this.start] = val;
  }
  setY(val) {
    this.verts[this.start + 1] = val;
  }
  setZ(val) {
    this.verts[this.start + 2] = val;
  }

  set(vec) {
    this.verts[this.start] = vec.verts[vec.start];
    this.verts[this.start + 1] = vec.verts[vec.start + 1];
    this.verts[this.start + 2] = vec.verts[vec.start + 2];
  }

  add(vec) {
    let result = [0, 0, 0];
    result[0] = this.verts[this.start] + vec.verts[vec.start];
    result[1] = this.verts[this.start + 1] + vec.verts[vec.start + 1];
    result[2] = this.verts[this.start + 2] + vec.verts[vec.start + 2];
    return new Vector3(result, 0);
  }

  sub(vec) {
    let result = [0, 0, 0];
    result[0] = this.verts[this.start] - vec.verts[vec.start];
    result[1] = this.verts[this.start + 1] - vec.verts[vec.start + 1];
    result[2] = this.verts[this.start + 2] - vec.verts[vec.start + 2];
    return new Vector3(result, 0);
  }

  mul(val) {
    let result = [0, 0, 0];
    result[0] = this.verts[this.start] * val;
    result[1] = this.verts[this.start + 1] * val;
    result[2] = this.verts[this.start + 2] * val;
    return new Vector3(result, 0);
  }

  addSet(vec) {
    this.verts[this.start] += vec.verts[vec.start];
    this.verts[this.start + 1] += vec.verts[vec.start + 1];
    this.verts[this.start + 2] += vec.verts[vec.start + 2];
  }

  subSet(vec) {
    this.verts[this.start] -= vec.verts[vec.start];
    this.verts[this.start + 1] -= vec.verts[vec.start + 1];
    this.verts[this.start + 2] -= vec.verts[vec.start + 2];
  }

  mulSet(val) {
    this.verts[this.start] *= val;
    this.verts[this.start + 1] *= val;
    this.verts[this.start + 2] *= val;
  }

  dot(vec) {
    return (
      this.verts[this.start] * vec.verts[vec.start] +
      this.verts[this.start + 1] * vec.verts[vec.start + 1] +
      this.verts[this.start + 2] * vec.verts[vec.start + 2]
    );
  }

  cross(vec) {
    let result = [0, 0, 0];
    result[0] =
      this.verts[this.start + 1] * vec.verts[vec.start + 2] -
      this.verts[this.start + 2] * vec.verts[vec.start + 1];
    result[1] =
      this.verts[this.start + 2] * vec.verts[vec.start] -
      this.verts[this.start] * vec.verts[vec.start + 2];
    result[2] =
      this.verts[this.start] * vec.verts[vec.start + 1] -
      this.verts[this.start + 1] * vec.verts[vec.start];
    return new Vector3(result, 0);
  }

  squareLen() {
    return (
      this.verts[this.start] * this.verts[this.start] +
      this.verts[this.start + 1] * this.verts[this.start + 1] +
      this.verts[this.start + 2] * this.verts[this.start + 2]
    );
  }

  len() {
    return Math.sqrt(
      this.verts[this.start] * this.verts[this.start] +
        this.verts[this.start + 1] * this.verts[this.start + 1] +
        this.verts[this.start + 2] * this.verts[this.start + 2]
    );
  }
}

//for event
function onMouseDown(event) {
  event.preventDefault();
  pickingControls.onMouseDown(event);
}

function onMouseMove(event) {
  event.preventDefault();
  pickingControls.onMouseMove(event);
}
function onMouseUp(event) {
  event.preventDefault();
  pickingControls.onMouseUp(event);
}

class PickingControls {
  constructor() {
    this.raycaster = new THREE.Raycaster();
    this.raycaster.layers.set(1);
    this.raycaster.params.Line.threshold = 0.1;
    this.isMouseDown = false;
    this.selectedObject = null;
    this.distance = 0.0;
    this.mousePos = new THREE.Vector2();
    this.prevPos = new THREE.Vector2();
    this.grabedPosition = null;
    this.grabedMass = 0.0;
  }
  onMouseDown(event) {
    if (event.button != 0) return;
    this.isMouseDown = true;

    this.updateRaycaster(event.clientX, event.clientY);
    const intersects = this.raycaster.intersectObjects(scene.children);

    if (intersects.length < 1) return;

    let body = intersects[0].object.userData;
    if (!body) return;

    if (!play) onPlayStop();

    this.selectedObject = body;
    this.distance = intersects[0].distance;
    let pos = this.raycaster.ray.origin.clone();
    pos.addScaledVector(this.raycaster.ray.direction, this.distance);
    this.prevPos = pos;
    this.grabedPosition = this.selectedObject.getNearestPointReference(
      pos.x,
      pos.y,
      pos.z
    );
    this.grabedMass =
      this.selectedObject.invMass[this.grabedPosition.getIndex()];
    this.selectedObject.invMass[this.grabedPosition.getIndex()] = 0.0;

    camControls.enabled = false;
  }

  onMouseMove(event) {
    if (!this.isMouseDown) return;
    if (!this.selectedObject) return;

    this.updateRaycaster(event.clientX, event.clientY);
    let pos = this.raycaster.ray.origin.clone();
    pos.addScaledVector(this.raycaster.ray.direction, this.distance);

    this.grabedPosition.set(new Vector3([pos.x, pos.y, pos.z], 0));
  }

  onMouseUp(event) {
    if (event.button != 0) return;
    this.isMouseDown = false;
    if (this.selectedObject) {
      camControls.enabled = true;

      this.selectedObject.invMass[this.grabedPosition.getIndex()] =
        this.grabedMass;
      this.grabedMass = 0.0;
      this.selectedObject = null;
    }
  }

  updateRaycaster(x, y) {
    //https://threejs.org/docs/#api/en/core/Raycaster
    let rect = renderer.domElement.getBoundingClientRect();
    this.mousePos.x = ((x - rect.left) / window.innerWidth) * 2 - 1;
    this.mousePos.y = -((y - rect.top) / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.mousePos, camera);
  }
}

const gravity = new Vector3([0, -10, 0], 0);

class Cloths {
  constructor(scene, clothsMesh) {
    this.numParticles = clothsMesh.vertices.length / 3;
    this.pos = new Float32Array(clothsMesh.vertices);
    this.prevPos = new Float32Array(clothsMesh.vertices);
    this.restPos = new Float32Array(clothsMesh.vertices);

    this.vel = new Float32Array(3 * this.numParticles);
    this.invMass = new Float32Array(this.numParticles);

    //contains global edge index of neighbor
    let neighbors = this.getNeighbors(clothsMesh.faceTriIds);
    let numTris = clothsMesh.faceTriIds.length / 3;
    let edgeIds = [];
    let triPairIds = [];

    for (let i = 0; i < numTris; i++) {
      for (let j = 0; j < 3; j++) {
        let id0 = clothsMesh.faceTriIds[3 * i + j];
        let id1 = clothsMesh.faceTriIds[3 * i + ((j + 1) % 3)];

        // each edge create distance constrains
        let n = neighbors[3 * i + j];
        //n=-1 means dosen't have neighbor
        //if there is duplicated edge one will be id0<id1 and the other one will be id1<id0
        if (n < 0 || id0 < id1) {
          edgeIds.push(id0);
          edgeIds.push(id1);
        }

        // each tri pair create vending constrains (since the pair has neighbor)
        if (n >= 0) {
          // opposite ids
          let ni = Math.floor(n / 3);
          let nj = n % 3;
          //left
          let id2 = clothsMesh.faceTriIds[3 * i + ((j + 2) % 3)];
          //right
          let id3 = clothsMesh.faceTriIds[3 * ni + ((nj + 2) % 3)];
          triPairIds.push(id0);
          triPairIds.push(id1);
          triPairIds.push(id2);
          triPairIds.push(id3);
        }
      }
    }

    this.stretchingIds = new Int32Array(edgeIds);
    this.bendingIds = new Int32Array(triPairIds);
    this.stretchingLengths = new Float32Array(this.stretchingIds.length / 2);
    this.bendingLengths = new Float32Array(this.bendingIds.length / 4);

    this.stretchingCompliance = 0.0;
    this.bendingCompliance = 1.0;

    this.initPhysics(clothsMesh.faceTriIds);

    let geometry = new THREE.BufferGeometry();
    let buffer = new THREE.BufferAttribute(this.pos, 3);
    buffer.setUsage(THREE.StreamDrawUsage);
    geometry.setAttribute("position", buffer);
    geometry.setIndex(clothsMesh.faceTriIds);
    let material = new THREE.MeshPhysicalMaterial({
      color: 0xfbf1d7,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.geometry.computeVertexNormals();

    //for laycast
    this.mesh.userData = this;
    this.mesh.layers.enable(1);
    scene.add(this.mesh);

    this.centerPos = this.hangToAir();

    //just to give wave on start.
    this.vel[50 * 3 + 0] += 1;
    this.vel[50 * 3 + 1] += 1;
    this.vel[50 * 3 + 2] += 1;
  }

  hangToAir() {
    let minX = Number.MAX_VALUE;
    let maxX = -Number.MAX_VALUE;
    let minY = Number.MAX_VALUE;
    let maxY = -Number.MAX_VALUE;

    for (let i = 0; i < this.numParticles; i++) {
      minX = Math.min(minX, this.pos[3 * i]);
      maxX = Math.max(maxX, this.pos[3 * i]);
      minY = Math.min(minY, this.pos[3 * i + 1]);
      maxY = Math.max(maxY, this.pos[3 * i + 1]);
    }
    let eps = 0.001;

    for (let i = 0; i < this.numParticles; i++) {
      let x = this.pos[3 * i];
      let y = this.pos[3 * i + 1];
      if (y > maxY - eps && (x < minX + eps || x > maxX - eps))
        this.invMass[i] = 0.0;
    }

    return new THREE.Vector3((minX + maxX) * 0.5, (minY + maxY) * 0.5, 0.0);
  }

  getNeighbors(triIds) {
    let edges = [];
    let numTris = triIds.length / 3;

    for (let i = 0; i < numTris; i++) {
      for (let j = 0; j < 3; j++) {
        let id0 = triIds[3 * i + j];
        let id1 = triIds[3 * i + ((j + 1) % 3)];
        edges.push({
          id0: Math.min(id0, id1),
          id1: Math.max(id0, id1),
          globalEdgeIndex: 3 * i + j,
        });
      }
    }
    edges.sort((a, b) =>
      a.id0 < b.id0 || (a.id0 == b.id0 && a.id1 < b.id1) ? -1 : 1
    );

    let neighbors = new Float32Array(3 * numTris);
    neighbors.fill(-1);

    for (let index = 0; index < edges.length; ) {
      let e0 = edges[index++];
      if (index < edges.length) {
        let e1 = edges[index++];
        if (e0.id0 == e1.id0 && e0.id1 == e1.id1) {
          neighbors[e0.globalEdgeIndex] = e1.globalEdgeIndex;
          neighbors[e1.globalEdgeIndex] = e0.globalEdgeIndex;
        }
      }
    }

    return neighbors;
  }
  getNearestPointReference(x, y, z) {
    let toCompare = new Vector3([x, y, z], 0);

    let PosFound = null;
    let minDistSquared = Number.MAX_VALUE;
    let minDistIndex = -1;
    for (let i = 0; i < this.numParticles; i++) {
      let pos = new Vector3(this.pos, i);
      let distSquared = toCompare.sub(pos).squareLen();
      if (distSquared < minDistSquared) {
        minDistSquared = distSquared;
        minDistIndex = i;
      }
    }
    if (minDistIndex >= 0) {
      PosFound = new Vector3(this.pos, minDistIndex);
    }
    return PosFound;
  }

  initPhysics(triIds) {
    let numTris = triIds.length / 3;

    //compute inv mass for each points
    for (let i = 0; i < numTris; i++) {
      let a = new Vector3(this.pos, triIds[i * 3]);
      let b = new Vector3(this.pos, triIds[i * 3 + 1]);
      let c = new Vector3(this.pos, triIds[i * 3 + 2]);

      let ab = b.sub(a);
      let ac = c.sub(a);

      let cross = ab.cross(ac);
      let area = cross.len() * 0.5;
      let pInvMass = area > 0.0 ? 1.0 / area / 3.0 : 0.0;
      this.invMass[triIds[i * 3]] += pInvMass;
      this.invMass[triIds[i * 3 + 1]] += pInvMass;
      this.invMass[triIds[i * 3 + 2]] += pInvMass;
    }

    //compute init len of edges
    for (let i = 0; i < this.stretchingLengths.length; i++) {
      let leftPos = new Vector3(this.pos, this.stretchingIds[2 * i]);
      let rightPos = new Vector3(this.pos, this.stretchingIds[2 * i + 1]);
      this.stretchingLengths[i] = rightPos.sub(leftPos).len();
    }

    //compute init len of bending distance
    for (let i = 0; i < this.bendingLengths.length; i++) {
      let leftEnd = new Vector3(this.pos, this.bendingIds[4 * i + 2]);
      let rightEnd = new Vector3(this.pos, this.bendingIds[4 * i + 3]);
      this.bendingLengths[i] = rightEnd.sub(leftEnd).len();
    }
  }

  solveEdges(dt) {
    let alphadtSquared = this.stretchingCompliance / (dt * dt);

    for (let i = 0; i < this.stretchingLengths.length; i++) {
      let wL = this.invMass[this.stretchingIds[2 * i]];
      let wR = this.invMass[this.stretchingIds[2 * i + 1]];
      let w = wL + wR;
      if (w == 0.0) continue;

      let leftPos = new Vector3(this.pos, this.stretchingIds[2 * i]);
      let rightPos = new Vector3(this.pos, this.stretchingIds[2 * i + 1]);
      let currentLen = rightPos.sub(leftPos).len();

      if (currentLen == 0.0) continue;

      let errorOfConstrain = currentLen - this.stretchingLengths[i];

      let grad = leftPos.sub(rightPos);
      let gradLeft = grad.mul(1.0 / currentLen);
      let gradRight = grad.mul(-1.0 / currentLen);

      let denominator = w + alphadtSquared;
      let lambda = -errorOfConstrain / denominator;
      let delPosLeft = gradLeft.mul(lambda * wL);
      let delPosRight = gradRight.mul(lambda * wR);

      leftPos.addSet(delPosLeft);
      rightPos.addSet(delPosRight);
    }
  }

  solveBending(dt) {
    let alphadtSquared = this.bendingCompliance / (dt * dt);
    for (let i = 0; i < this.bendingLengths.length; i++) {
      let wL = this.invMass[this.bendingIds[4 * i + 2]];
      let wR = this.invMass[this.bendingIds[4 * i + 3]];
      let w = wL + wR;
      if (w == 0.0) continue;

      let leftPos = new Vector3(this.pos, this.bendingIds[4 * i + 2]);
      let rightPos = new Vector3(this.pos, this.bendingIds[4 * i + 3]);
      let currentLen = rightPos.sub(leftPos).len();

      if (currentLen == 0.0) continue;

      let errorOfConstrain = currentLen - this.bendingLengths[i];

      let grad = leftPos.sub(rightPos);
      let gradLeft = grad.mul(1.0 / currentLen);
      let gradRight = grad.mul(-1.0 / currentLen);

      let denominator = w + alphadtSquared;
      let lambda = -errorOfConstrain / denominator;
      let delPosLeft = gradLeft.mul(lambda * wL);
      let delPosRight = gradRight.mul(lambda * wR);

      leftPos.addSet(delPosLeft);
      rightPos.addSet(delPosRight);
    }
  }

  solve(dt) {
    for (let i = 0; i < this.numParticles; i++) {
      if (this.invMass[i] == 0.0) continue;
      let vel = new Vector3(this.vel, i);
      let prevPos = new Vector3(this.prevPos, i);
      let currentPos = new Vector3(this.pos, i);

      //vel+=grav*dt
      vel.addSet(gravity.mul(dt));
      //prev=pos
      prevPos.set(currentPos);
      //pos+=vel*dt
      currentPos.addSet(vel.mul(dt));

      //ground
      let y = currentPos.getY();
      if (y < 0.0) {
        currentPos.set(prevPos);
        currentPos.setY(0.0);
      }
    }

    //solve constrains
    this.solveEdges(dt);
    this.solveBending(dt);

    //update vel
    for (let i = 0; i < this.numParticles; i++) {
      if (this.invMass[i] == 0.0) continue;
      let vel = new Vector3(this.vel, i);
      let prevPos = new Vector3(this.prevPos, i);
      let currentPos = new Vector3(this.pos, i);
      let diff = currentPos.sub(prevPos);
      vel.set(diff.mul(1.0 / dt));
    }

    this.mesh.geometry.computeVertexNormals();
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.computeBoundingSphere();
  }
}

function awake() {
  window.addEventListener("resize", onWindowResize, false);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.5;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderWindow.appendChild(renderer.domElement);
  pickingControls = new PickingControls();
  renderWindow.addEventListener("pointerdown", onMouseDown, false);
  renderWindow.addEventListener("pointermove", onMouseMove, false);
  renderWindow.addEventListener("pointerup", onMouseUp, false);

  document.getElementById("play").addEventListener("click", onPlayStop);
  document.getElementById("restart").addEventListener("click", onRestart);
}

function start() {
  const effectController = {
    turbidity: 0.1,
    rayleigh: 1,
    mieCoefficient: 0.005,
    mieDirectionalG: 0.7,
    elevation: 20,
    azimuth: 135,
    exposure: renderer.toneMappingExposure,
  };

  // Add Sky
  sky = new Sky();
  sky.scale.setScalar(4000);
  scene.add(sky);
  sun = new THREE.Vector3();

  const uniforms = sky.material.uniforms;
  uniforms["turbidity"].value = effectController.turbidity;
  uniforms["rayleigh"].value = effectController.rayleigh;
  const phi = THREE.MathUtils.degToRad(90 - effectController.elevation);
  const theta = THREE.MathUtils.degToRad(effectController.azimuth);
  sun.setFromSphericalCoords(1, phi, theta);
  uniforms["sunPosition"].value.copy(sun);
  renderer.toneMappingExposure = effectController.exposure;

  // Lights
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 2);
  //hemiLight.color.setHSL( 0.6, 1, 0.6 );
  //hemiLight.groundColor.setHSL( 0.095, 1, 0.75 );
  hemiLight.position.set(0, 50, 0);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 3);
  //dirLight.color.setHSL(0.1, 1, 0.95);
  dirLight.position.setFromSphericalCoords(5, phi, theta);
  dirLight.position.multiplyScalar(30);
  scene.add(dirLight);

  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;

  // GROUND
  const groundGeo = new THREE.PlaneGeometry(100, 100);
  const groundMat = new THREE.MeshLambertMaterial({ color: 0xe1aa72 });
  //groundMat.color.setHSL( 0.095, 1, 0.75 );

  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.position.y = -0.0001;
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  let body = new Cloths(scene, clothMesh);
  mainObj = body;

  camera.position.z = -1;
  camera.position.y = 1;
  camera.position.x = 0;
  //camera.lookAt(body.centerPos);
  camControls.target = body.centerPos;
  camControls.update();
}

function Update(dt) {
  if (!play) return;
  let sdt = dt / numSubsteps;
  for (let step = 0; step < numSubsteps; step++) {
    mainObj.solve(sdt);
  }
}

function UpdateLoop(timestamp) {
  requestAnimationFrame(UpdateLoop);
  timer.update(timestamp);
  camControls.update();
  Update(1.0 / 60.0);
  renderer.render(scene, camera);
}

function main() {
  awake();
  start();
  UpdateLoop();
}
let clothMesh = {
  name: "cloth",
  vertices: [
    -0.2, 1.145859, -0.0, -0.2, 1.105859, -0.0, -0.2, 1.065859, -0.0, -0.2,
    1.025859, -0.0, -0.2, 0.985859, -0.0, -0.2, 0.945859, -0.0, -0.2, 0.905859,
    -0.0, -0.2, 0.865859, -0.0, -0.2, 0.825859, -0.0, -0.2, 0.785859, -0.0,
    -0.2, 0.745859, -0.0, -0.2, 0.705859, -0.0, -0.2, 0.665859, -0.0, -0.2,
    0.625859, -0.0, -0.2, 0.585859, -0.0, -0.2, 0.545859, -0.0, -0.2, 0.505859,
    -0.0, -0.2, 0.465859, -0.0, -0.2, 0.425859, -0.0, -0.2, 0.385859, -0.0,
    -0.2, 0.345859, -0.0, -0.16, 1.145859, -0.0, -0.16, 1.105859, -0.0, -0.16,
    1.065859, -0.0, -0.16, 1.025859, -0.0, -0.16, 0.985859, -0.0, -0.16,
    0.945859, -0.0, -0.16, 0.905859, -0.0, -0.16, 0.865859, -0.0, -0.16,
    0.825859, -0.0, -0.16, 0.785859, -0.0, -0.16, 0.745859, -0.0, -0.16,
    0.705859, -0.0, -0.16, 0.665859, -0.0, -0.16, 0.625859, -0.0, -0.16,
    0.585859, -0.0, -0.16, 0.545859, -0.0, -0.16, 0.505859, -0.0, -0.16,
    0.465859, -0.0, -0.16, 0.425859, -0.0, -0.16, 0.385859, -0.0, -0.16,
    0.345859, -0.0, -0.12, 1.145859, -0.0, -0.12, 1.105859, -0.0, -0.12,
    1.065859, -0.0, -0.12, 1.025859, -0.0, -0.12, 0.985859, -0.0, -0.12,
    0.945859, -0.0, -0.12, 0.905859, -0.0, -0.12, 0.865859, -0.0, -0.12,
    0.825859, -0.0, -0.12, 0.785859, -0.0, -0.12, 0.745859, -0.0, -0.12,
    0.705859, -0.0, -0.12, 0.665859, -0.0, -0.12, 0.625859, -0.0, -0.12,
    0.585859, -0.0, -0.12, 0.545859, -0.0, -0.12, 0.505859, -0.0, -0.12,
    0.465859, -0.0, -0.12, 0.425859, -0.0, -0.12, 0.385859, -0.0, -0.12,
    0.345859, -0.0, -0.08, 1.145859, -0.0, -0.08, 1.105859, -0.0, -0.08,
    1.065859, -0.0, -0.08, 1.025859, -0.0, -0.08, 0.985859, -0.0, -0.08,
    0.945859, -0.0, -0.08, 0.905859, -0.0, -0.08, 0.865859, -0.0, -0.08,
    0.825859, -0.0, -0.08, 0.785859, -0.0, -0.08, 0.745859, -0.0, -0.08,
    0.705859, -0.0, -0.08, 0.665859, -0.0, -0.08, 0.625859, -0.0, -0.08,
    0.585859, -0.0, -0.08, 0.545859, -0.0, -0.08, 0.505859, -0.0, -0.08,
    0.465859, -0.0, -0.08, 0.425859, -0.0, -0.08, 0.385859, -0.0, -0.08,
    0.345859, -0.0, -0.04, 1.145859, -0.0, -0.04, 1.105859, -0.0, -0.04,
    1.065859, -0.0, -0.04, 1.025859, -0.0, -0.04, 0.985859, -0.0, -0.04,
    0.945859, -0.0, -0.04, 0.905859, -0.0, -0.04, 0.865859, -0.0, -0.04,
    0.825859, -0.0, -0.04, 0.785859, -0.0, -0.04, 0.745859, -0.0, -0.04,
    0.705859, -0.0, -0.04, 0.665859, -0.0, -0.04, 0.625859, -0.0, -0.04,
    0.585859, -0.0, -0.04, 0.545859, -0.0, -0.04, 0.505859, -0.0, -0.04,
    0.465859, -0.0, -0.04, 0.425859, -0.0, -0.04, 0.385859, -0.0, -0.04,
    0.345859, -0.0, 0.0, 1.145859, -0.0, 0.0, 1.105859, -0.0, 0.0, 1.065859,
    -0.0, 0.0, 1.025859, -0.0, 0.0, 0.985859, -0.0, 0.0, 0.945859, -0.0, 0.0,
    0.905859, -0.0, 0.0, 0.865859, -0.0, 0.0, 0.825859, -0.0, 0.0, 0.785859,
    -0.0, 0.0, 0.745859, -0.0, 0.0, 0.705859, -0.0, -0.0, 0.665859, -0.0, 0.0,
    0.625859, -0.0, -0.0, 0.585859, -0.0, -0.0, 0.545859, -0.0, 0.0, 0.505859,
    -0.0, 0.0, 0.465859, -0.0, -0.0, 0.425859, -0.0, -0.0, 0.385859, -0.0, -0.0,
    0.345859, -0.0, 0.04, 1.145859, -0.0, 0.04, 1.105859, -0.0, 0.04, 1.065859,
    -0.0, 0.04, 1.025859, -0.0, 0.04, 0.985859, -0.0, 0.04, 0.945859, -0.0,
    0.04, 0.905859, -0.0, 0.04, 0.865859, -0.0, 0.04, 0.825859, -0.0, 0.04,
    0.785859, -0.0, 0.04, 0.745859, -0.0, 0.04, 0.705859, -0.0, 0.04, 0.665859,
    -0.0, 0.04, 0.625859, -0.0, 0.04, 0.585859, -0.0, 0.04, 0.545859, -0.0,
    0.04, 0.505859, -0.0, 0.04, 0.465859, -0.0, 0.04, 0.425859, -0.0, 0.04,
    0.385859, -0.0, 0.04, 0.345859, -0.0, 0.08, 1.145859, -0.0, 0.08, 1.105859,
    -0.0, 0.08, 1.065859, -0.0, 0.08, 1.025859, -0.0, 0.08, 0.985859, -0.0,
    0.08, 0.945859, -0.0, 0.08, 0.905859, -0.0, 0.08, 0.865859, -0.0, 0.08,
    0.825859, -0.0, 0.08, 0.785859, -0.0, 0.08, 0.745859, -0.0, 0.08, 0.705859,
    -0.0, 0.08, 0.665859, -0.0, 0.08, 0.625859, -0.0, 0.08, 0.585859, -0.0,
    0.08, 0.545859, -0.0, 0.08, 0.505859, -0.0, 0.08, 0.465859, -0.0, 0.08,
    0.425859, -0.0, 0.08, 0.385859, -0.0, 0.08, 0.345859, -0.0, 0.12, 1.145859,
    -0.0, 0.12, 1.105859, -0.0, 0.12, 1.065859, -0.0, 0.12, 1.025859, -0.0,
    0.12, 0.985859, -0.0, 0.12, 0.945859, -0.0, 0.12, 0.905859, -0.0, 0.12,
    0.865859, -0.0, 0.12, 0.825859, -0.0, 0.12, 0.785859, -0.0, 0.12, 0.745859,
    -0.0, 0.12, 0.705859, -0.0, 0.12, 0.665859, -0.0, 0.12, 0.625859, -0.0,
    0.12, 0.585859, -0.0, 0.12, 0.545859, -0.0, 0.12, 0.505859, -0.0, 0.12,
    0.465859, -0.0, 0.12, 0.425859, -0.0, 0.12, 0.385859, -0.0, 0.12, 0.345859,
    -0.0, 0.16, 1.145859, -0.0, 0.16, 1.105859, -0.0, 0.16, 1.065859, -0.0,
    0.16, 1.025859, -0.0, 0.16, 0.985859, -0.0, 0.16, 0.945859, -0.0, 0.16,
    0.905859, -0.0, 0.16, 0.865859, -0.0, 0.16, 0.825859, -0.0, 0.16, 0.785859,
    -0.0, 0.16, 0.745859, -0.0, 0.16, 0.705859, -0.0, 0.16, 0.665859, -0.0,
    0.16, 0.625859, -0.0, 0.16, 0.585859, -0.0, 0.16, 0.545859, -0.0, 0.16,
    0.505859, -0.0, 0.16, 0.465859, -0.0, 0.16, 0.425859, -0.0, 0.16, 0.385859,
    -0.0, 0.16, 0.345859, -0.0, 0.2, 1.145859, -0.0, 0.2, 1.105859, -0.0, 0.2,
    1.065859, -0.0, 0.2, 1.025859, -0.0, 0.2, 0.985859, -0.0, 0.2, 0.945859,
    -0.0, 0.2, 0.905859, -0.0, 0.2, 0.865859, -0.0, 0.2, 0.825859, -0.0, 0.2,
    0.785859, -0.0, 0.2, 0.745859, -0.0, 0.2, 0.705859, -0.0, 0.2, 0.665859,
    -0.0, 0.2, 0.625859, -0.0, 0.2, 0.585859, -0.0, 0.2, 0.545859, -0.0, 0.2,
    0.505859, -0.0, 0.2, 0.465859, -0.0, 0.2, 0.425859, -0.0, 0.2, 0.385859,
    -0.0, 0.2, 0.345859, -0.0, -0.18, 1.145859, -0.0, -0.2, 1.125859, -0.0,
    -0.18, 1.105859, -0.0, -0.16, 1.125859, -0.0, -0.2, 1.085859, -0.0, -0.18,
    1.065859, -0.0, -0.16, 1.085859, -0.0, -0.2, 1.045859, -0.0, -0.18,
    1.025859, -0.0, -0.16, 1.045859, -0.0, -0.2, 1.005859, -0.0, -0.18,
    0.985859, -0.0, -0.16, 1.005859, -0.0, -0.2, 0.965859, -0.0, -0.18,
    0.945859, -0.0, -0.16, 0.965859, -0.0, -0.2, 0.925859, -0.0, -0.18,
    0.905859, -0.0, -0.16, 0.925859, -0.0, -0.2, 0.885859, -0.0, -0.18,
    0.865859, -0.0, -0.16, 0.885859, -0.0, -0.2, 0.845859, -0.0, -0.18,
    0.825859, -0.0, -0.16, 0.845859, -0.0, -0.2, 0.805859, -0.0, -0.18,
    0.785859, -0.0, -0.16, 0.805859, -0.0, -0.2, 0.765859, -0.0, -0.18,
    0.745859, -0.0, -0.16, 0.765859, -0.0, -0.2, 0.725859, -0.0, -0.18,
    0.705859, -0.0, -0.16, 0.725859, -0.0, -0.2, 0.685859, -0.0, -0.18,
    0.665859, -0.0, -0.16, 0.685859, -0.0, -0.2, 0.645859, -0.0, -0.18,
    0.625859, -0.0, -0.16, 0.645859, -0.0, -0.2, 0.605859, -0.0, -0.18,
    0.585859, -0.0, -0.16, 0.605859, -0.0, -0.2, 0.565859, -0.0, -0.18,
    0.545859, -0.0, -0.16, 0.565859, -0.0, -0.2, 0.525859, -0.0, -0.18,
    0.505859, -0.0, -0.16, 0.525859, -0.0, -0.2, 0.485859, -0.0, -0.18,
    0.465859, -0.0, -0.16, 0.485859, -0.0, -0.2, 0.445859, -0.0, -0.18,
    0.425859, -0.0, -0.16, 0.445859, -0.0, -0.2, 0.405859, -0.0, -0.18,
    0.385859, -0.0, -0.16, 0.405859, -0.0, -0.2, 0.365859, -0.0, -0.18,
    0.345859, -0.0, -0.16, 0.365859, -0.0, -0.14, 1.145859, -0.0, -0.14,
    1.105859, -0.0, -0.12, 1.125859, -0.0, -0.14, 1.065859, -0.0, -0.12,
    1.085859, -0.0, -0.14, 1.025859, -0.0, -0.12, 1.045859, -0.0, -0.14,
    0.985859, -0.0, -0.12, 1.005859, -0.0, -0.14, 0.945859, -0.0, -0.12,
    0.965859, -0.0, -0.14, 0.905859, -0.0, -0.12, 0.925859, -0.0, -0.14,
    0.865859, -0.0, -0.12, 0.885859, -0.0, -0.14, 0.825859, -0.0, -0.12,
    0.845859, -0.0, -0.14, 0.785859, -0.0, -0.12, 0.805859, -0.0, -0.14,
    0.745859, -0.0, -0.12, 0.765859, -0.0, -0.14, 0.705859, -0.0, -0.12,
    0.725859, -0.0, -0.14, 0.665859, -0.0, -0.12, 0.685859, -0.0, -0.14,
    0.625859, -0.0, -0.12, 0.645859, -0.0, -0.14, 0.585859, -0.0, -0.12,
    0.605859, -0.0, -0.14, 0.545859, -0.0, -0.12, 0.565859, -0.0, -0.14,
    0.505859, -0.0, -0.12, 0.525859, -0.0, -0.14, 0.465859, -0.0, -0.12,
    0.485859, -0.0, -0.14, 0.425859, -0.0, -0.12, 0.445859, -0.0, -0.14,
    0.385859, -0.0, -0.12, 0.405859, -0.0, -0.14, 0.345859, -0.0, -0.12,
    0.365859, -0.0, -0.1, 1.145859, -0.0, -0.1, 1.105859, -0.0, -0.08, 1.125859,
    -0.0, -0.1, 1.065859, -0.0, -0.08, 1.085859, -0.0, -0.1, 1.025859, -0.0,
    -0.08, 1.045859, -0.0, -0.1, 0.985859, -0.0, -0.08, 1.005859, -0.0, -0.1,
    0.945859, -0.0, -0.08, 0.965859, -0.0, -0.1, 0.905859, -0.0, -0.08,
    0.925859, -0.0, -0.1, 0.865859, -0.0, -0.08, 0.885859, -0.0, -0.1, 0.825859,
    -0.0, -0.08, 0.845859, -0.0, -0.1, 0.785859, -0.0, -0.08, 0.805859, -0.0,
    -0.1, 0.745859, -0.0, -0.08, 0.765859, -0.0, -0.1, 0.705859, -0.0, -0.08,
    0.725859, -0.0, -0.1, 0.665859, -0.0, -0.08, 0.685859, -0.0, -0.1, 0.625859,
    -0.0, -0.08, 0.645859, -0.0, -0.1, 0.585859, -0.0, -0.08, 0.605859, -0.0,
    -0.1, 0.545859, -0.0, -0.08, 0.565859, -0.0, -0.1, 0.505859, -0.0, -0.08,
    0.525859, -0.0, -0.1, 0.465859, -0.0, -0.08, 0.485859, -0.0, -0.1, 0.425859,
    -0.0, -0.08, 0.445859, -0.0, -0.1, 0.385859, -0.0, -0.08, 0.405859, -0.0,
    -0.1, 0.345859, -0.0, -0.08, 0.365859, -0.0, -0.06, 1.145859, -0.0, -0.06,
    1.105859, -0.0, -0.04, 1.125859, -0.0, -0.06, 1.065859, -0.0, -0.04,
    1.085859, -0.0, -0.06, 1.025859, -0.0, -0.04, 1.045859, -0.0, -0.06,
    0.985859, -0.0, -0.04, 1.005859, -0.0, -0.06, 0.945859, -0.0, -0.04,
    0.965859, -0.0, -0.06, 0.905859, -0.0, -0.04, 0.925859, -0.0, -0.06,
    0.865859, -0.0, -0.04, 0.885859, -0.0, -0.06, 0.825859, -0.0, -0.04,
    0.845859, -0.0, -0.06, 0.785859, -0.0, -0.04, 0.805859, -0.0, -0.06,
    0.745859, -0.0, -0.04, 0.765859, -0.0, -0.06, 0.705859, -0.0, -0.04,
    0.725859, -0.0, -0.06, 0.665859, -0.0, -0.04, 0.685859, -0.0, -0.06,
    0.625859, -0.0, -0.04, 0.645859, -0.0, -0.06, 0.585859, -0.0, -0.04,
    0.605859, -0.0, -0.06, 0.545859, -0.0, -0.04, 0.565859, -0.0, -0.06,
    0.505859, -0.0, -0.04, 0.525859, -0.0, -0.06, 0.465859, -0.0, -0.04,
    0.485859, -0.0, -0.06, 0.425859, -0.0, -0.04, 0.445859, -0.0, -0.06,
    0.385859, -0.0, -0.04, 0.405859, -0.0, -0.06, 0.345859, -0.0, -0.04,
    0.365859, -0.0, -0.02, 1.145859, -0.0, -0.02, 1.105859, -0.0, 0.0, 1.125859,
    -0.0, -0.02, 1.065859, -0.0, 0.0, 1.085859, -0.0, -0.02, 1.025859, -0.0,
    0.0, 1.045859, -0.0, -0.02, 0.985859, -0.0, 0.0, 1.005859, -0.0, -0.02,
    0.945859, -0.0, 0.0, 0.965859, -0.0, -0.02, 0.905859, -0.0, 0.0, 0.925859,
    -0.0, -0.02, 0.865859, -0.0, 0.0, 0.885859, -0.0, -0.02, 0.825859, -0.0,
    0.0, 0.845859, -0.0, -0.02, 0.785859, -0.0, 0.0, 0.805859, -0.0, -0.02,
    0.745859, -0.0, 0.0, 0.765859, -0.0, -0.02, 0.705859, -0.0, 0.0, 0.725859,
    -0.0, -0.02, 0.665859, -0.0, -0.0, 0.685859, -0.0, -0.02, 0.625859, -0.0,
    -0.0, 0.645859, -0.0, -0.02, 0.585859, -0.0, -0.0, 0.605859, -0.0, -0.02,
    0.545859, -0.0, -0.0, 0.565859, -0.0, -0.02, 0.505859, -0.0, -0.0, 0.525859,
    -0.0, -0.02, 0.465859, -0.0, 0.0, 0.485859, -0.0, -0.02, 0.425859, -0.0,
    -0.0, 0.445859, -0.0, -0.02, 0.385859, -0.0, -0.0, 0.405859, -0.0, -0.02,
    0.345859, -0.0, -0.0, 0.365859, -0.0, 0.02, 1.145859, -0.0, 0.02, 1.105859,
    -0.0, 0.04, 1.125859, -0.0, 0.02, 1.065859, -0.0, 0.04, 1.085859, -0.0,
    0.02, 1.025859, -0.0, 0.04, 1.045859, -0.0, 0.02, 0.985859, -0.0, 0.04,
    1.005859, -0.0, 0.02, 0.945859, -0.0, 0.04, 0.965859, -0.0, 0.02, 0.905859,
    -0.0, 0.04, 0.925859, -0.0, 0.02, 0.865859, -0.0, 0.04, 0.885859, -0.0,
    0.02, 0.825859, -0.0, 0.04, 0.845859, -0.0, 0.02, 0.785859, -0.0, 0.04,
    0.805859, -0.0, 0.02, 0.745859, -0.0, 0.04, 0.765859, -0.0, 0.02, 0.705859,
    -0.0, 0.04, 0.725859, -0.0, 0.02, 0.665859, -0.0, 0.04, 0.685859, -0.0,
    0.02, 0.625859, -0.0, 0.04, 0.645859, -0.0, 0.02, 0.585859, -0.0, 0.04,
    0.605859, -0.0, 0.02, 0.545859, -0.0, 0.04, 0.565859, -0.0, 0.02, 0.505859,
    -0.0, 0.04, 0.525859, -0.0, 0.02, 0.465859, -0.0, 0.04, 0.485859, -0.0,
    0.02, 0.425859, -0.0, 0.04, 0.445859, -0.0, 0.02, 0.385859, -0.0, 0.04,
    0.405859, -0.0, 0.02, 0.345859, -0.0, 0.04, 0.365859, -0.0, 0.06, 1.145859,
    -0.0, 0.06, 1.105859, -0.0, 0.08, 1.125859, -0.0, 0.06, 1.065859, -0.0,
    0.08, 1.085859, -0.0, 0.06, 1.025859, -0.0, 0.08, 1.045859, -0.0, 0.06,
    0.985859, -0.0, 0.08, 1.005859, -0.0, 0.06, 0.945859, -0.0, 0.08, 0.965859,
    -0.0, 0.06, 0.905859, -0.0, 0.08, 0.925859, -0.0, 0.06, 0.865859, -0.0,
    0.08, 0.885859, -0.0, 0.06, 0.825859, -0.0, 0.08, 0.845859, -0.0, 0.06,
    0.785859, -0.0, 0.08, 0.805859, -0.0, 0.06, 0.745859, -0.0, 0.08, 0.765859,
    -0.0, 0.06, 0.705859, -0.0, 0.08, 0.725859, -0.0, 0.06, 0.665859, -0.0,
    0.08, 0.685859, -0.0, 0.06, 0.625859, -0.0, 0.08, 0.645859, -0.0, 0.06,
    0.585859, -0.0, 0.08, 0.605859, -0.0, 0.06, 0.545859, -0.0, 0.08, 0.565859,
    -0.0, 0.06, 0.505859, -0.0, 0.08, 0.525859, -0.0, 0.06, 0.465859, -0.0,
    0.08, 0.485859, -0.0, 0.06, 0.425859, -0.0, 0.08, 0.445859, -0.0, 0.06,
    0.385859, -0.0, 0.08, 0.405859, -0.0, 0.06, 0.345859, -0.0, 0.08, 0.365859,
    -0.0, 0.1, 1.145859, -0.0, 0.1, 1.105859, -0.0, 0.12, 1.125859, -0.0, 0.1,
    1.065859, -0.0, 0.12, 1.085859, -0.0, 0.1, 1.025859, -0.0, 0.12, 1.045859,
    -0.0, 0.1, 0.985859, -0.0, 0.12, 1.005859, -0.0, 0.1, 0.945859, -0.0, 0.12,
    0.965859, -0.0, 0.1, 0.905859, -0.0, 0.12, 0.925859, -0.0, 0.1, 0.865859,
    -0.0, 0.12, 0.885859, -0.0, 0.1, 0.825859, -0.0, 0.12, 0.845859, -0.0, 0.1,
    0.785859, -0.0, 0.12, 0.805859, -0.0, 0.1, 0.745859, -0.0, 0.12, 0.765859,
    -0.0, 0.1, 0.705859, -0.0, 0.12, 0.725859, -0.0, 0.1, 0.665859, -0.0, 0.12,
    0.685859, -0.0, 0.1, 0.625859, -0.0, 0.12, 0.645859, -0.0, 0.1, 0.585859,
    -0.0, 0.12, 0.605859, -0.0, 0.1, 0.545859, -0.0, 0.12, 0.565859, -0.0, 0.1,
    0.505859, -0.0, 0.12, 0.525859, -0.0, 0.1, 0.465859, -0.0, 0.12, 0.485859,
    -0.0, 0.1, 0.425859, -0.0, 0.12, 0.445859, -0.0, 0.1, 0.385859, -0.0, 0.12,
    0.405859, -0.0, 0.1, 0.345859, -0.0, 0.12, 0.365859, -0.0, 0.14, 1.145859,
    -0.0, 0.14, 1.105859, -0.0, 0.16, 1.125859, -0.0, 0.14, 1.065859, -0.0,
    0.16, 1.085859, -0.0, 0.14, 1.025859, -0.0, 0.16, 1.045859, -0.0, 0.14,
    0.985859, -0.0, 0.16, 1.005859, -0.0, 0.14, 0.945859, -0.0, 0.16, 0.965859,
    -0.0, 0.14, 0.905859, -0.0, 0.16, 0.925859, -0.0, 0.14, 0.865859, -0.0,
    0.16, 0.885859, -0.0, 0.14, 0.825859, -0.0, 0.16, 0.845859, -0.0, 0.14,
    0.785859, -0.0, 0.16, 0.805859, -0.0, 0.14, 0.745859, -0.0, 0.16, 0.765859,
    -0.0, 0.14, 0.705859, -0.0, 0.16, 0.725859, -0.0, 0.14, 0.665859, -0.0,
    0.16, 0.685859, -0.0, 0.14, 0.625859, -0.0, 0.16, 0.645859, -0.0, 0.14,
    0.585859, -0.0, 0.16, 0.605859, -0.0, 0.14, 0.545859, -0.0, 0.16, 0.565859,
    -0.0, 0.14, 0.505859, -0.0, 0.16, 0.525859, -0.0, 0.14, 0.465859, -0.0,
    0.16, 0.485859, -0.0, 0.14, 0.425859, -0.0, 0.16, 0.445859, -0.0, 0.14,
    0.385859, -0.0, 0.16, 0.405859, -0.0, 0.14, 0.345859, -0.0, 0.16, 0.365859,
    -0.0, 0.18, 1.145859, -0.0, 0.18, 1.105859, -0.0, 0.2, 1.125859, -0.0, 0.18,
    1.065859, -0.0, 0.2, 1.085859, -0.0, 0.18, 1.025859, -0.0, 0.2, 1.045859,
    -0.0, 0.18, 0.985859, -0.0, 0.2, 1.005859, -0.0, 0.18, 0.945859, -0.0, 0.2,
    0.965859, -0.0, 0.18, 0.905859, -0.0, 0.2, 0.925859, -0.0, 0.18, 0.865859,
    -0.0, 0.2, 0.885859, -0.0, 0.18, 0.825859, -0.0, 0.2, 0.845859, -0.0, 0.18,
    0.785859, -0.0, 0.2, 0.805859, -0.0, 0.18, 0.745859, -0.0, 0.2, 0.765859,
    -0.0, 0.18, 0.705859, -0.0, 0.2, 0.725859, -0.0, 0.18, 0.665859, -0.0, 0.2,
    0.685859, -0.0, 0.18, 0.625859, -0.0, 0.2, 0.645859, -0.0, 0.18, 0.585859,
    -0.0, 0.2, 0.605859, -0.0, 0.18, 0.545859, -0.0, 0.2, 0.565859, -0.0, 0.18,
    0.505859, -0.0, 0.2, 0.525859, -0.0, 0.18, 0.465859, -0.0, 0.2, 0.485859,
    -0.0, 0.18, 0.425859, -0.0, 0.2, 0.445859, -0.0, 0.18, 0.385859, -0.0, 0.2,
    0.405859, -0.0, 0.18, 0.345859, -0.0, 0.2, 0.365859, -0.0, 0.18, 0.365859,
    -0.0, 0.18, 0.405859, -0.0, 0.18, 0.445859, -0.0, 0.18, 0.485859, -0.0,
    0.18, 0.525859, -0.0, 0.18, 0.565859, -0.0, 0.18, 0.605859, -0.0, 0.18,
    0.645859, -0.0, 0.18, 0.685859, -0.0, 0.18, 0.725859, -0.0, 0.18, 0.765859,
    -0.0, 0.18, 0.805859, -0.0, 0.18, 0.845859, -0.0, 0.18, 0.885859, -0.0,
    0.18, 0.925859, -0.0, 0.18, 0.965859, -0.0, 0.18, 1.005859, -0.0, 0.18,
    1.045859, -0.0, 0.18, 1.085859, -0.0, 0.18, 1.125859, -0.0, 0.14, 0.365859,
    -0.0, 0.14, 0.405859, -0.0, 0.14, 0.445859, -0.0, 0.14, 0.485859, -0.0,
    0.14, 0.525859, -0.0, 0.14, 0.565859, -0.0, 0.14, 0.605859, -0.0, 0.14,
    0.645859, -0.0, 0.14, 0.685859, -0.0, 0.14, 0.725859, -0.0, 0.14, 0.765859,
    -0.0, 0.14, 0.805859, -0.0, 0.14, 0.845859, -0.0, 0.14, 0.885859, -0.0,
    0.14, 0.925859, -0.0, 0.14, 0.965859, -0.0, 0.14, 1.005859, -0.0, 0.14,
    1.045859, -0.0, 0.14, 1.085859, -0.0, 0.14, 1.125859, -0.0, 0.1, 0.365859,
    -0.0, 0.1, 0.405859, -0.0, 0.1, 0.445859, -0.0, 0.1, 0.485859, -0.0, 0.1,
    0.525859, -0.0, 0.1, 0.565859, -0.0, 0.1, 0.605859, -0.0, 0.1, 0.645859,
    -0.0, 0.1, 0.685859, -0.0, 0.1, 0.725859, -0.0, 0.1, 0.765859, -0.0, 0.1,
    0.805859, -0.0, 0.1, 0.845859, -0.0, 0.1, 0.885859, -0.0, 0.1, 0.925859,
    -0.0, 0.1, 0.965859, -0.0, 0.1, 1.005859, -0.0, 0.1, 1.045859, -0.0, 0.1,
    1.085859, -0.0, 0.1, 1.125859, -0.0, 0.06, 0.365859, -0.0, 0.06, 0.405859,
    -0.0, 0.06, 0.445859, -0.0, 0.06, 0.485859, -0.0, 0.06, 0.525859, -0.0,
    0.06, 0.565859, -0.0, 0.06, 0.605859, -0.0, 0.06, 0.645859, -0.0, 0.06,
    0.685859, -0.0, 0.06, 0.725859, -0.0, 0.06, 0.765859, -0.0, 0.06, 0.805859,
    -0.0, 0.06, 0.845859, -0.0, 0.06, 0.885859, -0.0, 0.06, 0.925859, -0.0,
    0.06, 0.965859, -0.0, 0.06, 1.005859, -0.0, 0.06, 1.045859, -0.0, 0.06,
    1.085859, -0.0, 0.06, 1.125859, -0.0, 0.02, 0.365859, -0.0, 0.02, 0.405859,
    -0.0, 0.02, 0.445859, -0.0, 0.02, 0.485859, -0.0, 0.02, 0.525859, -0.0,
    0.02, 0.565859, -0.0, 0.02, 0.605859, -0.0, 0.02, 0.645859, -0.0, 0.02,
    0.685859, -0.0, 0.02, 0.725859, -0.0, 0.02, 0.765859, -0.0, 0.02, 0.805859,
    -0.0, 0.02, 0.845859, -0.0, 0.02, 0.885859, -0.0, 0.02, 0.925859, -0.0,
    0.02, 0.965859, -0.0, 0.02, 1.005859, -0.0, 0.02, 1.045859, -0.0, 0.02,
    1.085859, -0.0, 0.02, 1.125859, -0.0, -0.02, 0.365859, -0.0, -0.02,
    0.405859, -0.0, -0.02, 0.445859, -0.0, -0.02, 0.485859, -0.0, -0.02,
    0.525859, -0.0, -0.02, 0.565859, -0.0, -0.02, 0.605859, -0.0, -0.02,
    0.645859, -0.0, -0.02, 0.685859, -0.0, -0.02, 0.725859, -0.0, -0.02,
    0.765859, -0.0, -0.02, 0.805859, -0.0, -0.02, 0.845859, -0.0, -0.02,
    0.885859, -0.0, -0.02, 0.925859, -0.0, -0.02, 0.965859, -0.0, -0.02,
    1.005859, -0.0, -0.02, 1.045859, -0.0, -0.02, 1.085859, -0.0, -0.02,
    1.125859, -0.0, -0.06, 0.365859, -0.0, -0.06, 0.405859, -0.0, -0.06,
    0.445859, -0.0, -0.06, 0.485859, -0.0, -0.06, 0.525859, -0.0, -0.06,
    0.565859, -0.0, -0.06, 0.605859, -0.0, -0.06, 0.645859, -0.0, -0.06,
    0.685859, -0.0, -0.06, 0.725859, -0.0, -0.06, 0.765859, -0.0, -0.06,
    0.805859, -0.0, -0.06, 0.845859, -0.0, -0.06, 0.885859, -0.0, -0.06,
    0.925859, -0.0, -0.06, 0.965859, -0.0, -0.06, 1.005859, -0.0, -0.06,
    1.045859, -0.0, -0.06, 1.085859, -0.0, -0.06, 1.125859, -0.0, -0.1,
    0.365859, -0.0, -0.1, 0.405859, -0.0, -0.1, 0.445859, -0.0, -0.1, 0.485859,
    -0.0, -0.1, 0.525859, -0.0, -0.1, 0.565859, -0.0, -0.1, 0.605859, -0.0,
    -0.1, 0.645859, -0.0, -0.1, 0.685859, -0.0, -0.1, 0.725859, -0.0, -0.1,
    0.765859, -0.0, -0.1, 0.805859, -0.0, -0.1, 0.845859, -0.0, -0.1, 0.885859,
    -0.0, -0.1, 0.925859, -0.0, -0.1, 0.965859, -0.0, -0.1, 1.005859, -0.0,
    -0.1, 1.045859, -0.0, -0.1, 1.085859, -0.0, -0.1, 1.125859, -0.0, -0.14,
    0.365859, -0.0, -0.14, 0.405859, -0.0, -0.14, 0.445859, -0.0, -0.14,
    0.485859, -0.0, -0.14, 0.525859, -0.0, -0.14, 0.565859, -0.0, -0.14,
    0.605859, -0.0, -0.14, 0.645859, -0.0, -0.14, 0.685859, -0.0, -0.14,
    0.725859, -0.0, -0.14, 0.765859, -0.0, -0.14, 0.805859, -0.0, -0.14,
    0.845859, -0.0, -0.14, 0.885859, -0.0, -0.14, 0.925859, -0.0, -0.14,
    0.965859, -0.0, -0.14, 1.005859, -0.0, -0.14, 1.045859, -0.0, -0.14,
    1.085859, -0.0, -0.14, 1.125859, -0.0, -0.18, 0.365859, -0.0, -0.18,
    0.405859, -0.0, -0.18, 0.445859, -0.0, -0.18, 0.485859, -0.0, -0.18,
    0.525859, -0.0, -0.18, 0.565859, -0.0, -0.18, 0.605859, -0.0, -0.18,
    0.645859, -0.0, -0.18, 0.685859, -0.0, -0.18, 0.725859, -0.0, -0.18,
    0.765859, -0.0, -0.18, 0.805859, -0.0, -0.18, 0.845859, -0.0, -0.18,
    0.885859, -0.0, -0.18, 0.925859, -0.0, -0.18, 0.965859, -0.0, -0.18,
    1.005859, -0.0, -0.18, 1.045859, -0.0, -0.18, 1.085859, -0.0, -0.18,
    1.125859, -0.0, -0.19, 1.145859, -0.0, -0.2, 1.115859, -0.0, -0.17,
    1.105859, -0.0, -0.16, 1.135859, -0.0, -0.2, 1.075859, -0.0, -0.17,
    1.065859, -0.0, -0.16, 1.095859, -0.0, -0.2, 1.035859, -0.0, -0.17,
    1.025859, -0.0, -0.16, 1.055859, -0.0, -0.2, 0.995859, -0.0, -0.17,
    0.985859, -0.0, -0.16, 1.015859, -0.0, -0.2, 0.955859, -0.0, -0.17,
    0.945859, -0.0, -0.16, 0.975859, -0.0, -0.2, 0.915859, -0.0, -0.17,
    0.905859, -0.0, -0.16, 0.935859, -0.0, -0.2, 0.875859, -0.0, -0.17,
    0.865859, -0.0, -0.16, 0.895859, -0.0, -0.2, 0.835859, -0.0, -0.17,
    0.825859, -0.0, -0.16, 0.855859, -0.0, -0.2, 0.795859, -0.0, -0.17,
    0.785859, -0.0, -0.16, 0.815859, -0.0, -0.2, 0.755859, -0.0, -0.17,
    0.745859, -0.0, -0.16, 0.775859, -0.0, -0.2, 0.715859, -0.0, -0.17,
    0.705859, -0.0, -0.16, 0.735859, -0.0, -0.2, 0.675859, -0.0, -0.17,
    0.665859, -0.0, -0.16, 0.695859, -0.0, -0.2, 0.635859, -0.0, -0.17,
    0.625859, -0.0, -0.16, 0.655859, -0.0, -0.2, 0.595859, -0.0, -0.17,
    0.585859, -0.0, -0.16, 0.615859, -0.0, -0.2, 0.555859, -0.0, -0.17,
    0.545859, -0.0, -0.16, 0.575859, -0.0, -0.2, 0.515859, -0.0, -0.17,
    0.505859, -0.0, -0.16, 0.535859, -0.0, -0.2, 0.475859, -0.0, -0.17,
    0.465859, -0.0, -0.16, 0.495859, -0.0, -0.2, 0.435859, -0.0, -0.17,
    0.425859, -0.0, -0.16, 0.455859, -0.0, -0.2, 0.395859, -0.0, -0.17,
    0.385859, -0.0, -0.16, 0.415859, -0.0, -0.2, 0.355859, -0.0, -0.17,
    0.345859, -0.0, -0.16, 0.375859, -0.0, -0.15, 1.145859, -0.0, -0.13,
    1.105859, -0.0, -0.12, 1.135859, -0.0, -0.13, 1.065859, -0.0, -0.12,
    1.095859, -0.0, -0.13, 1.025859, -0.0, -0.12, 1.055859, -0.0, -0.13,
    0.985859, -0.0, -0.12, 1.015859, -0.0, -0.13, 0.945859, -0.0, -0.12,
    0.975859, -0.0, -0.13, 0.905859, -0.0, -0.12, 0.935859, -0.0, -0.13,
    0.865859, -0.0, -0.12, 0.895859, -0.0, -0.13, 0.825859, -0.0, -0.12,
    0.855859, -0.0, -0.13, 0.785859, -0.0, -0.12, 0.815859, -0.0, -0.13,
    0.745859, -0.0, -0.12, 0.775859, -0.0, -0.13, 0.705859, -0.0, -0.12,
    0.735859, -0.0, -0.13, 0.665859, -0.0, -0.12, 0.695859, -0.0, -0.13,
    0.625859, -0.0, -0.12, 0.655859, -0.0, -0.13, 0.585859, -0.0, -0.12,
    0.615859, -0.0, -0.13, 0.545859, -0.0, -0.12, 0.575859, -0.0, -0.13,
    0.505859, -0.0, -0.12, 0.535859, -0.0, -0.13, 0.465859, -0.0, -0.12,
    0.495859, -0.0, -0.13, 0.425859, -0.0, -0.12, 0.455859, -0.0, -0.13,
    0.385859, -0.0, -0.12, 0.415859, -0.0, -0.13, 0.345859, -0.0, -0.12,
    0.375859, -0.0, -0.11, 1.145859, -0.0, -0.09, 1.105859, -0.0, -0.08,
    1.135859, -0.0, -0.09, 1.065859, -0.0, -0.08, 1.095859, -0.0, -0.09,
    1.025859, -0.0, -0.08, 1.055859, -0.0, -0.09, 0.985859, -0.0, -0.08,
    1.015859, -0.0, -0.09, 0.945859, -0.0, -0.08, 0.975859, -0.0, -0.09,
    0.905859, -0.0, -0.08, 0.935859, -0.0, -0.09, 0.865859, -0.0, -0.08,
    0.895859, -0.0, -0.09, 0.825859, -0.0, -0.08, 0.855859, -0.0, -0.09,
    0.785859, -0.0, -0.08, 0.815859, -0.0, -0.09, 0.745859, -0.0, -0.08,
    0.775859, -0.0, -0.09, 0.705859, -0.0, -0.08, 0.735859, -0.0, -0.09,
    0.665859, -0.0, -0.08, 0.695859, -0.0, -0.09, 0.625859, -0.0, -0.08,
    0.655859, -0.0, -0.09, 0.585859, -0.0, -0.08, 0.615859, -0.0, -0.09,
    0.545859, -0.0, -0.08, 0.575859, -0.0, -0.09, 0.505859, -0.0, -0.08,
    0.535859, -0.0, -0.09, 0.465859, -0.0, -0.08, 0.495859, -0.0, -0.09,
    0.425859, -0.0, -0.08, 0.455859, -0.0, -0.09, 0.385859, -0.0, -0.08,
    0.415859, -0.0, -0.09, 0.345859, -0.0, -0.08, 0.375859, -0.0, -0.07,
    1.145859, -0.0, -0.05, 1.105859, -0.0, -0.04, 1.135859, -0.0, -0.05,
    1.065859, -0.0, -0.04, 1.095859, -0.0, -0.05, 1.025859, -0.0, -0.04,
    1.055859, -0.0, -0.05, 0.985859, -0.0, -0.04, 1.015859, -0.0, -0.05,
    0.945859, -0.0, -0.04, 0.975859, -0.0, -0.05, 0.905859, -0.0, -0.04,
    0.935859, -0.0, -0.05, 0.865859, -0.0, -0.04, 0.895859, -0.0, -0.05,
    0.825859, -0.0, -0.04, 0.855859, -0.0, -0.05, 0.785859, -0.0, -0.04,
    0.815859, -0.0, -0.05, 0.745859, -0.0, -0.04, 0.775859, -0.0, -0.05,
    0.705859, -0.0, -0.04, 0.735859, -0.0, -0.05, 0.665859, -0.0, -0.04,
    0.695859, -0.0, -0.05, 0.625859, -0.0, -0.04, 0.655859, -0.0, -0.05,
    0.585859, -0.0, -0.04, 0.615859, -0.0, -0.05, 0.545859, -0.0, -0.04,
    0.575859, -0.0, -0.05, 0.505859, -0.0, -0.04, 0.535859, -0.0, -0.05,
    0.465859, -0.0, -0.04, 0.495859, -0.0, -0.05, 0.425859, -0.0, -0.04,
    0.455859, -0.0, -0.05, 0.385859, -0.0, -0.04, 0.415859, -0.0, -0.05,
    0.345859, -0.0, -0.04, 0.375859, -0.0, -0.03, 1.145859, -0.0, -0.01,
    1.105859, -0.0, 0.0, 1.135859, -0.0, -0.01, 1.065859, -0.0, 0.0, 1.095859,
    -0.0, -0.01, 1.025859, -0.0, 0.0, 1.055859, -0.0, -0.01, 0.985859, -0.0,
    0.0, 1.015859, -0.0, -0.01, 0.945859, -0.0, 0.0, 0.975859, -0.0, -0.01,
    0.905859, -0.0, 0.0, 0.935859, -0.0, -0.01, 0.865859, -0.0, 0.0, 0.895859,
    -0.0, -0.01, 0.825859, -0.0, 0.0, 0.855859, -0.0, -0.01, 0.785859, -0.0,
    0.0, 0.815859, -0.0, -0.01, 0.745859, -0.0, 0.0, 0.775859, -0.0, -0.01,
    0.705859, -0.0, 0.0, 0.735859, -0.0, -0.01, 0.665859, -0.0, -0.0, 0.695859,
    -0.0, -0.01, 0.625859, -0.0, -0.0, 0.655859, -0.0, -0.01, 0.585859, -0.0,
    -0.0, 0.615859, -0.0, -0.01, 0.545859, -0.0, -0.0, 0.575859, -0.0, -0.01,
    0.505859, -0.0, -0.0, 0.535859, -0.0, -0.01, 0.465859, -0.0, 0.0, 0.495859,
    -0.0, -0.01, 0.425859, -0.0, -0.0, 0.455859, -0.0, -0.01, 0.385859, -0.0,
    -0.0, 0.415859, -0.0, -0.01, 0.345859, -0.0, -0.0, 0.375859, -0.0, 0.01,
    1.145859, -0.0, 0.03, 1.105859, -0.0, 0.04, 1.135859, -0.0, 0.03, 1.065859,
    -0.0, 0.04, 1.095859, -0.0, 0.03, 1.025859, -0.0, 0.04, 1.055859, -0.0,
    0.03, 0.985859, -0.0, 0.04, 1.015859, -0.0, 0.03, 0.945859, -0.0, 0.04,
    0.975859, -0.0, 0.03, 0.905859, -0.0, 0.04, 0.935859, -0.0, 0.03, 0.865859,
    -0.0, 0.04, 0.895859, -0.0, 0.03, 0.825859, -0.0, 0.04, 0.855859, -0.0,
    0.03, 0.785859, -0.0, 0.04, 0.815859, -0.0, 0.03, 0.745859, -0.0, 0.04,
    0.775859, -0.0, 0.03, 0.705859, -0.0, 0.04, 0.735859, -0.0, 0.03, 0.665859,
    -0.0, 0.04, 0.695859, -0.0, 0.03, 0.625859, -0.0, 0.04, 0.655859, -0.0,
    0.03, 0.585859, -0.0, 0.04, 0.615859, -0.0, 0.03, 0.545859, -0.0, 0.04,
    0.575859, -0.0, 0.03, 0.505859, -0.0, 0.04, 0.535859, -0.0, 0.03, 0.465859,
    -0.0, 0.04, 0.495859, -0.0, 0.03, 0.425859, -0.0, 0.04, 0.455859, -0.0,
    0.03, 0.385859, -0.0, 0.04, 0.415859, -0.0, 0.03, 0.345859, -0.0, 0.04,
    0.375859, -0.0, 0.05, 1.145859, -0.0, 0.07, 1.105859, -0.0, 0.08, 1.135859,
    -0.0, 0.07, 1.065859, -0.0, 0.08, 1.095859, -0.0, 0.07, 1.025859, -0.0,
    0.08, 1.055859, -0.0, 0.07, 0.985859, -0.0, 0.08, 1.015859, -0.0, 0.07,
    0.945859, -0.0, 0.08, 0.975859, -0.0, 0.07, 0.905859, -0.0, 0.08, 0.935859,
    -0.0, 0.07, 0.865859, -0.0, 0.08, 0.895859, -0.0, 0.07, 0.825859, -0.0,
    0.08, 0.855859, -0.0, 0.07, 0.785859, -0.0, 0.08, 0.815859, -0.0, 0.07,
    0.745859, -0.0, 0.08, 0.775859, -0.0, 0.07, 0.705859, -0.0, 0.08, 0.735859,
    -0.0, 0.07, 0.665859, -0.0, 0.08, 0.695859, -0.0, 0.07, 0.625859, -0.0,
    0.08, 0.655859, -0.0, 0.07, 0.585859, -0.0, 0.08, 0.615859, -0.0, 0.07,
    0.545859, -0.0, 0.08, 0.575859, -0.0, 0.07, 0.505859, -0.0, 0.08, 0.535859,
    -0.0, 0.07, 0.465859, -0.0, 0.08, 0.495859, -0.0, 0.07, 0.425859, -0.0,
    0.08, 0.455859, -0.0, 0.07, 0.385859, -0.0, 0.08, 0.415859, -0.0, 0.07,
    0.345859, -0.0, 0.08, 0.375859, -0.0, 0.09, 1.145859, -0.0, 0.11, 1.105859,
    -0.0, 0.12, 1.135859, -0.0, 0.11, 1.065859, -0.0, 0.12, 1.095859, -0.0,
    0.11, 1.025859, -0.0, 0.12, 1.055859, -0.0, 0.11, 0.985859, -0.0, 0.12,
    1.015859, -0.0, 0.11, 0.945859, -0.0, 0.12, 0.975859, -0.0, 0.11, 0.905859,
    -0.0, 0.12, 0.935859, -0.0, 0.11, 0.865859, -0.0, 0.12, 0.895859, -0.0,
    0.11, 0.825859, -0.0, 0.12, 0.855859, -0.0, 0.11, 0.785859, -0.0, 0.12,
    0.815859, -0.0, 0.11, 0.745859, -0.0, 0.12, 0.775859, -0.0, 0.11, 0.705859,
    -0.0, 0.12, 0.735859, -0.0, 0.11, 0.665859, -0.0, 0.12, 0.695859, -0.0,
    0.11, 0.625859, -0.0, 0.12, 0.655859, -0.0, 0.11, 0.585859, -0.0, 0.12,
    0.615859, -0.0, 0.11, 0.545859, -0.0, 0.12, 0.575859, -0.0, 0.11, 0.505859,
    -0.0, 0.12, 0.535859, -0.0, 0.11, 0.465859, -0.0, 0.12, 0.495859, -0.0,
    0.11, 0.425859, -0.0, 0.12, 0.455859, -0.0, 0.11, 0.385859, -0.0, 0.12,
    0.415859, -0.0, 0.11, 0.345859, -0.0, 0.12, 0.375859, -0.0, 0.13, 1.145859,
    -0.0, 0.15, 1.105859, -0.0, 0.16, 1.135859, -0.0, 0.15, 1.065859, -0.0,
    0.16, 1.095859, -0.0, 0.15, 1.025859, -0.0, 0.16, 1.055859, -0.0, 0.15,
    0.985859, -0.0, 0.16, 1.015859, -0.0, 0.15, 0.945859, -0.0, 0.16, 0.975859,
    -0.0, 0.15, 0.905859, -0.0, 0.16, 0.935859, -0.0, 0.15, 0.865859, -0.0,
    0.16, 0.895859, -0.0, 0.15, 0.825859, -0.0, 0.16, 0.855859, -0.0, 0.15,
    0.785859, -0.0, 0.16, 0.815859, -0.0, 0.15, 0.745859, -0.0, 0.16, 0.775859,
    -0.0, 0.15, 0.705859, -0.0, 0.16, 0.735859, -0.0, 0.15, 0.665859, -0.0,
    0.16, 0.695859, -0.0, 0.15, 0.625859, -0.0, 0.16, 0.655859, -0.0, 0.15,
    0.585859, -0.0, 0.16, 0.615859, -0.0, 0.15, 0.545859, -0.0, 0.16, 0.575859,
    -0.0, 0.15, 0.505859, -0.0, 0.16, 0.535859, -0.0, 0.15, 0.465859, -0.0,
    0.16, 0.495859, -0.0, 0.15, 0.425859, -0.0, 0.16, 0.455859, -0.0, 0.15,
    0.385859, -0.0, 0.16, 0.415859, -0.0, 0.15, 0.345859, -0.0, 0.16, 0.375859,
    -0.0, 0.17, 1.145859, -0.0, 0.19, 1.105859, -0.0, 0.2, 1.135859, -0.0, 0.19,
    1.065859, -0.0, 0.2, 1.095859, -0.0, 0.19, 1.025859, -0.0, 0.2, 1.055859,
    -0.0, 0.19, 0.985859, -0.0, 0.2, 1.015859, -0.0, 0.19, 0.945859, -0.0, 0.2,
    0.975859, -0.0, 0.19, 0.905859, -0.0, 0.2, 0.935859, -0.0, 0.19, 0.865859,
    -0.0, 0.2, 0.895859, -0.0, 0.19, 0.825859, -0.0, 0.2, 0.855859, -0.0, 0.19,
    0.785859, -0.0, 0.2, 0.815859, -0.0, 0.19, 0.745859, -0.0, 0.2, 0.775859,
    -0.0, 0.19, 0.705859, -0.0, 0.2, 0.735859, -0.0, 0.19, 0.665859, -0.0, 0.2,
    0.695859, -0.0, 0.19, 0.625859, -0.0, 0.2, 0.655859, -0.0, 0.19, 0.585859,
    -0.0, 0.2, 0.615859, -0.0, 0.19, 0.545859, -0.0, 0.2, 0.575859, -0.0, 0.19,
    0.505859, -0.0, 0.2, 0.535859, -0.0, 0.19, 0.465859, -0.0, 0.2, 0.495859,
    -0.0, 0.19, 0.425859, -0.0, 0.2, 0.455859, -0.0, 0.19, 0.385859, -0.0, 0.2,
    0.415859, -0.0, 0.19, 0.345859, -0.0, 0.2, 0.375859, -0.0, -0.17, 1.145859,
    -0.0, -0.2, 1.135859, -0.0, -0.19, 1.105859, -0.0, -0.16, 1.115859, -0.0,
    -0.2, 1.095859, -0.0, -0.19, 1.065859, -0.0, -0.16, 1.075859, -0.0, -0.2,
    1.055859, -0.0, -0.19, 1.025859, -0.0, -0.16, 1.035859, -0.0, -0.2,
    1.015859, -0.0, -0.19, 0.985859, -0.0, -0.16, 0.995859, -0.0, -0.2,
    0.975859, -0.0, -0.19, 0.945859, -0.0, -0.16, 0.955859, -0.0, -0.2,
    0.935859, -0.0, -0.19, 0.905859, -0.0, -0.16, 0.915859, -0.0, -0.2,
    0.895859, -0.0, -0.19, 0.865859, -0.0, -0.16, 0.875859, -0.0, -0.2,
    0.855859, -0.0, -0.19, 0.825859, -0.0, -0.16, 0.835859, -0.0, -0.2,
    0.815859, -0.0, -0.19, 0.785859, -0.0, -0.16, 0.795859, -0.0, -0.2,
    0.775859, -0.0, -0.19, 0.745859, -0.0, -0.16, 0.755859, -0.0, -0.2,
    0.735859, -0.0, -0.19, 0.705859, -0.0, -0.16, 0.715859, -0.0, -0.2,
    0.695859, -0.0, -0.19, 0.665859, -0.0, -0.16, 0.675859, -0.0, -0.2,
    0.655859, -0.0, -0.19, 0.625859, -0.0, -0.16, 0.635859, -0.0, -0.2,
    0.615859, -0.0, -0.19, 0.585859, -0.0, -0.16, 0.595859, -0.0, -0.2,
    0.575859, -0.0, -0.19, 0.545859, -0.0, -0.16, 0.555859, -0.0, -0.2,
    0.535859, -0.0, -0.19, 0.505859, -0.0, -0.16, 0.515859, -0.0, -0.2,
    0.495859, -0.0, -0.19, 0.465859, -0.0, -0.16, 0.475859, -0.0, -0.2,
    0.455859, -0.0, -0.19, 0.425859, -0.0, -0.16, 0.435859, -0.0, -0.2,
    0.415859, -0.0, -0.19, 0.385859, -0.0, -0.16, 0.395859, -0.0, -0.2,
    0.375859, -0.0, -0.19, 0.345859, -0.0, -0.16, 0.355859, -0.0, -0.13,
    1.145859, -0.0, -0.15, 1.105859, -0.0, -0.12, 1.115859, -0.0, -0.15,
    1.065859, -0.0, -0.12, 1.075859, -0.0, -0.15, 1.025859, -0.0, -0.12,
    1.035859, -0.0, -0.15, 0.985859, -0.0, -0.12, 0.995859, -0.0, -0.15,
    0.945859, -0.0, -0.12, 0.955859, -0.0, -0.15, 0.905859, -0.0, -0.12,
    0.915859, -0.0, -0.15, 0.865859, -0.0, -0.12, 0.875859, -0.0, -0.15,
    0.825859, -0.0, -0.12, 0.835859, -0.0, -0.15, 0.785859, -0.0, -0.12,
    0.795859, -0.0, -0.15, 0.745859, -0.0, -0.12, 0.755859, -0.0, -0.15,
    0.705859, -0.0, -0.12, 0.715859, -0.0, -0.15, 0.665859, -0.0, -0.12,
    0.675859, -0.0, -0.15, 0.625859, -0.0, -0.12, 0.635859, -0.0, -0.15,
    0.585859, -0.0, -0.12, 0.595859, -0.0, -0.15, 0.545859, -0.0, -0.12,
    0.555859, -0.0, -0.15, 0.505859, -0.0, -0.12, 0.515859, -0.0, -0.15,
    0.465859, -0.0, -0.12, 0.475859, -0.0, -0.15, 0.425859, -0.0, -0.12,
    0.435859, -0.0, -0.15, 0.385859, -0.0, -0.12, 0.395859, -0.0, -0.15,
    0.345859, -0.0, -0.12, 0.355859, -0.0, -0.09, 1.145859, -0.0, -0.11,
    1.105859, -0.0, -0.08, 1.115859, -0.0, -0.11, 1.065859, -0.0, -0.08,
    1.075859, -0.0, -0.11, 1.025859, -0.0, -0.08, 1.035859, -0.0, -0.11,
    0.985859, -0.0, -0.08, 0.995859, -0.0, -0.11, 0.945859, -0.0, -0.08,
    0.955859, -0.0, -0.11, 0.905859, -0.0, -0.08, 0.915859, -0.0, -0.11,
    0.865859, -0.0, -0.08, 0.875859, -0.0, -0.11, 0.825859, -0.0, -0.08,
    0.835859, -0.0, -0.11, 0.785859, -0.0, -0.08, 0.795859, -0.0, -0.11,
    0.745859, -0.0, -0.08, 0.755859, -0.0, -0.11, 0.705859, -0.0, -0.08,
    0.715859, -0.0, -0.11, 0.665859, -0.0, -0.08, 0.675859, -0.0, -0.11,
    0.625859, -0.0, -0.08, 0.635859, -0.0, -0.11, 0.585859, -0.0, -0.08,
    0.595859, -0.0, -0.11, 0.545859, -0.0, -0.08, 0.555859, -0.0, -0.11,
    0.505859, -0.0, -0.08, 0.515859, -0.0, -0.11, 0.465859, -0.0, -0.08,
    0.475859, -0.0, -0.11, 0.425859, -0.0, -0.08, 0.435859, -0.0, -0.11,
    0.385859, -0.0, -0.08, 0.395859, -0.0, -0.11, 0.345859, -0.0, -0.08,
    0.355859, -0.0, -0.05, 1.145859, -0.0, -0.07, 1.105859, -0.0, -0.04,
    1.115859, -0.0, -0.07, 1.065859, -0.0, -0.04, 1.075859, -0.0, -0.07,
    1.025859, -0.0, -0.04, 1.035859, -0.0, -0.07, 0.985859, -0.0, -0.04,
    0.995859, -0.0, -0.07, 0.945859, -0.0, -0.04, 0.955859, -0.0, -0.07,
    0.905859, -0.0, -0.04, 0.915859, -0.0, -0.07, 0.865859, -0.0, -0.04,
    0.875859, -0.0, -0.07, 0.825859, -0.0, -0.04, 0.835859, -0.0, -0.07,
    0.785859, -0.0, -0.04, 0.795859, -0.0, -0.07, 0.745859, -0.0, -0.04,
    0.755859, -0.0, -0.07, 0.705859, -0.0, -0.04, 0.715859, -0.0, -0.07,
    0.665859, -0.0, -0.04, 0.675859, -0.0, -0.07, 0.625859, -0.0, -0.04,
    0.635859, -0.0, -0.07, 0.585859, -0.0, -0.04, 0.595859, -0.0, -0.07,
    0.545859, -0.0, -0.04, 0.555859, -0.0, -0.07, 0.505859, -0.0, -0.04,
    0.515859, -0.0, -0.07, 0.465859, -0.0, -0.04, 0.475859, -0.0, -0.07,
    0.425859, -0.0, -0.04, 0.435859, -0.0, -0.07, 0.385859, -0.0, -0.04,
    0.395859, -0.0, -0.07, 0.345859, -0.0, -0.04, 0.355859, -0.0, -0.01,
    1.145859, -0.0, -0.03, 1.105859, -0.0, 0.0, 1.115859, -0.0, -0.03, 1.065859,
    -0.0, 0.0, 1.075859, -0.0, -0.03, 1.025859, -0.0, 0.0, 1.035859, -0.0,
    -0.03, 0.985859, -0.0, 0.0, 0.995859, -0.0, -0.03, 0.945859, -0.0, 0.0,
    0.955859, -0.0, -0.03, 0.905859, -0.0, 0.0, 0.915859, -0.0, -0.03, 0.865859,
    -0.0, 0.0, 0.875859, -0.0, -0.03, 0.825859, -0.0, 0.0, 0.835859, -0.0,
    -0.03, 0.785859, -0.0, 0.0, 0.795859, -0.0, -0.03, 0.745859, -0.0, 0.0,
    0.755859, -0.0, -0.03, 0.705859, -0.0, 0.0, 0.715859, -0.0, -0.03, 0.665859,
    -0.0, -0.0, 0.675859, -0.0, -0.03, 0.625859, -0.0, -0.0, 0.635859, -0.0,
    -0.03, 0.585859, -0.0, -0.0, 0.595859, -0.0, -0.03, 0.545859, -0.0, -0.0,
    0.555859, -0.0, -0.03, 0.505859, -0.0, -0.0, 0.515859, -0.0, -0.03,
    0.465859, -0.0, 0.0, 0.475859, -0.0, -0.03, 0.425859, -0.0, -0.0, 0.435859,
    -0.0, -0.03, 0.385859, -0.0, -0.0, 0.395859, -0.0, -0.03, 0.345859, -0.0,
    -0.0, 0.355859, -0.0, 0.03, 1.145859, -0.0, 0.01, 1.105859, -0.0, 0.04,
    1.115859, -0.0, 0.01, 1.065859, -0.0, 0.04, 1.075859, -0.0, 0.01, 1.025859,
    -0.0, 0.04, 1.035859, -0.0, 0.01, 0.985859, -0.0, 0.04, 0.995859, -0.0,
    0.01, 0.945859, -0.0, 0.04, 0.955859, -0.0, 0.01, 0.905859, -0.0, 0.04,
    0.915859, -0.0, 0.01, 0.865859, -0.0, 0.04, 0.875859, -0.0, 0.01, 0.825859,
    -0.0, 0.04, 0.835859, -0.0, 0.01, 0.785859, -0.0, 0.04, 0.795859, -0.0,
    0.01, 0.745859, -0.0, 0.04, 0.755859, -0.0, 0.01, 0.705859, -0.0, 0.04,
    0.715859, -0.0, 0.01, 0.665859, -0.0, 0.04, 0.675859, -0.0, 0.01, 0.625859,
    -0.0, 0.04, 0.635859, -0.0, 0.01, 0.585859, -0.0, 0.04, 0.595859, -0.0,
    0.01, 0.545859, -0.0, 0.04, 0.555859, -0.0, 0.01, 0.505859, -0.0, 0.04,
    0.515859, -0.0, 0.01, 0.465859, -0.0, 0.04, 0.475859, -0.0, 0.01, 0.425859,
    -0.0, 0.04, 0.435859, -0.0, 0.01, 0.385859, -0.0, 0.04, 0.395859, -0.0,
    0.01, 0.345859, -0.0, 0.04, 0.355859, -0.0, 0.07, 1.145859, -0.0, 0.05,
    1.105859, -0.0, 0.08, 1.115859, -0.0, 0.05, 1.065859, -0.0, 0.08, 1.075859,
    -0.0, 0.05, 1.025859, -0.0, 0.08, 1.035859, -0.0, 0.05, 0.985859, -0.0,
    0.08, 0.995859, -0.0, 0.05, 0.945859, -0.0, 0.08, 0.955859, -0.0, 0.05,
    0.905859, -0.0, 0.08, 0.915859, -0.0, 0.05, 0.865859, -0.0, 0.08, 0.875859,
    -0.0, 0.05, 0.825859, -0.0, 0.08, 0.835859, -0.0, 0.05, 0.785859, -0.0,
    0.08, 0.795859, -0.0, 0.05, 0.745859, -0.0, 0.08, 0.755859, -0.0, 0.05,
    0.705859, -0.0, 0.08, 0.715859, -0.0, 0.05, 0.665859, -0.0, 0.08, 0.675859,
    -0.0, 0.05, 0.625859, -0.0, 0.08, 0.635859, -0.0, 0.05, 0.585859, -0.0,
    0.08, 0.595859, -0.0, 0.05, 0.545859, -0.0, 0.08, 0.555859, -0.0, 0.05,
    0.505859, -0.0, 0.08, 0.515859, -0.0, 0.05, 0.465859, -0.0, 0.08, 0.475859,
    -0.0, 0.05, 0.425859, -0.0, 0.08, 0.435859, -0.0, 0.05, 0.385859, -0.0,
    0.08, 0.395859, -0.0, 0.05, 0.345859, -0.0, 0.08, 0.355859, -0.0, 0.11,
    1.145859, -0.0, 0.09, 1.105859, -0.0, 0.12, 1.115859, -0.0, 0.09, 1.065859,
    -0.0, 0.12, 1.075859, -0.0, 0.09, 1.025859, -0.0, 0.12, 1.035859, -0.0,
    0.09, 0.985859, -0.0, 0.12, 0.995859, -0.0, 0.09, 0.945859, -0.0, 0.12,
    0.955859, -0.0, 0.09, 0.905859, -0.0, 0.12, 0.915859, -0.0, 0.09, 0.865859,
    -0.0, 0.12, 0.875859, -0.0, 0.09, 0.825859, -0.0, 0.12, 0.835859, -0.0,
    0.09, 0.785859, -0.0, 0.12, 0.795859, -0.0, 0.09, 0.745859, -0.0, 0.12,
    0.755859, -0.0, 0.09, 0.705859, -0.0, 0.12, 0.715859, -0.0, 0.09, 0.665859,
    -0.0, 0.12, 0.675859, -0.0, 0.09, 0.625859, -0.0, 0.12, 0.635859, -0.0,
    0.09, 0.585859, -0.0, 0.12, 0.595859, -0.0, 0.09, 0.545859, -0.0, 0.12,
    0.555859, -0.0, 0.09, 0.505859, -0.0, 0.12, 0.515859, -0.0, 0.09, 0.465859,
    -0.0, 0.12, 0.475859, -0.0, 0.09, 0.425859, -0.0, 0.12, 0.435859, -0.0,
    0.09, 0.385859, -0.0, 0.12, 0.395859, -0.0, 0.09, 0.345859, -0.0, 0.12,
    0.355859, -0.0, 0.15, 1.145859, -0.0, 0.13, 1.105859, -0.0, 0.16, 1.115859,
    -0.0, 0.13, 1.065859, -0.0, 0.16, 1.075859, -0.0, 0.13, 1.025859, -0.0,
    0.16, 1.035859, -0.0, 0.13, 0.985859, -0.0, 0.16, 0.995859, -0.0, 0.13,
    0.945859, -0.0, 0.16, 0.955859, -0.0, 0.13, 0.905859, -0.0, 0.16, 0.915859,
    -0.0, 0.13, 0.865859, -0.0, 0.16, 0.875859, -0.0, 0.13, 0.825859, -0.0,
    0.16, 0.835859, -0.0, 0.13, 0.785859, -0.0, 0.16, 0.795859, -0.0, 0.13,
    0.745859, -0.0, 0.16, 0.755859, -0.0, 0.13, 0.705859, -0.0, 0.16, 0.715859,
    -0.0, 0.13, 0.665859, -0.0, 0.16, 0.675859, -0.0, 0.13, 0.625859, -0.0,
    0.16, 0.635859, -0.0, 0.13, 0.585859, -0.0, 0.16, 0.595859, -0.0, 0.13,
    0.545859, -0.0, 0.16, 0.555859, -0.0, 0.13, 0.505859, -0.0, 0.16, 0.515859,
    -0.0, 0.13, 0.465859, -0.0, 0.16, 0.475859, -0.0, 0.13, 0.425859, -0.0,
    0.16, 0.435859, -0.0, 0.13, 0.385859, -0.0, 0.16, 0.395859, -0.0, 0.13,
    0.345859, -0.0, 0.16, 0.355859, -0.0, 0.19, 1.145859, -0.0, 0.17, 1.105859,
    -0.0, 0.2, 1.115859, -0.0, 0.17, 1.065859, -0.0, 0.2, 1.075859, -0.0, 0.17,
    1.025859, -0.0, 0.2, 1.035859, -0.0, 0.17, 0.985859, -0.0, 0.2, 0.995859,
    -0.0, 0.17, 0.945859, -0.0, 0.2, 0.955859, -0.0, 0.17, 0.905859, -0.0, 0.2,
    0.915859, -0.0, 0.17, 0.865859, -0.0, 0.2, 0.875859, -0.0, 0.17, 0.825859,
    -0.0, 0.2, 0.835859, -0.0, 0.17, 0.785859, -0.0, 0.2, 0.795859, -0.0, 0.17,
    0.745859, -0.0, 0.2, 0.755859, -0.0, 0.17, 0.705859, -0.0, 0.2, 0.715859,
    -0.0, 0.17, 0.665859, -0.0, 0.2, 0.675859, -0.0, 0.17, 0.625859, -0.0, 0.2,
    0.635859, -0.0, 0.17, 0.585859, -0.0, 0.2, 0.595859, -0.0, 0.17, 0.545859,
    -0.0, 0.2, 0.555859, -0.0, 0.17, 0.505859, -0.0, 0.2, 0.515859, -0.0, 0.17,
    0.465859, -0.0, 0.2, 0.475859, -0.0, 0.17, 0.425859, -0.0, 0.2, 0.435859,
    -0.0, 0.17, 0.385859, -0.0, 0.2, 0.395859, -0.0, 0.17, 0.345859, -0.0, 0.2,
    0.355859, -0.0, 0.19, 0.365859, -0.0, 0.17, 0.365859, -0.0, 0.18, 0.375859,
    -0.0, 0.18, 0.355859, -0.0, 0.19, 0.405859, -0.0, 0.17, 0.405859, -0.0,
    0.18, 0.415859, -0.0, 0.18, 0.395859, -0.0, 0.19, 0.445859, -0.0, 0.17,
    0.445859, -0.0, 0.18, 0.455859, -0.0, 0.18, 0.435859, -0.0, 0.19, 0.485859,
    -0.0, 0.17, 0.485859, -0.0, 0.18, 0.495859, -0.0, 0.18, 0.475859, -0.0,
    0.19, 0.525859, -0.0, 0.17, 0.525859, -0.0, 0.18, 0.535859, -0.0, 0.18,
    0.515859, -0.0, 0.19, 0.565859, -0.0, 0.17, 0.565859, -0.0, 0.18, 0.575859,
    -0.0, 0.18, 0.555859, -0.0, 0.19, 0.605859, -0.0, 0.17, 0.605859, -0.0,
    0.18, 0.615859, -0.0, 0.18, 0.595859, -0.0, 0.19, 0.645859, -0.0, 0.17,
    0.645859, -0.0, 0.18, 0.655859, -0.0, 0.18, 0.635859, -0.0, 0.19, 0.685859,
    -0.0, 0.17, 0.685859, -0.0, 0.18, 0.695859, -0.0, 0.18, 0.675859, -0.0,
    0.19, 0.725859, -0.0, 0.17, 0.725859, -0.0, 0.18, 0.735859, -0.0, 0.18,
    0.715859, -0.0, 0.19, 0.765859, -0.0, 0.17, 0.765859, -0.0, 0.18, 0.775859,
    -0.0, 0.18, 0.755859, -0.0, 0.19, 0.805859, -0.0, 0.17, 0.805859, -0.0,
    0.18, 0.815859, -0.0, 0.18, 0.795859, -0.0, 0.19, 0.845859, -0.0, 0.17,
    0.845859, -0.0, 0.18, 0.855859, -0.0, 0.18, 0.835859, -0.0, 0.19, 0.885859,
    -0.0, 0.17, 0.885859, -0.0, 0.18, 0.895859, -0.0, 0.18, 0.875859, -0.0,
    0.19, 0.925859, -0.0, 0.17, 0.925859, -0.0, 0.18, 0.935859, -0.0, 0.18,
    0.915859, -0.0, 0.19, 0.965859, -0.0, 0.17, 0.965859, -0.0, 0.18, 0.975859,
    -0.0, 0.18, 0.955859, -0.0, 0.19, 1.005859, -0.0, 0.17, 1.005859, -0.0,
    0.18, 1.015859, -0.0, 0.18, 0.995859, -0.0, 0.19, 1.045859, -0.0, 0.17,
    1.045859, -0.0, 0.18, 1.055859, -0.0, 0.18, 1.035859, -0.0, 0.19, 1.085859,
    -0.0, 0.17, 1.085859, -0.0, 0.18, 1.095859, -0.0, 0.18, 1.075859, -0.0,
    0.19, 1.125859, -0.0, 0.17, 1.125859, -0.0, 0.18, 1.135859, -0.0, 0.18,
    1.115859, -0.0, 0.15, 0.365859, -0.0, 0.13, 0.365859, -0.0, 0.14, 0.375859,
    -0.0, 0.14, 0.355859, -0.0, 0.15, 0.405859, -0.0, 0.13, 0.405859, -0.0,
    0.14, 0.415859, -0.0, 0.14, 0.395859, -0.0, 0.15, 0.445859, -0.0, 0.13,
    0.445859, -0.0, 0.14, 0.455859, -0.0, 0.14, 0.435859, -0.0, 0.15, 0.485859,
    -0.0, 0.13, 0.485859, -0.0, 0.14, 0.495859, -0.0, 0.14, 0.475859, -0.0,
    0.15, 0.525859, -0.0, 0.13, 0.525859, -0.0, 0.14, 0.535859, -0.0, 0.14,
    0.515859, -0.0, 0.15, 0.565859, -0.0, 0.13, 0.565859, -0.0, 0.14, 0.575859,
    -0.0, 0.14, 0.555859, -0.0, 0.15, 0.605859, -0.0, 0.13, 0.605859, -0.0,
    0.14, 0.615859, -0.0, 0.14, 0.595859, -0.0, 0.15, 0.645859, -0.0, 0.13,
    0.645859, -0.0, 0.14, 0.655859, -0.0, 0.14, 0.635859, -0.0, 0.15, 0.685859,
    -0.0, 0.13, 0.685859, -0.0, 0.14, 0.695859, -0.0, 0.14, 0.675859, -0.0,
    0.15, 0.725859, -0.0, 0.13, 0.725859, -0.0, 0.14, 0.735859, -0.0, 0.14,
    0.715859, -0.0, 0.15, 0.765859, -0.0, 0.13, 0.765859, -0.0, 0.14, 0.775859,
    -0.0, 0.14, 0.755859, -0.0, 0.15, 0.805859, -0.0, 0.13, 0.805859, -0.0,
    0.14, 0.815859, -0.0, 0.14, 0.795859, -0.0, 0.15, 0.845859, -0.0, 0.13,
    0.845859, -0.0, 0.14, 0.855859, -0.0, 0.14, 0.835859, -0.0, 0.15, 0.885859,
    -0.0, 0.13, 0.885859, -0.0, 0.14, 0.895859, -0.0, 0.14, 0.875859, -0.0,
    0.15, 0.925859, -0.0, 0.13, 0.925859, -0.0, 0.14, 0.935859, -0.0, 0.14,
    0.915859, -0.0, 0.15, 0.965859, -0.0, 0.13, 0.965859, -0.0, 0.14, 0.975859,
    -0.0, 0.14, 0.955859, -0.0, 0.15, 1.005859, -0.0, 0.13, 1.005859, -0.0,
    0.14, 1.015859, -0.0, 0.14, 0.995859, -0.0, 0.15, 1.045859, -0.0, 0.13,
    1.045859, -0.0, 0.14, 1.055859, -0.0, 0.14, 1.035859, -0.0, 0.15, 1.085859,
    -0.0, 0.13, 1.085859, -0.0, 0.14, 1.095859, -0.0, 0.14, 1.075859, -0.0,
    0.15, 1.125859, -0.0, 0.13, 1.125859, -0.0, 0.14, 1.135859, -0.0, 0.14,
    1.115859, -0.0, 0.11, 0.365859, -0.0, 0.09, 0.365859, -0.0, 0.1, 0.375859,
    -0.0, 0.1, 0.355859, -0.0, 0.11, 0.405859, -0.0, 0.09, 0.405859, -0.0, 0.1,
    0.415859, -0.0, 0.1, 0.395859, -0.0, 0.11, 0.445859, -0.0, 0.09, 0.445859,
    -0.0, 0.1, 0.455859, -0.0, 0.1, 0.435859, -0.0, 0.11, 0.485859, -0.0, 0.09,
    0.485859, -0.0, 0.1, 0.495859, -0.0, 0.1, 0.475859, -0.0, 0.11, 0.525859,
    -0.0, 0.09, 0.525859, -0.0, 0.1, 0.535859, -0.0, 0.1, 0.515859, -0.0, 0.11,
    0.565859, -0.0, 0.09, 0.565859, -0.0, 0.1, 0.575859, -0.0, 0.1, 0.555859,
    -0.0, 0.11, 0.605859, -0.0, 0.09, 0.605859, -0.0, 0.1, 0.615859, -0.0, 0.1,
    0.595859, -0.0, 0.11, 0.645859, -0.0, 0.09, 0.645859, -0.0, 0.1, 0.655859,
    -0.0, 0.1, 0.635859, -0.0, 0.11, 0.685859, -0.0, 0.09, 0.685859, -0.0, 0.1,
    0.695859, -0.0, 0.1, 0.675859, -0.0, 0.11, 0.725859, -0.0, 0.09, 0.725859,
    -0.0, 0.1, 0.735859, -0.0, 0.1, 0.715859, -0.0, 0.11, 0.765859, -0.0, 0.09,
    0.765859, -0.0, 0.1, 0.775859, -0.0, 0.1, 0.755859, -0.0, 0.11, 0.805859,
    -0.0, 0.09, 0.805859, -0.0, 0.1, 0.815859, -0.0, 0.1, 0.795859, -0.0, 0.11,
    0.845859, -0.0, 0.09, 0.845859, -0.0, 0.1, 0.855859, -0.0, 0.1, 0.835859,
    -0.0, 0.11, 0.885859, -0.0, 0.09, 0.885859, -0.0, 0.1, 0.895859, -0.0, 0.1,
    0.875859, -0.0, 0.11, 0.925859, -0.0, 0.09, 0.925859, -0.0, 0.1, 0.935859,
    -0.0, 0.1, 0.915859, -0.0, 0.11, 0.965859, -0.0, 0.09, 0.965859, -0.0, 0.1,
    0.975859, -0.0, 0.1, 0.955859, -0.0, 0.11, 1.005859, -0.0, 0.09, 1.005859,
    -0.0, 0.1, 1.015859, -0.0, 0.1, 0.995859, -0.0, 0.11, 1.045859, -0.0, 0.09,
    1.045859, -0.0, 0.1, 1.055859, -0.0, 0.1, 1.035859, -0.0, 0.11, 1.085859,
    -0.0, 0.09, 1.085859, -0.0, 0.1, 1.095859, -0.0, 0.1, 1.075859, -0.0, 0.11,
    1.125859, -0.0, 0.09, 1.125859, -0.0, 0.1, 1.135859, -0.0, 0.1, 1.115859,
    -0.0, 0.07, 0.365859, -0.0, 0.05, 0.365859, -0.0, 0.06, 0.375859, -0.0,
    0.06, 0.355859, -0.0, 0.07, 0.405859, -0.0, 0.05, 0.405859, -0.0, 0.06,
    0.415859, -0.0, 0.06, 0.395859, -0.0, 0.07, 0.445859, -0.0, 0.05, 0.445859,
    -0.0, 0.06, 0.455859, -0.0, 0.06, 0.435859, -0.0, 0.07, 0.485859, -0.0,
    0.05, 0.485859, -0.0, 0.06, 0.495859, -0.0, 0.06, 0.475859, -0.0, 0.07,
    0.525859, -0.0, 0.05, 0.525859, -0.0, 0.06, 0.535859, -0.0, 0.06, 0.515859,
    -0.0, 0.07, 0.565859, -0.0, 0.05, 0.565859, -0.0, 0.06, 0.575859, -0.0,
    0.06, 0.555859, -0.0, 0.07, 0.605859, -0.0, 0.05, 0.605859, -0.0, 0.06,
    0.615859, -0.0, 0.06, 0.595859, -0.0, 0.07, 0.645859, -0.0, 0.05, 0.645859,
    -0.0, 0.06, 0.655859, -0.0, 0.06, 0.635859, -0.0, 0.07, 0.685859, -0.0,
    0.05, 0.685859, -0.0, 0.06, 0.695859, -0.0, 0.06, 0.675859, -0.0, 0.07,
    0.725859, -0.0, 0.05, 0.725859, -0.0, 0.06, 0.735859, -0.0, 0.06, 0.715859,
    -0.0, 0.07, 0.765859, -0.0, 0.05, 0.765859, -0.0, 0.06, 0.775859, -0.0,
    0.06, 0.755859, -0.0, 0.07, 0.805859, -0.0, 0.05, 0.805859, -0.0, 0.06,
    0.815859, -0.0, 0.06, 0.795859, -0.0, 0.07, 0.845859, -0.0, 0.05, 0.845859,
    -0.0, 0.06, 0.855859, -0.0, 0.06, 0.835859, -0.0, 0.07, 0.885859, -0.0,
    0.05, 0.885859, -0.0, 0.06, 0.895859, -0.0, 0.06, 0.875859, -0.0, 0.07,
    0.925859, -0.0, 0.05, 0.925859, -0.0, 0.06, 0.935859, -0.0, 0.06, 0.915859,
    -0.0, 0.07, 0.965859, -0.0, 0.05, 0.965859, -0.0, 0.06, 0.975859, -0.0,
    0.06, 0.955859, -0.0, 0.07, 1.005859, -0.0, 0.05, 1.005859, -0.0, 0.06,
    1.015859, -0.0, 0.06, 0.995859, -0.0, 0.07, 1.045859, -0.0, 0.05, 1.045859,
    -0.0, 0.06, 1.055859, -0.0, 0.06, 1.035859, -0.0, 0.07, 1.085859, -0.0,
    0.05, 1.085859, -0.0, 0.06, 1.095859, -0.0, 0.06, 1.075859, -0.0, 0.07,
    1.125859, -0.0, 0.05, 1.125859, -0.0, 0.06, 1.135859, -0.0, 0.06, 1.115859,
    -0.0, 0.03, 0.365859, -0.0, 0.01, 0.365859, -0.0, 0.02, 0.375859, -0.0,
    0.02, 0.355859, -0.0, 0.03, 0.405859, -0.0, 0.01, 0.405859, -0.0, 0.02,
    0.415859, -0.0, 0.02, 0.395859, -0.0, 0.03, 0.445859, -0.0, 0.01, 0.445859,
    -0.0, 0.02, 0.455859, -0.0, 0.02, 0.435859, -0.0, 0.03, 0.485859, -0.0,
    0.01, 0.485859, -0.0, 0.02, 0.495859, -0.0, 0.02, 0.475859, -0.0, 0.03,
    0.525859, -0.0, 0.01, 0.525859, -0.0, 0.02, 0.535859, -0.0, 0.02, 0.515859,
    -0.0, 0.03, 0.565859, -0.0, 0.01, 0.565859, -0.0, 0.02, 0.575859, -0.0,
    0.02, 0.555859, -0.0, 0.03, 0.605859, -0.0, 0.01, 0.605859, -0.0, 0.02,
    0.615859, -0.0, 0.02, 0.595859, -0.0, 0.03, 0.645859, -0.0, 0.01, 0.645859,
    -0.0, 0.02, 0.655859, -0.0, 0.02, 0.635859, -0.0, 0.03, 0.685859, -0.0,
    0.01, 0.685859, -0.0, 0.02, 0.695859, -0.0, 0.02, 0.675859, -0.0, 0.03,
    0.725859, -0.0, 0.01, 0.725859, -0.0, 0.02, 0.735859, -0.0, 0.02, 0.715859,
    -0.0, 0.03, 0.765859, -0.0, 0.01, 0.765859, -0.0, 0.02, 0.775859, -0.0,
    0.02, 0.755859, -0.0, 0.03, 0.805859, -0.0, 0.01, 0.805859, -0.0, 0.02,
    0.815859, -0.0, 0.02, 0.795859, -0.0, 0.03, 0.845859, -0.0, 0.01, 0.845859,
    -0.0, 0.02, 0.855859, -0.0, 0.02, 0.835859, -0.0, 0.03, 0.885859, -0.0,
    0.01, 0.885859, -0.0, 0.02, 0.895859, -0.0, 0.02, 0.875859, -0.0, 0.03,
    0.925859, -0.0, 0.01, 0.925859, -0.0, 0.02, 0.935859, -0.0, 0.02, 0.915859,
    -0.0, 0.03, 0.965859, -0.0, 0.01, 0.965859, -0.0, 0.02, 0.975859, -0.0,
    0.02, 0.955859, -0.0, 0.03, 1.005859, -0.0, 0.01, 1.005859, -0.0, 0.02,
    1.015859, -0.0, 0.02, 0.995859, -0.0, 0.03, 1.045859, -0.0, 0.01, 1.045859,
    -0.0, 0.02, 1.055859, -0.0, 0.02, 1.035859, -0.0, 0.03, 1.085859, -0.0,
    0.01, 1.085859, -0.0, 0.02, 1.095859, -0.0, 0.02, 1.075859, -0.0, 0.03,
    1.125859, -0.0, 0.01, 1.125859, -0.0, 0.02, 1.135859, -0.0, 0.02, 1.115859,
    -0.0, -0.01, 0.365859, -0.0, -0.03, 0.365859, -0.0, -0.02, 0.375859, -0.0,
    -0.02, 0.355859, -0.0, -0.01, 0.405859, -0.0, -0.03, 0.405859, -0.0, -0.02,
    0.415859, -0.0, -0.02, 0.395859, -0.0, -0.01, 0.445859, -0.0, -0.03,
    0.445859, -0.0, -0.02, 0.455859, -0.0, -0.02, 0.435859, -0.0, -0.01,
    0.485859, -0.0, -0.03, 0.485859, -0.0, -0.02, 0.495859, -0.0, -0.02,
    0.475859, -0.0, -0.01, 0.525859, -0.0, -0.03, 0.525859, -0.0, -0.02,
    0.535859, -0.0, -0.02, 0.515859, -0.0, -0.01, 0.565859, -0.0, -0.03,
    0.565859, -0.0, -0.02, 0.575859, -0.0, -0.02, 0.555859, -0.0, -0.01,
    0.605859, -0.0, -0.03, 0.605859, -0.0, -0.02, 0.615859, -0.0, -0.02,
    0.595859, -0.0, -0.01, 0.645859, -0.0, -0.03, 0.645859, -0.0, -0.02,
    0.655859, -0.0, -0.02, 0.635859, -0.0, -0.01, 0.685859, -0.0, -0.03,
    0.685859, -0.0, -0.02, 0.695859, -0.0, -0.02, 0.675859, -0.0, -0.01,
    0.725859, -0.0, -0.03, 0.725859, -0.0, -0.02, 0.735859, -0.0, -0.02,
    0.715859, -0.0, -0.01, 0.765859, -0.0, -0.03, 0.765859, -0.0, -0.02,
    0.775859, -0.0, -0.02, 0.755859, -0.0, -0.01, 0.805859, -0.0, -0.03,
    0.805859, -0.0, -0.02, 0.815859, -0.0, -0.02, 0.795859, -0.0, -0.01,
    0.845859, -0.0, -0.03, 0.845859, -0.0, -0.02, 0.855859, -0.0, -0.02,
    0.835859, -0.0, -0.01, 0.885859, -0.0, -0.03, 0.885859, -0.0, -0.02,
    0.895859, -0.0, -0.02, 0.875859, -0.0, -0.01, 0.925859, -0.0, -0.03,
    0.925859, -0.0, -0.02, 0.935859, -0.0, -0.02, 0.915859, -0.0, -0.01,
    0.965859, -0.0, -0.03, 0.965859, -0.0, -0.02, 0.975859, -0.0, -0.02,
    0.955859, -0.0, -0.01, 1.005859, -0.0, -0.03, 1.005859, -0.0, -0.02,
    1.015859, -0.0, -0.02, 0.995859, -0.0, -0.01, 1.045859, -0.0, -0.03,
    1.045859, -0.0, -0.02, 1.055859, -0.0, -0.02, 1.035859, -0.0, -0.01,
    1.085859, -0.0, -0.03, 1.085859, -0.0, -0.02, 1.095859, -0.0, -0.02,
    1.075859, -0.0, -0.01, 1.125859, -0.0, -0.03, 1.125859, -0.0, -0.02,
    1.135859, -0.0, -0.02, 1.115859, -0.0, -0.05, 0.365859, -0.0, -0.07,
    0.365859, -0.0, -0.06, 0.375859, -0.0, -0.06, 0.355859, -0.0, -0.05,
    0.405859, -0.0, -0.07, 0.405859, -0.0, -0.06, 0.415859, -0.0, -0.06,
    0.395859, -0.0, -0.05, 0.445859, -0.0, -0.07, 0.445859, -0.0, -0.06,
    0.455859, -0.0, -0.06, 0.435859, -0.0, -0.05, 0.485859, -0.0, -0.07,
    0.485859, -0.0, -0.06, 0.495859, -0.0, -0.06, 0.475859, -0.0, -0.05,
    0.525859, -0.0, -0.07, 0.525859, -0.0, -0.06, 0.535859, -0.0, -0.06,
    0.515859, -0.0, -0.05, 0.565859, -0.0, -0.07, 0.565859, -0.0, -0.06,
    0.575859, -0.0, -0.06, 0.555859, -0.0, -0.05, 0.605859, -0.0, -0.07,
    0.605859, -0.0, -0.06, 0.615859, -0.0, -0.06, 0.595859, -0.0, -0.05,
    0.645859, -0.0, -0.07, 0.645859, -0.0, -0.06, 0.655859, -0.0, -0.06,
    0.635859, -0.0, -0.05, 0.685859, -0.0, -0.07, 0.685859, -0.0, -0.06,
    0.695859, -0.0, -0.06, 0.675859, -0.0, -0.05, 0.725859, -0.0, -0.07,
    0.725859, -0.0, -0.06, 0.735859, -0.0, -0.06, 0.715859, -0.0, -0.05,
    0.765859, -0.0, -0.07, 0.765859, -0.0, -0.06, 0.775859, -0.0, -0.06,
    0.755859, -0.0, -0.05, 0.805859, -0.0, -0.07, 0.805859, -0.0, -0.06,
    0.815859, -0.0, -0.06, 0.795859, -0.0, -0.05, 0.845859, -0.0, -0.07,
    0.845859, -0.0, -0.06, 0.855859, -0.0, -0.06, 0.835859, -0.0, -0.05,
    0.885859, -0.0, -0.07, 0.885859, -0.0, -0.06, 0.895859, -0.0, -0.06,
    0.875859, -0.0, -0.05, 0.925859, -0.0, -0.07, 0.925859, -0.0, -0.06,
    0.935859, -0.0, -0.06, 0.915859, -0.0, -0.05, 0.965859, -0.0, -0.07,
    0.965859, -0.0, -0.06, 0.975859, -0.0, -0.06, 0.955859, -0.0, -0.05,
    1.005859, -0.0, -0.07, 1.005859, -0.0, -0.06, 1.015859, -0.0, -0.06,
    0.995859, -0.0, -0.05, 1.045859, -0.0, -0.07, 1.045859, -0.0, -0.06,
    1.055859, -0.0, -0.06, 1.035859, -0.0, -0.05, 1.085859, -0.0, -0.07,
    1.085859, -0.0, -0.06, 1.095859, -0.0, -0.06, 1.075859, -0.0, -0.05,
    1.125859, -0.0, -0.07, 1.125859, -0.0, -0.06, 1.135859, -0.0, -0.06,
    1.115859, -0.0, -0.09, 0.365859, -0.0, -0.11, 0.365859, -0.0, -0.1,
    0.375859, -0.0, -0.1, 0.355859, -0.0, -0.09, 0.405859, -0.0, -0.11,
    0.405859, -0.0, -0.1, 0.415859, -0.0, -0.1, 0.395859, -0.0, -0.09, 0.445859,
    -0.0, -0.11, 0.445859, -0.0, -0.1, 0.455859, -0.0, -0.1, 0.435859, -0.0,
    -0.09, 0.485859, -0.0, -0.11, 0.485859, -0.0, -0.1, 0.495859, -0.0, -0.1,
    0.475859, -0.0, -0.09, 0.525859, -0.0, -0.11, 0.525859, -0.0, -0.1,
    0.535859, -0.0, -0.1, 0.515859, -0.0, -0.09, 0.565859, -0.0, -0.11,
    0.565859, -0.0, -0.1, 0.575859, -0.0, -0.1, 0.555859, -0.0, -0.09, 0.605859,
    -0.0, -0.11, 0.605859, -0.0, -0.1, 0.615859, -0.0, -0.1, 0.595859, -0.0,
    -0.09, 0.645859, -0.0, -0.11, 0.645859, -0.0, -0.1, 0.655859, -0.0, -0.1,
    0.635859, -0.0, -0.09, 0.685859, -0.0, -0.11, 0.685859, -0.0, -0.1,
    0.695859, -0.0, -0.1, 0.675859, -0.0, -0.09, 0.725859, -0.0, -0.11,
    0.725859, -0.0, -0.1, 0.735859, -0.0, -0.1, 0.715859, -0.0, -0.09, 0.765859,
    -0.0, -0.11, 0.765859, -0.0, -0.1, 0.775859, -0.0, -0.1, 0.755859, -0.0,
    -0.09, 0.805859, -0.0, -0.11, 0.805859, -0.0, -0.1, 0.815859, -0.0, -0.1,
    0.795859, -0.0, -0.09, 0.845859, -0.0, -0.11, 0.845859, -0.0, -0.1,
    0.855859, -0.0, -0.1, 0.835859, -0.0, -0.09, 0.885859, -0.0, -0.11,
    0.885859, -0.0, -0.1, 0.895859, -0.0, -0.1, 0.875859, -0.0, -0.09, 0.925859,
    -0.0, -0.11, 0.925859, -0.0, -0.1, 0.935859, -0.0, -0.1, 0.915859, -0.0,
    -0.09, 0.965859, -0.0, -0.11, 0.965859, -0.0, -0.1, 0.975859, -0.0, -0.1,
    0.955859, -0.0, -0.09, 1.005859, -0.0, -0.11, 1.005859, -0.0, -0.1,
    1.015859, -0.0, -0.1, 0.995859, -0.0, -0.09, 1.045859, -0.0, -0.11,
    1.045859, -0.0, -0.1, 1.055859, -0.0, -0.1, 1.035859, -0.0, -0.09, 1.085859,
    -0.0, -0.11, 1.085859, -0.0, -0.1, 1.095859, -0.0, -0.1, 1.075859, -0.0,
    -0.09, 1.125859, -0.0, -0.11, 1.125859, -0.0, -0.1, 1.135859, -0.0, -0.1,
    1.115859, -0.0, -0.13, 0.365859, -0.0, -0.15, 0.365859, -0.0, -0.14,
    0.375859, -0.0, -0.14, 0.355859, -0.0, -0.13, 0.405859, -0.0, -0.15,
    0.405859, -0.0, -0.14, 0.415859, -0.0, -0.14, 0.395859, -0.0, -0.13,
    0.445859, -0.0, -0.15, 0.445859, -0.0, -0.14, 0.455859, -0.0, -0.14,
    0.435859, -0.0, -0.13, 0.485859, -0.0, -0.15, 0.485859, -0.0, -0.14,
    0.495859, -0.0, -0.14, 0.475859, -0.0, -0.13, 0.525859, -0.0, -0.15,
    0.525859, -0.0, -0.14, 0.535859, -0.0, -0.14, 0.515859, -0.0, -0.13,
    0.565859, -0.0, -0.15, 0.565859, -0.0, -0.14, 0.575859, -0.0, -0.14,
    0.555859, -0.0, -0.13, 0.605859, -0.0, -0.15, 0.605859, -0.0, -0.14,
    0.615859, -0.0, -0.14, 0.595859, -0.0, -0.13, 0.645859, -0.0, -0.15,
    0.645859, -0.0, -0.14, 0.655859, -0.0, -0.14, 0.635859, -0.0, -0.13,
    0.685859, -0.0, -0.15, 0.685859, -0.0, -0.14, 0.695859, -0.0, -0.14,
    0.675859, -0.0, -0.13, 0.725859, -0.0, -0.15, 0.725859, -0.0, -0.14,
    0.735859, -0.0, -0.14, 0.715859, -0.0, -0.13, 0.765859, -0.0, -0.15,
    0.765859, -0.0, -0.14, 0.775859, -0.0, -0.14, 0.755859, -0.0, -0.13,
    0.805859, -0.0, -0.15, 0.805859, -0.0, -0.14, 0.815859, -0.0, -0.14,
    0.795859, -0.0, -0.13, 0.845859, -0.0, -0.15, 0.845859, -0.0, -0.14,
    0.855859, -0.0, -0.14, 0.835859, -0.0, -0.13, 0.885859, -0.0, -0.15,
    0.885859, -0.0, -0.14, 0.895859, -0.0, -0.14, 0.875859, -0.0, -0.13,
    0.925859, -0.0, -0.15, 0.925859, -0.0, -0.14, 0.935859, -0.0, -0.14,
    0.915859, -0.0, -0.13, 0.965859, -0.0, -0.15, 0.965859, -0.0, -0.14,
    0.975859, -0.0, -0.14, 0.955859, -0.0, -0.13, 1.005859, -0.0, -0.15,
    1.005859, -0.0, -0.14, 1.015859, -0.0, -0.14, 0.995859, -0.0, -0.13,
    1.045859, -0.0, -0.15, 1.045859, -0.0, -0.14, 1.055859, -0.0, -0.14,
    1.035859, -0.0, -0.13, 1.085859, -0.0, -0.15, 1.085859, -0.0, -0.14,
    1.095859, -0.0, -0.14, 1.075859, -0.0, -0.13, 1.125859, -0.0, -0.15,
    1.125859, -0.0, -0.14, 1.135859, -0.0, -0.14, 1.115859, -0.0, -0.17,
    0.365859, -0.0, -0.19, 0.365859, -0.0, -0.18, 0.375859, -0.0, -0.18,
    0.355859, -0.0, -0.17, 0.405859, -0.0, -0.19, 0.405859, -0.0, -0.18,
    0.415859, -0.0, -0.18, 0.395859, -0.0, -0.17, 0.445859, -0.0, -0.19,
    0.445859, -0.0, -0.18, 0.455859, -0.0, -0.18, 0.435859, -0.0, -0.17,
    0.485859, -0.0, -0.19, 0.485859, -0.0, -0.18, 0.495859, -0.0, -0.18,
    0.475859, -0.0, -0.17, 0.525859, -0.0, -0.19, 0.525859, -0.0, -0.18,
    0.535859, -0.0, -0.18, 0.515859, -0.0, -0.17, 0.565859, -0.0, -0.19,
    0.565859, -0.0, -0.18, 0.575859, -0.0, -0.18, 0.555859, -0.0, -0.17,
    0.605859, -0.0, -0.19, 0.605859, -0.0, -0.18, 0.615859, -0.0, -0.18,
    0.595859, -0.0, -0.17, 0.645859, -0.0, -0.19, 0.645859, -0.0, -0.18,
    0.655859, -0.0, -0.18, 0.635859, -0.0, -0.17, 0.685859, -0.0, -0.19,
    0.685859, -0.0, -0.18, 0.695859, -0.0, -0.18, 0.675859, -0.0, -0.17,
    0.725859, -0.0, -0.19, 0.725859, -0.0, -0.18, 0.735859, -0.0, -0.18,
    0.715859, -0.0, -0.17, 0.765859, -0.0, -0.19, 0.765859, -0.0, -0.18,
    0.775859, -0.0, -0.18, 0.755859, -0.0, -0.17, 0.805859, -0.0, -0.19,
    0.805859, -0.0, -0.18, 0.815859, -0.0, -0.18, 0.795859, -0.0, -0.17,
    0.845859, -0.0, -0.19, 0.845859, -0.0, -0.18, 0.855859, -0.0, -0.18,
    0.835859, -0.0, -0.17, 0.885859, -0.0, -0.19, 0.885859, -0.0, -0.18,
    0.895859, -0.0, -0.18, 0.875859, -0.0, -0.17, 0.925859, -0.0, -0.19,
    0.925859, -0.0, -0.18, 0.935859, -0.0, -0.18, 0.915859, -0.0, -0.17,
    0.965859, -0.0, -0.19, 0.965859, -0.0, -0.18, 0.975859, -0.0, -0.18,
    0.955859, -0.0, -0.17, 1.005859, -0.0, -0.19, 1.005859, -0.0, -0.18,
    1.015859, -0.0, -0.18, 0.995859, -0.0, -0.17, 1.045859, -0.0, -0.19,
    1.045859, -0.0, -0.18, 1.055859, -0.0, -0.18, 1.035859, -0.0, -0.17,
    1.085859, -0.0, -0.19, 1.085859, -0.0, -0.18, 1.095859, -0.0, -0.18,
    1.075859, -0.0, -0.17, 1.125859, -0.0, -0.19, 1.125859, -0.0, -0.18,
    1.135859, -0.0, -0.18, 1.115859, -0.0, -0.19, 1.115859, -0.0, -0.19,
    1.135859, -0.0, -0.17, 1.135859, -0.0, -0.19, 1.075859, -0.0, -0.19,
    1.095859, -0.0, -0.17, 1.095859, -0.0, -0.19, 1.035859, -0.0, -0.19,
    1.055859, -0.0, -0.17, 1.055859, -0.0, -0.19, 0.995859, -0.0, -0.19,
    1.015859, -0.0, -0.17, 1.015859, -0.0, -0.19, 0.955859, -0.0, -0.19,
    0.975859, -0.0, -0.17, 0.975859, -0.0, -0.19, 0.915859, -0.0, -0.19,
    0.935859, -0.0, -0.17, 0.935859, -0.0, -0.19, 0.875859, -0.0, -0.19,
    0.895859, -0.0, -0.17, 0.895859, -0.0, -0.19, 0.835859, -0.0, -0.19,
    0.855859, -0.0, -0.17, 0.855859, -0.0, -0.19, 0.795859, -0.0, -0.19,
    0.815859, -0.0, -0.17, 0.815859, -0.0, -0.19, 0.755859, -0.0, -0.19,
    0.775859, -0.0, -0.17, 0.775859, -0.0, -0.19, 0.715859, -0.0, -0.19,
    0.735859, -0.0, -0.17, 0.735859, -0.0, -0.19, 0.675859, -0.0, -0.19,
    0.695859, -0.0, -0.17, 0.695859, -0.0, -0.19, 0.635859, -0.0, -0.19,
    0.655859, -0.0, -0.17, 0.655859, -0.0, -0.19, 0.595859, -0.0, -0.19,
    0.615859, -0.0, -0.17, 0.615859, -0.0, -0.19, 0.555859, -0.0, -0.19,
    0.575859, -0.0, -0.17, 0.575859, -0.0, -0.19, 0.515859, -0.0, -0.19,
    0.535859, -0.0, -0.17, 0.535859, -0.0, -0.19, 0.475859, -0.0, -0.19,
    0.495859, -0.0, -0.17, 0.495859, -0.0, -0.19, 0.435859, -0.0, -0.19,
    0.455859, -0.0, -0.17, 0.455859, -0.0, -0.19, 0.395859, -0.0, -0.19,
    0.415859, -0.0, -0.17, 0.415859, -0.0, -0.19, 0.355859, -0.0, -0.19,
    0.375859, -0.0, -0.17, 0.375859, -0.0, -0.15, 1.115859, -0.0, -0.15,
    1.135859, -0.0, -0.13, 1.135859, -0.0, -0.15, 1.075859, -0.0, -0.15,
    1.095859, -0.0, -0.13, 1.095859, -0.0, -0.15, 1.035859, -0.0, -0.15,
    1.055859, -0.0, -0.13, 1.055859, -0.0, -0.15, 0.995859, -0.0, -0.15,
    1.015859, -0.0, -0.13, 1.015859, -0.0, -0.15, 0.955859, -0.0, -0.15,
    0.975859, -0.0, -0.13, 0.975859, -0.0, -0.15, 0.915859, -0.0, -0.15,
    0.935859, -0.0, -0.13, 0.935859, -0.0, -0.15, 0.875859, -0.0, -0.15,
    0.895859, -0.0, -0.13, 0.895859, -0.0, -0.15, 0.835859, -0.0, -0.15,
    0.855859, -0.0, -0.13, 0.855859, -0.0, -0.15, 0.795859, -0.0, -0.15,
    0.815859, -0.0, -0.13, 0.815859, -0.0, -0.15, 0.755859, -0.0, -0.15,
    0.775859, -0.0, -0.13, 0.775859, -0.0, -0.15, 0.715859, -0.0, -0.15,
    0.735859, -0.0, -0.13, 0.735859, -0.0, -0.15, 0.675859, -0.0, -0.15,
    0.695859, -0.0, -0.13, 0.695859, -0.0, -0.15, 0.635859, -0.0, -0.15,
    0.655859, -0.0, -0.13, 0.655859, -0.0, -0.15, 0.595859, -0.0, -0.15,
    0.615859, -0.0, -0.13, 0.615859, -0.0, -0.15, 0.555859, -0.0, -0.15,
    0.575859, -0.0, -0.13, 0.575859, -0.0, -0.15, 0.515859, -0.0, -0.15,
    0.535859, -0.0, -0.13, 0.535859, -0.0, -0.15, 0.475859, -0.0, -0.15,
    0.495859, -0.0, -0.13, 0.495859, -0.0, -0.15, 0.435859, -0.0, -0.15,
    0.455859, -0.0, -0.13, 0.455859, -0.0, -0.15, 0.395859, -0.0, -0.15,
    0.415859, -0.0, -0.13, 0.415859, -0.0, -0.15, 0.355859, -0.0, -0.15,
    0.375859, -0.0, -0.13, 0.375859, -0.0, -0.11, 1.115859, -0.0, -0.11,
    1.135859, -0.0, -0.09, 1.135859, -0.0, -0.11, 1.075859, -0.0, -0.11,
    1.095859, -0.0, -0.09, 1.095859, -0.0, -0.11, 1.035859, -0.0, -0.11,
    1.055859, -0.0, -0.09, 1.055859, -0.0, -0.11, 0.995859, -0.0, -0.11,
    1.015859, -0.0, -0.09, 1.015859, -0.0, -0.11, 0.955859, -0.0, -0.11,
    0.975859, -0.0, -0.09, 0.975859, -0.0, -0.11, 0.915859, -0.0, -0.11,
    0.935859, -0.0, -0.09, 0.935859, -0.0, -0.11, 0.875859, -0.0, -0.11,
    0.895859, -0.0, -0.09, 0.895859, -0.0, -0.11, 0.835859, -0.0, -0.11,
    0.855859, -0.0, -0.09, 0.855859, -0.0, -0.11, 0.795859, -0.0, -0.11,
    0.815859, -0.0, -0.09, 0.815859, -0.0, -0.11, 0.755859, -0.0, -0.11,
    0.775859, -0.0, -0.09, 0.775859, -0.0, -0.11, 0.715859, -0.0, -0.11,
    0.735859, -0.0, -0.09, 0.735859, -0.0, -0.11, 0.675859, -0.0, -0.11,
    0.695859, -0.0, -0.09, 0.695859, -0.0, -0.11, 0.635859, -0.0, -0.11,
    0.655859, -0.0, -0.09, 0.655859, -0.0, -0.11, 0.595859, -0.0, -0.11,
    0.615859, -0.0, -0.09, 0.615859, -0.0, -0.11, 0.555859, -0.0, -0.11,
    0.575859, -0.0, -0.09, 0.575859, -0.0, -0.11, 0.515859, -0.0, -0.11,
    0.535859, -0.0, -0.09, 0.535859, -0.0, -0.11, 0.475859, -0.0, -0.11,
    0.495859, -0.0, -0.09, 0.495859, -0.0, -0.11, 0.435859, -0.0, -0.11,
    0.455859, -0.0, -0.09, 0.455859, -0.0, -0.11, 0.395859, -0.0, -0.11,
    0.415859, -0.0, -0.09, 0.415859, -0.0, -0.11, 0.355859, -0.0, -0.11,
    0.375859, -0.0, -0.09, 0.375859, -0.0, -0.07, 1.115859, -0.0, -0.07,
    1.135859, -0.0, -0.05, 1.135859, -0.0, -0.07, 1.075859, -0.0, -0.07,
    1.095859, -0.0, -0.05, 1.095859, -0.0, -0.07, 1.035859, -0.0, -0.07,
    1.055859, -0.0, -0.05, 1.055859, -0.0, -0.07, 0.995859, -0.0, -0.07,
    1.015859, -0.0, -0.05, 1.015859, -0.0, -0.07, 0.955859, -0.0, -0.07,
    0.975859, -0.0, -0.05, 0.975859, -0.0, -0.07, 0.915859, -0.0, -0.07,
    0.935859, -0.0, -0.05, 0.935859, -0.0, -0.07, 0.875859, -0.0, -0.07,
    0.895859, -0.0, -0.05, 0.895859, -0.0, -0.07, 0.835859, -0.0, -0.07,
    0.855859, -0.0, -0.05, 0.855859, -0.0, -0.07, 0.795859, -0.0, -0.07,
    0.815859, -0.0, -0.05, 0.815859, -0.0, -0.07, 0.755859, -0.0, -0.07,
    0.775859, -0.0, -0.05, 0.775859, -0.0, -0.07, 0.715859, -0.0, -0.07,
    0.735859, -0.0, -0.05, 0.735859, -0.0, -0.07, 0.675859, -0.0, -0.07,
    0.695859, -0.0, -0.05, 0.695859, -0.0, -0.07, 0.635859, -0.0, -0.07,
    0.655859, -0.0, -0.05, 0.655859, -0.0, -0.07, 0.595859, -0.0, -0.07,
    0.615859, -0.0, -0.05, 0.615859, -0.0, -0.07, 0.555859, -0.0, -0.07,
    0.575859, -0.0, -0.05, 0.575859, -0.0, -0.07, 0.515859, -0.0, -0.07,
    0.535859, -0.0, -0.05, 0.535859, -0.0, -0.07, 0.475859, -0.0, -0.07,
    0.495859, -0.0, -0.05, 0.495859, -0.0, -0.07, 0.435859, -0.0, -0.07,
    0.455859, -0.0, -0.05, 0.455859, -0.0, -0.07, 0.395859, -0.0, -0.07,
    0.415859, -0.0, -0.05, 0.415859, -0.0, -0.07, 0.355859, -0.0, -0.07,
    0.375859, -0.0, -0.05, 0.375859, -0.0, -0.03, 1.115859, -0.0, -0.03,
    1.135859, -0.0, -0.01, 1.135859, -0.0, -0.03, 1.075859, -0.0, -0.03,
    1.095859, -0.0, -0.01, 1.095859, -0.0, -0.03, 1.035859, -0.0, -0.03,
    1.055859, -0.0, -0.01, 1.055859, -0.0, -0.03, 0.995859, -0.0, -0.03,
    1.015859, -0.0, -0.01, 1.015859, -0.0, -0.03, 0.955859, -0.0, -0.03,
    0.975859, -0.0, -0.01, 0.975859, -0.0, -0.03, 0.915859, -0.0, -0.03,
    0.935859, -0.0, -0.01, 0.935859, -0.0, -0.03, 0.875859, -0.0, -0.03,
    0.895859, -0.0, -0.01, 0.895859, -0.0, -0.03, 0.835859, -0.0, -0.03,
    0.855859, -0.0, -0.01, 0.855859, -0.0, -0.03, 0.795859, -0.0, -0.03,
    0.815859, -0.0, -0.01, 0.815859, -0.0, -0.03, 0.755859, -0.0, -0.03,
    0.775859, -0.0, -0.01, 0.775859, -0.0, -0.03, 0.715859, -0.0, -0.03,
    0.735859, -0.0, -0.01, 0.735859, -0.0, -0.03, 0.675859, -0.0, -0.03,
    0.695859, -0.0, -0.01, 0.695859, -0.0, -0.03, 0.635859, -0.0, -0.03,
    0.655859, -0.0, -0.01, 0.655859, -0.0, -0.03, 0.595859, -0.0, -0.03,
    0.615859, -0.0, -0.01, 0.615859, -0.0, -0.03, 0.555859, -0.0, -0.03,
    0.575859, -0.0, -0.01, 0.575859, -0.0, -0.03, 0.515859, -0.0, -0.03,
    0.535859, -0.0, -0.01, 0.535859, -0.0, -0.03, 0.475859, -0.0, -0.03,
    0.495859, -0.0, -0.01, 0.495859, -0.0, -0.03, 0.435859, -0.0, -0.03,
    0.455859, -0.0, -0.01, 0.455859, -0.0, -0.03, 0.395859, -0.0, -0.03,
    0.415859, -0.0, -0.01, 0.415859, -0.0, -0.03, 0.355859, -0.0, -0.03,
    0.375859, -0.0, -0.01, 0.375859, -0.0, 0.01, 1.115859, -0.0, 0.01, 1.135859,
    -0.0, 0.03, 1.135859, -0.0, 0.01, 1.075859, -0.0, 0.01, 1.095859, -0.0,
    0.03, 1.095859, -0.0, 0.01, 1.035859, -0.0, 0.01, 1.055859, -0.0, 0.03,
    1.055859, -0.0, 0.01, 0.995859, -0.0, 0.01, 1.015859, -0.0, 0.03, 1.015859,
    -0.0, 0.01, 0.955859, -0.0, 0.01, 0.975859, -0.0, 0.03, 0.975859, -0.0,
    0.01, 0.915859, -0.0, 0.01, 0.935859, -0.0, 0.03, 0.935859, -0.0, 0.01,
    0.875859, -0.0, 0.01, 0.895859, -0.0, 0.03, 0.895859, -0.0, 0.01, 0.835859,
    -0.0, 0.01, 0.855859, -0.0, 0.03, 0.855859, -0.0, 0.01, 0.795859, -0.0,
    0.01, 0.815859, -0.0, 0.03, 0.815859, -0.0, 0.01, 0.755859, -0.0, 0.01,
    0.775859, -0.0, 0.03, 0.775859, -0.0, 0.01, 0.715859, -0.0, 0.01, 0.735859,
    -0.0, 0.03, 0.735859, -0.0, 0.01, 0.675859, -0.0, 0.01, 0.695859, -0.0,
    0.03, 0.695859, -0.0, 0.01, 0.635859, -0.0, 0.01, 0.655859, -0.0, 0.03,
    0.655859, -0.0, 0.01, 0.595859, -0.0, 0.01, 0.615859, -0.0, 0.03, 0.615859,
    -0.0, 0.01, 0.555859, -0.0, 0.01, 0.575859, -0.0, 0.03, 0.575859, -0.0,
    0.01, 0.515859, -0.0, 0.01, 0.535859, -0.0, 0.03, 0.535859, -0.0, 0.01,
    0.475859, -0.0, 0.01, 0.495859, -0.0, 0.03, 0.495859, -0.0, 0.01, 0.435859,
    -0.0, 0.01, 0.455859, -0.0, 0.03, 0.455859, -0.0, 0.01, 0.395859, -0.0,
    0.01, 0.415859, -0.0, 0.03, 0.415859, -0.0, 0.01, 0.355859, -0.0, 0.01,
    0.375859, -0.0, 0.03, 0.375859, -0.0, 0.05, 1.115859, -0.0, 0.05, 1.135859,
    -0.0, 0.07, 1.135859, -0.0, 0.05, 1.075859, -0.0, 0.05, 1.095859, -0.0,
    0.07, 1.095859, -0.0, 0.05, 1.035859, -0.0, 0.05, 1.055859, -0.0, 0.07,
    1.055859, -0.0, 0.05, 0.995859, -0.0, 0.05, 1.015859, -0.0, 0.07, 1.015859,
    -0.0, 0.05, 0.955859, -0.0, 0.05, 0.975859, -0.0, 0.07, 0.975859, -0.0,
    0.05, 0.915859, -0.0, 0.05, 0.935859, -0.0, 0.07, 0.935859, -0.0, 0.05,
    0.875859, -0.0, 0.05, 0.895859, -0.0, 0.07, 0.895859, -0.0, 0.05, 0.835859,
    -0.0, 0.05, 0.855859, -0.0, 0.07, 0.855859, -0.0, 0.05, 0.795859, -0.0,
    0.05, 0.815859, -0.0, 0.07, 0.815859, -0.0, 0.05, 0.755859, -0.0, 0.05,
    0.775859, -0.0, 0.07, 0.775859, -0.0, 0.05, 0.715859, -0.0, 0.05, 0.735859,
    -0.0, 0.07, 0.735859, -0.0, 0.05, 0.675859, -0.0, 0.05, 0.695859, -0.0,
    0.07, 0.695859, -0.0, 0.05, 0.635859, -0.0, 0.05, 0.655859, -0.0, 0.07,
    0.655859, -0.0, 0.05, 0.595859, -0.0, 0.05, 0.615859, -0.0, 0.07, 0.615859,
    -0.0, 0.05, 0.555859, -0.0, 0.05, 0.575859, -0.0, 0.07, 0.575859, -0.0,
    0.05, 0.515859, -0.0, 0.05, 0.535859, -0.0, 0.07, 0.535859, -0.0, 0.05,
    0.475859, -0.0, 0.05, 0.495859, -0.0, 0.07, 0.495859, -0.0, 0.05, 0.435859,
    -0.0, 0.05, 0.455859, -0.0, 0.07, 0.455859, -0.0, 0.05, 0.395859, -0.0,
    0.05, 0.415859, -0.0, 0.07, 0.415859, -0.0, 0.05, 0.355859, -0.0, 0.05,
    0.375859, -0.0, 0.07, 0.375859, -0.0, 0.09, 1.115859, -0.0, 0.09, 1.135859,
    -0.0, 0.11, 1.135859, -0.0, 0.09, 1.075859, -0.0, 0.09, 1.095859, -0.0,
    0.11, 1.095859, -0.0, 0.09, 1.035859, -0.0, 0.09, 1.055859, -0.0, 0.11,
    1.055859, -0.0, 0.09, 0.995859, -0.0, 0.09, 1.015859, -0.0, 0.11, 1.015859,
    -0.0, 0.09, 0.955859, -0.0, 0.09, 0.975859, -0.0, 0.11, 0.975859, -0.0,
    0.09, 0.915859, -0.0, 0.09, 0.935859, -0.0, 0.11, 0.935859, -0.0, 0.09,
    0.875859, -0.0, 0.09, 0.895859, -0.0, 0.11, 0.895859, -0.0, 0.09, 0.835859,
    -0.0, 0.09, 0.855859, -0.0, 0.11, 0.855859, -0.0, 0.09, 0.795859, -0.0,
    0.09, 0.815859, -0.0, 0.11, 0.815859, -0.0, 0.09, 0.755859, -0.0, 0.09,
    0.775859, -0.0, 0.11, 0.775859, -0.0, 0.09, 0.715859, -0.0, 0.09, 0.735859,
    -0.0, 0.11, 0.735859, -0.0, 0.09, 0.675859, -0.0, 0.09, 0.695859, -0.0,
    0.11, 0.695859, -0.0, 0.09, 0.635859, -0.0, 0.09, 0.655859, -0.0, 0.11,
    0.655859, -0.0, 0.09, 0.595859, -0.0, 0.09, 0.615859, -0.0, 0.11, 0.615859,
    -0.0, 0.09, 0.555859, -0.0, 0.09, 0.575859, -0.0, 0.11, 0.575859, -0.0,
    0.09, 0.515859, -0.0, 0.09, 0.535859, -0.0, 0.11, 0.535859, -0.0, 0.09,
    0.475859, -0.0, 0.09, 0.495859, -0.0, 0.11, 0.495859, -0.0, 0.09, 0.435859,
    -0.0, 0.09, 0.455859, -0.0, 0.11, 0.455859, -0.0, 0.09, 0.395859, -0.0,
    0.09, 0.415859, -0.0, 0.11, 0.415859, -0.0, 0.09, 0.355859, -0.0, 0.09,
    0.375859, -0.0, 0.11, 0.375859, -0.0, 0.13, 1.115859, -0.0, 0.13, 1.135859,
    -0.0, 0.15, 1.135859, -0.0, 0.13, 1.075859, -0.0, 0.13, 1.095859, -0.0,
    0.15, 1.095859, -0.0, 0.13, 1.035859, -0.0, 0.13, 1.055859, -0.0, 0.15,
    1.055859, -0.0, 0.13, 0.995859, -0.0, 0.13, 1.015859, -0.0, 0.15, 1.015859,
    -0.0, 0.13, 0.955859, -0.0, 0.13, 0.975859, -0.0, 0.15, 0.975859, -0.0,
    0.13, 0.915859, -0.0, 0.13, 0.935859, -0.0, 0.15, 0.935859, -0.0, 0.13,
    0.875859, -0.0, 0.13, 0.895859, -0.0, 0.15, 0.895859, -0.0, 0.13, 0.835859,
    -0.0, 0.13, 0.855859, -0.0, 0.15, 0.855859, -0.0, 0.13, 0.795859, -0.0,
    0.13, 0.815859, -0.0, 0.15, 0.815859, -0.0, 0.13, 0.755859, -0.0, 0.13,
    0.775859, -0.0, 0.15, 0.775859, -0.0, 0.13, 0.715859, -0.0, 0.13, 0.735859,
    -0.0, 0.15, 0.735859, -0.0, 0.13, 0.675859, -0.0, 0.13, 0.695859, -0.0,
    0.15, 0.695859, -0.0, 0.13, 0.635859, -0.0, 0.13, 0.655859, -0.0, 0.15,
    0.655859, -0.0, 0.13, 0.595859, -0.0, 0.13, 0.615859, -0.0, 0.15, 0.615859,
    -0.0, 0.13, 0.555859, -0.0, 0.13, 0.575859, -0.0, 0.15, 0.575859, -0.0,
    0.13, 0.515859, -0.0, 0.13, 0.535859, -0.0, 0.15, 0.535859, -0.0, 0.13,
    0.475859, -0.0, 0.13, 0.495859, -0.0, 0.15, 0.495859, -0.0, 0.13, 0.435859,
    -0.0, 0.13, 0.455859, -0.0, 0.15, 0.455859, -0.0, 0.13, 0.395859, -0.0,
    0.13, 0.415859, -0.0, 0.15, 0.415859, -0.0, 0.13, 0.355859, -0.0, 0.13,
    0.375859, -0.0, 0.15, 0.375859, -0.0, 0.17, 1.115859, -0.0, 0.17, 1.135859,
    -0.0, 0.19, 1.135859, -0.0, 0.17, 1.075859, -0.0, 0.17, 1.095859, -0.0,
    0.19, 1.095859, -0.0, 0.17, 1.035859, -0.0, 0.17, 1.055859, -0.0, 0.19,
    1.055859, -0.0, 0.17, 0.995859, -0.0, 0.17, 1.015859, -0.0, 0.19, 1.015859,
    -0.0, 0.17, 0.955859, -0.0, 0.17, 0.975859, -0.0, 0.19, 0.975859, -0.0,
    0.17, 0.915859, -0.0, 0.17, 0.935859, -0.0, 0.19, 0.935859, -0.0, 0.17,
    0.875859, -0.0, 0.17, 0.895859, -0.0, 0.19, 0.895859, -0.0, 0.17, 0.835859,
    -0.0, 0.17, 0.855859, -0.0, 0.19, 0.855859, -0.0, 0.17, 0.795859, -0.0,
    0.17, 0.815859, -0.0, 0.19, 0.815859, -0.0, 0.17, 0.755859, -0.0, 0.17,
    0.775859, -0.0, 0.19, 0.775859, -0.0, 0.17, 0.715859, -0.0, 0.17, 0.735859,
    -0.0, 0.19, 0.735859, -0.0, 0.17, 0.675859, -0.0, 0.17, 0.695859, -0.0,
    0.19, 0.695859, -0.0, 0.17, 0.635859, -0.0, 0.17, 0.655859, -0.0, 0.19,
    0.655859, -0.0, 0.17, 0.595859, -0.0, 0.17, 0.615859, -0.0, 0.19, 0.615859,
    -0.0, 0.17, 0.555859, -0.0, 0.17, 0.575859, -0.0, 0.19, 0.575859, -0.0,
    0.17, 0.515859, -0.0, 0.17, 0.535859, -0.0, 0.19, 0.535859, -0.0, 0.17,
    0.475859, -0.0, 0.17, 0.495859, -0.0, 0.19, 0.495859, -0.0, 0.17, 0.435859,
    -0.0, 0.17, 0.455859, -0.0, 0.19, 0.455859, -0.0, 0.17, 0.395859, -0.0,
    0.17, 0.415859, -0.0, 0.19, 0.415859, -0.0, 0.17, 0.355859, -0.0, 0.17,
    0.375859, -0.0, 0.19, 0.375859, -0.0, 0.19, 0.355859, -0.0, 0.19, 0.395859,
    -0.0, 0.19, 0.435859, -0.0, 0.19, 0.475859, -0.0, 0.19, 0.515859, -0.0,
    0.19, 0.555859, -0.0, 0.19, 0.595859, -0.0, 0.19, 0.635859, -0.0, 0.19,
    0.675859, -0.0, 0.19, 0.715859, -0.0, 0.19, 0.755859, -0.0, 0.19, 0.795859,
    -0.0, 0.19, 0.835859, -0.0, 0.19, 0.875859, -0.0, 0.19, 0.915859, -0.0,
    0.19, 0.955859, -0.0, 0.19, 0.995859, -0.0, 0.19, 1.035859, -0.0, 0.19,
    1.075859, -0.0, 0.19, 1.115859, -0.0, 0.15, 0.355859, -0.0, 0.15, 0.395859,
    -0.0, 0.15, 0.435859, -0.0, 0.15, 0.475859, -0.0, 0.15, 0.515859, -0.0,
    0.15, 0.555859, -0.0, 0.15, 0.595859, -0.0, 0.15, 0.635859, -0.0, 0.15,
    0.675859, -0.0, 0.15, 0.715859, -0.0, 0.15, 0.755859, -0.0, 0.15, 0.795859,
    -0.0, 0.15, 0.835859, -0.0, 0.15, 0.875859, -0.0, 0.15, 0.915859, -0.0,
    0.15, 0.955859, -0.0, 0.15, 0.995859, -0.0, 0.15, 1.035859, -0.0, 0.15,
    1.075859, -0.0, 0.15, 1.115859, -0.0, 0.11, 0.355859, -0.0, 0.11, 0.395859,
    -0.0, 0.11, 0.435859, -0.0, 0.11, 0.475859, -0.0, 0.11, 0.515859, -0.0,
    0.11, 0.555859, -0.0, 0.11, 0.595859, -0.0, 0.11, 0.635859, -0.0, 0.11,
    0.675859, -0.0, 0.11, 0.715859, -0.0, 0.11, 0.755859, -0.0, 0.11, 0.795859,
    -0.0, 0.11, 0.835859, -0.0, 0.11, 0.875859, -0.0, 0.11, 0.915859, -0.0,
    0.11, 0.955859, -0.0, 0.11, 0.995859, -0.0, 0.11, 1.035859, -0.0, 0.11,
    1.075859, -0.0, 0.11, 1.115859, -0.0, 0.07, 0.355859, -0.0, 0.07, 0.395859,
    -0.0, 0.07, 0.435859, -0.0, 0.07, 0.475859, -0.0, 0.07, 0.515859, -0.0,
    0.07, 0.555859, -0.0, 0.07, 0.595859, -0.0, 0.07, 0.635859, -0.0, 0.07,
    0.675859, -0.0, 0.07, 0.715859, -0.0, 0.07, 0.755859, -0.0, 0.07, 0.795859,
    -0.0, 0.07, 0.835859, -0.0, 0.07, 0.875859, -0.0, 0.07, 0.915859, -0.0,
    0.07, 0.955859, -0.0, 0.07, 0.995859, -0.0, 0.07, 1.035859, -0.0, 0.07,
    1.075859, -0.0, 0.07, 1.115859, -0.0, 0.03, 0.355859, -0.0, 0.03, 0.395859,
    -0.0, 0.03, 0.435859, -0.0, 0.03, 0.475859, -0.0, 0.03, 0.515859, -0.0,
    0.03, 0.555859, -0.0, 0.03, 0.595859, -0.0, 0.03, 0.635859, -0.0, 0.03,
    0.675859, -0.0, 0.03, 0.715859, -0.0, 0.03, 0.755859, -0.0, 0.03, 0.795859,
    -0.0, 0.03, 0.835859, -0.0, 0.03, 0.875859, -0.0, 0.03, 0.915859, -0.0,
    0.03, 0.955859, -0.0, 0.03, 0.995859, -0.0, 0.03, 1.035859, -0.0, 0.03,
    1.075859, -0.0, 0.03, 1.115859, -0.0, -0.01, 0.355859, -0.0, -0.01,
    0.395859, -0.0, -0.01, 0.435859, -0.0, -0.01, 0.475859, -0.0, -0.01,
    0.515859, -0.0, -0.01, 0.555859, -0.0, -0.01, 0.595859, -0.0, -0.01,
    0.635859, -0.0, -0.01, 0.675859, -0.0, -0.01, 0.715859, -0.0, -0.01,
    0.755859, -0.0, -0.01, 0.795859, -0.0, -0.01, 0.835859, -0.0, -0.01,
    0.875859, -0.0, -0.01, 0.915859, -0.0, -0.01, 0.955859, -0.0, -0.01,
    0.995859, -0.0, -0.01, 1.035859, -0.0, -0.01, 1.075859, -0.0, -0.01,
    1.115859, -0.0, -0.05, 0.355859, -0.0, -0.05, 0.395859, -0.0, -0.05,
    0.435859, -0.0, -0.05, 0.475859, -0.0, -0.05, 0.515859, -0.0, -0.05,
    0.555859, -0.0, -0.05, 0.595859, -0.0, -0.05, 0.635859, -0.0, -0.05,
    0.675859, -0.0, -0.05, 0.715859, -0.0, -0.05, 0.755859, -0.0, -0.05,
    0.795859, -0.0, -0.05, 0.835859, -0.0, -0.05, 0.875859, -0.0, -0.05,
    0.915859, -0.0, -0.05, 0.955859, -0.0, -0.05, 0.995859, -0.0, -0.05,
    1.035859, -0.0, -0.05, 1.075859, -0.0, -0.05, 1.115859, -0.0, -0.09,
    0.355859, -0.0, -0.09, 0.395859, -0.0, -0.09, 0.435859, -0.0, -0.09,
    0.475859, -0.0, -0.09, 0.515859, -0.0, -0.09, 0.555859, -0.0, -0.09,
    0.595859, -0.0, -0.09, 0.635859, -0.0, -0.09, 0.675859, -0.0, -0.09,
    0.715859, -0.0, -0.09, 0.755859, -0.0, -0.09, 0.795859, -0.0, -0.09,
    0.835859, -0.0, -0.09, 0.875859, -0.0, -0.09, 0.915859, -0.0, -0.09,
    0.955859, -0.0, -0.09, 0.995859, -0.0, -0.09, 1.035859, -0.0, -0.09,
    1.075859, -0.0, -0.09, 1.115859, -0.0, -0.13, 0.355859, -0.0, -0.13,
    0.395859, -0.0, -0.13, 0.435859, -0.0, -0.13, 0.475859, -0.0, -0.13,
    0.515859, -0.0, -0.13, 0.555859, -0.0, -0.13, 0.595859, -0.0, -0.13,
    0.635859, -0.0, -0.13, 0.675859, -0.0, -0.13, 0.715859, -0.0, -0.13,
    0.755859, -0.0, -0.13, 0.795859, -0.0, -0.13, 0.835859, -0.0, -0.13,
    0.875859, -0.0, -0.13, 0.915859, -0.0, -0.13, 0.955859, -0.0, -0.13,
    0.995859, -0.0, -0.13, 1.035859, -0.0, -0.13, 1.075859, -0.0, -0.13,
    1.115859, -0.0, -0.17, 0.355859, -0.0, -0.17, 0.395859, -0.0, -0.17,
    0.435859, -0.0, -0.17, 0.475859, -0.0, -0.17, 0.515859, -0.0, -0.17,
    0.555859, -0.0, -0.17, 0.595859, -0.0, -0.17, 0.635859, -0.0, -0.17,
    0.675859, -0.0, -0.17, 0.715859, -0.0, -0.17, 0.755859, -0.0, -0.17,
    0.795859, -0.0, -0.17, 0.835859, -0.0, -0.17, 0.875859, -0.0, -0.17,
    0.915859, -0.0, -0.17, 0.955859, -0.0, -0.17, 0.995859, -0.0, -0.17,
    1.035859, -0.0, -0.17, 1.075859, -0.0, -0.17, 1.115859, -0.0,
  ],
  faceTriIds: [
    863, 1294, 3320, 866, 1297, 3319, 869, 1300, 3318, 872, 1303, 3317, 875,
    1306, 3316, 878, 1309, 3315, 3314, 28, 1312, 3313, 29, 1315, 887, 1318,
    3312, 3311, 31, 1321, 893, 1324, 3310, 896, 1327, 3309, 3308, 34, 1330, 902,
    1333, 3307, 905, 1336, 3306, 908, 1339, 3305, 911, 1342, 3304, 914, 1345,
    3303, 917, 1348, 3302, 920, 1351, 3301, 923, 1354, 3300, 925, 1356, 3299,
    927, 1358, 3298, 929, 1360, 3297, 931, 1362, 3296, 933, 1364, 3295, 935,
    1366, 3294, 937, 1368, 3293, 939, 1370, 3292, 941, 1372, 3291, 943, 1374,
    3290, 945, 1376, 3289, 947, 1378, 3288, 949, 1380, 3287, 951, 1382, 3286,
    953, 1384, 3285, 955, 1386, 3284, 957, 1388, 3283, 959, 1390, 3282, 961,
    1392, 3281, 964, 1395, 3280, 966, 1397, 3279, 968, 1399, 3278, 970, 1401,
    3277, 972, 1403, 3276, 3275, 69, 1405, 976, 1407, 3274, 978, 1409, 3273,
    980, 1411, 3272, 982, 1413, 3271, 984, 1415, 3270, 3269, 75, 1417, 988,
    1419, 3268, 3267, 77, 1421, 992, 1423, 3266, 994, 1425, 3265, 996, 1427,
    3264, 998, 1429, 3263, 1000, 1431, 3262, 1002, 1433, 3261, 1005, 1436, 3260,
    1007, 1438, 3259, 3258, 87, 1440, 1011, 1442, 3257, 3256, 89, 1444, 3255,
    90, 1446, 1017, 1448, 3254, 3253, 92, 1450, 1021, 1452, 3252, 1023, 1454,
    3251, 3250, 95, 1456, 1027, 1458, 3249, 1029, 1460, 3248, 1031, 1462, 3247,
    1033, 1464, 3246, 3245, 100, 1466, 1037, 1468, 3244, 1039, 1470, 3243, 1041,
    1472, 3242, 3241, 104, 1474, 3240, 106, 1477, 1048, 1479, 3239, 1050, 1481,
    3238, 3237, 109, 1483, 1054, 1485, 3236, 3235, 111, 1487, 1058, 1489, 3234,
    1060, 1491, 3233, 1062, 1493, 3232, 1064, 1495, 3231, 1066, 1497, 3230,
    3229, 117, 1499, 1070, 1501, 3228, 3227, 119, 1503, 1074, 1505, 3226, 1076,
    1507, 3225, 3224, 122, 1509, 3223, 123, 1511, 3222, 124, 1513, 3221, 125,
    1515, 1087, 1518, 3220, 1089, 1520, 3219, 3218, 129, 1522, 1093, 1524, 3217,
    1095, 1526, 3216, 1097, 1528, 3215, 1099, 1530, 3214, 1101, 1532, 3213,
    3212, 135, 1534, 1105, 1536, 3211, 3210, 137, 1538, 1109, 1540, 3209, 1111,
    1542, 3208, 1113, 1544, 3207, 1115, 1546, 3206, 1117, 1548, 3205, 3204, 143,
    1550, 1121, 1552, 3203, 1123, 1554, 3202, 1125, 1556, 3201, 1128, 1559,
    3200, 1130, 1561, 3199, 1132, 1563, 3198, 3197, 151, 1565, 1136, 1567, 3196,
    1138, 1569, 3195, 1140, 1571, 3194, 3193, 155, 1573, 1144, 1575, 3192, 1146,
    1577, 3191, 1148, 1579, 3190, 3189, 159, 1581, 1152, 1583, 3188, 1154, 1585,
    3187, 3186, 162, 1587, 1158, 1589, 3185, 1160, 1591, 3184, 1162, 1593, 3183,
    3182, 166, 1595, 1166, 1597, 3181, 1169, 1600, 3180, 1171, 1602, 3179, 1173,
    1604, 3178, 1175, 1606, 3177, 1177, 1608, 3176, 1179, 1610, 3175, 1181,
    1612, 3174, 1183, 1614, 3173, 1185, 1616, 3172, 1187, 1618, 3171, 1189,
    1620, 3170, 1191, 1622, 3169, 1193, 1624, 3168, 3167, 182, 1626, 1197, 1628,
    3166, 1199, 1630, 3165, 1201, 1632, 3164, 1203, 1634, 3163, 1205, 1636,
    3162, 1207, 1638, 3161, 1210, 1641, 3160, 1212, 1643, 3159, 1214, 1645,
    3158, 1216, 1647, 3157, 1218, 1649, 3156, 1220, 1651, 3155, 1222, 1653,
    3154, 1224, 1655, 3153, 1226, 1657, 3152, 1228, 1659, 3151, 1230, 1661,
    3150, 1232, 1663, 3149, 1234, 1665, 3148, 3147, 203, 1667, 1238, 1669, 3146,
    1240, 1671, 3145, 1242, 1673, 3144, 1244, 1675, 3143, 1246, 1677, 3142,
    1248, 1679, 3141, 1251, 1682, 3140, 1253, 1684, 3139, 1255, 1686, 3138,
    3137, 214, 1688, 1259, 1690, 3136, 1261, 1692, 3135, 3134, 217, 1694, 1265,
    1696, 3133, 1267, 1698, 3132, 3131, 220, 1700, 1271, 1702, 3130, 1273, 1704,
    3129, 1275, 1706, 3128, 3127, 224, 1708, 1279, 1710, 3126, 1281, 1712, 3125,
    1283, 1714, 3124, 1285, 1716, 3123, 1287, 1718, 3122, 1289, 1720, 3121,
    1721, 1290, 3120, 3119, 661, 1723, 1719, 1724, 3118, 1725, 1288, 3117, 1726,
    1727, 3116, 1717, 1728, 3115, 1729, 1286, 3114, 1730, 1731, 3113, 1715,
    1732, 3112, 1733, 1284, 3111, 3110, 664, 1735, 1713, 1736, 3109, 1737, 1282,
    3108, 1738, 1739, 3107, 1711, 1740, 3106, 1741, 1280, 3105, 1742, 1743,
    3104, 1709, 1744, 3103, 1745, 1278, 3102, 1746, 1747, 3101, 1707, 1748,
    3100, 1749, 1276, 3099, 1750, 1751, 3098, 1705, 1752, 3097, 1753, 1274,
    3096, 1754, 1755, 3095, 1703, 1756, 3094, 3093, 642, 1272, 3092, 670, 1759,
    1701, 1760, 3091, 1761, 1270, 3090, 1762, 1763, 3089, 1699, 1764, 3088,
    1765, 1268, 3087, 1766, 1767, 3086, 1697, 1768, 3085, 1769, 1266, 3084,
    1770, 1771, 3083, 1695, 1772, 3082, 1773, 1264, 3081, 1774, 1775, 3080,
    3079, 633, 1776, 1777, 1262, 3078, 1778, 1779, 3077, 1691, 1780, 3076, 1781,
    1260, 3075, 1782, 1783, 3074, 1689, 1784, 3073, 3072, 628, 1258, 3071, 677,
    1787, 3070, 627, 1788, 1789, 1256, 3069, 1790, 1791, 3068, 1685, 1792, 3067,
    1793, 1254, 3066, 1794, 1795, 3065, 1683, 1796, 3064, 1797, 1252, 3063,
    1798, 1799, 3062, 1681, 1800, 3061, 1801, 1249, 3060, 1802, 1803, 3059,
    1678, 1804, 3058, 1805, 1247, 3057, 1806, 1807, 3056, 1676, 1808, 3055,
    1809, 1245, 3054, 1810, 1811, 3053, 1674, 1812, 3052, 1813, 1243, 3051,
    1814, 1815, 3050, 1672, 1816, 3049, 1817, 1241, 3048, 1818, 1819, 3047,
    1670, 1820, 3046, 1821, 1239, 3045, 1822, 1823, 3044, 1668, 1824, 3043,
    1825, 1237, 3042, 1826, 1827, 3041, 1666, 1828, 3040, 1829, 1235, 3039,
    1830, 1831, 3038, 1664, 1832, 3037, 1833, 1233, 3036, 1834, 1835, 3035,
    1662, 1836, 3034, 1837, 1231, 3033, 1838, 1839, 3032, 1660, 1840, 3031,
    1841, 1229, 3030, 1842, 1843, 3029, 3028, 598, 1844, 1845, 1227, 3027, 1846,
    1847, 3026, 1656, 1848, 3025, 1849, 1225, 3024, 1850, 1851, 3023, 1654,
    1852, 3022, 1853, 1223, 3021, 1854, 1855, 3020, 1652, 1856, 3019, 1857,
    1221, 3018, 1858, 1859, 3017, 1650, 1860, 3016, 1861, 1219, 3015, 1862,
    1863, 3014, 1648, 1864, 3013, 3012, 587, 1217, 3011, 697, 1867, 1646, 1868,
    3010, 1869, 1215, 3009, 1870, 1871, 3008, 1644, 1872, 3007, 1873, 1213,
    3006, 1874, 1875, 3005, 1642, 1876, 3004, 1877, 1211, 3003, 1878, 1879,
    3002, 1640, 1880, 3001, 1881, 1208, 3000, 1882, 1883, 2999, 1637, 1884,
    2998, 1885, 1206, 2997, 2996, 702, 1887, 2995, 575, 1888, 1889, 1204, 2994,
    1890, 1891, 2993, 1633, 1892, 2992, 1893, 1202, 2991, 1894, 1895, 2990,
    1631, 1896, 2989, 1897, 1200, 2988, 1898, 1899, 2987, 1629, 1900, 2986,
    1901, 1198, 2985, 1902, 1903, 2984, 1627, 1904, 2983, 1905, 1196, 2982,
    1906, 1907, 2981, 2980, 565, 1908, 1909, 1194, 2979, 1910, 1911, 2978, 1623,
    1912, 2977, 1913, 1192, 2976, 1914, 1915, 2975, 1621, 1916, 2974, 1917,
    1190, 2973, 1918, 1919, 2972, 1619, 1920, 2971, 1921, 1188, 2970, 1922,
    1923, 2969, 1617, 1924, 2968, 1925, 1186, 2967, 1926, 1927, 2966, 1615,
    1928, 2965, 1929, 1184, 2964, 1930, 1931, 2963, 2962, 553, 1932, 1933, 1182,
    2961, 1934, 1935, 2960, 1611, 1936, 2959, 1937, 1180, 2958, 1938, 1939,
    2957, 1609, 1940, 2956, 1941, 1178, 2955, 1942, 1943, 2954, 1607, 1944,
    2953, 2952, 546, 1176, 2951, 717, 1947, 1605, 1948, 2950, 1949, 1174, 2949,
    1950, 1951, 2948, 1603, 1952, 2947, 1953, 1172, 2946, 1954, 1955, 2945,
    1601, 1956, 2944, 1957, 1170, 2943, 1958, 1959, 2942, 1599, 1960, 2941,
    1961, 1167, 2940, 1962, 1963, 2939, 1596, 1964, 2938, 2937, 535, 1165, 2936,
    722, 1967, 1594, 1968, 2935, 1969, 1163, 2934, 1970, 1971, 2933, 1592, 1972,
    2932, 1973, 1161, 2931, 2930, 724, 1975, 1590, 1976, 2929, 1977, 1159, 2928,
    1978, 1979, 2927, 1588, 1980, 2926, 2925, 527, 1157, 2924, 726, 1983, 2923,
    526, 1984, 1985, 1155, 2922, 1986, 1987, 2921, 1584, 1988, 2920, 2919, 523,
    1153, 1990, 1991, 2918, 1582, 1992, 2917, 1993, 1151, 2916, 1994, 1995,
    2915, 2914, 520, 1996, 1997, 1149, 2913, 1998, 1999, 2912, 1578, 2000, 2911,
    2001, 1147, 2910, 2002, 2003, 2909, 1576, 2004, 2908, 2005, 1145, 2907,
    2006, 2007, 2906, 1574, 2008, 2905, 2009, 1143, 2904, 2010, 2011, 2903,
    2902, 512, 2012, 2013, 1141, 2901, 2014, 2015, 2900, 1570, 2016, 2899, 2017,
    1139, 2898, 2018, 2019, 2897, 1568, 2020, 2896, 2021, 1137, 2895, 2022,
    2023, 2894, 1566, 2024, 2893, 2892, 505, 1135, 2026, 2027, 2891, 1564, 2028,
    2890, 2889, 503, 1133, 2888, 738, 2031, 1562, 2032, 2887, 2033, 1131, 2886,
    2034, 2035, 2885, 1560, 2036, 2884, 2037, 1129, 2883, 2038, 2039, 2882,
    1558, 2040, 2881, 2041, 1126, 2880, 2042, 2043, 2879, 1555, 2044, 2878,
    2045, 1124, 2877, 2046, 2047, 2876, 1553, 2048, 2875, 2874, 492, 1122, 2873,
    743, 2051, 2872, 491, 2052, 2871, 490, 1120, 2054, 2055, 2870, 1549, 2056,
    2869, 2057, 1118, 2868, 2058, 2059, 2867, 1547, 2060, 2866, 2061, 1116,
    2865, 2062, 2063, 2864, 1545, 2064, 2863, 2862, 484, 1114, 2861, 747, 2067,
    2860, 483, 2068, 2069, 1112, 2859, 2070, 2071, 2858, 1541, 2072, 2857, 2073,
    1110, 2856, 2855, 749, 2075, 2854, 479, 2076, 2077, 1108, 2853, 2078, 2079,
    2852, 1537, 2080, 2851, 2081, 1106, 2850, 2082, 2083, 2849, 1535, 2084,
    2848, 2085, 1104, 2847, 2846, 752, 2087, 2845, 473, 2088, 2844, 472, 1102,
    2090, 2091, 2843, 1531, 2092, 2842, 2093, 1100, 2841, 2840, 754, 2095, 1529,
    2096, 2839, 2097, 1098, 2838, 2098, 2099, 2837, 1527, 2100, 2836, 2835, 466,
    1096, 2102, 2103, 2834, 1525, 2104, 2833, 2105, 1094, 2832, 2106, 2107,
    2831, 2830, 463, 2108, 2829, 462, 1092, 2110, 2111, 2828, 2827, 461, 2112,
    2113, 1090, 2826, 2114, 2115, 2825, 1519, 2116, 2824, 2117, 1088, 2823,
    2118, 2119, 2822, 1517, 2120, 2821, 2820, 455, 1085, 2819, 761, 2123, 2818,
    454, 2124, 2817, 453, 1083, 2126, 2127, 2816, 1512, 2128, 2815, 2814, 451,
    1081, 2813, 763, 2131, 2812, 450, 2132, 2133, 1079, 2811, 2134, 2135, 2810,
    1508, 2136, 2809, 2137, 1077, 2808, 2807, 765, 2139, 1506, 2140, 2806, 2141,
    1075, 2805, 2142, 2143, 2804, 1504, 2144, 2803, 2802, 443, 1073, 2801, 767,
    2147, 1502, 2148, 2800, 2149, 1071, 2799, 2150, 2151, 2798, 1500, 2152,
    2797, 2796, 439, 1069, 2795, 769, 2155, 1498, 2156, 2794, 2157, 1067, 2793,
    2158, 2159, 2792, 2791, 436, 2160, 2790, 435, 1065, 2162, 2163, 2789, 1494,
    2164, 2788, 2787, 433, 1063, 2166, 2167, 2786, 1492, 2168, 2785, 2169, 1061,
    2784, 2170, 2171, 2783, 2782, 430, 2172, 2781, 429, 1059, 2780, 774, 2175,
    1488, 2176, 2779, 2177, 1057, 2778, 2777, 775, 2179, 2776, 426, 2180, 2181,
    1055, 2775, 2182, 2183, 2774, 1484, 2184, 2773, 2772, 423, 1053, 2771, 777,
    2187, 2770, 422, 2188, 2189, 1051, 2769, 2190, 2191, 2768, 1480, 2192, 2767,
    2193, 1049, 2766, 2194, 2195, 2765, 1478, 2196, 2764, 2197, 1047, 2763,
    2198, 2199, 2762, 2761, 416, 2200, 2201, 1044, 2760, 2759, 781, 2203, 1473,
    2204, 2758, 2205, 1042, 2757, 2206, 2207, 2756, 1471, 2208, 2755, 2209,
    1040, 2754, 2210, 2211, 2753, 1469, 2212, 2752, 2213, 1038, 2751, 2214,
    2215, 2750, 1467, 2216, 2749, 2748, 406, 1036, 2218, 2219, 2747, 1465, 2220,
    2746, 2221, 1034, 2745, 2222, 2223, 2744, 1463, 2224, 2743, 2225, 1032,
    2742, 2226, 2227, 2741, 1461, 2228, 2740, 2229, 1030, 2739, 2230, 2231,
    2738, 1459, 2232, 2737, 2233, 1028, 2736, 2234, 2235, 2735, 2734, 397, 2236,
    2237, 1026, 2733, 2238, 2239, 2732, 1455, 2240, 2731, 2241, 1024, 2730,
    2242, 2243, 2729, 1453, 2244, 2728, 2245, 1022, 2727, 2726, 792, 2247, 1451,
    2248, 2725, 2249, 1020, 2724, 2250, 2251, 2723, 1449, 2252, 2722, 2253,
    1018, 2721, 2254, 2255, 2720, 1447, 2256, 2719, 2718, 386, 1016, 2258, 2259,
    2717, 2716, 385, 2260, 2261, 1014, 2715, 2262, 2263, 2714, 1443, 2264, 2713,
    2265, 1012, 2712, 2266, 2267, 2711, 1441, 2268, 2710, 2269, 1010, 2709,
    2708, 798, 2271, 2707, 379, 2272, 2273, 1008, 2706, 2274, 2275, 2705, 1437,
    2276, 2704, 2277, 1006, 2703, 2278, 2279, 2702, 1435, 2280, 2701, 2281,
    1003, 2700, 2282, 2283, 2699, 1432, 2284, 2698, 2285, 1001, 2697, 2286,
    2287, 2696, 1430, 2288, 2695, 2289, 999, 2694, 2290, 2291, 2693, 1428, 2292,
    2692, 2293, 997, 2691, 2294, 2295, 2690, 1426, 2296, 2689, 2297, 995, 2688,
    2298, 2299, 2687, 1424, 2300, 2686, 2301, 993, 2685, 2302, 2303, 2684, 1422,
    2304, 2683, 2305, 991, 2682, 2306, 2307, 2681, 2680, 360, 2308, 2309, 989,
    2679, 2310, 2311, 2678, 1418, 2312, 2677, 2313, 987, 2676, 2314, 2315, 2675,
    1416, 2316, 2674, 2317, 985, 2673, 2318, 2319, 2672, 1414, 2320, 2671, 2321,
    983, 2670, 2322, 2323, 2669, 1412, 2324, 2668, 2325, 981, 2667, 2326, 2327,
    2666, 1410, 2328, 2665, 2329, 979, 2664, 2330, 2331, 2663, 1408, 2332, 2662,
    2661, 347, 977, 2660, 814, 2335, 1406, 2336, 2659, 2337, 975, 2658, 2338,
    2339, 2657, 1404, 2340, 2656, 2341, 973, 2655, 2342, 2343, 2654, 1402, 2344,
    2653, 2345, 971, 2652, 2346, 2347, 2651, 1400, 2348, 2650, 2649, 339, 969,
    2648, 818, 2351, 1398, 2352, 2647, 2353, 967, 2646, 2354, 2355, 2645, 1396,
    2356, 2644, 2357, 965, 2643, 2358, 2359, 2642, 1394, 2360, 2641, 2361, 962,
    2640, 2362, 2363, 2639, 1391, 2364, 2638, 2365, 960, 2637, 2366, 2367, 2636,
    1389, 2368, 2635, 2369, 958, 2634, 2370, 2371, 2633, 1387, 2372, 2632, 2373,
    956, 2631, 2374, 2375, 2630, 1385, 2376, 2629, 2377, 954, 2628, 2378, 2379,
    2627, 1383, 2380, 2626, 2381, 952, 2625, 2382, 2383, 2624, 1381, 2384, 2623,
    2385, 950, 2622, 2386, 2387, 2621, 1379, 2388, 2620, 2389, 948, 2619, 2390,
    2391, 2618, 1377, 2392, 2617, 2393, 946, 2616, 2394, 2395, 2615, 1375, 2396,
    2614, 2397, 944, 2613, 2398, 2399, 2612, 1373, 2400, 2611, 2401, 942, 2610,
    2402, 2403, 2609, 1371, 2404, 2608, 2405, 940, 2607, 2406, 2407, 2606, 1369,
    2408, 2605, 2409, 938, 2604, 2410, 2411, 2603, 1367, 2412, 2602, 2413, 936,
    2601, 2600, 834, 2415, 1365, 2416, 2599, 2417, 934, 2598, 2418, 2419, 2597,
    1363, 2420, 2596, 2421, 932, 2595, 2422, 2423, 2594, 1361, 2424, 2593, 2425,
    930, 2592, 2426, 2427, 2591, 1359, 2428, 2590, 2429, 928, 2589, 2430, 2431,
    2588, 1357, 2432, 2587, 2433, 926, 2586, 2434, 2435, 2585, 1355, 2436, 2584,
    2437, 924, 2583, 2438, 2439, 2582, 1353, 2440, 2581, 2441, 921, 2580, 2442,
    2443, 2579, 1350, 2444, 2578, 2445, 918, 2577, 2446, 2447, 2576, 1347, 2448,
    2575, 2449, 915, 2574, 2450, 2451, 2573, 1344, 2452, 2572, 2453, 912, 2571,
    2570, 844, 2455, 2569, 281, 2456, 2457, 909, 2568, 2458, 2459, 2567, 1338,
    2460, 2566, 2461, 906, 2565, 2462, 2463, 2564, 1335, 2464, 2563, 2465, 903,
    2562, 2466, 2467, 2561, 1332, 2468, 2560, 2469, 900, 2559, 2470, 2471, 2558,
    1329, 2472, 2557, 2473, 897, 2556, 2474, 2475, 2555, 1326, 2476, 2554, 2553,
    264, 894, 2552, 850, 2479, 1323, 2480, 2551, 2550, 261, 891, 2482, 2483,
    2549, 1320, 2484, 2548, 2547, 258, 888, 2486, 2487, 2546, 1317, 2488, 2545,
    2544, 255, 885, 2490, 2491, 2543, 2542, 254, 2492, 2493, 882, 2541, 2494,
    2495, 2540, 1311, 2496, 2539, 2497, 879, 2538, 2498, 2499, 2537, 1308, 2500,
    2536, 2535, 246, 876, 2502, 2503, 2534, 1305, 2504, 2533, 2505, 873, 2532,
    2506, 2507, 2531, 2530, 242, 2508, 2509, 870, 2529, 2510, 2511, 2528, 1299,
    2512, 2527, 2526, 237, 867, 2514, 2515, 2525, 1296, 2516, 2524, 2523, 234,
    864, 2518, 2519, 2522, 2521, 233, 2520, 2521, 860, 2518, 232, 2521, 2518,
    862, 1293, 2521, 2522, 231, 861, 1292, 861, 0, 232, 2522, 1292, 2523, 21,
    1291, 231, 2523, 1291, 2519, 2517, 2523, 2524, 859, 2514, 865, 2514, 235, 2,
    2524, 865, 1293, 2515, 233, 1295, 1293, 1, 235, 2525, 1295, 863, 867, 22,
    233, 2526, 863, 2515, 2513, 2526, 2527, 858, 2510, 868, 2510, 238, 3, 2527,
    868, 2528, 236, 1296, 1298, 1296, 2, 238, 2528, 1298, 2529, 23, 866, 2511,
    866, 236, 858, 2529, 2511, 2506, 2508, 857, 241, 2530, 2506, 871, 1302,
    2530, 2531, 239, 1299, 1301, 1299, 3, 1301, 2506, 2531, 2532, 24, 869, 2507,
    869, 239, 857, 2532, 2507, 2533, 856, 2502, 874, 2502, 244, 5, 2533, 874,
    1302, 2503, 242, 1304, 1302, 4, 244, 2534, 1304, 872, 876, 25, 242, 2535,
    872, 2503, 2501, 2535, 2536, 855, 2498, 877, 2498, 247, 6, 2536, 877, 2537,
    245, 1305, 1307, 1305, 5, 247, 2537, 1307, 2538, 26, 875, 2499, 875, 245,
    855, 2538, 2499, 2539, 854, 2494, 880, 2494, 250, 7, 2539, 880, 1308, 2495,
    248, 6, 2540, 1308, 250, 2540, 1310, 2541, 27, 878, 2495, 878, 248, 854,
    2541, 2495, 2542, 853, 2490, 883, 2490, 253, 8, 2542, 883, 2543, 251, 1311,
    1313, 1311, 7, 253, 2543, 1313, 881, 885, 28, 251, 2544, 881, 2491, 2489,
    2544, 2545, 852, 2486, 886, 2486, 256, 9, 2545, 886, 1314, 2487, 254, 1316,
    1314, 8, 256, 2546, 1316, 884, 888, 29, 254, 2547, 884, 2487, 2485, 2547,
    2482, 2484, 851, 889, 2482, 259, 889, 1320, 2548, 2549, 257, 1317, 1319,
    1317, 9, 259, 2549, 1319, 887, 891, 30, 2483, 887, 257, 851, 2550, 2483,
    2551, 850, 2478, 892, 2478, 262, 892, 1323, 2551, 1320, 2479, 260, 10, 2552,
    1320, 1322, 2478, 2552, 2553, 31, 890, 2479, 890, 260, 2479, 2477, 2553,
    2554, 849, 2474, 895, 2474, 265, 12, 2554, 895, 2555, 263, 1323, 1325, 1323,
    11, 265, 2555, 1325, 2556, 32, 893, 2475, 893, 263, 849, 2556, 2475, 2557,
    848, 2470, 898, 2470, 268, 13, 2557, 898, 2558, 266, 1326, 1328, 1326, 12,
    268, 2558, 1328, 2559, 33, 896, 2471, 896, 266, 848, 2559, 2471, 2560, 847,
    2466, 901, 2466, 271, 14, 2560, 901, 2561, 269, 1329, 1331, 1329, 13, 271,
    2561, 1331, 2562, 34, 899, 2467, 899, 269, 847, 2562, 2467, 2563, 846, 2462,
    904, 2462, 274, 15, 2563, 904, 2564, 272, 1332, 1334, 1332, 14, 274, 2564,
    1334, 2565, 35, 902, 2463, 902, 272, 846, 2565, 2463, 2566, 845, 2458, 907,
    2458, 277, 16, 2566, 907, 2567, 275, 1335, 1337, 1335, 15, 277, 2567, 1337,
    905, 909, 36, 2459, 905, 275, 845, 2568, 2459, 2454, 2456, 844, 910, 2454,
    280, 910, 1341, 2569, 2570, 278, 1338, 16, 2570, 1338, 1340, 2454, 2570,
    2571, 37, 908, 2455, 908, 278, 2455, 2453, 2571, 2572, 843, 2450, 913, 2450,
    283, 18, 2572, 913, 2573, 281, 1341, 1343, 1341, 17, 283, 2573, 1343, 2574,
    38, 911, 2451, 911, 281, 843, 2574, 2451, 2575, 842, 2446, 916, 2446, 286,
    19, 2575, 916, 2576, 284, 1344, 1346, 1344, 18, 286, 2576, 1346, 2577, 39,
    914, 2447, 914, 284, 842, 2577, 2447, 2578, 841, 2442, 919, 2442, 289, 919,
    1350, 2578, 2579, 287, 1347, 1349, 1347, 19, 289, 2579, 1349, 2580, 40, 917,
    2443, 917, 287, 841, 2580, 2443, 2581, 840, 2438, 1294, 2438, 234, 22, 2581,
    1294, 2582, 292, 922, 864, 922, 21, 234, 2582, 864, 2583, 42, 1352, 2439,
    1352, 292, 840, 2583, 2439, 2584, 839, 2434, 1297, 2434, 237, 23, 2584,
    1297, 2585, 293, 1353, 867, 1353, 22, 237, 2585, 867, 2586, 43, 923, 2435,
    923, 293, 839, 2586, 2435, 2587, 838, 2430, 1300, 2430, 240, 24, 2587, 1300,
    2588, 295, 1355, 870, 1355, 23, 240, 2588, 870, 2589, 44, 925, 2431, 925,
    295, 838, 2589, 2431, 2590, 837, 2426, 1303, 2426, 243, 25, 2590, 1303,
    2591, 297, 1357, 873, 1357, 24, 243, 2591, 873, 2592, 45, 927, 2427, 927,
    297, 837, 2592, 2427, 2593, 836, 2422, 1306, 2422, 246, 26, 2593, 1306,
    2594, 299, 1359, 876, 1359, 25, 246, 2594, 876, 2595, 46, 929, 2423, 929,
    299, 836, 2595, 2423, 2596, 835, 2418, 1309, 2418, 249, 27, 2596, 1309,
    2597, 301, 1361, 879, 1361, 26, 249, 2597, 879, 2598, 47, 931, 2419, 931,
    301, 835, 2598, 2419, 2414, 2416, 834, 1312, 2414, 252, 28, 2599, 1312,
    2600, 303, 1363, 882, 1363, 27, 252, 2600, 882, 933, 936, 48, 2415, 933,
    303, 2415, 2413, 2601, 2602, 833, 2410, 1315, 2410, 255, 29, 2602, 1315,
    2603, 305, 1365, 885, 1365, 28, 255, 2603, 885, 2604, 49, 935, 2411, 935,
    305, 833, 2604, 2411, 2605, 832, 2406, 1318, 2406, 258, 30, 2605, 1318,
    2606, 307, 1367, 888, 1367, 29, 258, 2606, 888, 2607, 50, 937, 2407, 937,
    307, 832, 2607, 2407, 2608, 831, 2402, 1321, 2402, 261, 31, 2608, 1321,
    2609, 309, 1369, 891, 1369, 30, 261, 2609, 891, 2610, 51, 939, 2403, 939,
    309, 831, 2610, 2403, 2611, 830, 2398, 1324, 2398, 264, 32, 2611, 1324,
    2612, 311, 1371, 894, 1371, 31, 264, 2612, 894, 2613, 52, 941, 2399, 941,
    311, 830, 2613, 2399, 2614, 829, 2394, 1327, 2394, 267, 33, 2614, 1327,
    2615, 313, 1373, 897, 1373, 32, 267, 2615, 897, 2616, 53, 943, 2395, 943,
    313, 829, 2616, 2395, 2617, 828, 2390, 1330, 2390, 270, 1330, 1377, 2617,
    2618, 315, 1375, 900, 1375, 33, 270, 2618, 900, 2619, 54, 945, 2391, 945,
    315, 828, 2619, 2391, 2620, 827, 2386, 1333, 2386, 273, 35, 2620, 1333,
    1377, 2387, 317, 903, 1377, 34, 273, 2621, 903, 2622, 55, 947, 317, 2622,
    947, 827, 2622, 2387, 2623, 826, 2382, 1336, 2382, 276, 36, 2623, 1336,
    2624, 319, 1379, 906, 1379, 35, 276, 2624, 906, 2625, 56, 949, 2383, 949,
    319, 826, 2625, 2383, 2626, 825, 2378, 1339, 2378, 279, 37, 2626, 1339,
    1381, 2379, 321, 36, 2627, 1381, 279, 2627, 909, 2628, 57, 951, 2379, 951,
    321, 825, 2628, 2379, 2629, 824, 2374, 1342, 2374, 282, 38, 2629, 1342,
    2630, 323, 1383, 912, 1383, 37, 282, 2630, 912, 2631, 58, 953, 2375, 953,
    323, 824, 2631, 2375, 2632, 823, 2370, 1345, 2370, 285, 39, 2632, 1345,
    2633, 325, 1385, 915, 1385, 38, 285, 2633, 915, 2634, 59, 955, 2371, 955,
    325, 823, 2634, 2371, 2635, 822, 2366, 1348, 2366, 288, 40, 2635, 1348,
    2636, 327, 1387, 918, 1387, 39, 288, 2636, 918, 2637, 60, 957, 2367, 957,
    327, 822, 2637, 2367, 2638, 821, 2362, 1351, 2362, 291, 41, 2638, 1351,
    2639, 329, 1389, 921, 1389, 40, 291, 2639, 921, 2640, 61, 959, 2363, 959,
    329, 821, 2640, 2363, 2641, 820, 2358, 1354, 2358, 294, 43, 2641, 1354,
    2642, 333, 963, 924, 963, 42, 294, 2642, 924, 2643, 63, 1393, 2359, 1393,
    333, 820, 2643, 2359, 2644, 819, 2354, 1356, 2354, 296, 1356, 1396, 2644,
    2645, 334, 1394, 926, 1394, 43, 296, 2645, 926, 2646, 64, 964, 2355, 964,
    334, 819, 2646, 2355, 2647, 818, 2350, 1358, 2350, 298, 45, 2647, 1358,
    1396, 2351, 336, 44, 2648, 1396, 298, 2648, 928, 966, 969, 65, 336, 2649,
    966, 2351, 2349, 2649, 2650, 817, 2346, 1360, 2346, 300, 46, 2650, 1360,
    2651, 338, 1398, 930, 1398, 45, 300, 2651, 930, 2652, 66, 968, 2347, 968,
    338, 817, 2652, 2347, 2653, 816, 2342, 1362, 2342, 302, 47, 2653, 1362,
    2654, 340, 1400, 932, 1400, 46, 302, 2654, 932, 2655, 67, 970, 2343, 970,
    340, 816, 2655, 2343, 2656, 815, 2338, 1364, 2338, 304, 48, 2656, 1364,
    2657, 342, 1402, 934, 1402, 47, 304, 2657, 934, 2658, 68, 972, 2339, 972,
    342, 815, 2658, 2339, 2659, 814, 2334, 1366, 2334, 306, 49, 2659, 1366,
    1404, 2335, 344, 48, 2660, 1404, 306, 2660, 936, 974, 977, 69, 344, 2661,
    974, 2335, 2333, 2661, 2662, 813, 2330, 1368, 2330, 308, 50, 2662, 1368,
    2663, 346, 1406, 938, 1406, 49, 308, 2663, 938, 2664, 70, 976, 2331, 976,
    346, 813, 2664, 2331, 2665, 812, 2326, 1370, 2326, 310, 51, 2665, 1370,
    2666, 348, 1408, 940, 1408, 50, 310, 2666, 940, 978, 981, 71, 2327, 978,
    348, 812, 2667, 2327, 2668, 811, 2322, 1372, 2322, 312, 52, 2668, 1372,
    2669, 350, 1410, 942, 1410, 51, 312, 2669, 942, 2670, 72, 980, 2323, 980,
    350, 811, 2670, 2323, 2671, 810, 2318, 1374, 2318, 314, 53, 2671, 1374,
    2672, 352, 1412, 944, 1412, 52, 314, 2672, 944, 2673, 73, 982, 2319, 982,
    352, 810, 2673, 2319, 2674, 809, 2314, 1376, 2314, 316, 54, 2674, 1376,
    2675, 354, 1414, 946, 1414, 53, 316, 2675, 946, 2676, 74, 984, 2315, 984,
    354, 809, 2676, 2315, 2677, 808, 2310, 1378, 2310, 318, 55, 2677, 1378,
    2678, 356, 1416, 948, 1416, 54, 318, 2678, 948, 986, 989, 75, 356, 2679,
    986, 808, 2679, 2311, 2680, 807, 2306, 1380, 2306, 320, 1380, 1420, 2680,
    1418, 2307, 358, 55, 2681, 1418, 320, 2681, 950, 2682, 76, 988, 2307, 988,
    358, 807, 2682, 2307, 2683, 806, 2302, 1382, 2302, 322, 57, 2683, 1382,
    2684, 360, 1420, 952, 1420, 56, 322, 2684, 952, 2685, 77, 990, 2303, 990,
    360, 806, 2685, 2303, 2686, 805, 2298, 1384, 2298, 324, 58, 2686, 1384,
    2687, 362, 1422, 954, 1422, 57, 324, 2687, 954, 2688, 78, 992, 2299, 992,
    362, 805, 2688, 2299, 2689, 804, 2294, 1386, 2294, 326, 59, 2689, 1386,
    2690, 364, 1424, 956, 1424, 58, 326, 2690, 956, 2691, 79, 994, 2295, 994,
    364, 804, 2691, 2295, 2692, 803, 2290, 1388, 2290, 328, 60, 2692, 1388,
    2693, 366, 1426, 958, 1426, 59, 328, 2693, 958, 2694, 80, 996, 2291, 996,
    366, 803, 2694, 2291, 2695, 802, 2286, 1390, 2286, 330, 61, 2695, 1390,
    2696, 368, 1428, 960, 1428, 60, 330, 2696, 960, 2697, 81, 998, 2287, 998,
    368, 802, 2697, 2287, 2698, 801, 2282, 1392, 2282, 332, 62, 2698, 1392,
    2699, 370, 1430, 962, 1430, 61, 332, 2699, 962, 2700, 82, 1000, 2283, 1000,
    370, 801, 2700, 2283, 2701, 800, 2278, 1395, 2278, 335, 64, 2701, 1395,
    2702, 374, 1004, 965, 1004, 63, 335, 2702, 965, 2703, 84, 1434, 2279, 1434,
    374, 800, 2703, 2279, 2704, 799, 2274, 1397, 2274, 337, 65, 2704, 1397,
    2705, 375, 1435, 967, 1435, 64, 337, 2705, 967, 2706, 85, 1005, 2275, 1005,
    375, 799, 2706, 2275, 2707, 798, 2270, 339, 2707, 2270, 66, 2707, 1399,
    2708, 377, 1437, 969, 1437, 65, 969, 2270, 2708, 2709, 86, 1007, 2271, 1007,
    377, 798, 2709, 2271, 2710, 797, 2266, 1401, 2266, 341, 67, 2710, 1401,
    2711, 379, 1439, 971, 1439, 66, 341, 2711, 971, 2712, 87, 1009, 2267, 1009,
    379, 797, 2712, 2267, 2713, 796, 2262, 1403, 2262, 343, 68, 2713, 1403,
    2714, 381, 1441, 973, 1441, 67, 343, 2714, 973, 2715, 88, 1011, 2263, 1011,
    381, 796, 2715, 2263, 2716, 795, 2258, 1405, 2258, 345, 1405, 1445, 2716,
    1443, 2259, 383, 68, 2717, 1443, 345, 2717, 975, 1013, 1016, 89, 383, 2718,
    1013, 2259, 2257, 2718, 2719, 794, 2254, 1407, 2254, 347, 70, 2719, 1407,
    2720, 385, 1445, 977, 1445, 69, 347, 2720, 977, 1015, 1018, 90, 2255, 1015,
    385, 794, 2721, 2255, 2722, 793, 2250, 1409, 2250, 349, 71, 2722, 1409,
    2723, 387, 1447, 979, 1447, 70, 349, 2723, 979, 2724, 91, 1017, 2251, 1017,
    387, 793, 2724, 2251, 2725, 792, 2246, 1411, 2246, 351, 72, 2725, 1411,
    2726, 389, 1449, 71, 2726, 1449, 351, 2726, 981, 2727, 92, 1019, 2247, 1019,
    389, 792, 2727, 2247, 2728, 791, 2242, 1413, 2242, 353, 73, 2728, 1413,
    2729, 391, 1451, 983, 1451, 72, 353, 2729, 983, 1021, 1024, 93, 391, 2730,
    1021, 791, 2730, 2243, 2731, 790, 2238, 1415, 2238, 355, 74, 2731, 1415,
    2732, 393, 1453, 985, 1453, 73, 355, 2732, 985, 2733, 94, 1023, 2239, 1023,
    393, 790, 2733, 2239, 2734, 789, 2234, 1417, 2234, 357, 1417, 1457, 2734,
    1455, 2235, 395, 74, 2735, 1455, 357, 2735, 987, 2736, 95, 1025, 395, 2736,
    1025, 789, 2736, 2235, 2737, 788, 2230, 1419, 2230, 359, 76, 2737, 1419,
    2738, 397, 1457, 75, 2738, 1457, 359, 2738, 989, 2739, 96, 1027, 2231, 1027,
    397, 788, 2739, 2231, 2740, 787, 2226, 1421, 2226, 361, 77, 2740, 1421,
    2741, 399, 1459, 991, 1459, 76, 361, 2741, 991, 2742, 97, 1029, 2227, 1029,
    399, 787, 2742, 2227, 2743, 786, 2222, 1423, 2222, 363, 78, 2743, 1423,
    2744, 401, 1461, 993, 1461, 77, 363, 2744, 993, 2745, 98, 1031, 2223, 1031,
    401, 786, 2745, 2223, 2746, 785, 2218, 1425, 2218, 365, 79, 2746, 1425,
    2747, 403, 1463, 995, 1463, 78, 365, 2747, 995, 2748, 99, 1033, 2219, 1033,
    403, 785, 2748, 2219, 2749, 784, 2214, 1427, 2214, 367, 80, 2749, 1427,
    2750, 405, 1465, 997, 1465, 79, 367, 2750, 997, 2751, 100, 1035, 2215, 1035,
    405, 784, 2751, 2215, 2752, 783, 2210, 1429, 2210, 369, 81, 2752, 1429,
    2753, 407, 1467, 999, 1467, 80, 369, 2753, 999, 2754, 101, 1037, 2211, 1037,
    407, 783, 2754, 2211, 2755, 782, 2206, 1431, 2206, 371, 82, 2755, 1431,
    2756, 409, 1469, 1001, 1469, 81, 371, 2756, 1001, 2757, 102, 1039, 2207,
    1039, 409, 782, 2757, 2207, 2758, 781, 2202, 1433, 2202, 373, 83, 2758,
    1433, 2759, 411, 1471, 1003, 1471, 82, 1003, 2202, 2759, 1041, 1044, 103,
    411, 2760, 1041, 2203, 2201, 2760, 2198, 2200, 780, 376, 2761, 2198, 85,
    2761, 1436, 2762, 415, 1045, 1006, 1045, 84, 1006, 2198, 2762, 1475, 1047,
    105, 2199, 1475, 415, 780, 2763, 2199, 2764, 779, 2194, 1438, 2194, 378, 86,
    2764, 1438, 2765, 416, 1476, 1008, 1476, 85, 378, 2765, 1008, 1046, 1049,
    106, 2195, 1046, 416, 779, 2766, 2195, 2767, 778, 2190, 1440, 2190, 380, 87,
    2767, 1440, 2768, 418, 1478, 1010, 1478, 86, 380, 2768, 1010, 2769, 107,
    1048, 2191, 1048, 418, 778, 2769, 2191, 2186, 2188, 777, 382, 2770, 2186,
    88, 2770, 1442, 2771, 420, 1480, 1012, 1480, 87, 1012, 2186, 2771, 1050,
    1053, 108, 420, 2772, 1050, 2187, 2185, 2772, 2773, 776, 2182, 1444, 2182,
    384, 89, 2773, 1444, 2774, 422, 1482, 1014, 1482, 88, 384, 2774, 1014, 1052,
    1055, 109, 2183, 1052, 422, 776, 2775, 2183, 2178, 2180, 775, 386, 2776,
    2178, 1446, 1486, 2776, 1484, 2179, 424, 89, 2777, 1484, 1016, 2178, 2777,
    1054, 1057, 110, 424, 2778, 1054, 2179, 2177, 2778, 2779, 774, 2174, 1448,
    2174, 388, 91, 2779, 1448, 2780, 426, 1486, 1018, 1486, 90, 388, 2780, 1018,
    1056, 1059, 111, 2175, 1056, 426, 2175, 2173, 2781, 2782, 773, 2170, 1450,
    2170, 390, 1450, 1490, 2782, 2783, 428, 1488, 1020, 1488, 91, 390, 2783,
    1020, 2784, 112, 1058, 2171, 1058, 428, 773, 2784, 2171, 2785, 772, 2166,
    1452, 2166, 392, 93, 2785, 1452, 1490, 2167, 430, 1022, 1490, 92, 392, 2786,
    1022, 1060, 1063, 113, 430, 2787, 1060, 772, 2787, 2167, 2788, 771, 2162,
    1454, 2162, 394, 94, 2788, 1454, 2789, 432, 1492, 93, 2789, 1492, 394, 2789,
    1024, 2790, 114, 1062, 2163, 1062, 432, 2163, 2161, 2790, 2791, 770, 2158,
    1456, 2158, 396, 1456, 1496, 2791, 2792, 434, 1494, 1026, 1494, 94, 396,
    2792, 1026, 2793, 115, 1064, 2159, 1064, 434, 770, 2793, 2159, 2154, 2156,
    769, 1458, 2154, 398, 96, 2794, 1458, 1496, 2155, 436, 95, 2795, 1496, 1028,
    2154, 2795, 2796, 116, 1066, 436, 2796, 1066, 2155, 2153, 2796, 2797, 768,
    2150, 1460, 2150, 400, 97, 2797, 1460, 2798, 438, 1498, 1030, 1498, 96, 400,
    2798, 1030, 2799, 117, 1068, 2151, 1068, 438, 768, 2799, 2151, 2800, 767,
    2146, 1462, 2146, 402, 98, 2800, 1462, 2801, 440, 1500, 1032, 1500, 97,
    1032, 2146, 2801, 1070, 1073, 118, 2147, 1070, 440, 2147, 2145, 2802, 2803,
    766, 2142, 1464, 2142, 404, 99, 2803, 1464, 2804, 442, 1502, 1034, 1502, 98,
    404, 2804, 1034, 2805, 119, 1072, 2143, 1072, 442, 766, 2805, 2143, 2806,
    765, 2138, 406, 2806, 2138, 1466, 1506, 2806, 2807, 444, 1504, 99, 2807,
    1504, 1036, 2138, 2807, 2808, 120, 1074, 2139, 1074, 444, 765, 2808, 2139,
    2809, 764, 2134, 1468, 2134, 408, 101, 2809, 1468, 2810, 446, 1506, 1038,
    1506, 100, 408, 2810, 1038, 2811, 121, 1076, 2135, 1076, 446, 764, 2811,
    2135, 2130, 2132, 763, 410, 2812, 2130, 102, 2812, 1470, 2813, 448, 1508,
    1040, 1508, 101, 1040, 2130, 2813, 1078, 1081, 122, 448, 2814, 1078, 2131,
    2129, 2814, 2815, 762, 2126, 1472, 2126, 412, 103, 2815, 1472, 2816, 450,
    1510, 1042, 1510, 102, 412, 2816, 1042, 1080, 1083, 123, 2127, 1080, 450,
    762, 2817, 2127, 2122, 2124, 761, 414, 2818, 2122, 1474, 1514, 2818, 1512,
    2123, 452, 103, 2819, 1512, 1044, 2122, 2819, 1082, 1085, 124, 452, 2820,
    1082, 2123, 2121, 2820, 2821, 760, 2118, 1477, 2118, 417, 106, 2821, 1477,
    2822, 456, 1086, 1047, 1086, 105, 417, 2822, 1047, 2823, 126, 1516, 2119,
    1516, 456, 760, 2823, 2119, 2824, 759, 2114, 1479, 2114, 419, 107, 2824,
    1479, 2825, 457, 1517, 1049, 1517, 106, 419, 2825, 1049, 2826, 127, 1087,
    2115, 1087, 457, 759, 2826, 2115, 2110, 2112, 758, 1481, 2110, 421, 108,
    2827, 1481, 1519, 2111, 459, 107, 2828, 1519, 421, 2828, 1051, 1089, 1092,
    128, 459, 2829, 1089, 2111, 2109, 2829, 2106, 2108, 757, 423, 2830, 2106,
    1483, 1523, 2830, 1521, 2107, 461, 108, 2831, 1521, 1053, 2106, 2831, 2832,
    129, 1091, 2107, 1091, 461, 757, 2832, 2107, 2833, 756, 2102, 1485, 2102,
    425, 110, 2833, 1485, 2834, 463, 1523, 1055, 1523, 109, 425, 2834, 1055,
    1093, 1096, 130, 2103, 1093, 463, 2103, 2101, 2835, 2836, 755, 2098, 1487,
    2098, 427, 111, 2836, 1487, 2837, 465, 1525, 1057, 1525, 110, 427, 2837,
    1057, 2838, 131, 1095, 2099, 1095, 465, 755, 2838, 2099, 2094, 2096, 754,
    429, 2839, 2094, 112, 2839, 1489, 1527, 2095, 467, 111, 2840, 1527, 1059,
    2094, 2840, 2841, 132, 1097, 467, 2841, 1097, 2095, 2093, 2841, 2842, 753,
    2090, 1491, 2090, 431, 113, 2842, 1491, 2843, 469, 1529, 1061, 1529, 112,
    431, 2843, 1061, 2844, 133, 1099, 2091, 1099, 469, 753, 2844, 2091, 2845,
    752, 2086, 433, 2845, 2086, 114, 2845, 1493, 2846, 471, 1531, 113, 2846,
    1531, 1063, 2086, 2846, 2847, 134, 1101, 2087, 1101, 471, 2087, 2085, 2847,
    2848, 751, 2082, 1495, 2082, 435, 1495, 1535, 2848, 2849, 473, 1533, 1065,
    1533, 114, 435, 2849, 1065, 1103, 1106, 135, 473, 2850, 1103, 751, 2850,
    2083, 2851, 750, 2078, 1497, 2078, 437, 116, 2851, 1497, 2852, 475, 1535,
    1067, 1535, 115, 437, 2852, 1067, 2853, 136, 1105, 475, 2853, 1105, 750,
    2853, 2079, 2854, 749, 2074, 1499, 2074, 439, 117, 2854, 1499, 2855, 477,
    1537, 1069, 1537, 116, 439, 2855, 1069, 2856, 137, 1107, 2075, 1107, 477,
    749, 2856, 2075, 2857, 748, 2070, 1501, 2070, 441, 118, 2857, 1501, 2858,
    479, 1539, 1071, 1539, 117, 441, 2858, 1071, 1109, 1112, 138, 479, 2859,
    1109, 748, 2859, 2071, 2066, 2068, 747, 443, 2860, 2066, 1503, 1543, 2860,
    1541, 2067, 481, 118, 2861, 1541, 1073, 2066, 2861, 2862, 139, 1111, 2067,
    1111, 481, 2067, 2065, 2862, 2863, 746, 2062, 1505, 2062, 445, 120, 2863,
    1505, 2864, 483, 1543, 1075, 1543, 119, 445, 2864, 1075, 2865, 140, 1113,
    2063, 1113, 483, 746, 2865, 2063, 2866, 745, 2058, 1507, 2058, 447, 121,
    2866, 1507, 2867, 485, 1545, 1077, 1545, 120, 447, 2867, 1077, 2868, 141,
    1115, 2059, 1115, 485, 745, 2868, 2059, 2054, 2056, 744, 1509, 2054, 449,
    122, 2869, 1509, 2870, 487, 1547, 1079, 1547, 121, 449, 2870, 1079, 1117,
    1120, 142, 487, 2871, 1117, 2055, 2053, 2871, 2050, 2052, 743, 451, 2872,
    2050, 1511, 1551, 2872, 1549, 2051, 489, 122, 2873, 1549, 1081, 2050, 2873,
    2874, 143, 1119, 489, 2874, 1119, 2051, 2049, 2874, 2875, 742, 2046, 1513,
    2046, 453, 124, 2875, 1513, 2876, 491, 1551, 1083, 1551, 123, 453, 2876,
    1083, 2877, 144, 1121, 2047, 1121, 491, 742, 2877, 2047, 2878, 741, 2042,
    1515, 2042, 455, 1515, 1555, 2878, 2879, 493, 1553, 1085, 1553, 124, 455,
    2879, 1085, 2880, 145, 1123, 2043, 1123, 493, 741, 2880, 2043, 2881, 740,
    2038, 1518, 2038, 458, 127, 2881, 1518, 2882, 497, 1127, 1088, 1127, 126,
    458, 2882, 1088, 2883, 147, 1557, 2039, 1557, 497, 740, 2883, 2039, 2884,
    739, 2034, 1520, 2034, 460, 128, 2884, 1520, 2885, 498, 1558, 1090, 1558,
    127, 460, 2885, 1090, 2886, 148, 1128, 2035, 1128, 498, 739, 2886, 2035,
    2030, 2032, 738, 462, 2887, 2030, 1522, 1562, 2887, 1560, 2031, 500, 128,
    2888, 1560, 1092, 2030, 2888, 2889, 149, 1130, 2031, 1130, 500, 2031, 2029,
    2889, 2890, 737, 2026, 1524, 2026, 464, 130, 2890, 1524, 2891, 502, 1562,
    1094, 1562, 129, 464, 2891, 1094, 1132, 1135, 150, 2027, 1132, 502, 2027,
    2025, 2892, 2022, 2024, 736, 466, 2893, 2022, 1526, 1566, 2893, 2894, 504,
    1564, 1096, 1564, 130, 466, 2894, 1096, 2895, 151, 1134, 2023, 1134, 504,
    736, 2895, 2023, 2896, 735, 2018, 1528, 2018, 468, 132, 2896, 1528, 2897,
    506, 1566, 1098, 1566, 131, 468, 2897, 1098, 2898, 152, 1136, 2019, 1136,
    506, 735, 2898, 2019, 2899, 734, 2014, 1530, 2014, 470, 133, 2899, 1530,
    2900, 508, 1568, 1100, 1568, 132, 470, 2900, 1100, 2901, 153, 1138, 2015,
    1138, 508, 734, 2901, 2015, 2010, 2012, 733, 472, 2902, 2010, 134, 2902,
    1532, 2903, 510, 1570, 1102, 1570, 133, 1102, 2010, 2903, 2904, 154, 1140,
    2011, 1140, 510, 733, 2904, 2011, 2905, 732, 2006, 1534, 2006, 474, 1534,
    1574, 2905, 1572, 2007, 512, 1104, 1572, 134, 474, 2906, 1104, 1142, 1145,
    155, 512, 2907, 1142, 732, 2907, 2007, 2908, 731, 2002, 1536, 2002, 476,
    136, 2908, 1536, 2909, 514, 1574, 1106, 1574, 135, 476, 2909, 1106, 2910,
    156, 1144, 2003, 1144, 514, 731, 2910, 2003, 2911, 730, 1998, 1538, 1998,
    478, 1538, 1578, 2911, 2912, 516, 1576, 1108, 1576, 136, 478, 2912, 1108,
    2913, 157, 1146, 1999, 1146, 516, 730, 2913, 1999, 2914, 729, 1994, 1540,
    1994, 480, 138, 2914, 1540, 2915, 518, 1578, 1110, 1578, 137, 480, 2915,
    1110, 2916, 158, 1148, 1995, 1148, 518, 729, 2916, 1995, 2917, 728, 1990,
    1542, 1990, 482, 1542, 1582, 2917, 2918, 520, 1580, 138, 2918, 1580, 482,
    2918, 1112, 1150, 1153, 159, 1991, 1150, 520, 728, 2919, 1991, 1986, 1988,
    727, 484, 2920, 1986, 1544, 1584, 2920, 2921, 522, 1582, 139, 2921, 1582,
    1114, 1986, 2921, 2922, 160, 1152, 1987, 1152, 522, 727, 2922, 1987, 1982,
    1984, 726, 486, 2923, 1982, 1546, 1586, 2923, 2924, 524, 1584, 140, 2924,
    1584, 486, 2924, 1116, 1154, 1157, 161, 524, 2925, 1154, 1983, 1981, 2925,
    2926, 725, 1978, 1548, 1978, 488, 142, 2926, 1548, 1586, 1979, 526, 1118,
    1586, 141, 488, 2927, 1118, 2928, 162, 1156, 526, 2928, 1156, 725, 2928,
    1979, 2929, 724, 1974, 490, 2929, 1974, 1550, 1590, 2929, 2930, 528, 1588,
    142, 2930, 1588, 1120, 1974, 2930, 2931, 163, 1158, 1975, 1158, 528, 724,
    2931, 1975, 2932, 723, 1970, 1552, 1970, 492, 144, 2932, 1552, 2933, 530,
    1590, 1122, 1590, 143, 492, 2933, 1122, 2934, 164, 1160, 1971, 1160, 530,
    723, 2934, 1971, 1966, 1968, 722, 494, 2935, 1966, 145, 2935, 1554, 2936,
    532, 1592, 1124, 1592, 144, 494, 2936, 1124, 1162, 1165, 165, 1967, 1162,
    532, 1967, 1965, 2937, 2938, 721, 1962, 1556, 1962, 496, 146, 2938, 1556,
    2939, 534, 1594, 1126, 1594, 145, 496, 2939, 1126, 2940, 166, 1164, 1963,
    1164, 534, 721, 2940, 1963, 2941, 720, 1958, 1559, 1958, 499, 148, 2941,
    1559, 2942, 538, 1168, 1129, 1168, 147, 499, 2942, 1129, 2943, 168, 1598,
    1959, 1598, 538, 720, 2943, 1959, 2944, 719, 1954, 1561, 1954, 501, 149,
    2944, 1561, 2945, 539, 1599, 1131, 1599, 148, 501, 2945, 1131, 2946, 169,
    1169, 1955, 1169, 539, 719, 2946, 1955, 2947, 718, 1950, 1563, 1950, 503,
    150, 2947, 1563, 2948, 541, 1601, 1133, 1601, 149, 503, 2948, 1133, 2949,
    170, 1171, 1951, 1171, 541, 718, 2949, 1951, 1946, 1948, 717, 505, 2950,
    1946, 1565, 1605, 2950, 2951, 543, 1603, 150, 2951, 1603, 1135, 1946, 2951,
    2952, 171, 1173, 1947, 1173, 543, 1947, 1945, 2952, 2953, 716, 1942, 1567,
    1942, 507, 152, 2953, 1567, 2954, 545, 1605, 1137, 1605, 151, 507, 2954,
    1137, 2955, 172, 1175, 1943, 1175, 545, 716, 2955, 1943, 2956, 715, 1938,
    1569, 1938, 509, 153, 2956, 1569, 2957, 547, 1607, 1139, 1607, 152, 509,
    2957, 1139, 2958, 173, 1177, 1939, 1177, 547, 715, 2958, 1939, 2959, 714,
    1934, 1571, 1934, 511, 154, 2959, 1571, 2960, 549, 1609, 1141, 1609, 153,
    511, 2960, 1141, 2961, 174, 1179, 1935, 1179, 549, 714, 2961, 1935, 2962,
    713, 1930, 1573, 1930, 513, 1573, 1613, 2962, 1611, 1931, 551, 154, 2963,
    1611, 513, 2963, 1143, 1181, 1184, 175, 551, 2964, 1181, 713, 2964, 1931,
    2965, 712, 1926, 1575, 1926, 515, 156, 2965, 1575, 2966, 553, 1613, 155,
    2966, 1613, 515, 2966, 1145, 2967, 176, 1183, 1927, 1183, 553, 712, 2967,
    1927, 2968, 711, 1922, 1577, 1922, 517, 157, 2968, 1577, 2969, 555, 1615,
    1147, 1615, 156, 517, 2969, 1147, 2970, 177, 1185, 1923, 1185, 555, 711,
    2970, 1923, 2971, 710, 1918, 1579, 1918, 519, 158, 2971, 1579, 2972, 557,
    1617, 1149, 1617, 157, 519, 2972, 1149, 2973, 178, 1187, 1919, 1187, 557,
    710, 2973, 1919, 2974, 709, 1914, 1581, 1914, 521, 1581, 1621, 2974, 2975,
    559, 1619, 1151, 1619, 158, 521, 2975, 1151, 2976, 179, 1189, 1915, 1189,
    559, 709, 2976, 1915, 2977, 708, 1910, 1583, 1910, 523, 160, 2977, 1583,
    2978, 561, 1621, 1153, 1621, 159, 523, 2978, 1153, 2979, 180, 1191, 1911,
    1191, 561, 708, 2979, 1911, 1906, 1908, 707, 525, 2980, 1906, 1585, 1625,
    2980, 2981, 563, 1623, 1155, 1623, 160, 525, 2981, 1155, 2982, 181, 1193,
    1907, 1193, 563, 707, 2982, 1907, 2983, 706, 1902, 1587, 1902, 527, 162,
    2983, 1587, 2984, 565, 1625, 161, 2984, 1625, 527, 2984, 1157, 2985, 182,
    1195, 1903, 1195, 565, 706, 2985, 1903, 2986, 705, 1898, 1589, 1898, 529,
    163, 2986, 1589, 2987, 567, 1627, 1159, 1627, 162, 529, 2987, 1159, 2988,
    183, 1197, 1899, 1197, 567, 705, 2988, 1899, 2989, 704, 1894, 1591, 1894,
    531, 164, 2989, 1591, 2990, 569, 1629, 1161, 1629, 163, 531, 2990, 1161,
    2991, 184, 1199, 1895, 1199, 569, 704, 2991, 1895, 2992, 703, 1890, 1593,
    1890, 533, 165, 2992, 1593, 2993, 571, 1631, 1163, 1631, 164, 533, 2993,
    1163, 2994, 185, 1201, 1891, 1201, 571, 703, 2994, 1891, 1886, 1888, 702,
    535, 2995, 1886, 1595, 1635, 2995, 2996, 573, 1633, 165, 2996, 1633, 1165,
    1886, 2996, 2997, 186, 1203, 1887, 1203, 573, 1887, 1885, 2997, 2998, 701,
    1882, 1597, 1882, 537, 167, 2998, 1597, 2999, 575, 1635, 1167, 1635, 166,
    537, 2999, 1167, 3000, 187, 1205, 1883, 1205, 575, 701, 3000, 1883, 3001,
    700, 1878, 1600, 1878, 540, 169, 3001, 1600, 3002, 579, 1209, 1170, 1209,
    168, 540, 3002, 1170, 3003, 189, 1639, 1879, 1639, 579, 700, 3003, 1879,
    3004, 699, 1874, 1602, 1874, 542, 170, 3004, 1602, 3005, 580, 1640, 1172,
    1640, 169, 542, 3005, 1172, 3006, 190, 1210, 1875, 1210, 580, 699, 3006,
    1875, 3007, 698, 1870, 1604, 1870, 544, 171, 3007, 1604, 3008, 582, 1642,
    1174, 1642, 170, 544, 3008, 1174, 3009, 191, 1212, 1871, 1212, 582, 698,
    3009, 1871, 1866, 1868, 697, 546, 3010, 1866, 172, 3010, 1606, 3011, 584,
    1644, 1176, 1644, 171, 1176, 1866, 3011, 3012, 192, 1214, 1867, 1214, 584,
    1867, 1865, 3012, 3013, 696, 1862, 1608, 1862, 548, 173, 3013, 1608, 3014,
    586, 1646, 1178, 1646, 172, 548, 3014, 1178, 3015, 193, 1216, 1863, 1216,
    586, 696, 3015, 1863, 3016, 695, 1858, 1610, 1858, 550, 174, 3016, 1610,
    3017, 588, 1648, 1180, 1648, 173, 550, 3017, 1180, 3018, 194, 1218, 1859,
    1218, 588, 695, 3018, 1859, 3019, 694, 1854, 1612, 1854, 552, 175, 3019,
    1612, 3020, 590, 1650, 1182, 1650, 174, 552, 3020, 1182, 3021, 195, 1220,
    1855, 1220, 590, 694, 3021, 1855, 3022, 693, 1850, 1614, 1850, 554, 176,
    3022, 1614, 1652, 1851, 592, 175, 3023, 1652, 554, 3023, 1184, 1222, 1225,
    196, 592, 3024, 1222, 693, 3024, 1851, 3025, 692, 1846, 1616, 1846, 556,
    177, 3025, 1616, 3026, 594, 1654, 1186, 1654, 176, 556, 3026, 1186, 3027,
    197, 1224, 1847, 1224, 594, 692, 3027, 1847, 3028, 691, 1842, 1618, 1842,
    558, 178, 3028, 1618, 3029, 596, 1656, 1188, 1656, 177, 558, 3029, 1188,
    3030, 198, 1226, 1843, 1226, 596, 691, 3030, 1843, 3031, 690, 1838, 1620,
    1838, 560, 179, 3031, 1620, 3032, 598, 1658, 1190, 1658, 178, 560, 3032,
    1190, 3033, 199, 1228, 1839, 1228, 598, 690, 3033, 1839, 3034, 689, 1834,
    1622, 1834, 562, 180, 3034, 1622, 3035, 600, 1660, 1192, 1660, 179, 562,
    3035, 1192, 3036, 200, 1230, 1835, 1230, 600, 689, 3036, 1835, 3037, 688,
    1830, 1624, 1830, 564, 181, 3037, 1624, 3038, 602, 1662, 1194, 1662, 180,
    564, 3038, 1194, 3039, 201, 1232, 1831, 1232, 602, 688, 3039, 1831, 3040,
    687, 1826, 1626, 1826, 566, 1626, 1666, 3040, 3041, 604, 1664, 1196, 1664,
    181, 566, 3041, 1196, 3042, 202, 1234, 1827, 1234, 604, 687, 3042, 1827,
    3043, 686, 1822, 1628, 1822, 568, 183, 3043, 1628, 3044, 606, 1666, 1198,
    1666, 182, 568, 3044, 1198, 3045, 203, 1236, 1823, 1236, 606, 686, 3045,
    1823, 3046, 685, 1818, 1630, 1818, 570, 184, 3046, 1630, 3047, 608, 1668,
    1200, 1668, 183, 570, 3047, 1200, 3048, 204, 1238, 1819, 1238, 608, 685,
    3048, 1819, 3049, 684, 1814, 1632, 1814, 572, 185, 3049, 1632, 3050, 610,
    1670, 1202, 1670, 184, 572, 3050, 1202, 3051, 205, 1240, 1815, 1240, 610,
    684, 3051, 1815, 3052, 683, 1810, 1634, 1810, 574, 186, 3052, 1634, 3053,
    612, 1672, 1204, 1672, 185, 574, 3053, 1204, 3054, 206, 1242, 1811, 1242,
    612, 683, 3054, 1811, 3055, 682, 1806, 1636, 1806, 576, 187, 3055, 1636,
    3056, 614, 1674, 1206, 1674, 186, 576, 3056, 1206, 3057, 207, 1244, 1807,
    1244, 614, 682, 3057, 1807, 3058, 681, 1802, 1638, 1802, 578, 188, 3058,
    1638, 3059, 616, 1676, 1208, 1676, 187, 578, 3059, 1208, 3060, 208, 1246,
    1803, 1246, 616, 681, 3060, 1803, 3061, 680, 1798, 1641, 1798, 581, 190,
    3061, 1641, 3062, 620, 1250, 1211, 1250, 189, 581, 3062, 1211, 3063, 210,
    1680, 1799, 1680, 620, 680, 3063, 1799, 3064, 679, 1794, 1643, 1794, 583,
    191, 3064, 1643, 3065, 621, 1681, 1213, 1681, 190, 583, 3065, 1213, 1251,
    1254, 211, 621, 3066, 1251, 679, 3066, 1795, 3067, 678, 1790, 1645, 1790,
    585, 192, 3067, 1645, 3068, 623, 1683, 1215, 1683, 191, 585, 3068, 1215,
    3069, 212, 1253, 1791, 1253, 623, 678, 3069, 1791, 1786, 1788, 677, 587,
    3070, 1786, 193, 3070, 1647, 1685, 1787, 625, 192, 3071, 1685, 1217, 1786,
    3071, 1255, 1258, 213, 625, 3072, 1255, 1787, 1785, 3072, 3073, 676, 1782,
    1649, 1782, 589, 194, 3073, 1649, 3074, 627, 1687, 1219, 1687, 193, 589,
    3074, 1219, 3075, 214, 1257, 1783, 1257, 627, 676, 3075, 1783, 3076, 675,
    1778, 1651, 1778, 591, 195, 3076, 1651, 3077, 629, 1689, 1221, 1689, 194,
    591, 3077, 1221, 3078, 215, 1259, 1779, 1259, 629, 675, 3078, 1779, 3079,
    674, 1774, 1653, 1774, 593, 1653, 1693, 3079, 3080, 631, 1691, 1223, 1691,
    195, 593, 3080, 1223, 3081, 216, 1261, 1775, 1261, 631, 674, 3081, 1775,
    3082, 673, 1770, 1655, 1770, 595, 197, 3082, 1655, 1693, 1771, 633, 196,
    3083, 1693, 595, 3083, 1225, 3084, 217, 1263, 1771, 1263, 633, 673, 3084,
    1771, 3085, 672, 1766, 1657, 1766, 597, 198, 3085, 1657, 3086, 635, 1695,
    1227, 1695, 197, 597, 3086, 1227, 3087, 218, 1265, 1767, 1265, 635, 672,
    3087, 1767, 1762, 1764, 671, 1659, 1762, 599, 199, 3088, 1659, 3089, 637,
    1697, 1229, 1697, 198, 1229, 1762, 3089, 3090, 219, 1267, 1763, 1267, 637,
    671, 3090, 1763, 3091, 670, 1758, 601, 3091, 1758, 200, 3091, 1661, 1699,
    1759, 639, 1231, 1699, 199, 601, 3092, 1231, 1269, 1272, 220, 639, 3093,
    1269, 1759, 1757, 3093, 3094, 669, 1754, 1663, 1754, 603, 201, 3094, 1663,
    3095, 641, 1701, 1233, 1701, 200, 603, 3095, 1233, 3096, 221, 1271, 1755,
    1271, 641, 669, 3096, 1755, 3097, 668, 1750, 1665, 1750, 605, 202, 3097,
    1665, 3098, 643, 1703, 1235, 1703, 201, 605, 3098, 1235, 3099, 222, 1273,
    1751, 1273, 643, 668, 3099, 1751, 1746, 1748, 667, 1667, 1746, 607, 1667,
    1707, 3100, 3101, 645, 1705, 1237, 1705, 202, 607, 3101, 1237, 3102, 223,
    1275, 1747, 1275, 645, 667, 3102, 1747, 3103, 666, 1742, 1669, 1742, 609,
    204, 3103, 1669, 3104, 647, 1707, 1239, 1707, 203, 609, 3104, 1239, 3105,
    224, 1277, 1743, 1277, 647, 666, 3105, 1743, 3106, 665, 1738, 1671, 1738,
    611, 1671, 1711, 3106, 3107, 649, 1709, 1241, 1709, 204, 611, 3107, 1241,
    3108, 225, 1279, 1739, 1279, 649, 665, 3108, 1739, 3109, 664, 1734, 1673,
    1734, 613, 206, 3109, 1673, 1711, 1735, 651, 205, 3110, 1711, 613, 3110,
    1243, 3111, 226, 1281, 1735, 1281, 651, 664, 3111, 1735, 3112, 663, 1730,
    1675, 1730, 615, 1675, 1715, 3112, 3113, 653, 1713, 1245, 1713, 206, 615,
    3113, 1245, 3114, 227, 1283, 1731, 1283, 653, 663, 3114, 1731, 3115, 662,
    1726, 617, 3115, 1726, 1677, 1717, 3115, 3116, 655, 1715, 207, 3116, 1715,
    1247, 1726, 3116, 3117, 228, 1285, 1727, 1285, 655, 662, 3117, 1727, 3118,
    661, 1722, 1679, 1722, 619, 209, 3118, 1679, 1717, 1723, 657, 208, 3119,
    1717, 619, 3119, 1249, 3120, 229, 1287, 1723, 1287, 657, 661, 3120, 1723,
    3121, 660, 1721, 1724, 1721, 661, 659, 3121, 1724, 3122, 658, 1725, 1728,
    1725, 662, 657, 3122, 1728, 3123, 656, 1729, 1732, 1729, 663, 655, 3123,
    1732, 3124, 654, 1733, 1736, 1733, 664, 653, 3124, 1736, 3125, 652, 1737,
    1740, 1737, 665, 651, 3125, 1740, 3126, 650, 1741, 1744, 1741, 666, 649,
    3126, 1744, 1745, 1708, 648, 667, 3127, 1745, 1748, 1277, 3127, 3128, 646,
    1749, 1752, 1749, 668, 645, 3128, 1752, 3129, 644, 1753, 1756, 1753, 669,
    643, 3129, 1756, 1757, 1702, 642, 670, 3130, 1757, 641, 3130, 1760, 1761,
    1700, 640, 671, 3131, 1761, 639, 3131, 1764, 3132, 638, 1765, 1768, 1765,
    672, 637, 3132, 1768, 3133, 636, 1769, 1772, 1769, 673, 635, 3133, 1772,
    3134, 634, 1773, 1776, 1773, 674, 1776, 1263, 3134, 3135, 632, 1777, 1780,
    1777, 675, 631, 3135, 1780, 3136, 630, 1781, 1784, 1781, 676, 629, 3136,
    1784, 1785, 1688, 628, 677, 3137, 1785, 1788, 1257, 3137, 3138, 626, 1789,
    1792, 1789, 678, 625, 3138, 1792, 3139, 624, 1793, 1796, 1793, 679, 623,
    3139, 1796, 3140, 622, 1797, 1800, 1797, 680, 621, 3140, 1800, 3141, 619,
    1801, 1804, 1801, 681, 618, 3141, 1804, 3142, 617, 1805, 1808, 1805, 682,
    616, 3142, 1808, 3143, 615, 1809, 1812, 1809, 683, 614, 3143, 1812, 3144,
    613, 1813, 1816, 1813, 684, 612, 3144, 1816, 3145, 611, 1817, 1820, 1817,
    685, 610, 3145, 1820, 3146, 609, 1821, 1824, 1821, 686, 608, 3146, 1824,
    3147, 607, 1825, 1828, 1825, 687, 606, 3147, 1828, 3148, 605, 1829, 1832,
    1829, 688, 604, 3148, 1832, 3149, 603, 1833, 1836, 1833, 689, 602, 3149,
    1836, 3150, 601, 1837, 1840, 1837, 690, 600, 3150, 1840, 3151, 599, 1841,
    1844, 1841, 691, 598, 3151, 1844, 3152, 597, 1845, 1848, 1845, 692, 596,
    3152, 1848, 3153, 595, 1849, 1852, 1849, 693, 594, 3153, 1852, 3154, 593,
    1853, 1856, 1853, 694, 592, 3154, 1856, 3155, 591, 1857, 1860, 1857, 695,
    590, 3155, 1860, 3156, 589, 1861, 1864, 1861, 696, 588, 3156, 1864, 1865,
    1647, 587, 697, 3157, 1865, 586, 3157, 1868, 3158, 585, 1869, 1872, 1869,
    698, 584, 3158, 1872, 3159, 583, 1873, 1876, 1873, 699, 582, 3159, 1876,
    3160, 581, 1877, 1880, 1877, 700, 580, 3160, 1880, 3161, 578, 1881, 1884,
    1881, 701, 577, 3161, 1884, 1885, 1636, 576, 702, 3162, 1885, 575, 3162,
    1888, 3163, 574, 1889, 1892, 1889, 703, 573, 3163, 1892, 3164, 572, 1893,
    1896, 1893, 704, 571, 3164, 1896, 3165, 570, 1897, 1900, 1897, 705, 569,
    3165, 1900, 3166, 568, 1901, 1904, 1901, 706, 567, 3166, 1904, 3167, 566,
    1905, 707, 3167, 1905, 1908, 1195, 3167, 3168, 564, 1909, 1912, 1909, 708,
    563, 3168, 1912, 3169, 562, 1913, 1916, 1913, 709, 561, 3169, 1916, 3170,
    560, 1917, 1920, 1917, 710, 559, 3170, 1920, 3171, 558, 1921, 1924, 1921,
    711, 557, 3171, 1924, 3172, 556, 1925, 1928, 1925, 712, 555, 3172, 1928,
    3173, 554, 1929, 1932, 1929, 713, 553, 3173, 1932, 3174, 552, 1933, 1936,
    1933, 714, 551, 3174, 1936, 3175, 550, 1937, 1940, 1937, 715, 549, 3175,
    1940, 3176, 548, 1941, 1944, 1941, 716, 547, 3176, 1944, 1945, 1606, 546,
    717, 3177, 1945, 545, 3177, 1948, 3178, 544, 1949, 1952, 1949, 718, 543,
    3178, 1952, 3179, 542, 1953, 1956, 1953, 719, 541, 3179, 1956, 3180, 540,
    1957, 1960, 1957, 720, 539, 3180, 1960, 3181, 537, 1961, 1964, 1961, 721,
    536, 3181, 1964, 1965, 1595, 535, 722, 3182, 1965, 1968, 1164, 3182, 3183,
    533, 1969, 1972, 1969, 723, 532, 3183, 1972, 3184, 531, 1973, 1976, 1973,
    724, 530, 3184, 1976, 3185, 529, 1977, 1980, 1977, 725, 528, 3185, 1980,
    1981, 1587, 527, 726, 3186, 1981, 1984, 1156, 3186, 3187, 525, 1985, 727,
    3187, 1985, 524, 3187, 1988, 1989, 1583, 523, 1992, 1989, 728, 522, 3188,
    1992, 3189, 521, 1993, 1996, 1993, 729, 1996, 1150, 3189, 3190, 519, 1997,
    2000, 1997, 730, 518, 3190, 2000, 3191, 517, 2001, 2004, 2001, 731, 516,
    3191, 2004, 3192, 515, 2005, 2008, 2005, 732, 514, 3192, 2008, 3193, 513,
    2009, 2012, 2009, 733, 2012, 1142, 3193, 3194, 511, 2013, 2016, 2013, 734,
    510, 3194, 2016, 3195, 509, 2017, 2020, 2017, 735, 508, 3195, 2020, 3196,
    507, 2021, 2024, 2021, 736, 506, 3196, 2024, 2025, 1565, 505, 737, 3197,
    2025, 504, 3197, 2028, 3198, 503, 2029, 738, 3198, 2029, 502, 3198, 2032,
    3199, 501, 2033, 2036, 2033, 739, 500, 3199, 2036, 3200, 499, 2037, 2040,
    2037, 740, 498, 3200, 2040, 3201, 496, 2041, 2044, 2041, 741, 495, 3201,
    2044, 3202, 494, 2045, 2048, 2045, 742, 493, 3202, 2048, 3203, 492, 2049,
    743, 3203, 2049, 2052, 1121, 3203, 2053, 1550, 490, 744, 3204, 2053, 489,
    3204, 2056, 3205, 488, 2057, 2060, 2057, 745, 487, 3205, 2060, 3206, 486,
    2061, 2064, 2061, 746, 485, 3206, 2064, 2065, 1544, 484, 747, 3207, 2065,
    483, 3207, 2068, 3208, 482, 2069, 2072, 2069, 748, 481, 3208, 2072, 3209,
    480, 2073, 2076, 2073, 749, 2076, 1109, 3209, 3210, 478, 2077, 2080, 2077,
    750, 2080, 1107, 3210, 3211, 476, 2081, 2084, 2081, 751, 475, 3211, 2084,
    3212, 474, 2085, 2088, 2085, 752, 473, 3212, 2088, 3213, 472, 2089, 2092,
    2089, 753, 471, 3213, 2092, 2093, 1530, 470, 754, 3214, 2093, 469, 3214,
    2096, 3215, 468, 2097, 2100, 2097, 755, 467, 3215, 2100, 2101, 1526, 466,
    756, 3216, 2101, 465, 3216, 2104, 3217, 464, 2105, 2108, 2105, 757, 463,
    3217, 2108, 2109, 1522, 462, 758, 3218, 2109, 2112, 1091, 3218, 3219, 460,
    2113, 2116, 2113, 759, 459, 3219, 2116, 3220, 458, 2117, 2120, 2117, 760,
    457, 3220, 2120, 3221, 455, 2121, 761, 3221, 2121, 2124, 1084, 3221, 2125,
    1513, 453, 2128, 2125, 762, 452, 3222, 2128, 2129, 1511, 451, 763, 3223,
    2129, 2132, 1080, 3223, 3224, 449, 2133, 764, 3224, 2133, 2136, 1078, 3224,
    3225, 447, 2137, 2140, 2137, 765, 446, 3225, 2140, 3226, 445, 2141, 2144,
    2141, 766, 444, 3226, 2144, 2145, 1503, 443, 767, 3227, 2145, 442, 3227,
    2148, 3228, 441, 2149, 2152, 2149, 768, 440, 3228, 2152, 2153, 1499, 439,
    769, 3229, 2153, 2156, 1068, 3229, 3230, 437, 2157, 2160, 2157, 770, 2160,
    1066, 3230, 2161, 1495, 435, 771, 3231, 2161, 434, 3231, 2164, 2165, 1493,
    433, 2168, 2165, 772, 432, 3232, 2168, 3233, 431, 2169, 2172, 2169, 773,
    430, 3233, 2172, 3234, 429, 2173, 774, 3234, 2173, 428, 3234, 2176, 3235,
    427, 2177, 2180, 2177, 775, 2180, 1056, 3235, 3236, 425, 2181, 2184, 2181,
    776, 424, 3236, 2184, 2185, 1483, 423, 777, 3237, 2185, 2188, 1052, 3237,
    3238, 421, 2189, 2192, 2189, 778, 420, 3238, 2192, 3239, 419, 2193, 2196,
    2193, 779, 418, 3239, 2196, 3240, 417, 2197, 780, 3240, 2197, 2200, 1046,
    3240, 3241, 414, 2201, 2204, 2201, 781, 413, 3241, 2204, 3242, 412, 2205,
    2208, 2205, 782, 411, 3242, 2208, 3243, 410, 2209, 2212, 2209, 783, 409,
    3243, 2212, 3244, 408, 2213, 2216, 2213, 784, 407, 3244, 2216, 2217, 1466,
    406, 785, 3245, 2217, 405, 3245, 2220, 3246, 404, 2221, 2224, 2221, 786,
    403, 3246, 2224, 3247, 402, 2225, 2228, 2225, 787, 401, 3247, 2228, 3248,
    400, 2229, 2232, 2229, 788, 399, 3248, 2232, 3249, 398, 2233, 2236, 2233,
    789, 397, 3249, 2236, 3250, 396, 2237, 2240, 2237, 790, 2240, 1025, 3250,
    3251, 394, 2241, 2244, 2241, 791, 393, 3251, 2244, 3252, 392, 2245, 2248,
    2245, 792, 391, 3252, 2248, 3253, 390, 2249, 2252, 2249, 793, 389, 3253,
    2252, 3254, 388, 2253, 2256, 2253, 794, 387, 3254, 2256, 2257, 1446, 386,
    795, 3255, 2257, 2260, 1015, 3255, 3256, 384, 2261, 2264, 2261, 796, 383,
    3256, 2264, 3257, 382, 2265, 2268, 2265, 797, 381, 3257, 2268, 3258, 380,
    2269, 2272, 2269, 798, 2272, 1009, 3258, 3259, 378, 2273, 2276, 2273, 799,
    377, 3259, 2276, 3260, 376, 2277, 2280, 2277, 800, 375, 3260, 2280, 3261,
    373, 2281, 2284, 2281, 801, 372, 3261, 2284, 3262, 371, 2285, 2288, 2285,
    802, 370, 3262, 2288, 3263, 369, 2289, 2292, 2289, 803, 368, 3263, 2292,
    3264, 367, 2293, 2296, 2293, 804, 366, 3264, 2296, 3265, 365, 2297, 2300,
    2297, 805, 364, 3265, 2300, 3266, 363, 2301, 2304, 2301, 806, 362, 3266,
    2304, 3267, 361, 2305, 2308, 2305, 807, 2308, 990, 3267, 3268, 359, 2309,
    2312, 2309, 808, 358, 3268, 2312, 3269, 357, 2313, 2316, 2313, 809, 356,
    3269, 2316, 3270, 355, 2317, 2320, 2317, 810, 354, 3270, 2320, 3271, 353,
    2321, 2324, 2321, 811, 352, 3271, 2324, 3272, 351, 2325, 2328, 2325, 812,
    350, 3272, 2328, 3273, 349, 2329, 2332, 2329, 813, 348, 3273, 2332, 3274,
    347, 2333, 2336, 2333, 814, 346, 3274, 2336, 3275, 345, 2337, 2340, 2337,
    815, 344, 3275, 2340, 3276, 343, 2341, 2344, 2341, 816, 342, 3276, 2344,
    3277, 341, 2345, 2348, 2345, 817, 340, 3277, 2348, 2349, 1399, 339, 2352,
    2349, 818, 338, 3278, 2352, 3279, 337, 2353, 2356, 2353, 819, 336, 3279,
    2356, 3280, 335, 2357, 2360, 2357, 820, 334, 3280, 2360, 3281, 332, 2361,
    2364, 2361, 821, 331, 3281, 2364, 3282, 330, 2365, 2368, 2365, 822, 329,
    3282, 2368, 3283, 328, 2369, 2372, 2369, 823, 327, 3283, 2372, 3284, 326,
    2373, 2376, 2373, 824, 325, 3284, 2376, 3285, 324, 2377, 2380, 2377, 825,
    323, 3285, 2380, 3286, 322, 2381, 2384, 2381, 826, 321, 3286, 2384, 3287,
    320, 2385, 2388, 2385, 827, 2388, 949, 3287, 3288, 318, 2389, 2392, 2389,
    828, 317, 3288, 2392, 3289, 316, 2393, 2396, 2393, 829, 315, 3289, 2396,
    3290, 314, 2397, 2400, 2397, 830, 313, 3290, 2400, 3291, 312, 2401, 2404,
    2401, 831, 311, 3291, 2404, 3292, 310, 2405, 2408, 2405, 832, 309, 3292,
    2408, 3293, 308, 2409, 2412, 2409, 833, 307, 3293, 2412, 2413, 1366, 306,
    834, 3294, 2413, 305, 3294, 2416, 3295, 304, 2417, 2420, 2417, 835, 303,
    3295, 2420, 3296, 302, 2421, 2424, 2421, 836, 301, 3296, 2424, 3297, 300,
    2425, 2428, 2425, 837, 299, 3297, 2428, 3298, 298, 2429, 2432, 2429, 838,
    297, 3298, 2432, 3299, 296, 2433, 2436, 2433, 839, 295, 3299, 2436, 3300,
    294, 2437, 2440, 2437, 840, 293, 3300, 2440, 3301, 291, 2441, 2444, 2441,
    841, 290, 3301, 2444, 3302, 288, 2445, 2448, 2445, 842, 287, 3302, 2448,
    3303, 285, 2449, 2452, 2449, 843, 284, 3303, 2452, 2453, 1342, 282, 844,
    3304, 2453, 281, 3304, 2456, 3305, 279, 2457, 2460, 2457, 845, 278, 3305,
    2460, 3306, 276, 2461, 2464, 2461, 846, 275, 3306, 2464, 3307, 273, 2465,
    2468, 2465, 847, 272, 3307, 2468, 3308, 270, 2469, 2472, 2469, 848, 2472,
    899, 3308, 3309, 267, 2473, 2476, 2473, 849, 266, 3309, 2476, 2477, 1324,
    264, 850, 3310, 2477, 263, 3310, 2480, 2481, 1321, 261, 851, 3311, 2481,
    2484, 890, 3311, 2485, 1318, 258, 2488, 2485, 852, 257, 3312, 2488, 2489,
    1315, 255, 853, 3313, 2489, 2492, 884, 3313, 2493, 1312, 252, 2496, 2493,
    854, 2496, 881, 3314, 3315, 249, 2497, 2500, 2497, 855, 248, 3315, 2500,
    2501, 1306, 246, 2504, 2501, 856, 245, 3316, 2504, 3317, 243, 2505, 2508,
    2505, 857, 2508, 872, 3317, 3318, 240, 2509, 2512, 2509, 858, 239, 3318,
    2512, 2513, 1297, 237, 2516, 2513, 859, 236, 3319, 2516, 2517, 1294, 234,
    2520, 2517, 860, 2520, 863, 3320, 863, 22, 1294, 866, 23, 1297, 869, 24,
    1300, 872, 25, 1303, 875, 26, 1306, 878, 27, 1309, 3314, 881, 28, 3313, 884,
    29, 887, 30, 1318, 3311, 890, 31, 893, 32, 1324, 896, 33, 1327, 3308, 899,
    34, 902, 35, 1333, 905, 36, 1336, 908, 37, 1339, 911, 38, 1342, 914, 39,
    1345, 917, 40, 1348, 920, 41, 1351, 923, 43, 1354, 925, 44, 1356, 927, 45,
    1358, 929, 46, 1360, 931, 47, 1362, 933, 48, 1364, 935, 49, 1366, 937, 50,
    1368, 939, 51, 1370, 941, 52, 1372, 943, 53, 1374, 945, 54, 1376, 947, 55,
    1378, 949, 56, 1380, 951, 57, 1382, 953, 58, 1384, 955, 59, 1386, 957, 60,
    1388, 959, 61, 1390, 961, 62, 1392, 964, 64, 1395, 966, 65, 1397, 968, 66,
    1399, 970, 67, 1401, 972, 68, 1403, 3275, 974, 69, 976, 70, 1407, 978, 71,
    1409, 980, 72, 1411, 982, 73, 1413, 984, 74, 1415, 3269, 986, 75, 988, 76,
    1419, 3267, 990, 77, 992, 78, 1423, 994, 79, 1425, 996, 80, 1427, 998, 81,
    1429, 1000, 82, 1431, 1002, 83, 1433, 1005, 85, 1436, 1007, 86, 1438, 3258,
    1009, 87, 1011, 88, 1442, 3256, 1013, 89, 3255, 1015, 90, 1017, 91, 1448,
    3253, 1019, 92, 1021, 93, 1452, 1023, 94, 1454, 3250, 1025, 95, 1027, 96,
    1458, 1029, 97, 1460, 1031, 98, 1462, 1033, 99, 1464, 3245, 1035, 100, 1037,
    101, 1468, 1039, 102, 1470, 1041, 103, 1472, 3241, 1043, 104, 3240, 1046,
    106, 1048, 107, 1479, 1050, 108, 1481, 3237, 1052, 109, 1054, 110, 1485,
    3235, 1056, 111, 1058, 112, 1489, 1060, 113, 1491, 1062, 114, 1493, 1064,
    115, 1495, 1066, 116, 1497, 3229, 1068, 117, 1070, 118, 1501, 3227, 1072,
    119, 1074, 120, 1505, 1076, 121, 1507, 3224, 1078, 122, 3223, 1080, 123,
    3222, 1082, 124, 3221, 1084, 125, 1087, 127, 1518, 1089, 128, 1520, 3218,
    1091, 129, 1093, 130, 1524, 1095, 131, 1526, 1097, 132, 1528, 1099, 133,
    1530, 1101, 134, 1532, 3212, 1103, 135, 1105, 136, 1536, 3210, 1107, 137,
    1109, 138, 1540, 1111, 139, 1542, 1113, 140, 1544, 1115, 141, 1546, 1117,
    142, 1548, 3204, 1119, 143, 1121, 144, 1552, 1123, 145, 1554, 1125, 146,
    1556, 1128, 148, 1559, 1130, 149, 1561, 1132, 150, 1563, 3197, 1134, 151,
    1136, 152, 1567, 1138, 153, 1569, 1140, 154, 1571, 3193, 1142, 155, 1144,
    156, 1575, 1146, 157, 1577, 1148, 158, 1579, 3189, 1150, 159, 1152, 160,
    1583, 1154, 161, 1585, 3186, 1156, 162, 1158, 163, 1589, 1160, 164, 1591,
    1162, 165, 1593, 3182, 1164, 166, 1166, 167, 1597, 1169, 169, 1600, 1171,
    170, 1602, 1173, 171, 1604, 1175, 172, 1606, 1177, 173, 1608, 1179, 174,
    1610, 1181, 175, 1612, 1183, 176, 1614, 1185, 177, 1616, 1187, 178, 1618,
    1189, 179, 1620, 1191, 180, 1622, 1193, 181, 1624, 3167, 1195, 182, 1197,
    183, 1628, 1199, 184, 1630, 1201, 185, 1632, 1203, 186, 1634, 1205, 187,
    1636, 1207, 188, 1638, 1210, 190, 1641, 1212, 191, 1643, 1214, 192, 1645,
    1216, 193, 1647, 1218, 194, 1649, 1220, 195, 1651, 1222, 196, 1653, 1224,
    197, 1655, 1226, 198, 1657, 1228, 199, 1659, 1230, 200, 1661, 1232, 201,
    1663, 1234, 202, 1665, 3147, 1236, 203, 1238, 204, 1669, 1240, 205, 1671,
    1242, 206, 1673, 1244, 207, 1675, 1246, 208, 1677, 1248, 209, 1679, 1251,
    211, 1682, 1253, 212, 1684, 1255, 213, 1686, 3137, 1257, 214, 1259, 215,
    1690, 1261, 216, 1692, 3134, 1263, 217, 1265, 218, 1696, 1267, 219, 1698,
    3131, 1269, 220, 1271, 221, 1702, 1273, 222, 1704, 1275, 223, 1706, 3127,
    1277, 224, 1279, 225, 1710, 1281, 226, 1712, 1283, 227, 1714, 1285, 228,
    1716, 1287, 229, 1718, 1289, 230, 1720, 1721, 660, 1290, 3119, 1722, 661,
    1719, 659, 1724, 1725, 658, 1288, 1726, 662, 1727, 1717, 657, 1728, 1729,
    656, 1286, 1730, 663, 1731, 1715, 655, 1732, 1733, 654, 1284, 3110, 1734,
    664, 1713, 653, 1736, 1737, 652, 1282, 1738, 665, 1739, 1711, 651, 1740,
    1741, 650, 1280, 1742, 666, 1743, 1709, 649, 1744, 1745, 648, 1278, 1746,
    667, 1747, 1707, 647, 1748, 1749, 646, 1276, 1750, 668, 1751, 1705, 645,
    1752, 1753, 644, 1274, 1754, 669, 1755, 1703, 643, 1756, 3093, 1757, 642,
    3092, 1758, 670, 1701, 641, 1760, 1761, 640, 1270, 1762, 671, 1763, 1699,
    639, 1764, 1765, 638, 1268, 1766, 672, 1767, 1697, 637, 1768, 1769, 636,
    1266, 1770, 673, 1771, 1695, 635, 1772, 1773, 634, 1264, 1774, 674, 1775,
    3079, 1693, 633, 1777, 632, 1262, 1778, 675, 1779, 1691, 631, 1780, 1781,
    630, 1260, 1782, 676, 1783, 1689, 629, 1784, 3072, 1785, 628, 3071, 1786,
    677, 3070, 1687, 627, 1789, 626, 1256, 1790, 678, 1791, 1685, 625, 1792,
    1793, 624, 1254, 1794, 679, 1795, 1683, 623, 1796, 1797, 622, 1252, 1798,
    680, 1799, 1681, 621, 1800, 1801, 619, 1249, 1802, 681, 1803, 1678, 618,
    1804, 1805, 617, 1247, 1806, 682, 1807, 1676, 616, 1808, 1809, 615, 1245,
    1810, 683, 1811, 1674, 614, 1812, 1813, 613, 1243, 1814, 684, 1815, 1672,
    612, 1816, 1817, 611, 1241, 1818, 685, 1819, 1670, 610, 1820, 1821, 609,
    1239, 1822, 686, 1823, 1668, 608, 1824, 1825, 607, 1237, 1826, 687, 1827,
    1666, 606, 1828, 1829, 605, 1235, 1830, 688, 1831, 1664, 604, 1832, 1833,
    603, 1233, 1834, 689, 1835, 1662, 602, 1836, 1837, 601, 1231, 1838, 690,
    1839, 1660, 600, 1840, 1841, 599, 1229, 1842, 691, 1843, 3028, 1658, 598,
    1845, 597, 1227, 1846, 692, 1847, 1656, 596, 1848, 1849, 595, 1225, 1850,
    693, 1851, 1654, 594, 1852, 1853, 593, 1223, 1854, 694, 1855, 1652, 592,
    1856, 1857, 591, 1221, 1858, 695, 1859, 1650, 590, 1860, 1861, 589, 1219,
    1862, 696, 1863, 1648, 588, 1864, 3012, 1865, 587, 3011, 1866, 697, 1646,
    586, 1868, 1869, 585, 1215, 1870, 698, 1871, 1644, 584, 1872, 1873, 583,
    1213, 1874, 699, 1875, 1642, 582, 1876, 1877, 581, 1211, 1878, 700, 1879,
    1640, 580, 1880, 1881, 578, 1208, 1882, 701, 1883, 1637, 577, 1884, 1885,
    576, 1206, 2996, 1886, 702, 2995, 1635, 575, 1889, 574, 1204, 1890, 703,
    1891, 1633, 573, 1892, 1893, 572, 1202, 1894, 704, 1895, 1631, 571, 1896,
    1897, 570, 1200, 1898, 705, 1899, 1629, 569, 1900, 1901, 568, 1198, 1902,
    706, 1903, 1627, 567, 1904, 1905, 566, 1196, 1906, 707, 1907, 2980, 1625,
    565, 1909, 564, 1194, 1910, 708, 1911, 1623, 563, 1912, 1913, 562, 1192,
    1914, 709, 1915, 1621, 561, 1916, 1917, 560, 1190, 1918, 710, 1919, 1619,
    559, 1920, 1921, 558, 1188, 1922, 711, 1923, 1617, 557, 1924, 1925, 556,
    1186, 1926, 712, 1927, 1615, 555, 1928, 1929, 554, 1184, 1930, 713, 1931,
    2962, 1613, 553, 1933, 552, 1182, 1934, 714, 1935, 1611, 551, 1936, 1937,
    550, 1180, 1938, 715, 1939, 1609, 549, 1940, 1941, 548, 1178, 1942, 716,
    1943, 1607, 547, 1944, 2952, 1945, 546, 2951, 1946, 717, 1605, 545, 1948,
    1949, 544, 1174, 1950, 718, 1951, 1603, 543, 1952, 1953, 542, 1172, 1954,
    719, 1955, 1601, 541, 1956, 1957, 540, 1170, 1958, 720, 1959, 1599, 539,
    1960, 1961, 537, 1167, 1962, 721, 1963, 1596, 536, 1964, 2937, 1965, 535,
    2936, 1966, 722, 1594, 534, 1968, 1969, 533, 1163, 1970, 723, 1971, 1592,
    532, 1972, 1973, 531, 1161, 2930, 1974, 724, 1590, 530, 1976, 1977, 529,
    1159, 1978, 725, 1979, 1588, 528, 1980, 2925, 1981, 527, 2924, 1982, 726,
    2923, 1586, 526, 1985, 525, 1155, 1986, 727, 1987, 1584, 524, 1988, 2919,
    1989, 523, 1990, 728, 1991, 1582, 522, 1992, 1993, 521, 1151, 1994, 729,
    1995, 2914, 1580, 520, 1997, 519, 1149, 1998, 730, 1999, 1578, 518, 2000,
    2001, 517, 1147, 2002, 731, 2003, 1576, 516, 2004, 2005, 515, 1145, 2006,
    732, 2007, 1574, 514, 2008, 2009, 513, 1143, 2010, 733, 2011, 2902, 1572,
    512, 2013, 511, 1141, 2014, 734, 2015, 1570, 510, 2016, 2017, 509, 1139,
    2018, 735, 2019, 1568, 508, 2020, 2021, 507, 1137, 2022, 736, 2023, 1566,
    506, 2024, 2892, 2025, 505, 2026, 737, 2027, 1564, 504, 2028, 2889, 2029,
    503, 2888, 2030, 738, 1562, 502, 2032, 2033, 501, 1131, 2034, 739, 2035,
    1560, 500, 2036, 2037, 499, 1129, 2038, 740, 2039, 1558, 498, 2040, 2041,
    496, 1126, 2042, 741, 2043, 1555, 495, 2044, 2045, 494, 1124, 2046, 742,
    2047, 1553, 493, 2048, 2874, 2049, 492, 2873, 2050, 743, 2872, 1551, 491,
    2871, 2053, 490, 2054, 744, 2055, 1549, 489, 2056, 2057, 488, 1118, 2058,
    745, 2059, 1547, 487, 2060, 2061, 486, 1116, 2062, 746, 2063, 1545, 485,
    2064, 2862, 2065, 484, 2861, 2066, 747, 2860, 1543, 483, 2069, 482, 1112,
    2070, 748, 2071, 1541, 481, 2072, 2073, 480, 1110, 2855, 2074, 749, 2854,
    1539, 479, 2077, 478, 1108, 2078, 750, 2079, 1537, 477, 2080, 2081, 476,
    1106, 2082, 751, 2083, 1535, 475, 2084, 2085, 474, 1104, 2846, 2086, 752,
    2845, 1533, 473, 2844, 2089, 472, 2090, 753, 2091, 1531, 471, 2092, 2093,
    470, 1100, 2840, 2094, 754, 1529, 469, 2096, 2097, 468, 1098, 2098, 755,
    2099, 1527, 467, 2100, 2835, 2101, 466, 2102, 756, 2103, 1525, 465, 2104,
    2105, 464, 1094, 2106, 757, 2107, 2830, 1523, 463, 2829, 2109, 462, 2110,
    758, 2111, 2827, 1521, 461, 2113, 460, 1090, 2114, 759, 2115, 1519, 459,
    2116, 2117, 458, 1088, 2118, 760, 2119, 1517, 457, 2120, 2820, 2121, 455,
    2819, 2122, 761, 2818, 1514, 454, 2817, 2125, 453, 2126, 762, 2127, 1512,
    452, 2128, 2814, 2129, 451, 2813, 2130, 763, 2812, 1510, 450, 2133, 449,
    1079, 2134, 764, 2135, 1508, 448, 2136, 2137, 447, 1077, 2807, 2138, 765,
    1506, 446, 2140, 2141, 445, 1075, 2142, 766, 2143, 1504, 444, 2144, 2802,
    2145, 443, 2801, 2146, 767, 1502, 442, 2148, 2149, 441, 1071, 2150, 768,
    2151, 1500, 440, 2152, 2796, 2153, 439, 2795, 2154, 769, 1498, 438, 2156,
    2157, 437, 1067, 2158, 770, 2159, 2791, 1496, 436, 2790, 2161, 435, 2162,
    771, 2163, 1494, 434, 2164, 2787, 2165, 433, 2166, 772, 2167, 1492, 432,
    2168, 2169, 431, 1061, 2170, 773, 2171, 2782, 1490, 430, 2781, 2173, 429,
    2780, 2174, 774, 1488, 428, 2176, 2177, 427, 1057, 2777, 2178, 775, 2776,
    1486, 426, 2181, 425, 1055, 2182, 776, 2183, 1484, 424, 2184, 2772, 2185,
    423, 2771, 2186, 777, 2770, 1482, 422, 2189, 421, 1051, 2190, 778, 2191,
    1480, 420, 2192, 2193, 419, 1049, 2194, 779, 2195, 1478, 418, 2196, 2197,
    417, 1047, 2198, 780, 2199, 2761, 1476, 416, 2201, 414, 1044, 2759, 2202,
    781, 1473, 413, 2204, 2205, 412, 1042, 2206, 782, 2207, 1471, 411, 2208,
    2209, 410, 1040, 2210, 783, 2211, 1469, 409, 2212, 2213, 408, 1038, 2214,
    784, 2215, 1467, 407, 2216, 2748, 2217, 406, 2218, 785, 2219, 1465, 405,
    2220, 2221, 404, 1034, 2222, 786, 2223, 1463, 403, 2224, 2225, 402, 1032,
    2226, 787, 2227, 1461, 401, 2228, 2229, 400, 1030, 2230, 788, 2231, 1459,
    399, 2232, 2233, 398, 1028, 2234, 789, 2235, 2734, 1457, 397, 2237, 396,
    1026, 2238, 790, 2239, 1455, 395, 2240, 2241, 394, 1024, 2242, 791, 2243,
    1453, 393, 2244, 2245, 392, 1022, 2726, 2246, 792, 1451, 391, 2248, 2249,
    390, 1020, 2250, 793, 2251, 1449, 389, 2252, 2253, 388, 1018, 2254, 794,
    2255, 1447, 387, 2256, 2718, 2257, 386, 2258, 795, 2259, 2716, 1445, 385,
    2261, 384, 1014, 2262, 796, 2263, 1443, 383, 2264, 2265, 382, 1012, 2266,
    797, 2267, 1441, 381, 2268, 2269, 380, 1010, 2708, 2270, 798, 2707, 1439,
    379, 2273, 378, 1008, 2274, 799, 2275, 1437, 377, 2276, 2277, 376, 1006,
    2278, 800, 2279, 1435, 375, 2280, 2281, 373, 1003, 2282, 801, 2283, 1432,
    372, 2284, 2285, 371, 1001, 2286, 802, 2287, 1430, 370, 2288, 2289, 369,
    999, 2290, 803, 2291, 1428, 368, 2292, 2293, 367, 997, 2294, 804, 2295,
    1426, 366, 2296, 2297, 365, 995, 2298, 805, 2299, 1424, 364, 2300, 2301,
    363, 993, 2302, 806, 2303, 1422, 362, 2304, 2305, 361, 991, 2306, 807, 2307,
    2680, 1420, 360, 2309, 359, 989, 2310, 808, 2311, 1418, 358, 2312, 2313,
    357, 987, 2314, 809, 2315, 1416, 356, 2316, 2317, 355, 985, 2318, 810, 2319,
    1414, 354, 2320, 2321, 353, 983, 2322, 811, 2323, 1412, 352, 2324, 2325,
    351, 981, 2326, 812, 2327, 1410, 350, 2328, 2329, 349, 979, 2330, 813, 2331,
    1408, 348, 2332, 2661, 2333, 347, 2660, 2334, 814, 1406, 346, 2336, 2337,
    345, 975, 2338, 815, 2339, 1404, 344, 2340, 2341, 343, 973, 2342, 816, 2343,
    1402, 342, 2344, 2345, 341, 971, 2346, 817, 2347, 1400, 340, 2348, 2649,
    2349, 339, 2648, 2350, 818, 1398, 338, 2352, 2353, 337, 967, 2354, 819,
    2355, 1396, 336, 2356, 2357, 335, 965, 2358, 820, 2359, 1394, 334, 2360,
    2361, 332, 962, 2362, 821, 2363, 1391, 331, 2364, 2365, 330, 960, 2366, 822,
    2367, 1389, 329, 2368, 2369, 328, 958, 2370, 823, 2371, 1387, 327, 2372,
    2373, 326, 956, 2374, 824, 2375, 1385, 325, 2376, 2377, 324, 954, 2378, 825,
    2379, 1383, 323, 2380, 2381, 322, 952, 2382, 826, 2383, 1381, 321, 2384,
    2385, 320, 950, 2386, 827, 2387, 1379, 319, 2388, 2389, 318, 948, 2390, 828,
    2391, 1377, 317, 2392, 2393, 316, 946, 2394, 829, 2395, 1375, 315, 2396,
    2397, 314, 944, 2398, 830, 2399, 1373, 313, 2400, 2401, 312, 942, 2402, 831,
    2403, 1371, 311, 2404, 2405, 310, 940, 2406, 832, 2407, 1369, 309, 2408,
    2409, 308, 938, 2410, 833, 2411, 1367, 307, 2412, 2413, 306, 936, 2600,
    2414, 834, 1365, 305, 2416, 2417, 304, 934, 2418, 835, 2419, 1363, 303,
    2420, 2421, 302, 932, 2422, 836, 2423, 1361, 301, 2424, 2425, 300, 930,
    2426, 837, 2427, 1359, 299, 2428, 2429, 298, 928, 2430, 838, 2431, 1357,
    297, 2432, 2433, 296, 926, 2434, 839, 2435, 1355, 295, 2436, 2437, 294, 924,
    2438, 840, 2439, 1353, 293, 2440, 2441, 291, 921, 2442, 841, 2443, 1350,
    290, 2444, 2445, 288, 918, 2446, 842, 2447, 1347, 287, 2448, 2449, 285, 915,
    2450, 843, 2451, 1344, 284, 2452, 2453, 282, 912, 2570, 2454, 844, 2569,
    1341, 281, 2457, 279, 909, 2458, 845, 2459, 1338, 278, 2460, 2461, 276, 906,
    2462, 846, 2463, 1335, 275, 2464, 2465, 273, 903, 2466, 847, 2467, 1332,
    272, 2468, 2469, 270, 900, 2470, 848, 2471, 1329, 269, 2472, 2473, 267, 897,
    2474, 849, 2475, 1326, 266, 2476, 2553, 2477, 264, 2552, 2478, 850, 1323,
    263, 2480, 2550, 2481, 261, 2482, 851, 2483, 1320, 260, 2484, 2547, 2485,
    258, 2486, 852, 2487, 1317, 257, 2488, 2544, 2489, 255, 2490, 853, 2491,
    2542, 1314, 254, 2493, 252, 882, 2494, 854, 2495, 1311, 251, 2496, 2497,
    249, 879, 2498, 855, 2499, 1308, 248, 2500, 2535, 2501, 246, 2502, 856,
    2503, 1305, 245, 2504, 2505, 243, 873, 2506, 857, 2507, 2530, 1302, 242,
    2509, 240, 870, 2510, 858, 2511, 1299, 239, 2512, 2526, 2513, 237, 2514,
    859, 2515, 1296, 236, 2516, 2523, 2517, 234, 2518, 860, 2519, 2521, 1293,
    233, 2521, 2520, 860, 232, 862, 2521, 862, 1, 1293, 2522, 2519, 231, 1292,
    2522, 861, 232, 2518, 2522, 2523, 864, 21, 231, 2519, 2523, 2519, 860, 2517,
    2524, 2516, 859, 865, 2524, 2514, 2, 1296, 2524, 1293, 2525, 2515, 1295,
    2525, 1293, 235, 2514, 2525, 863, 2526, 867, 233, 2515, 2526, 2515, 859,
    2513, 2527, 2512, 858, 868, 2527, 2510, 3, 1299, 2527, 2528, 2511, 236,
    1298, 2528, 1296, 238, 2510, 2528, 2529, 870, 23, 2511, 2529, 866, 858,
    2509, 2529, 2506, 2530, 2508, 241, 871, 2530, 871, 4, 1302, 2531, 2507, 239,
    1301, 2531, 1299, 1301, 241, 2506, 2532, 873, 24, 2507, 2532, 869, 857,
    2505, 2532, 2533, 2504, 856, 874, 2533, 2502, 5, 1305, 2533, 1302, 2534,
    2503, 1304, 2534, 1302, 244, 2502, 2534, 872, 2535, 876, 242, 2503, 2535,
    2503, 856, 2501, 2536, 2500, 855, 877, 2536, 2498, 6, 1308, 2536, 2537,
    2499, 245, 1307, 2537, 1305, 247, 2498, 2537, 2538, 879, 26, 2499, 2538,
    875, 855, 2497, 2538, 2539, 2496, 854, 880, 2539, 2494, 7, 1311, 2539, 1308,
    2540, 2495, 6, 1310, 2540, 250, 2494, 2540, 2541, 882, 27, 2495, 2541, 878,
    854, 2493, 2541, 2542, 2492, 853, 883, 2542, 2490, 8, 1314, 2542, 2543,
    2491, 251, 1313, 2543, 1311, 253, 2490, 2543, 881, 2544, 885, 251, 2491,
    2544, 2491, 853, 2489, 2545, 2488, 852, 886, 2545, 2486, 9, 1317, 2545,
    1314, 2546, 2487, 1316, 2546, 1314, 256, 2486, 2546, 884, 2547, 888, 254,
    2487, 2547, 2487, 852, 2485, 2482, 2548, 2484, 889, 2548, 2482, 889, 10,
    1320, 2549, 2483, 257, 1319, 2549, 1317, 259, 2482, 2549, 887, 2550, 891,
    2483, 2550, 887, 851, 2481, 2550, 2551, 2480, 850, 892, 2551, 2478, 892, 11,
    1323, 1320, 2552, 2479, 10, 1322, 2552, 1322, 262, 2478, 2553, 894, 31,
    2479, 2553, 890, 2479, 850, 2477, 2554, 2476, 849, 895, 2554, 2474, 12,
    1326, 2554, 2555, 2475, 263, 1325, 2555, 1323, 265, 2474, 2555, 2556, 897,
    32, 2475, 2556, 893, 849, 2473, 2556, 2557, 2472, 848, 898, 2557, 2470, 13,
    1329, 2557, 2558, 2471, 266, 1328, 2558, 1326, 268, 2470, 2558, 2559, 900,
    33, 2471, 2559, 896, 848, 2469, 2559, 2560, 2468, 847, 901, 2560, 2466, 14,
    1332, 2560, 2561, 2467, 269, 1331, 2561, 1329, 271, 2466, 2561, 2562, 903,
    34, 2467, 2562, 899, 847, 2465, 2562, 2563, 2464, 846, 904, 2563, 2462, 15,
    1335, 2563, 2564, 2463, 272, 1334, 2564, 1332, 274, 2462, 2564, 2565, 906,
    35, 2463, 2565, 902, 846, 2461, 2565, 2566, 2460, 845, 907, 2566, 2458, 16,
    1338, 2566, 2567, 2459, 275, 1337, 2567, 1335, 277, 2458, 2567, 905, 2568,
    909, 2459, 2568, 905, 845, 2457, 2568, 2454, 2569, 2456, 910, 2569, 2454,
    910, 17, 1341, 2570, 2455, 278, 16, 1340, 2570, 1340, 280, 2454, 2571, 912,
    37, 2455, 2571, 908, 2455, 844, 2453, 2572, 2452, 843, 913, 2572, 2450, 18,
    1344, 2572, 2573, 2451, 281, 1343, 2573, 1341, 283, 2450, 2573, 2574, 915,
    38, 2451, 2574, 911, 843, 2449, 2574, 2575, 2448, 842, 916, 2575, 2446, 19,
    1347, 2575, 2576, 2447, 284, 1346, 2576, 1344, 286, 2446, 2576, 2577, 918,
    39, 2447, 2577, 914, 842, 2445, 2577, 2578, 2444, 841, 919, 2578, 2442, 919,
    20, 1350, 2579, 2443, 287, 1349, 2579, 1347, 289, 2442, 2579, 2580, 921, 40,
    2443, 2580, 917, 841, 2441, 2580, 2581, 2440, 840, 1294, 2581, 2438, 22,
    1353, 2581, 2582, 2439, 292, 864, 2582, 922, 234, 2438, 2582, 2583, 924, 42,
    2439, 2583, 1352, 840, 2437, 2583, 2584, 2436, 839, 1297, 2584, 2434, 23,
    1355, 2584, 2585, 2435, 293, 867, 2585, 1353, 237, 2434, 2585, 2586, 926,
    43, 2435, 2586, 923, 839, 2433, 2586, 2587, 2432, 838, 1300, 2587, 2430, 24,
    1357, 2587, 2588, 2431, 295, 870, 2588, 1355, 240, 2430, 2588, 2589, 928,
    44, 2431, 2589, 925, 838, 2429, 2589, 2590, 2428, 837, 1303, 2590, 2426, 25,
    1359, 2590, 2591, 2427, 297, 873, 2591, 1357, 243, 2426, 2591, 2592, 930,
    45, 2427, 2592, 927, 837, 2425, 2592, 2593, 2424, 836, 1306, 2593, 2422, 26,
    1361, 2593, 2594, 2423, 299, 876, 2594, 1359, 246, 2422, 2594, 2595, 932,
    46, 2423, 2595, 929, 836, 2421, 2595, 2596, 2420, 835, 1309, 2596, 2418, 27,
    1363, 2596, 2597, 2419, 301, 879, 2597, 1361, 249, 2418, 2597, 2598, 934,
    47, 2419, 2598, 931, 835, 2417, 2598, 2414, 2599, 2416, 1312, 2599, 2414,
    28, 1365, 2599, 2600, 2415, 303, 882, 2600, 1363, 252, 2414, 2600, 933,
    2601, 936, 2415, 2601, 933, 2415, 834, 2413, 2602, 2412, 833, 1315, 2602,
    2410, 29, 1367, 2602, 2603, 2411, 305, 885, 2603, 1365, 255, 2410, 2603,
    2604, 938, 49, 2411, 2604, 935, 833, 2409, 2604, 2605, 2408, 832, 1318,
    2605, 2406, 30, 1369, 2605, 2606, 2407, 307, 888, 2606, 1367, 258, 2406,
    2606, 2607, 940, 50, 2407, 2607, 937, 832, 2405, 2607, 2608, 2404, 831,
    1321, 2608, 2402, 31, 1371, 2608, 2609, 2403, 309, 891, 2609, 1369, 261,
    2402, 2609, 2610, 942, 51, 2403, 2610, 939, 831, 2401, 2610, 2611, 2400,
    830, 1324, 2611, 2398, 32, 1373, 2611, 2612, 2399, 311, 894, 2612, 1371,
    264, 2398, 2612, 2613, 944, 52, 2399, 2613, 941, 830, 2397, 2613, 2614,
    2396, 829, 1327, 2614, 2394, 33, 1375, 2614, 2615, 2395, 313, 897, 2615,
    1373, 267, 2394, 2615, 2616, 946, 53, 2395, 2616, 943, 829, 2393, 2616,
    2617, 2392, 828, 1330, 2617, 2390, 1330, 34, 1377, 2618, 2391, 315, 900,
    2618, 1375, 270, 2390, 2618, 2619, 948, 54, 2391, 2619, 945, 828, 2389,
    2619, 2620, 2388, 827, 1333, 2620, 2386, 35, 1379, 2620, 1377, 2621, 2387,
    903, 2621, 1377, 273, 2386, 2621, 2622, 950, 55, 317, 2387, 2622, 827, 2385,
    2622, 2623, 2384, 826, 1336, 2623, 2382, 36, 1381, 2623, 2624, 2383, 319,
    906, 2624, 1379, 276, 2382, 2624, 2625, 952, 56, 2383, 2625, 949, 826, 2381,
    2625, 2626, 2380, 825, 1339, 2626, 2378, 37, 1383, 2626, 1381, 2627, 2379,
    36, 909, 2627, 279, 2378, 2627, 2628, 954, 57, 2379, 2628, 951, 825, 2377,
    2628, 2629, 2376, 824, 1342, 2629, 2374, 38, 1385, 2629, 2630, 2375, 323,
    912, 2630, 1383, 282, 2374, 2630, 2631, 956, 58, 2375, 2631, 953, 824, 2373,
    2631, 2632, 2372, 823, 1345, 2632, 2370, 39, 1387, 2632, 2633, 2371, 325,
    915, 2633, 1385, 285, 2370, 2633, 2634, 958, 59, 2371, 2634, 955, 823, 2369,
    2634, 2635, 2368, 822, 1348, 2635, 2366, 40, 1389, 2635, 2636, 2367, 327,
    918, 2636, 1387, 288, 2366, 2636, 2637, 960, 60, 2367, 2637, 957, 822, 2365,
    2637, 2638, 2364, 821, 1351, 2638, 2362, 41, 1391, 2638, 2639, 2363, 329,
    921, 2639, 1389, 291, 2362, 2639, 2640, 962, 61, 2363, 2640, 959, 821, 2361,
    2640, 2641, 2360, 820, 1354, 2641, 2358, 43, 1394, 2641, 2642, 2359, 333,
    924, 2642, 963, 294, 2358, 2642, 2643, 965, 63, 2359, 2643, 1393, 820, 2357,
    2643, 2644, 2356, 819, 1356, 2644, 2354, 1356, 44, 1396, 2645, 2355, 334,
    926, 2645, 1394, 296, 2354, 2645, 2646, 967, 64, 2355, 2646, 964, 819, 2353,
    2646, 2647, 2352, 818, 1358, 2647, 2350, 45, 1398, 2647, 1396, 2648, 2351,
    44, 928, 2648, 298, 2350, 2648, 966, 2649, 969, 336, 2351, 2649, 2351, 818,
    2349, 2650, 2348, 817, 1360, 2650, 2346, 46, 1400, 2650, 2651, 2347, 338,
    930, 2651, 1398, 300, 2346, 2651, 2652, 971, 66, 2347, 2652, 968, 817, 2345,
    2652, 2653, 2344, 816, 1362, 2653, 2342, 47, 1402, 2653, 2654, 2343, 340,
    932, 2654, 1400, 302, 2342, 2654, 2655, 973, 67, 2343, 2655, 970, 816, 2341,
    2655, 2656, 2340, 815, 1364, 2656, 2338, 48, 1404, 2656, 2657, 2339, 342,
    934, 2657, 1402, 304, 2338, 2657, 2658, 975, 68, 2339, 2658, 972, 815, 2337,
    2658, 2659, 2336, 814, 1366, 2659, 2334, 49, 1406, 2659, 1404, 2660, 2335,
    48, 936, 2660, 306, 2334, 2660, 974, 2661, 977, 344, 2335, 2661, 2335, 814,
    2333, 2662, 2332, 813, 1368, 2662, 2330, 50, 1408, 2662, 2663, 2331, 346,
    938, 2663, 1406, 308, 2330, 2663, 2664, 979, 70, 2331, 2664, 976, 813, 2329,
    2664, 2665, 2328, 812, 1370, 2665, 2326, 51, 1410, 2665, 2666, 2327, 348,
    940, 2666, 1408, 310, 2326, 2666, 978, 2667, 981, 2327, 2667, 978, 812,
    2325, 2667, 2668, 2324, 811, 1372, 2668, 2322, 52, 1412, 2668, 2669, 2323,
    350, 942, 2669, 1410, 312, 2322, 2669, 2670, 983, 72, 2323, 2670, 980, 811,
    2321, 2670, 2671, 2320, 810, 1374, 2671, 2318, 53, 1414, 2671, 2672, 2319,
    352, 944, 2672, 1412, 314, 2318, 2672, 2673, 985, 73, 2319, 2673, 982, 810,
    2317, 2673, 2674, 2316, 809, 1376, 2674, 2314, 54, 1416, 2674, 2675, 2315,
    354, 946, 2675, 1414, 316, 2314, 2675, 2676, 987, 74, 2315, 2676, 984, 809,
    2313, 2676, 2677, 2312, 808, 1378, 2677, 2310, 55, 1418, 2677, 2678, 2311,
    356, 948, 2678, 1416, 318, 2310, 2678, 986, 2679, 989, 356, 2311, 2679, 808,
    2309, 2679, 2680, 2308, 807, 1380, 2680, 2306, 1380, 56, 1420, 1418, 2681,
    2307, 55, 950, 2681, 320, 2306, 2681, 2682, 991, 76, 2307, 2682, 988, 807,
    2305, 2682, 2683, 2304, 806, 1382, 2683, 2302, 57, 1422, 2683, 2684, 2303,
    360, 952, 2684, 1420, 322, 2302, 2684, 2685, 993, 77, 2303, 2685, 990, 806,
    2301, 2685, 2686, 2300, 805, 1384, 2686, 2298, 58, 1424, 2686, 2687, 2299,
    362, 954, 2687, 1422, 324, 2298, 2687, 2688, 995, 78, 2299, 2688, 992, 805,
    2297, 2688, 2689, 2296, 804, 1386, 2689, 2294, 59, 1426, 2689, 2690, 2295,
    364, 956, 2690, 1424, 326, 2294, 2690, 2691, 997, 79, 2295, 2691, 994, 804,
    2293, 2691, 2692, 2292, 803, 1388, 2692, 2290, 60, 1428, 2692, 2693, 2291,
    366, 958, 2693, 1426, 328, 2290, 2693, 2694, 999, 80, 2291, 2694, 996, 803,
    2289, 2694, 2695, 2288, 802, 1390, 2695, 2286, 61, 1430, 2695, 2696, 2287,
    368, 960, 2696, 1428, 330, 2286, 2696, 2697, 1001, 81, 2287, 2697, 998, 802,
    2285, 2697, 2698, 2284, 801, 1392, 2698, 2282, 62, 1432, 2698, 2699, 2283,
    370, 962, 2699, 1430, 332, 2282, 2699, 2700, 1003, 82, 2283, 2700, 1000,
    801, 2281, 2700, 2701, 2280, 800, 1395, 2701, 2278, 64, 1435, 2701, 2702,
    2279, 374, 965, 2702, 1004, 335, 2278, 2702, 2703, 1006, 84, 2279, 2703,
    1434, 800, 2277, 2703, 2704, 2276, 799, 1397, 2704, 2274, 65, 1437, 2704,
    2705, 2275, 375, 967, 2705, 1435, 337, 2274, 2705, 2706, 1008, 85, 2275,
    2706, 1005, 799, 2273, 2706, 2707, 2272, 798, 339, 1399, 2707, 66, 1439,
    2707, 2708, 2271, 377, 969, 2708, 1437, 969, 339, 2270, 2709, 1010, 86,
    2271, 2709, 1007, 798, 2269, 2709, 2710, 2268, 797, 1401, 2710, 2266, 67,
    1441, 2710, 2711, 2267, 379, 971, 2711, 1439, 341, 2266, 2711, 2712, 1012,
    87, 2267, 2712, 1009, 797, 2265, 2712, 2713, 2264, 796, 1403, 2713, 2262,
    68, 1443, 2713, 2714, 2263, 381, 973, 2714, 1441, 343, 2262, 2714, 2715,
    1014, 88, 2263, 2715, 1011, 796, 2261, 2715, 2716, 2260, 795, 1405, 2716,
    2258, 1405, 69, 1445, 1443, 2717, 2259, 68, 975, 2717, 345, 2258, 2717,
    1013, 2718, 1016, 383, 2259, 2718, 2259, 795, 2257, 2719, 2256, 794, 1407,
    2719, 2254, 70, 1447, 2719, 2720, 2255, 385, 977, 2720, 1445, 347, 2254,
    2720, 1015, 2721, 1018, 2255, 2721, 1015, 794, 2253, 2721, 2722, 2252, 793,
    1409, 2722, 2250, 71, 1449, 2722, 2723, 2251, 387, 979, 2723, 1447, 349,
    2250, 2723, 2724, 1020, 91, 2251, 2724, 1017, 793, 2249, 2724, 2725, 2248,
    792, 1411, 2725, 2246, 72, 1451, 2725, 2726, 2247, 389, 71, 981, 2726, 351,
    2246, 2726, 2727, 1022, 92, 2247, 2727, 1019, 792, 2245, 2727, 2728, 2244,
    791, 1413, 2728, 2242, 73, 1453, 2728, 2729, 2243, 391, 983, 2729, 1451,
    353, 2242, 2729, 1021, 2730, 1024, 391, 2243, 2730, 791, 2241, 2730, 2731,
    2240, 790, 1415, 2731, 2238, 74, 1455, 2731, 2732, 2239, 393, 985, 2732,
    1453, 355, 2238, 2732, 2733, 1026, 94, 2239, 2733, 1023, 790, 2237, 2733,
    2734, 2236, 789, 1417, 2734, 2234, 1417, 75, 1457, 1455, 2735, 2235, 74,
    987, 2735, 357, 2234, 2735, 2736, 1028, 95, 395, 2235, 2736, 789, 2233,
    2736, 2737, 2232, 788, 1419, 2737, 2230, 76, 1459, 2737, 2738, 2231, 397,
    75, 989, 2738, 359, 2230, 2738, 2739, 1030, 96, 2231, 2739, 1027, 788, 2229,
    2739, 2740, 2228, 787, 1421, 2740, 2226, 77, 1461, 2740, 2741, 2227, 399,
    991, 2741, 1459, 361, 2226, 2741, 2742, 1032, 97, 2227, 2742, 1029, 787,
    2225, 2742, 2743, 2224, 786, 1423, 2743, 2222, 78, 1463, 2743, 2744, 2223,
    401, 993, 2744, 1461, 363, 2222, 2744, 2745, 1034, 98, 2223, 2745, 1031,
    786, 2221, 2745, 2746, 2220, 785, 1425, 2746, 2218, 79, 1465, 2746, 2747,
    2219, 403, 995, 2747, 1463, 365, 2218, 2747, 2748, 1036, 99, 2219, 2748,
    1033, 785, 2217, 2748, 2749, 2216, 784, 1427, 2749, 2214, 80, 1467, 2749,
    2750, 2215, 405, 997, 2750, 1465, 367, 2214, 2750, 2751, 1038, 100, 2215,
    2751, 1035, 784, 2213, 2751, 2752, 2212, 783, 1429, 2752, 2210, 81, 1469,
    2752, 2753, 2211, 407, 999, 2753, 1467, 369, 2210, 2753, 2754, 1040, 101,
    2211, 2754, 1037, 783, 2209, 2754, 2755, 2208, 782, 1431, 2755, 2206, 82,
    1471, 2755, 2756, 2207, 409, 1001, 2756, 1469, 371, 2206, 2756, 2757, 1042,
    102, 2207, 2757, 1039, 782, 2205, 2757, 2758, 2204, 781, 1433, 2758, 2202,
    83, 1473, 2758, 2759, 2203, 411, 1003, 2759, 1471, 1003, 373, 2202, 1041,
    2760, 1044, 411, 2203, 2760, 2203, 781, 2201, 2198, 2761, 2200, 376, 1436,
    2761, 85, 1476, 2761, 2762, 2199, 415, 1006, 2762, 1045, 1006, 376, 2198,
    1475, 2763, 1047, 2199, 2763, 1475, 780, 2197, 2763, 2764, 2196, 779, 1438,
    2764, 2194, 86, 1478, 2764, 2765, 2195, 416, 1008, 2765, 1476, 378, 2194,
    2765, 1046, 2766, 1049, 2195, 2766, 1046, 779, 2193, 2766, 2767, 2192, 778,
    1440, 2767, 2190, 87, 1480, 2767, 2768, 2191, 418, 1010, 2768, 1478, 380,
    2190, 2768, 2769, 1051, 107, 2191, 2769, 1048, 778, 2189, 2769, 2186, 2770,
    2188, 382, 1442, 2770, 88, 1482, 2770, 2771, 2187, 420, 1012, 2771, 1480,
    1012, 382, 2186, 1050, 2772, 1053, 420, 2187, 2772, 2187, 777, 2185, 2773,
    2184, 776, 1444, 2773, 2182, 89, 1484, 2773, 2774, 2183, 422, 1014, 2774,
    1482, 384, 2182, 2774, 1052, 2775, 1055, 2183, 2775, 1052, 776, 2181, 2775,
    2178, 2776, 2180, 386, 1446, 2776, 1446, 90, 1486, 1484, 2777, 2179, 89,
    1016, 2777, 1016, 386, 2178, 1054, 2778, 1057, 424, 2179, 2778, 2179, 775,
    2177, 2779, 2176, 774, 1448, 2779, 2174, 91, 1488, 2779, 2780, 2175, 426,
    1018, 2780, 1486, 388, 2174, 2780, 1056, 2781, 1059, 2175, 2781, 1056, 2175,
    774, 2173, 2782, 2172, 773, 1450, 2782, 2170, 1450, 92, 1490, 2783, 2171,
    428, 1020, 2783, 1488, 390, 2170, 2783, 2784, 1061, 112, 2171, 2784, 1058,
    773, 2169, 2784, 2785, 2168, 772, 1452, 2785, 2166, 93, 1492, 2785, 1490,
    2786, 2167, 1022, 2786, 1490, 392, 2166, 2786, 1060, 2787, 1063, 430, 2167,
    2787, 772, 2165, 2787, 2788, 2164, 771, 1454, 2788, 2162, 94, 1494, 2788,
    2789, 2163, 432, 93, 1024, 2789, 394, 2162, 2789, 2790, 1065, 114, 2163,
    2790, 1062, 2163, 771, 2161, 2791, 2160, 770, 1456, 2791, 2158, 1456, 95,
    1496, 2792, 2159, 434, 1026, 2792, 1494, 396, 2158, 2792, 2793, 1067, 115,
    2159, 2793, 1064, 770, 2157, 2793, 2154, 2794, 2156, 1458, 2794, 2154, 96,
    1498, 2794, 1496, 2795, 2155, 95, 1028, 2795, 1028, 398, 2154, 2796, 1069,
    116, 436, 2155, 2796, 2155, 769, 2153, 2797, 2152, 768, 1460, 2797, 2150,
    97, 1500, 2797, 2798, 2151, 438, 1030, 2798, 1498, 400, 2150, 2798, 2799,
    1071, 117, 2151, 2799, 1068, 768, 2149, 2799, 2800, 2148, 767, 1462, 2800,
    2146, 98, 1502, 2800, 2801, 2147, 440, 1032, 2801, 1500, 1032, 402, 2146,
    1070, 2802, 1073, 2147, 2802, 1070, 2147, 767, 2145, 2803, 2144, 766, 1464,
    2803, 2142, 99, 1504, 2803, 2804, 2143, 442, 1034, 2804, 1502, 404, 2142,
    2804, 2805, 1075, 119, 2143, 2805, 1072, 766, 2141, 2805, 2806, 2140, 765,
    406, 1466, 2806, 1466, 100, 1506, 2807, 2139, 444, 99, 1036, 2807, 1036,
    406, 2138, 2808, 1077, 120, 2139, 2808, 1074, 765, 2137, 2808, 2809, 2136,
    764, 1468, 2809, 2134, 101, 1508, 2809, 2810, 2135, 446, 1038, 2810, 1506,
    408, 2134, 2810, 2811, 1079, 121, 2135, 2811, 1076, 764, 2133, 2811, 2130,
    2812, 2132, 410, 1470, 2812, 102, 1510, 2812, 2813, 2131, 448, 1040, 2813,
    1508, 1040, 410, 2130, 1078, 2814, 1081, 448, 2131, 2814, 2131, 763, 2129,
    2815, 2128, 762, 1472, 2815, 2126, 103, 1512, 2815, 2816, 2127, 450, 1042,
    2816, 1510, 412, 2126, 2816, 1080, 2817, 1083, 2127, 2817, 1080, 762, 2125,
    2817, 2122, 2818, 2124, 414, 1474, 2818, 1474, 104, 1514, 1512, 2819, 2123,
    103, 1044, 2819, 1044, 414, 2122, 1082, 2820, 1085, 452, 2123, 2820, 2123,
    761, 2121, 2821, 2120, 760, 1477, 2821, 2118, 106, 1517, 2821, 2822, 2119,
    456, 1047, 2822, 1086, 417, 2118, 2822, 2823, 1088, 126, 2119, 2823, 1516,
    760, 2117, 2823, 2824, 2116, 759, 1479, 2824, 2114, 107, 1519, 2824, 2825,
    2115, 457, 1049, 2825, 1517, 419, 2114, 2825, 2826, 1090, 127, 2115, 2826,
    1087, 759, 2113, 2826, 2110, 2827, 2112, 1481, 2827, 2110, 108, 1521, 2827,
    1519, 2828, 2111, 107, 1051, 2828, 421, 2110, 2828, 1089, 2829, 1092, 459,
    2111, 2829, 2111, 758, 2109, 2106, 2830, 2108, 423, 1483, 2830, 1483, 109,
    1523, 1521, 2831, 2107, 108, 1053, 2831, 1053, 423, 2106, 2832, 1094, 129,
    2107, 2832, 1091, 757, 2105, 2832, 2833, 2104, 756, 1485, 2833, 2102, 110,
    1525, 2833, 2834, 2103, 463, 1055, 2834, 1523, 425, 2102, 2834, 1093, 2835,
    1096, 2103, 2835, 1093, 2103, 756, 2101, 2836, 2100, 755, 1487, 2836, 2098,
    111, 1527, 2836, 2837, 2099, 465, 1057, 2837, 1525, 427, 2098, 2837, 2838,
    1098, 131, 2099, 2838, 1095, 755, 2097, 2838, 2094, 2839, 2096, 429, 1489,
    2839, 112, 1529, 2839, 1527, 2840, 2095, 111, 1059, 2840, 1059, 429, 2094,
    2841, 1100, 132, 467, 2095, 2841, 2095, 754, 2093, 2842, 2092, 753, 1491,
    2842, 2090, 113, 1531, 2842, 2843, 2091, 469, 1061, 2843, 1529, 431, 2090,
    2843, 2844, 1102, 133, 2091, 2844, 1099, 753, 2089, 2844, 2845, 2088, 752,
    433, 1493, 2845, 114, 1533, 2845, 2846, 2087, 471, 113, 1063, 2846, 1063,
    433, 2086, 2847, 1104, 134, 2087, 2847, 1101, 2087, 752, 2085, 2848, 2084,
    751, 1495, 2848, 2082, 1495, 115, 1535, 2849, 2083, 473, 1065, 2849, 1533,
    435, 2082, 2849, 1103, 2850, 1106, 473, 2083, 2850, 751, 2081, 2850, 2851,
    2080, 750, 1497, 2851, 2078, 116, 1537, 2851, 2852, 2079, 475, 1067, 2852,
    1535, 437, 2078, 2852, 2853, 1108, 136, 475, 2079, 2853, 750, 2077, 2853,
    2854, 2076, 749, 1499, 2854, 2074, 117, 1539, 2854, 2855, 2075, 477, 1069,
    2855, 1537, 439, 2074, 2855, 2856, 1110, 137, 2075, 2856, 1107, 749, 2073,
    2856, 2857, 2072, 748, 1501, 2857, 2070, 118, 1541, 2857, 2858, 2071, 479,
    1071, 2858, 1539, 441, 2070, 2858, 1109, 2859, 1112, 479, 2071, 2859, 748,
    2069, 2859, 2066, 2860, 2068, 443, 1503, 2860, 1503, 119, 1543, 1541, 2861,
    2067, 118, 1073, 2861, 1073, 443, 2066, 2862, 1114, 139, 2067, 2862, 1111,
    2067, 747, 2065, 2863, 2064, 746, 1505, 2863, 2062, 120, 1545, 2863, 2864,
    2063, 483, 1075, 2864, 1543, 445, 2062, 2864, 2865, 1116, 140, 2063, 2865,
    1113, 746, 2061, 2865, 2866, 2060, 745, 1507, 2866, 2058, 121, 1547, 2866,
    2867, 2059, 485, 1077, 2867, 1545, 447, 2058, 2867, 2868, 1118, 141, 2059,
    2868, 1115, 745, 2057, 2868, 2054, 2869, 2056, 1509, 2869, 2054, 122, 1549,
    2869, 2870, 2055, 487, 1079, 2870, 1547, 449, 2054, 2870, 1117, 2871, 1120,
    487, 2055, 2871, 2055, 744, 2053, 2050, 2872, 2052, 451, 1511, 2872, 1511,
    123, 1551, 1549, 2873, 2051, 122, 1081, 2873, 1081, 451, 2050, 2874, 1122,
    143, 489, 2051, 2874, 2051, 743, 2049, 2875, 2048, 742, 1513, 2875, 2046,
    124, 1553, 2875, 2876, 2047, 491, 1083, 2876, 1551, 453, 2046, 2876, 2877,
    1124, 144, 2047, 2877, 1121, 742, 2045, 2877, 2878, 2044, 741, 1515, 2878,
    2042, 1515, 125, 1555, 2879, 2043, 493, 1085, 2879, 1553, 455, 2042, 2879,
    2880, 1126, 145, 2043, 2880, 1123, 741, 2041, 2880, 2881, 2040, 740, 1518,
    2881, 2038, 127, 1558, 2881, 2882, 2039, 497, 1088, 2882, 1127, 458, 2038,
    2882, 2883, 1129, 147, 2039, 2883, 1557, 740, 2037, 2883, 2884, 2036, 739,
    1520, 2884, 2034, 128, 1560, 2884, 2885, 2035, 498, 1090, 2885, 1558, 460,
    2034, 2885, 2886, 1131, 148, 2035, 2886, 1128, 739, 2033, 2886, 2030, 2887,
    2032, 462, 1522, 2887, 1522, 129, 1562, 1560, 2888, 2031, 128, 1092, 2888,
    1092, 462, 2030, 2889, 1133, 149, 2031, 2889, 1130, 2031, 738, 2029, 2890,
    2028, 737, 1524, 2890, 2026, 130, 1564, 2890, 2891, 2027, 502, 1094, 2891,
    1562, 464, 2026, 2891, 1132, 2892, 1135, 2027, 2892, 1132, 2027, 737, 2025,
    2022, 2893, 2024, 466, 1526, 2893, 1526, 131, 1566, 2894, 2023, 504, 1096,
    2894, 1564, 466, 2022, 2894, 2895, 1137, 151, 2023, 2895, 1134, 736, 2021,
    2895, 2896, 2020, 735, 1528, 2896, 2018, 132, 1568, 2896, 2897, 2019, 506,
    1098, 2897, 1566, 468, 2018, 2897, 2898, 1139, 152, 2019, 2898, 1136, 735,
    2017, 2898, 2899, 2016, 734, 1530, 2899, 2014, 133, 1570, 2899, 2900, 2015,
    508, 1100, 2900, 1568, 470, 2014, 2900, 2901, 1141, 153, 2015, 2901, 1138,
    734, 2013, 2901, 2010, 2902, 2012, 472, 1532, 2902, 134, 1572, 2902, 2903,
    2011, 510, 1102, 2903, 1570, 1102, 472, 2010, 2904, 1143, 154, 2011, 2904,
    1140, 733, 2009, 2904, 2905, 2008, 732, 1534, 2905, 2006, 1534, 135, 1574,
    1572, 2906, 2007, 1104, 2906, 1572, 474, 2006, 2906, 1142, 2907, 1145, 512,
    2007, 2907, 732, 2005, 2907, 2908, 2004, 731, 1536, 2908, 2002, 136, 1576,
    2908, 2909, 2003, 514, 1106, 2909, 1574, 476, 2002, 2909, 2910, 1147, 156,
    2003, 2910, 1144, 731, 2001, 2910, 2911, 2000, 730, 1538, 2911, 1998, 1538,
    137, 1578, 2912, 1999, 516, 1108, 2912, 1576, 478, 1998, 2912, 2913, 1149,
    157, 1999, 2913, 1146, 730, 1997, 2913, 2914, 1996, 729, 1540, 2914, 1994,
    138, 1580, 2914, 2915, 1995, 518, 1110, 2915, 1578, 480, 1994, 2915, 2916,
    1151, 158, 1995, 2916, 1148, 729, 1993, 2916, 2917, 1992, 728, 1542, 2917,
    1990, 1542, 139, 1582, 2918, 1991, 520, 138, 1112, 2918, 482, 1990, 2918,
    1150, 2919, 1153, 1991, 2919, 1150, 728, 1989, 2919, 1986, 2920, 1988, 484,
    1544, 2920, 1544, 140, 1584, 2921, 1987, 522, 139, 1114, 2921, 1114, 484,
    1986, 2922, 1155, 160, 1987, 2922, 1152, 727, 1985, 2922, 1982, 2923, 1984,
    486, 1546, 2923, 1546, 141, 1586, 2924, 1983, 524, 140, 1116, 2924, 486,
    1982, 2924, 1154, 2925, 1157, 524, 1983, 2925, 1983, 726, 1981, 2926, 1980,
    725, 1548, 2926, 1978, 142, 1588, 2926, 1586, 2927, 1979, 1118, 2927, 1586,
    488, 1978, 2927, 2928, 1159, 162, 526, 1979, 2928, 725, 1977, 2928, 2929,
    1976, 724, 490, 1550, 2929, 1550, 143, 1590, 2930, 1975, 528, 142, 1120,
    2930, 1120, 490, 1974, 2931, 1161, 163, 1975, 2931, 1158, 724, 1973, 2931,
    2932, 1972, 723, 1552, 2932, 1970, 144, 1592, 2932, 2933, 1971, 530, 1122,
    2933, 1590, 492, 1970, 2933, 2934, 1163, 164, 1971, 2934, 1160, 723, 1969,
    2934, 1966, 2935, 1968, 494, 1554, 2935, 145, 1594, 2935, 2936, 1967, 532,
    1124, 2936, 1592, 494, 1966, 2936, 1162, 2937, 1165, 1967, 2937, 1162, 1967,
    722, 1965, 2938, 1964, 721, 1556, 2938, 1962, 146, 1596, 2938, 2939, 1963,
    534, 1126, 2939, 1594, 496, 1962, 2939, 2940, 1167, 166, 1963, 2940, 1164,
    721, 1961, 2940, 2941, 1960, 720, 1559, 2941, 1958, 148, 1599, 2941, 2942,
    1959, 538, 1129, 2942, 1168, 499, 1958, 2942, 2943, 1170, 168, 1959, 2943,
    1598, 720, 1957, 2943, 2944, 1956, 719, 1561, 2944, 1954, 149, 1601, 2944,
    2945, 1955, 539, 1131, 2945, 1599, 501, 1954, 2945, 2946, 1172, 169, 1955,
    2946, 1169, 719, 1953, 2946, 2947, 1952, 718, 1563, 2947, 1950, 150, 1603,
    2947, 2948, 1951, 541, 1133, 2948, 1601, 503, 1950, 2948, 2949, 1174, 170,
    1951, 2949, 1171, 718, 1949, 2949, 1946, 2950, 1948, 505, 1565, 2950, 1565,
    151, 1605, 2951, 1947, 543, 150, 1135, 2951, 1135, 505, 1946, 2952, 1176,
    171, 1947, 2952, 1173, 1947, 717, 1945, 2953, 1944, 716, 1567, 2953, 1942,
    152, 1607, 2953, 2954, 1943, 545, 1137, 2954, 1605, 507, 1942, 2954, 2955,
    1178, 172, 1943, 2955, 1175, 716, 1941, 2955, 2956, 1940, 715, 1569, 2956,
    1938, 153, 1609, 2956, 2957, 1939, 547, 1139, 2957, 1607, 509, 1938, 2957,
    2958, 1180, 173, 1939, 2958, 1177, 715, 1937, 2958, 2959, 1936, 714, 1571,
    2959, 1934, 154, 1611, 2959, 2960, 1935, 549, 1141, 2960, 1609, 511, 1934,
    2960, 2961, 1182, 174, 1935, 2961, 1179, 714, 1933, 2961, 2962, 1932, 713,
    1573, 2962, 1930, 1573, 155, 1613, 1611, 2963, 1931, 154, 1143, 2963, 513,
    1930, 2963, 1181, 2964, 1184, 551, 1931, 2964, 713, 1929, 2964, 2965, 1928,
    712, 1575, 2965, 1926, 156, 1615, 2965, 2966, 1927, 553, 155, 1145, 2966,
    515, 1926, 2966, 2967, 1186, 176, 1927, 2967, 1183, 712, 1925, 2967, 2968,
    1924, 711, 1577, 2968, 1922, 157, 1617, 2968, 2969, 1923, 555, 1147, 2969,
    1615, 517, 1922, 2969, 2970, 1188, 177, 1923, 2970, 1185, 711, 1921, 2970,
    2971, 1920, 710, 1579, 2971, 1918, 158, 1619, 2971, 2972, 1919, 557, 1149,
    2972, 1617, 519, 1918, 2972, 2973, 1190, 178, 1919, 2973, 1187, 710, 1917,
    2973, 2974, 1916, 709, 1581, 2974, 1914, 1581, 159, 1621, 2975, 1915, 559,
    1151, 2975, 1619, 521, 1914, 2975, 2976, 1192, 179, 1915, 2976, 1189, 709,
    1913, 2976, 2977, 1912, 708, 1583, 2977, 1910, 160, 1623, 2977, 2978, 1911,
    561, 1153, 2978, 1621, 523, 1910, 2978, 2979, 1194, 180, 1911, 2979, 1191,
    708, 1909, 2979, 1906, 2980, 1908, 525, 1585, 2980, 1585, 161, 1625, 2981,
    1907, 563, 1155, 2981, 1623, 525, 1906, 2981, 2982, 1196, 181, 1907, 2982,
    1193, 707, 1905, 2982, 2983, 1904, 706, 1587, 2983, 1902, 162, 1627, 2983,
    2984, 1903, 565, 161, 1157, 2984, 527, 1902, 2984, 2985, 1198, 182, 1903,
    2985, 1195, 706, 1901, 2985, 2986, 1900, 705, 1589, 2986, 1898, 163, 1629,
    2986, 2987, 1899, 567, 1159, 2987, 1627, 529, 1898, 2987, 2988, 1200, 183,
    1899, 2988, 1197, 705, 1897, 2988, 2989, 1896, 704, 1591, 2989, 1894, 164,
    1631, 2989, 2990, 1895, 569, 1161, 2990, 1629, 531, 1894, 2990, 2991, 1202,
    184, 1895, 2991, 1199, 704, 1893, 2991, 2992, 1892, 703, 1593, 2992, 1890,
    165, 1633, 2992, 2993, 1891, 571, 1163, 2993, 1631, 533, 1890, 2993, 2994,
    1204, 185, 1891, 2994, 1201, 703, 1889, 2994, 1886, 2995, 1888, 535, 1595,
    2995, 1595, 166, 1635, 2996, 1887, 573, 165, 1165, 2996, 1165, 535, 1886,
    2997, 1206, 186, 1887, 2997, 1203, 1887, 702, 1885, 2998, 1884, 701, 1597,
    2998, 1882, 167, 1637, 2998, 2999, 1883, 575, 1167, 2999, 1635, 537, 1882,
    2999, 3000, 1208, 187, 1883, 3000, 1205, 701, 1881, 3000, 3001, 1880, 700,
    1600, 3001, 1878, 169, 1640, 3001, 3002, 1879, 579, 1170, 3002, 1209, 540,
    1878, 3002, 3003, 1211, 189, 1879, 3003, 1639, 700, 1877, 3003, 3004, 1876,
    699, 1602, 3004, 1874, 170, 1642, 3004, 3005, 1875, 580, 1172, 3005, 1640,
    542, 1874, 3005, 3006, 1213, 190, 1875, 3006, 1210, 699, 1873, 3006, 3007,
    1872, 698, 1604, 3007, 1870, 171, 1644, 3007, 3008, 1871, 582, 1174, 3008,
    1642, 544, 1870, 3008, 3009, 1215, 191, 1871, 3009, 1212, 698, 1869, 3009,
    1866, 3010, 1868, 546, 1606, 3010, 172, 1646, 3010, 3011, 1867, 584, 1176,
    3011, 1644, 1176, 546, 1866, 3012, 1217, 192, 1867, 3012, 1214, 1867, 697,
    1865, 3013, 1864, 696, 1608, 3013, 1862, 173, 1648, 3013, 3014, 1863, 586,
    1178, 3014, 1646, 548, 1862, 3014, 3015, 1219, 193, 1863, 3015, 1216, 696,
    1861, 3015, 3016, 1860, 695, 1610, 3016, 1858, 174, 1650, 3016, 3017, 1859,
    588, 1180, 3017, 1648, 550, 1858, 3017, 3018, 1221, 194, 1859, 3018, 1218,
    695, 1857, 3018, 3019, 1856, 694, 1612, 3019, 1854, 175, 1652, 3019, 3020,
    1855, 590, 1182, 3020, 1650, 552, 1854, 3020, 3021, 1223, 195, 1855, 3021,
    1220, 694, 1853, 3021, 3022, 1852, 693, 1614, 3022, 1850, 176, 1654, 3022,
    1652, 3023, 1851, 175, 1184, 3023, 554, 1850, 3023, 1222, 3024, 1225, 592,
    1851, 3024, 693, 1849, 3024, 3025, 1848, 692, 1616, 3025, 1846, 177, 1656,
    3025, 3026, 1847, 594, 1186, 3026, 1654, 556, 1846, 3026, 3027, 1227, 197,
    1847, 3027, 1224, 692, 1845, 3027, 3028, 1844, 691, 1618, 3028, 1842, 178,
    1658, 3028, 3029, 1843, 596, 1188, 3029, 1656, 558, 1842, 3029, 3030, 1229,
    198, 1843, 3030, 1226, 691, 1841, 3030, 3031, 1840, 690, 1620, 3031, 1838,
    179, 1660, 3031, 3032, 1839, 598, 1190, 3032, 1658, 560, 1838, 3032, 3033,
    1231, 199, 1839, 3033, 1228, 690, 1837, 3033, 3034, 1836, 689, 1622, 3034,
    1834, 180, 1662, 3034, 3035, 1835, 600, 1192, 3035, 1660, 562, 1834, 3035,
    3036, 1233, 200, 1835, 3036, 1230, 689, 1833, 3036, 3037, 1832, 688, 1624,
    3037, 1830, 181, 1664, 3037, 3038, 1831, 602, 1194, 3038, 1662, 564, 1830,
    3038, 3039, 1235, 201, 1831, 3039, 1232, 688, 1829, 3039, 3040, 1828, 687,
    1626, 3040, 1826, 1626, 182, 1666, 3041, 1827, 604, 1196, 3041, 1664, 566,
    1826, 3041, 3042, 1237, 202, 1827, 3042, 1234, 687, 1825, 3042, 3043, 1824,
    686, 1628, 3043, 1822, 183, 1668, 3043, 3044, 1823, 606, 1198, 3044, 1666,
    568, 1822, 3044, 3045, 1239, 203, 1823, 3045, 1236, 686, 1821, 3045, 3046,
    1820, 685, 1630, 3046, 1818, 184, 1670, 3046, 3047, 1819, 608, 1200, 3047,
    1668, 570, 1818, 3047, 3048, 1241, 204, 1819, 3048, 1238, 685, 1817, 3048,
    3049, 1816, 684, 1632, 3049, 1814, 185, 1672, 3049, 3050, 1815, 610, 1202,
    3050, 1670, 572, 1814, 3050, 3051, 1243, 205, 1815, 3051, 1240, 684, 1813,
    3051, 3052, 1812, 683, 1634, 3052, 1810, 186, 1674, 3052, 3053, 1811, 612,
    1204, 3053, 1672, 574, 1810, 3053, 3054, 1245, 206, 1811, 3054, 1242, 683,
    1809, 3054, 3055, 1808, 682, 1636, 3055, 1806, 187, 1676, 3055, 3056, 1807,
    614, 1206, 3056, 1674, 576, 1806, 3056, 3057, 1247, 207, 1807, 3057, 1244,
    682, 1805, 3057, 3058, 1804, 681, 1638, 3058, 1802, 188, 1678, 3058, 3059,
    1803, 616, 1208, 3059, 1676, 578, 1802, 3059, 3060, 1249, 208, 1803, 3060,
    1246, 681, 1801, 3060, 3061, 1800, 680, 1641, 3061, 1798, 190, 1681, 3061,
    3062, 1799, 620, 1211, 3062, 1250, 581, 1798, 3062, 3063, 1252, 210, 1799,
    3063, 1680, 680, 1797, 3063, 3064, 1796, 679, 1643, 3064, 1794, 191, 1683,
    3064, 3065, 1795, 621, 1213, 3065, 1681, 583, 1794, 3065, 1251, 3066, 1254,
    621, 1795, 3066, 679, 1793, 3066, 3067, 1792, 678, 1645, 3067, 1790, 192,
    1685, 3067, 3068, 1791, 623, 1215, 3068, 1683, 585, 1790, 3068, 3069, 1256,
    212, 1791, 3069, 1253, 678, 1789, 3069, 1786, 3070, 1788, 587, 1647, 3070,
    193, 1687, 3070, 1685, 3071, 1787, 192, 1217, 3071, 1217, 587, 1786, 1255,
    3072, 1258, 625, 1787, 3072, 1787, 677, 1785, 3073, 1784, 676, 1649, 3073,
    1782, 194, 1689, 3073, 3074, 1783, 627, 1219, 3074, 1687, 589, 1782, 3074,
    3075, 1260, 214, 1783, 3075, 1257, 676, 1781, 3075, 3076, 1780, 675, 1651,
    3076, 1778, 195, 1691, 3076, 3077, 1779, 629, 1221, 3077, 1689, 591, 1778,
    3077, 3078, 1262, 215, 1779, 3078, 1259, 675, 1777, 3078, 3079, 1776, 674,
    1653, 3079, 1774, 1653, 196, 1693, 3080, 1775, 631, 1223, 3080, 1691, 593,
    1774, 3080, 3081, 1264, 216, 1775, 3081, 1261, 674, 1773, 3081, 3082, 1772,
    673, 1655, 3082, 1770, 197, 1695, 3082, 1693, 3083, 1771, 196, 1225, 3083,
    595, 1770, 3083, 3084, 1266, 217, 1771, 3084, 1263, 673, 1769, 3084, 3085,
    1768, 672, 1657, 3085, 1766, 198, 1697, 3085, 3086, 1767, 635, 1227, 3086,
    1695, 597, 1766, 3086, 3087, 1268, 218, 1767, 3087, 1265, 672, 1765, 3087,
    1762, 3088, 1764, 1659, 3088, 1762, 199, 1699, 3088, 3089, 1763, 637, 1229,
    3089, 1697, 1229, 599, 1762, 3090, 1270, 219, 1763, 3090, 1267, 671, 1761,
    3090, 3091, 1760, 670, 601, 1661, 3091, 200, 1701, 3091, 1699, 3092, 1759,
    1231, 3092, 1699, 601, 1758, 3092, 1269, 3093, 1272, 639, 1759, 3093, 1759,
    670, 1757, 3094, 1756, 669, 1663, 3094, 1754, 201, 1703, 3094, 3095, 1755,
    641, 1233, 3095, 1701, 603, 1754, 3095, 3096, 1274, 221, 1755, 3096, 1271,
    669, 1753, 3096, 3097, 1752, 668, 1665, 3097, 1750, 202, 1705, 3097, 3098,
    1751, 643, 1235, 3098, 1703, 605, 1750, 3098, 3099, 1276, 222, 1751, 3099,
    1273, 668, 1749, 3099, 1746, 3100, 1748, 1667, 3100, 1746, 1667, 203, 1707,
    3101, 1747, 645, 1237, 3101, 1705, 607, 1746, 3101, 3102, 1278, 223, 1747,
    3102, 1275, 667, 1745, 3102, 3103, 1744, 666, 1669, 3103, 1742, 204, 1709,
    3103, 3104, 1743, 647, 1239, 3104, 1707, 609, 1742, 3104, 3105, 1280, 224,
    1743, 3105, 1277, 666, 1741, 3105, 3106, 1740, 665, 1671, 3106, 1738, 1671,
    205, 1711, 3107, 1739, 649, 1241, 3107, 1709, 611, 1738, 3107, 3108, 1282,
    225, 1739, 3108, 1279, 665, 1737, 3108, 3109, 1736, 664, 1673, 3109, 1734,
    206, 1713, 3109, 1711, 3110, 1735, 205, 1243, 3110, 613, 1734, 3110, 3111,
    1284, 226, 1735, 3111, 1281, 664, 1733, 3111, 3112, 1732, 663, 1675, 3112,
    1730, 1675, 207, 1715, 3113, 1731, 653, 1245, 3113, 1713, 615, 1730, 3113,
    3114, 1286, 227, 1731, 3114, 1283, 663, 1729, 3114, 3115, 1728, 662, 617,
    1677, 3115, 1677, 208, 1717, 3116, 1727, 655, 207, 1247, 3116, 1247, 617,
    1726, 3117, 1288, 228, 1727, 3117, 1285, 662, 1725, 3117, 3118, 1724, 661,
    1679, 3118, 1722, 209, 1719, 3118, 1717, 3119, 1723, 208, 1249, 3119, 619,
    1722, 3119, 3120, 1290, 229, 1723, 3120, 1287, 661, 1721, 3120, 3121, 1720,
    660, 1724, 3121, 1721, 659, 1289, 3121, 3122, 1718, 658, 1728, 3122, 1725,
    657, 1287, 3122, 3123, 1716, 656, 1732, 3123, 1729, 655, 1285, 3123, 3124,
    1714, 654, 1736, 3124, 1733, 653, 1283, 3124, 3125, 1712, 652, 1740, 3125,
    1737, 651, 1281, 3125, 3126, 1710, 650, 1744, 3126, 1741, 649, 1279, 3126,
    1745, 3127, 1708, 667, 1748, 3127, 1748, 647, 1277, 3128, 1706, 646, 1752,
    3128, 1749, 645, 1275, 3128, 3129, 1704, 644, 1756, 3129, 1753, 643, 1273,
    3129, 1757, 3130, 1702, 670, 1760, 3130, 641, 1271, 3130, 1761, 3131, 1700,
    671, 1764, 3131, 639, 1269, 3131, 3132, 1698, 638, 1768, 3132, 1765, 637,
    1267, 3132, 3133, 1696, 636, 1772, 3133, 1769, 635, 1265, 3133, 3134, 1694,
    634, 1776, 3134, 1773, 1776, 633, 1263, 3135, 1692, 632, 1780, 3135, 1777,
    631, 1261, 3135, 3136, 1690, 630, 1784, 3136, 1781, 629, 1259, 3136, 1785,
    3137, 1688, 677, 1788, 3137, 1788, 627, 1257, 3138, 1686, 626, 1792, 3138,
    1789, 625, 1255, 3138, 3139, 1684, 624, 1796, 3139, 1793, 623, 1253, 3139,
    3140, 1682, 622, 1800, 3140, 1797, 621, 1251, 3140, 3141, 1679, 619, 1804,
    3141, 1801, 618, 1248, 3141, 3142, 1677, 617, 1808, 3142, 1805, 616, 1246,
    3142, 3143, 1675, 615, 1812, 3143, 1809, 614, 1244, 3143, 3144, 1673, 613,
    1816, 3144, 1813, 612, 1242, 3144, 3145, 1671, 611, 1820, 3145, 1817, 610,
    1240, 3145, 3146, 1669, 609, 1824, 3146, 1821, 608, 1238, 3146, 3147, 1667,
    607, 1828, 3147, 1825, 606, 1236, 3147, 3148, 1665, 605, 1832, 3148, 1829,
    604, 1234, 3148, 3149, 1663, 603, 1836, 3149, 1833, 602, 1232, 3149, 3150,
    1661, 601, 1840, 3150, 1837, 600, 1230, 3150, 3151, 1659, 599, 1844, 3151,
    1841, 598, 1228, 3151, 3152, 1657, 597, 1848, 3152, 1845, 596, 1226, 3152,
    3153, 1655, 595, 1852, 3153, 1849, 594, 1224, 3153, 3154, 1653, 593, 1856,
    3154, 1853, 592, 1222, 3154, 3155, 1651, 591, 1860, 3155, 1857, 590, 1220,
    3155, 3156, 1649, 589, 1864, 3156, 1861, 588, 1218, 3156, 1865, 3157, 1647,
    697, 1868, 3157, 586, 1216, 3157, 3158, 1645, 585, 1872, 3158, 1869, 584,
    1214, 3158, 3159, 1643, 583, 1876, 3159, 1873, 582, 1212, 3159, 3160, 1641,
    581, 1880, 3160, 1877, 580, 1210, 3160, 3161, 1638, 578, 1884, 3161, 1881,
    577, 1207, 3161, 1885, 3162, 1636, 702, 1888, 3162, 575, 1205, 3162, 3163,
    1634, 574, 1892, 3163, 1889, 573, 1203, 3163, 3164, 1632, 572, 1896, 3164,
    1893, 571, 1201, 3164, 3165, 1630, 570, 1900, 3165, 1897, 569, 1199, 3165,
    3166, 1628, 568, 1904, 3166, 1901, 567, 1197, 3166, 3167, 1626, 566, 707,
    1908, 3167, 1908, 565, 1195, 3168, 1624, 564, 1912, 3168, 1909, 563, 1193,
    3168, 3169, 1622, 562, 1916, 3169, 1913, 561, 1191, 3169, 3170, 1620, 560,
    1920, 3170, 1917, 559, 1189, 3170, 3171, 1618, 558, 1924, 3171, 1921, 557,
    1187, 3171, 3172, 1616, 556, 1928, 3172, 1925, 555, 1185, 3172, 3173, 1614,
    554, 1932, 3173, 1929, 553, 1183, 3173, 3174, 1612, 552, 1936, 3174, 1933,
    551, 1181, 3174, 3175, 1610, 550, 1940, 3175, 1937, 549, 1179, 3175, 3176,
    1608, 548, 1944, 3176, 1941, 547, 1177, 3176, 1945, 3177, 1606, 717, 1948,
    3177, 545, 1175, 3177, 3178, 1604, 544, 1952, 3178, 1949, 543, 1173, 3178,
    3179, 1602, 542, 1956, 3179, 1953, 541, 1171, 3179, 3180, 1600, 540, 1960,
    3180, 1957, 539, 1169, 3180, 3181, 1597, 537, 1964, 3181, 1961, 536, 1166,
    3181, 1965, 3182, 1595, 722, 1968, 3182, 1968, 534, 1164, 3183, 1593, 533,
    1972, 3183, 1969, 532, 1162, 3183, 3184, 1591, 531, 1976, 3184, 1973, 530,
    1160, 3184, 3185, 1589, 529, 1980, 3185, 1977, 528, 1158, 3185, 1981, 3186,
    1587, 726, 1984, 3186, 1984, 526, 1156, 3187, 1585, 525, 727, 1988, 3187,
    524, 1154, 3187, 1989, 3188, 1583, 1992, 3188, 1989, 522, 1152, 3188, 3189,
    1581, 521, 1996, 3189, 1993, 1996, 520, 1150, 3190, 1579, 519, 2000, 3190,
    1997, 518, 1148, 3190, 3191, 1577, 517, 2004, 3191, 2001, 516, 1146, 3191,
    3192, 1575, 515, 2008, 3192, 2005, 514, 1144, 3192, 3193, 1573, 513, 2012,
    3193, 2009, 2012, 512, 1142, 3194, 1571, 511, 2016, 3194, 2013, 510, 1140,
    3194, 3195, 1569, 509, 2020, 3195, 2017, 508, 1138, 3195, 3196, 1567, 507,
    2024, 3196, 2021, 506, 1136, 3196, 2025, 3197, 1565, 737, 2028, 3197, 504,
    1134, 3197, 3198, 1563, 503, 738, 2032, 3198, 502, 1132, 3198, 3199, 1561,
    501, 2036, 3199, 2033, 500, 1130, 3199, 3200, 1559, 499, 2040, 3200, 2037,
    498, 1128, 3200, 3201, 1556, 496, 2044, 3201, 2041, 495, 1125, 3201, 3202,
    1554, 494, 2048, 3202, 2045, 493, 1123, 3202, 3203, 1552, 492, 743, 2052,
    3203, 2052, 491, 1121, 2053, 3204, 1550, 744, 2056, 3204, 489, 1119, 3204,
    3205, 1548, 488, 2060, 3205, 2057, 487, 1117, 3205, 3206, 1546, 486, 2064,
    3206, 2061, 485, 1115, 3206, 2065, 3207, 1544, 747, 2068, 3207, 483, 1113,
    3207, 3208, 1542, 482, 2072, 3208, 2069, 481, 1111, 3208, 3209, 1540, 480,
    2076, 3209, 2073, 2076, 479, 1109, 3210, 1538, 478, 2080, 3210, 2077, 2080,
    477, 1107, 3211, 1536, 476, 2084, 3211, 2081, 475, 1105, 3211, 3212, 1534,
    474, 2088, 3212, 2085, 473, 1103, 3212, 3213, 1532, 472, 2092, 3213, 2089,
    471, 1101, 3213, 2093, 3214, 1530, 754, 2096, 3214, 469, 1099, 3214, 3215,
    1528, 468, 2100, 3215, 2097, 467, 1097, 3215, 2101, 3216, 1526, 756, 2104,
    3216, 465, 1095, 3216, 3217, 1524, 464, 2108, 3217, 2105, 463, 1093, 3217,
    2109, 3218, 1522, 758, 2112, 3218, 2112, 461, 1091, 3219, 1520, 460, 2116,
    3219, 2113, 459, 1089, 3219, 3220, 1518, 458, 2120, 3220, 2117, 457, 1087,
    3220, 3221, 1515, 455, 761, 2124, 3221, 2124, 454, 1084, 2125, 3222, 1513,
    2128, 3222, 2125, 452, 1082, 3222, 2129, 3223, 1511, 763, 2132, 3223, 2132,
    450, 1080, 3224, 1509, 449, 764, 2136, 3224, 2136, 448, 1078, 3225, 1507,
    447, 2140, 3225, 2137, 446, 1076, 3225, 3226, 1505, 445, 2144, 3226, 2141,
    444, 1074, 3226, 2145, 3227, 1503, 767, 2148, 3227, 442, 1072, 3227, 3228,
    1501, 441, 2152, 3228, 2149, 440, 1070, 3228, 2153, 3229, 1499, 769, 2156,
    3229, 2156, 438, 1068, 3230, 1497, 437, 2160, 3230, 2157, 2160, 436, 1066,
    2161, 3231, 1495, 771, 2164, 3231, 434, 1064, 3231, 2165, 3232, 1493, 2168,
    3232, 2165, 432, 1062, 3232, 3233, 1491, 431, 2172, 3233, 2169, 430, 1060,
    3233, 3234, 1489, 429, 774, 2176, 3234, 428, 1058, 3234, 3235, 1487, 427,
    2180, 3235, 2177, 2180, 426, 1056, 3236, 1485, 425, 2184, 3236, 2181, 424,
    1054, 3236, 2185, 3237, 1483, 777, 2188, 3237, 2188, 422, 1052, 3238, 1481,
    421, 2192, 3238, 2189, 420, 1050, 3238, 3239, 1479, 419, 2196, 3239, 2193,
    418, 1048, 3239, 3240, 1477, 417, 780, 2200, 3240, 2200, 416, 1046, 3241,
    1474, 414, 2204, 3241, 2201, 413, 1043, 3241, 3242, 1472, 412, 2208, 3242,
    2205, 411, 1041, 3242, 3243, 1470, 410, 2212, 3243, 2209, 409, 1039, 3243,
    3244, 1468, 408, 2216, 3244, 2213, 407, 1037, 3244, 2217, 3245, 1466, 785,
    2220, 3245, 405, 1035, 3245, 3246, 1464, 404, 2224, 3246, 2221, 403, 1033,
    3246, 3247, 1462, 402, 2228, 3247, 2225, 401, 1031, 3247, 3248, 1460, 400,
    2232, 3248, 2229, 399, 1029, 3248, 3249, 1458, 398, 2236, 3249, 2233, 397,
    1027, 3249, 3250, 1456, 396, 2240, 3250, 2237, 2240, 395, 1025, 3251, 1454,
    394, 2244, 3251, 2241, 393, 1023, 3251, 3252, 1452, 392, 2248, 3252, 2245,
    391, 1021, 3252, 3253, 1450, 390, 2252, 3253, 2249, 389, 1019, 3253, 3254,
    1448, 388, 2256, 3254, 2253, 387, 1017, 3254, 2257, 3255, 1446, 795, 2260,
    3255, 2260, 385, 1015, 3256, 1444, 384, 2264, 3256, 2261, 383, 1013, 3256,
    3257, 1442, 382, 2268, 3257, 2265, 381, 1011, 3257, 3258, 1440, 380, 2272,
    3258, 2269, 2272, 379, 1009, 3259, 1438, 378, 2276, 3259, 2273, 377, 1007,
    3259, 3260, 1436, 376, 2280, 3260, 2277, 375, 1005, 3260, 3261, 1433, 373,
    2284, 3261, 2281, 372, 1002, 3261, 3262, 1431, 371, 2288, 3262, 2285, 370,
    1000, 3262, 3263, 1429, 369, 2292, 3263, 2289, 368, 998, 3263, 3264, 1427,
    367, 2296, 3264, 2293, 366, 996, 3264, 3265, 1425, 365, 2300, 3265, 2297,
    364, 994, 3265, 3266, 1423, 363, 2304, 3266, 2301, 362, 992, 3266, 3267,
    1421, 361, 2308, 3267, 2305, 2308, 360, 990, 3268, 1419, 359, 2312, 3268,
    2309, 358, 988, 3268, 3269, 1417, 357, 2316, 3269, 2313, 356, 986, 3269,
    3270, 1415, 355, 2320, 3270, 2317, 354, 984, 3270, 3271, 1413, 353, 2324,
    3271, 2321, 352, 982, 3271, 3272, 1411, 351, 2328, 3272, 2325, 350, 980,
    3272, 3273, 1409, 349, 2332, 3273, 2329, 348, 978, 3273, 3274, 1407, 347,
    2336, 3274, 2333, 346, 976, 3274, 3275, 1405, 345, 2340, 3275, 2337, 344,
    974, 3275, 3276, 1403, 343, 2344, 3276, 2341, 342, 972, 3276, 3277, 1401,
    341, 2348, 3277, 2345, 340, 970, 3277, 2349, 3278, 1399, 2352, 3278, 2349,
    338, 968, 3278, 3279, 1397, 337, 2356, 3279, 2353, 336, 966, 3279, 3280,
    1395, 335, 2360, 3280, 2357, 334, 964, 3280, 3281, 1392, 332, 2364, 3281,
    2361, 331, 961, 3281, 3282, 1390, 330, 2368, 3282, 2365, 329, 959, 3282,
    3283, 1388, 328, 2372, 3283, 2369, 327, 957, 3283, 3284, 1386, 326, 2376,
    3284, 2373, 325, 955, 3284, 3285, 1384, 324, 2380, 3285, 2377, 323, 953,
    3285, 3286, 1382, 322, 2384, 3286, 2381, 321, 951, 3286, 3287, 1380, 320,
    2388, 3287, 2385, 2388, 319, 949, 3288, 1378, 318, 2392, 3288, 2389, 317,
    947, 3288, 3289, 1376, 316, 2396, 3289, 2393, 315, 945, 3289, 3290, 1374,
    314, 2400, 3290, 2397, 313, 943, 3290, 3291, 1372, 312, 2404, 3291, 2401,
    311, 941, 3291, 3292, 1370, 310, 2408, 3292, 2405, 309, 939, 3292, 3293,
    1368, 308, 2412, 3293, 2409, 307, 937, 3293, 2413, 3294, 1366, 834, 2416,
    3294, 305, 935, 3294, 3295, 1364, 304, 2420, 3295, 2417, 303, 933, 3295,
    3296, 1362, 302, 2424, 3296, 2421, 301, 931, 3296, 3297, 1360, 300, 2428,
    3297, 2425, 299, 929, 3297, 3298, 1358, 298, 2432, 3298, 2429, 297, 927,
    3298, 3299, 1356, 296, 2436, 3299, 2433, 295, 925, 3299, 3300, 1354, 294,
    2440, 3300, 2437, 293, 923, 3300, 3301, 1351, 291, 2444, 3301, 2441, 290,
    920, 3301, 3302, 1348, 288, 2448, 3302, 2445, 287, 917, 3302, 3303, 1345,
    285, 2452, 3303, 2449, 284, 914, 3303, 2453, 3304, 1342, 844, 2456, 3304,
    281, 911, 3304, 3305, 1339, 279, 2460, 3305, 2457, 278, 908, 3305, 3306,
    1336, 276, 2464, 3306, 2461, 275, 905, 3306, 3307, 1333, 273, 2468, 3307,
    2465, 272, 902, 3307, 3308, 1330, 270, 2472, 3308, 2469, 2472, 269, 899,
    3309, 1327, 267, 2476, 3309, 2473, 266, 896, 3309, 2477, 3310, 1324, 850,
    2480, 3310, 263, 893, 3310, 2481, 3311, 1321, 851, 2484, 3311, 2484, 260,
    890, 2485, 3312, 1318, 2488, 3312, 2485, 257, 887, 3312, 2489, 3313, 1315,
    853, 2492, 3313, 2492, 254, 884, 2493, 3314, 1312, 2496, 3314, 2493, 2496,
    251, 881, 3315, 1309, 249, 2500, 3315, 2497, 248, 878, 3315, 2501, 3316,
    1306, 2504, 3316, 2501, 245, 875, 3316, 3317, 1303, 243, 2508, 3317, 2505,
    2508, 242, 872, 3318, 1300, 240, 2512, 3318, 2509, 239, 869, 3318, 2513,
    3319, 1297, 2516, 3319, 2513, 236, 866, 3319, 2517, 3320, 1294, 2520, 3320,
    2517, 2520, 233, 863,
  ],
};

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

main();
