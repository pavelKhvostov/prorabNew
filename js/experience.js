// Скролл-полёт в духе atmos.leeroy.ca: камера летит по сплайну сквозь облака,
// небо меняет палитру по ходу маршрута, главы-тексты проявляются по прогрессу.
import * as THREE from 'three';

const canvas = document.getElementById('scene');
const loader = document.getElementById('loader');
const journey = document.querySelector('.journey');
const hint = document.getElementById('hint');
const chapters = [...document.querySelectorAll('.chapter')].map((el) => ({
  el,
  start: +el.dataset.start,
  end: +el.dataset.end,
}));

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clouds = [];

function fail() {
  document.body.classList.add('no-webgl');
  loader.classList.add('done');
}

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
} catch (e) {
  fail();
}

if (renderer) init();

function init() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 600);

  // ---- Палитра неба: рассвет → день → золотой час → сумерки → ночь (фон сайта)
  const palettes = [
    { top: '#43568c', bottom: '#f0b7a4', light: '#ffd9c4' },
    { top: '#3f7cc4', bottom: '#cde7f2', light: '#ffffff' },
    { top: '#5b4f96', bottom: '#f5b87a', light: '#ffe2b8' },
    { top: '#241f4d', bottom: '#9a5e8e', light: '#d9a8c8' },
    { top: '#0c0b12', bottom: '#241d2e', light: '#6a5a78' },
  ].map((p) => ({
    top: new THREE.Color(p.top),
    bottom: new THREE.Color(p.bottom),
    light: new THREE.Color(p.light),
  }));

  const cTop = new THREE.Color();
  const cBottom = new THREE.Color();
  const cLight = new THREE.Color();

  function paletteAt(p) {
    const x = Math.min(Math.max(p, 0), 1) * (palettes.length - 1);
    const i = Math.min(Math.floor(x), palettes.length - 2);
    const f = x - i;
    cTop.lerpColors(palettes[i].top, palettes[i + 1].top, f);
    cBottom.lerpColors(palettes[i].bottom, palettes[i + 1].bottom, f);
    cLight.lerpColors(palettes[i].light, palettes[i + 1].light, f);
  }

  // ---- Небо: сфера внутрь с градиентным шейдером и лёгким шумом
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTop: { value: new THREE.Color() },
      uBottom: { value: new THREE.Color() },
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uTop;
      uniform vec3 uBottom;
      uniform float uTime;
      varying vec3 vDir;
      void main() {
        float n = sin(vDir.x * 5.0 + uTime * 0.12) * sin(vDir.y * 7.0 - uTime * 0.09) * 0.04;
        float h = smoothstep(-0.18, 0.55, vDir.y + n);
        gl_FragColor = vec4(mix(uBottom, uTop, h), 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(420, 24, 16), skyMat);
  scene.add(sky);

  scene.fog = new THREE.Fog(0xffffff, 30, 220);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x666666, 1.1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(20, 40, -10);
  scene.add(sun);

  // ---- Маршрут: каждый визит генерируется заново, как в Atmos
  const seed = Math.random() * 100;
  const pathPoints = [];
  const SEGMENTS = 15;
  for (let i = 0; i <= SEGMENTS; i++) {
    pathPoints.push(new THREE.Vector3(
      Math.sin(i * 0.55 + seed) * 24 * (i < 2 ? 0.25 : 1),
      6 + Math.sin(i * 0.34 + seed * 2.1) * 5,
      -i * 44
    ));
  }
  const curve = new THREE.CatmullRomCurve3(pathPoints);

  // ---- Облака: кластеры из приплюснутых икосаэдров вдоль маршрута
  const cloudGeo = new THREE.IcosahedronGeometry(1, 0);
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
  const clusterCount = innerWidth < 768 ? 24 : 42;
  const tmp = new THREE.Vector3();

  for (let c = 0; c < clusterCount; c++) {
    const group = new THREE.Group();
    const t = c / clusterCount + Math.random() * 0.02;
    curve.getPointAt(Math.min(t, 1), tmp);

    const side = Math.random() > 0.5 ? 1 : -1;
    group.position.set(
      tmp.x + side * (10 + Math.random() * 42),
      tmp.y + (Math.random() - 0.5) * 26,
      tmp.z - Math.random() * 20
    );

    const puffs = 4 + Math.floor(Math.random() * 4);
    for (let p = 0; p < puffs; p++) {
      const puff = new THREE.Mesh(cloudGeo, cloudMat);
      puff.position.set(
        (Math.random() - 0.5) * 9,
        (Math.random() - 0.5) * 2.5,
        (Math.random() - 0.5) * 5
      );
      puff.scale.set(
        2 + Math.random() * 3.5,
        0.8 + Math.random() * 1.2,
        1.5 + Math.random() * 2.5
      );
      puff.rotation.y = Math.random() * Math.PI;
      group.add(puff);
    }
    group.userData.drift = 0.2 + Math.random() * 0.5;
    group.userData.baseX = group.position.x;
    scene.add(group);
    clouds.push(group);
  }

  // ---- Бумажный самолётик
  const plane = buildPaperPlane();
  scene.add(plane);

  function buildPaperPlane() {
    const g = new THREE.BufferGeometry();
    // нос, хвост-левый, хвост-правый, киль, киль-низ
    const v = new Float32Array([
      // левое крыло
      0, 0, -2.2,   -1.5, 0.1, 1.3,   0, -0.12, 1.0,
      // правое крыло
      0, 0, -2.2,    0, -0.12, 1.0,   1.5, 0.1, 1.3,
      // киль
      0, 0, -2.2,    0, 0.65, 1.4,    0, -0.12, 1.0,
    ]);
    g.setAttribute('position', new THREE.BufferAttribute(v, 3));
    g.computeVertexNormals();
    const m = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      flatShading: true,
      roughness: 0.6,
    });
    const mesh = new THREE.Mesh(g, m);
    mesh.scale.setScalar(0.85);
    return mesh;
  }

  // ---- Прогресс скролла с инерцией
  let target = 0;
  let progress = 0;
  let pastJourney = 0;

  function readScroll() {
    const max = journey.offsetHeight - innerHeight;
    target = Math.min(Math.max(scrollY / max, 0), 1);
    pastJourney = Math.min(Math.max((scrollY - max) / (innerHeight * 0.7), 0), 1);
  }
  addEventListener('scroll', readScroll, { passive: true });
  readScroll();

  const camPos = new THREE.Vector3();
  const lookPos = new THREE.Vector3();
  const planePos = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const tangent2 = new THREE.Vector3();
  const clock = new THREE.Clock();
  let smoothRoll = 0;

  function frame() {
    requestAnimationFrame(frame);

    // за пределами полёта канвас погашен — не рендерим зря
    canvas.style.opacity = 1 - pastJourney;
    if (pastJourney >= 1) return;

    const dt = Math.min(clock.getDelta(), 0.05);
    const time = clock.elapsedTime;

    progress = reduceMotion ? target : progress + (target - progress) * Math.min(dt * 4, 1);
    const t = Math.min(progress, 0.999);

    // камера на сплайне, взгляд вперёд по маршруту
    curve.getPointAt(t, camPos);
    curve.getPointAt(Math.min(t + 0.022, 1), lookPos);
    camera.position.set(camPos.x, camPos.y + 0.6, camPos.z);
    camera.lookAt(lookPos);

    // самолётик впереди камеры, крен по кривизне маршрута
    const tp = Math.min(t + 0.038, 1);
    curve.getPointAt(tp, planePos);
    curve.getTangentAt(tp, tangent);
    curve.getTangentAt(Math.min(tp + 0.012, 1), tangent2);
    planePos.y += Math.sin(time * 1.8) * 0.18;
    plane.position.copy(planePos);
    plane.lookAt(planePos.x + tangent.x, planePos.y + tangent.y, planePos.z + tangent.z);
    const roll = THREE.MathUtils.clamp((tangent2.x - tangent.x) * 60, -0.8, 0.8);
    smoothRoll += (roll - smoothRoll) * Math.min(dt * 5, 1);
    plane.rotateZ(-smoothRoll);

    // палитра неба, туман и свет следуют прогрессу
    paletteAt(progress);
    skyMat.uniforms.uTop.value.copy(cTop);
    skyMat.uniforms.uBottom.value.copy(cBottom);
    skyMat.uniforms.uTime.value = time;
    sky.position.copy(camera.position);
    scene.fog.color.copy(cBottom);
    hemi.color.copy(cLight);
    hemi.groundColor.copy(cBottom).multiplyScalar(0.55);

    // лёгкий дрейф облаков
    for (const cl of clouds) {
      cl.position.x = cl.userData.baseX + Math.sin(time * 0.2 * cl.userData.drift + cl.userData.baseX) * 1.5;
    }

    updateChapters();
    hint.style.opacity = progress < 0.015 ? 1 : 0;

    renderer.render(scene, camera);
  }

  function updateChapters() {
    for (const ch of chapters) {
      const span = ch.end - ch.start;
      const local = (progress - ch.start) / span;
      let o = 0;
      if (local > 0 && local < 1) {
        o = Math.min(local / 0.18, 1) * Math.min((1 - local) / 0.18, 1);
        o = Math.min(o, 1);
      }
      ch.el.style.opacity = o;
      ch.el.style.transform = `translateY(${(1 - o) * (local > 0.5 ? -34 : 34)}px)`;
      ch.el.style.visibility = o > 0.01 ? 'visible' : 'hidden';
    }
  }

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    readScroll();
  });

  // первый кадр отрисован — убираем лоадер (минимум 500 мс, чтобы не мигал)
  const shownAt = performance.now();
  renderer.render(scene, camera);
  setTimeout(() => loader.classList.add('done'), Math.max(0, 500 - (performance.now() - shownAt)));

  frame();
}
