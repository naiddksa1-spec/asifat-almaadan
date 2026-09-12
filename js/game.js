/**
 * عاصفة المعدن — Premium browser dogfight demo
 * Three.js · Hangar · Canyon · AI · Arabic HUD
 */
(function () {
  'use strict';

  const ARABIC_DIGITS = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
  function arNum(n, digits) {
    const s = (digits != null ? Number(n).toFixed(digits) : String(Math.round(n)))
      .replace(/-/g, '−');
    return s.replace(/[0-9]/g, d => ARABIC_DIGITS[+d]);
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(a, b) { return a + Math.random() * (b - a); }

  const JETS = [
    {
      id: 'f15', name: 'إف-١٥ إيغل', role: 'تفوق جوي · متعدد المهام', tier: 'V',
      trophies: 1150, color: 0x8a9bb0, accent: 0x2a3544,
      hp: 340, topSpeed: 1450, accel: 45, turn: 34, ideal: 846, abFuel: 15,
      missiles: 2, flares: 4, damage: 22, missileDmg: 170, style: 'eagle'
    },
    {
      id: 'f22', name: 'إف-٢٢ رابتور', role: 'تخفي · سيطرة جوية', tier: 'V',
      trophies: 1280, color: 0x6e7f92, accent: 0x1c2430,
      hp: 320, topSpeed: 1500, accel: 48, turn: 38, ideal: 820, abFuel: 14,
      missiles: 2, flares: 4, damage: 20, missileDmg: 185, style: 'raptor'
    },
    {
      id: 'su57', name: 'سو-٥٧ فيلون', role: 'جيل خامس · رشاقة عالية', tier: 'V',
      trophies: 1220, color: 0x5a6b55, accent: 0x2c3828,
      hp: 330, topSpeed: 1480, accel: 47, turn: 40, ideal: 800, abFuel: 13.5,
      missiles: 2, flares: 5, damage: 21, missileDmg: 175, style: 'felon'
    },
    {
      id: 'j20', name: 'جيه-٢٠ تنين عظيم', role: 'تخفي بعيد المدى', tier: 'V',
      trophies: 1190, color: 0x4a5568, accent: 0x1a2030,
      hp: 335, topSpeed: 1470, accel: 46, turn: 36, ideal: 830, abFuel: 14.5,
      missiles: 2, flares: 4, damage: 23, missileDmg: 180, style: 'dragon'
    },
    {
      id: 'm2000', name: 'ميراج ٢٠٠٠', role: 'دلتا · اعتراض سريع', tier: 'IV',
      trophies: 980, color: 0x9aa8b8, accent: 0x3a4555,
      hp: 280, topSpeed: 1380, accel: 50, turn: 42, ideal: 780, abFuel: 12,
      missiles: 2, flares: 4, damage: 24, missileDmg: 160, style: 'delta'
    }
  ];

  const BOT_NAMES_ENEMY = ['هونغ مان', 'آيتكن', 'هوت فكس', 'ظل الليل', 'صقر'];
  const BOT_NAMES_ALLY = ['روي باتي', 'تشابز', 'غاليليو', 'قمة', 'جدار'];
  const MATCH_SECONDS = 180;
  const SCORE_LIMIT = 15;

  // ─── State ───────────────────────────────────────────
  let selectedJet = 0;
  let scene, camera, renderer, clock;
  let player, allies, enemies, projectiles, flares, particles, explosions;
  let terrainGroup, waterMesh;
  let match = null;
  let keys = {};
  let stick = { active: false, x: 0, y: 0, id: null };
  let bankHold = 0;
  let running = false;
  let hangarPreview = null;

  const canvas = document.getElementById('game');
  const el = {
    hangar: document.getElementById('hangar'),
    result: document.getElementById('result'),
    resultCard: document.getElementById('result-card'),
    hud: document.getElementById('hud'),
    jetList: document.getElementById('jet-list'),
    statName: document.getElementById('stat-name'),
    statRows: document.getElementById('stat-rows'),
    hangarBody: document.getElementById('hangar-body'),
    lbPanel: document.getElementById('lb-panel'),
    lbList: document.getElementById('lb-list'),
    splash: document.getElementById('splash'),
    scoreBlue: document.getElementById('score-blue'),
    scoreRed: document.getElementById('score-red'),
    timer: document.getElementById('match-timer'),
    teamStrip: document.getElementById('team-strip'),
    ammoM: document.getElementById('ammo-m'),
    ammoF: document.getElementById('ammo-f'),
    speedAlt: document.getElementById('speed-alt'),
    labels: document.getElementById('labels'),
    radar: document.getElementById('radar'),
    radarCone: document.getElementById('radar-cone'),
    lockBox: document.getElementById('lock-box'),
    stick: document.getElementById('stick'),
    knob: document.getElementById('knob'),
  };

  // ─── Jet mesh builder ────────────────────────────────
  function createJetMesh(def, scale = 1) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: def.color, metalness: 0.72, roughness: 0.38,
      flatShading: false
    });
    const matDark = new THREE.MeshStandardMaterial({
      color: def.accent, metalness: 0.8, roughness: 0.35
    });
    const matGlass = new THREE.MeshStandardMaterial({
      color: 0x88ccff, metalness: 0.9, roughness: 0.1, transparent: true, opacity: 0.55
    });
    const matGlow = new THREE.MeshBasicMaterial({ color: 0xff6622 });

    const style = def.style;
    let fuselage, wingGeo;

    if (style === 'delta') {
      fuselage = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 2.2, 6, 10), mat);
      fuselage.rotation.z = Math.PI / 2;
      wingGeo = new THREE.ConeGeometry(1.6, 2.4, 3);
    } else if (style === 'raptor' || style === 'dragon' || style === 'felon') {
      fuselage = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.35, 2.6), mat);
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.9, 6), mat);
      nose.rotation.x = -Math.PI / 2; nose.position.z = 1.55;
      g.add(nose);
      wingGeo = new THREE.BoxGeometry(3.2, 0.08, 1.1);
    } else {
      fuselage = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 2.4, 6, 12), mat);
      fuselage.rotation.z = Math.PI / 2;
      wingGeo = new THREE.BoxGeometry(3.4, 0.07, 1.0);
    }
    g.add(fuselage);

    const wing = new THREE.Mesh(wingGeo, matDark);
    wing.position.y = -0.05;
    if (style === 'delta') {
      wing.rotation.x = Math.PI / 2;
      wing.rotation.z = Math.PI;
      wing.position.z = -0.2;
    } else {
      wing.position.z = -0.15;
    }
    g.add(wing);

    // twin tails / single
    if (style === 'delta') {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.55), matDark);
      fin.position.set(0, 0.35, -1.0);
      g.add(fin);
    } else {
      [-0.35, 0.35].forEach(x => {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.65, 0.5), matDark);
        fin.position.set(x, 0.4, -1.05);
        fin.rotation.z = x > 0 ? -0.15 : 0.15;
        g.add(fin);
      });
    }

    const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), matGlass);
    canopy.scale.set(1, 0.7, 1.4);
    canopy.position.set(0, 0.22, 0.55);
    g.add(canopy);

    // engines
    const engCount = style === 'delta' ? 1 : 2;
    for (let i = 0; i < engCount; i++) {
      const ex = engCount === 1 ? 0 : (i === 0 ? -0.22 : 0.22);
      const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.25, 10), matDark);
      nozzle.rotation.x = Math.PI / 2;
      nozzle.position.set(ex, 0, -1.45);
      g.add(nozzle);
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), matGlow);
      glow.position.set(ex, 0, -1.62);
      glow.name = 'exhaust';
      g.add(glow);
    }

    // missiles under wings
    [-1.1, 1.1].forEach(x => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.55, 6), new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.6, roughness: 0.4 }));
      m.rotation.x = Math.PI / 2;
      m.position.set(x, -0.12, -0.1);
      g.add(m);
    });

    g.scale.setScalar(scale);
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  }

  // ─── Canyon terrain ──────────────────────────────────
  function noise2(x, z) {
    const n = Math.sin(x * 0.021) * Math.cos(z * 0.017) * 40
      + Math.sin(x * 0.053 + 1.7) * Math.cos(z * 0.041) * 18
      + Math.sin((x + z) * 0.09) * 8;
    return n;
  }

  function buildCanyon(scene) {
    terrainGroup = new THREE.Group();
    const size = 900;
    const segs = 128;
    const geo = new THREE.PlaneGeometry(size, size, segs, segs);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = [];
    const cRock = new THREE.Color(0x4a4e52);
    const cDark = new THREE.Color(0x2c3034);
    const cGrass = new THREE.Color(0x3d5a3a);
    const cSand = new THREE.Color(0x6a6558);
    const tmp = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const dist = Math.sqrt(x * x + z * z * 0.35);
      // canyon corridor along Z
      const canyon = Math.abs(x) < 55 ? -55 - noise2(x * 0.3, z) * 0.4 : 0;
      const walls = Math.abs(x) > 40 && Math.abs(x) < 120
        ? (Math.abs(x) - 40) * 1.8 + noise2(x, z) * 2.5
        : noise2(x, z) * 1.2;
      let y = walls + canyon;
      if (Math.abs(x) < 35) y = -62 + Math.sin(z * 0.02) * 2;
      // pillars
      const px = ((x + 200) % 90) - 45;
      const pz = ((z + 200) % 110) - 55;
      if (Math.abs(x) > 70 && Math.hypot(px, pz * 0.7) < 14) {
        y += 35 + noise2(x * 2, z * 2);
      }
      pos.setY(i, y);

      if (y > 20) tmp.copy(cGrass);
      else if (y < -50) tmp.copy(cSand);
      else tmp.copy(cRock).lerp(cDark, clamp((y + 20) / 60, 0, 1));
      colors.push(tmp.r, tmp.g, tmp.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.92, metalness: 0.05, flatShading: false
    }));
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    terrainGroup.add(mesh);

    // water
    waterMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(70, size * 0.9),
      new THREE.MeshStandardMaterial({
        color: 0x1a4a6a, metalness: 0.6, roughness: 0.25,
        transparent: true, opacity: 0.75
      })
    );
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.set(0, -60.5, 0);
    terrainGroup.add(waterMesh);

    // cliff detail pillars
    for (let i = 0; i < 28; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const h = rand(25, 55);
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(rand(4, 9), rand(5, 11), h, 7),
        new THREE.MeshStandardMaterial({ color: 0x3a3e42, roughness: 0.95, flatShading: true })
      );
      pillar.position.set(side * rand(75, 160), -30 + h / 2, rand(-400, 400));
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      terrainGroup.add(pillar);
    }

    scene.add(terrainGroup);
  }

  function groundHeight(x, z) {
    const canyon = Math.abs(x) < 55 ? -55 : 0;
    const walls = Math.abs(x) > 40 && Math.abs(x) < 120
      ? (Math.abs(x) - 40) * 1.8 + noise2(x, z) * 2.5
      : noise2(x, z) * 1.2;
    let y = walls + canyon;
    if (Math.abs(x) < 35) y = -62;
    return y;
  }

  // ─── Aircraft entity ─────────────────────────────────
  function makeAircraft(def, team, name, isPlayer) {
    const mesh = createJetMesh(def, 1.15);
    scene.add(mesh);
    const ac = {
      def, team, name, isPlayer,
      mesh,
      pos: new THREE.Vector3(0, 40, 0),
      vel: new THREE.Vector3(0, 0, 40),
      quat: new THREE.Quaternion(),
      yaw: 0, pitch: 0, roll: 0,
      speed: 55,
      hp: def.hp, maxHp: def.hp,
      missiles: def.missiles, maxMissiles: def.missiles,
      flares: def.flares, maxFlares: def.flares,
      abFuel: def.abFuel, maxAb: def.abFuel,
      alive: true,
      lockTarget: null,
      missileCd: 0, flareCd: 0, cannonCd: 0, respawnCd: 0,
      ai: { mode: 'patrol', timer: 0, target: null, evade: 0 },
      trail: []
    };
    return ac;
  }

  function resetAircraft(ac, spawnZ, side) {
    const lane = side === 'blue' ? -1 : 1;
    ac.pos.set(lane * rand(8, 28), rand(25, 55), spawnZ + rand(-20, 20));
    ac.yaw = side === 'blue' ? 0 : Math.PI;
    ac.pitch = 0; ac.roll = 0;
    ac.speed = 50;
    ac.hp = ac.maxHp;
    ac.missiles = ac.maxMissiles;
    ac.flares = ac.maxFlares;
    ac.abFuel = ac.maxAb;
    ac.alive = true;
    ac.respawnCd = 0;
    ac.mesh.visible = true;
    ac.quat.setFromEuler(new THREE.Euler(ac.pitch, ac.yaw, ac.roll, 'YXZ'));
    ac.vel.set(0, 0, side === 'blue' ? 50 : -50);
  }

  // ─── Combat ──────────────────────────────────────────
  function fireCannon(ac) {
    if (!ac.alive || ac.cannonCd > 0) return;
    ac.cannonCd = 0.07;
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(ac.quat);
    const origin = ac.pos.clone().add(forward.clone().multiplyScalar(2.2));
    const spread = 0.012;
    forward.x += rand(-spread, spread);
    forward.y += rand(-spread, spread);
    forward.normalize();
    projectiles.push({
      type: 'cannon', owner: ac, team: ac.team,
      pos: origin,
      vel: forward.multiplyScalar(220 + ac.speed),
      life: 0.9, dmg: ac.def.damage,
      mesh: null
    });
    // muzzle flash
    spawnFlash(origin, 0xffcc44, 0.6);
    if (ac.isPlayer) match.shots++;
  }

  function fireMissile(ac) {
    if (!ac.alive || ac.missiles <= 0 || ac.missileCd > 0) return;
    ac.missiles--;
    ac.missileCd = 2.2;
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(ac.quat);
    const origin = ac.pos.clone().add(forward.clone().multiplyScalar(1.5)).add(new THREE.Vector3(0, -0.3, 0));
    const target = ac.lockTarget && ac.lockTarget.alive ? ac.lockTarget : findNearestEnemy(ac);
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.08, 0.9, 6),
      new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.7, roughness: 0.3 })
    );
    m.rotation.x = Math.PI / 2;
    scene.add(m);
    projectiles.push({
      type: 'missile', owner: ac, team: ac.team, target,
      pos: origin, vel: forward.multiplyScalar(ac.speed + 30),
      life: 6, dmg: ac.def.missileDmg, mesh: m, smoke: [], boost: 0
    });
    if (ac.isPlayer) match.shots++;
  }

  function dropFlares(ac) {
    if (!ac.alive || ac.flares <= 0 || ac.flareCd > 0) return;
    ac.flares--;
    ac.flareCd = 1.5;
    for (let i = 0; i < 5; i++) {
      const p = ac.pos.clone().add(new THREE.Vector3(rand(-2, 2), rand(-1, 1), rand(-2, 0)));
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xffaa33 })
      );
      mesh.position.copy(p);
      scene.add(mesh);
      flares.push({
        pos: p, vel: new THREE.Vector3(rand(-8, 8), rand(-2, 4), rand(-15, -5)).applyQuaternion(ac.quat),
        life: 2.5, mesh, owner: ac
      });
    }
    // decoy nearby enemy missiles
    projectiles.forEach(pr => {
      if (pr.type === 'missile' && pr.target === ac && Math.random() < 0.75) {
        pr.target = null;
        pr.life = Math.min(pr.life, 0.8);
      }
    });
  }

  function findNearestEnemy(ac) {
    const list = ac.team === 'blue' ? enemies : allies;
    let best = null, bd = 1e9;
    list.forEach(e => {
      if (!e.alive) return;
      const d = ac.pos.distanceTo(e.pos);
      if (d < bd && d < 280) { bd = d; best = e; }
    });
    return best;
  }

  function spawnFlash(pos, color, size) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(size, 6, 6),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 })
    );
    m.position.copy(pos);
    scene.add(m);
    particles.push({ mesh: m, life: 0.12, max: 0.12 });
  }

  function spawnExplosion(pos, big) {
    const s = big ? 3.5 : 1.8;
    spawnFlash(pos, 0xff8822, s);
    spawnFlash(pos.clone().add(new THREE.Vector3(0.5, 0.5, 0)), 0xffee88, s * 0.6);
    for (let i = 0; i < (big ? 12 : 6); i++) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(rand(0.15, 0.4), 4, 4),
        new THREE.MeshBasicMaterial({ color: rand(0, 1) > 0.5 ? 0xff6600 : 0x444444 })
      );
      m.position.copy(pos);
      scene.add(m);
      particles.push({
        mesh: m, life: rand(0.4, 0.9), max: 1,
        vel: new THREE.Vector3(rand(-1, 1), rand(-0.3, 1.2), rand(-1, 1)).multiplyScalar(rand(8, 22))
      });
    }
  }

  function damageAircraft(ac, dmg, from) {
    if (!ac.alive) return;
    ac.hp -= dmg;
    if (from && from.isPlayer) {
      match.damageDealt += dmg;
      floatDamage(ac, dmg);
    }
    if (ac.hp <= 0) {
      ac.hp = 0;
      ac.alive = false;
      ac.mesh.visible = false;
      ac.respawnCd = 5;
      spawnExplosion(ac.pos, true);
      if (ac.team === 'red') {
        match.scoreBlue++;
        if (from && from.isPlayer) match.kills++;
      } else {
        match.scoreRed++;
      }
      updateTeamStrip();
    }
  }

  function floatDamage(ac, dmg) {
    const v = ac.pos.clone().project(camera);
    const x = (v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
    if (v.z > 1) return;
    const div = document.createElement('div');
    div.className = 'dmg-float';
    div.textContent = arNum(dmg) + ' ضرر';
    div.style.left = x + 'px';
    div.style.top = y + 'px';
    el.hud.appendChild(div);
    setTimeout(() => div.remove(), 900);
  }

  // ─── AI ──────────────────────────────────────────────
  function updateAI(ac, dt) {
    if (!ac.alive) return;
    const ai = ac.ai;
    ai.timer -= dt;
    const foes = ac.team === 'blue' ? enemies : allies;
    let target = ai.target && ai.target.alive ? ai.target : null;
    if (!target || ai.timer <= 0) {
      let best = null, bd = 1e9;
      foes.forEach(e => {
        if (!e.alive) return;
        const d = ac.pos.distanceTo(e.pos);
        if (d < bd) { bd = d; best = e; }
      });
      ai.target = best;
      target = best;
      ai.timer = rand(1.5, 3.5);
      ai.mode = Math.random() < 0.7 ? 'attack' : 'patrol';
    }

    // incoming missile evade
    let threat = false;
    for (const pr of projectiles) {
      if (pr.type === 'missile' && pr.target === ac && pr.pos.distanceTo(ac.pos) < 80) {
        threat = true; break;
      }
    }
    if (threat && ac.flares > 0 && ac.flareCd <= 0 && Math.random() < 0.4) dropFlares(ac);

    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(ac.quat);
    let desire = forward.clone();

    if (ai.mode === 'attack' && target) {
      const to = target.pos.clone().sub(ac.pos);
      const dist = to.length();
      desire.copy(to.normalize());
      // lead
      desire.add(target.vel.clone().multiplyScalar(0.15 / Math.max(dist, 1))).normalize();
      ac.lockTarget = target;
      const ang = forward.angleTo(to.normalize());
      if (dist < 120 && ang < 0.35 && Math.random() < 0.08) fireCannon(ac);
      if (dist < 200 && dist > 40 && ang < 0.25 && ac.missiles > 0 && ac.missileCd <= 0 && Math.random() < 0.015) {
        fireMissile(ac);
      }
      if (dist < 35) desire.add(new THREE.Vector3(rand(-1, 1), 0.4, 0)).normalize();
    } else {
      // patrol canyon
      const cx = clamp(-ac.pos.x * 0.02, -0.5, 0.5);
      desire.set(cx + Math.sin(performance.now() * 0.0004 + ac.pos.z * 0.01) * 0.3, Math.sin(performance.now() * 0.0003) * 0.15, ac.team === 'blue' ? 1 : -1).normalize();
      ac.lockTarget = null;
    }

    // steer
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(ac.quat);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(ac.quat);
    const yawCmd = desire.dot(right);
    const pitchCmd = -desire.dot(up);
    const turn = ac.def.turn * 0.017 * dt * 1.1;
    ac.yaw -= yawCmd * turn * 2.2;
    ac.pitch += pitchCmd * turn * 1.8;
    ac.pitch = clamp(ac.pitch, -0.7, 0.7);
    ac.roll = lerp(ac.roll, -yawCmd * 0.9, 1 - Math.pow(0.001, dt));

    // speed
    const ideal = ac.def.ideal / 30;
    ac.speed = lerp(ac.speed, ideal + (ai.mode === 'attack' ? 8 : 0), dt * 0.4);
  }

  // ─── Player control ──────────────────────────────────
  function updatePlayer(dt) {
    const ac = player;
    if (!ac.alive) return;

    let yawIn = 0, pitchIn = 0, throttle = 0;
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) yawIn += 1;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) yawIn -= 1;
    if (keys['ArrowUp'] || keys['w'] || keys['W']) pitchIn += 1;
    if (keys['ArrowDown'] || keys['s'] || keys['S']) pitchIn -= 1;
    if (keys['Shift']) throttle = 1;

    yawIn += -stick.x + bankHold;
    pitchIn += stick.y;

    const turn = ac.def.turn * 0.018 * dt;
    ac.yaw += yawIn * turn * 2.4;
    ac.pitch += pitchIn * turn * 2.0;
    ac.pitch = clamp(ac.pitch, -0.85, 0.85);
    ac.roll = lerp(ac.roll, yawIn * 0.85, 1 - Math.pow(0.0008, dt));

    const base = ac.def.topSpeed / 28;
    const ab = throttle > 0 && ac.abFuel > 0;
    if (ab) { ac.abFuel = Math.max(0, ac.abFuel - dt); ac.speed = lerp(ac.speed, base * 1.25, dt * 1.2); }
    else {
      ac.abFuel = Math.min(ac.maxAb, ac.abFuel + dt * 0.35);
      ac.speed = lerp(ac.speed, base * 0.85, dt * 0.6);
    }

    // lock
    ac.lockTarget = null;
    let bestAng = 0.28, best = null;
    enemies.forEach(e => {
      if (!e.alive) return;
      const to = e.pos.clone().sub(ac.pos).normalize();
      const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(ac.quat);
      const ang = fwd.angleTo(to);
      const dist = ac.pos.distanceTo(e.pos);
      if (ang < bestAng && dist < 250) { bestAng = ang; best = e; }
    });
    ac.lockTarget = best;
    el.lockBox.classList.toggle('on', !!best);

    if (keys[' '] || keys['Spacebar']) fireCannon(ac);
    if (keys['f'] || keys['F']) { fireMissile(ac); keys['f'] = keys['F'] = false; }
    if (keys['x'] || keys['X']) { dropFlares(ac); keys['x'] = keys['X'] = false; }
  }

  function integrateAircraft(ac, dt) {
    if (!ac.alive) {
      ac.respawnCd -= dt;
      if (ac.respawnCd <= 0 && match && match.active) {
        resetAircraft(ac, ac.team === 'blue' ? -180 : 180, ac.team);
      }
      return;
    }

    ac.quat.setFromEuler(new THREE.Euler(ac.pitch, ac.yaw, ac.roll, 'YXZ'));
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(ac.quat);
    ac.vel.copy(forward.multiplyScalar(ac.speed));
    ac.pos.addScaledVector(ac.vel, dt);

    // bounds & terrain
    ac.pos.x = clamp(ac.pos.x, -200, 200);
    ac.pos.z = clamp(ac.pos.z, -420, 420);
    const gh = groundHeight(ac.pos.x, ac.pos.z) + 4;
    if (ac.pos.y < gh) {
      ac.pos.y = gh;
      ac.pitch = Math.max(ac.pitch, 0.15);
      if (ac.speed > 40) damageAircraft(ac, 40 * dt, null);
    }
    if (ac.pos.y > 140) ac.pos.y = 140;

    ac.mesh.position.copy(ac.pos);
    ac.mesh.quaternion.copy(ac.quat);

    // exhaust glow pulse
    ac.mesh.traverse(o => {
      if (o.name === 'exhaust') {
        const s = 0.9 + Math.sin(performance.now() * 0.02) * 0.15 + (ac.speed / 100) * 0.2;
        o.scale.setScalar(s);
      }
    });

    ac.missileCd = Math.max(0, ac.missileCd - dt);
    ac.flareCd = Math.max(0, ac.flareCd - dt);
    ac.cannonCd = Math.max(0, ac.cannonCd - dt);
  }

  // ─── Projectiles update ──────────────────────────────
  function updateProjectiles(dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const pr = projectiles[i];
      pr.life -= dt;

      if (pr.type === 'missile') {
        pr.boost = Math.min(1, (pr.boost || 0) + dt * 0.8);
        const speed = 70 + pr.boost * 90;
        if (pr.target && pr.target.alive) {
          const to = pr.target.pos.clone().sub(pr.pos).normalize();
          pr.vel.lerp(to.multiplyScalar(speed), dt * 3.5);
          // smoke trail
          if (Math.random() < 0.6) {
            const sm = new THREE.Mesh(
              new THREE.SphereGeometry(0.15, 4, 4),
              new THREE.MeshBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.45 })
            );
            sm.position.copy(pr.pos);
            scene.add(sm);
            particles.push({ mesh: sm, life: 0.8, max: 0.8 });
          }
        } else {
          pr.vel.multiplyScalar(1 + dt * 0.1);
        }
        if (pr.mesh) {
          pr.mesh.position.copy(pr.pos);
          pr.mesh.lookAt(pr.pos.clone().add(pr.vel));
        }
      }

      pr.pos.addScaledVector(pr.vel, dt);

      // hit test
      const targets = pr.team === 'blue' ? enemies : allies;
      let hit = false;
      for (const t of targets) {
        if (!t.alive) continue;
        const rad = pr.type === 'missile' ? 3.2 : 1.6;
        if (pr.pos.distanceTo(t.pos) < rad) {
          damageAircraft(t, pr.dmg, pr.owner);
          spawnExplosion(pr.pos, pr.type === 'missile');
          hit = true;
          break;
        }
      }
      // terrain
      if (pr.pos.y < groundHeight(pr.pos.x, pr.pos.z) + 1) {
        spawnFlash(pr.pos, 0xffaa44, 1);
        hit = true;
      }

      if (hit || pr.life <= 0) {
        if (pr.mesh) { scene.remove(pr.mesh); pr.mesh.geometry?.dispose(); }
        projectiles.splice(i, 1);
      }
    }

    for (let i = flares.length - 1; i >= 0; i--) {
      const f = flares[i];
      f.life -= dt;
      f.vel.y -= 4 * dt;
      f.pos.addScaledVector(f.vel, dt);
      f.mesh.position.copy(f.pos);
      f.mesh.material.opacity = clamp(f.life, 0, 1);
      f.mesh.material.transparent = true;
      if (f.life <= 0) {
        scene.remove(f.mesh);
        flares.splice(i, 1);
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.vel) p.mesh.position.addScaledVector(p.vel, dt);
      if (p.mesh.material) p.mesh.material.opacity = clamp(p.life / (p.max || 1), 0, 1);
      p.mesh.material && (p.mesh.material.transparent = true);
      const sc = clamp(p.life / (p.max || 1), 0.1, 1);
      if (!p.vel) p.mesh.scale.setScalar(sc * 2);
      if (p.life <= 0) {
        scene.remove(p.mesh);
        particles.splice(i, 1);
      }
    }
  }

  // ─── Camera ──────────────────────────────────────────
  const camOffset = new THREE.Vector3();
  const camLook = new THREE.Vector3();
  function updateCamera(dt) {
    if (!player) return;
    const back = new THREE.Vector3(0, 0, -1).applyQuaternion(player.quat);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(player.quat);
    const desired = player.pos.clone()
      .add(back.multiplyScalar(14))
      .add(up.multiplyScalar(4.5));
    camera.position.lerp(desired, 1 - Math.pow(0.0002, dt));
    camLook.copy(player.pos).add(new THREE.Vector3(0, 1.2, 8).applyQuaternion(player.quat));
    camera.lookAt(camLook);
    camera.up.lerp(new THREE.Vector3(0, 1, 0).applyQuaternion(player.quat).multiplyScalar(0.4).add(new THREE.Vector3(0, 0.6, 0)), 0.08);
  }

  // ─── HUD ─────────────────────────────────────────────
  function updateHUD() {
    if (!match || !player) return;
    el.scoreBlue.textContent = arNum(match.scoreBlue);
    el.scoreRed.textContent = arNum(match.scoreRed);
    const t = Math.max(0, Math.ceil(match.timeLeft));
    const m = Math.floor(t / 60), s = t % 60;
    el.timer.textContent = arNum(m) + ':' + (s < 10 ? '٠' : '') + arNum(s);

    el.ammoM.textContent = arNum(player.missiles) + '/' + arNum(player.maxMissiles);
    el.ammoF.textContent = arNum(player.flares) + '/' + arNum(player.maxFlares);

    const kmh = Math.round(player.speed * 28);
    const alt = Math.round(Math.max(0, player.pos.y + 62));
    el.speedAlt.textContent = arNum(kmh) + ' كم/س · ارتفاع ' + arNum(alt) + ' م';

    // labels
    el.labels.innerHTML = '';
    const all = allies.concat(enemies);
    all.forEach(ac => {
      if (ac.isPlayer || !ac.alive) return;
      const v = ac.pos.clone().project(camera);
      if (v.z > 1 || Math.abs(v.x) > 1.2 || Math.abs(v.y) > 1.2) return;
      const x = (v.x * 0.5 + 0.5) * 100;
      const y = (-v.y * 0.5 + 0.5) * 100;
      const dist = player.pos.distanceTo(ac.pos) / 1000;
      const div = document.createElement('div');
      div.className = 'plane-label ' + (ac.team === 'blue' ? 'ally' : 'enemy');
      div.style.left = x + '%';
      div.style.top = y + '%';
      div.innerHTML = ac.name + ' | ' + arNum(dist, 2) + ' كم | ' + ac.def.name.split(' ')[0]
        + '<span class="hp"><i style="width:' + (100 * ac.hp / ac.maxHp) + '%"></i></span>';
      el.labels.appendChild(div);
    });

    // radar
    el.radar.querySelectorAll('.radar-dot:not(.self)').forEach(n => n.remove());
    const range = 220;
    all.forEach(ac => {
      if (ac.isPlayer || !ac.alive) return;
      const dx = ac.pos.x - player.pos.x;
      const dz = ac.pos.z - player.pos.z;
      // rotate into player yaw
      const c = Math.cos(-player.yaw), s = Math.sin(-player.yaw);
      const rx = dx * c - dz * s;
      const rz = dx * s + dz * c;
      const nx = 50 + (rx / range) * 45;
      const ny = 50 - (rz / range) * 45;
      if (nx < 5 || nx > 95 || ny < 5 || ny > 95) return;
      const d = document.createElement('div');
      d.className = 'radar-dot ' + (ac.team === 'blue' ? 'ally' : 'enemy');
      d.style.left = nx + '%';
      d.style.top = ny + '%';
      el.radar.appendChild(d);
    });
  }

  function updateTeamStrip() {
    el.teamStrip.innerHTML = '';
    const mk = (list, cls) => list.forEach(ac => {
      const d = document.createElement('div');
      d.className = 'picon ' + cls + (ac.alive ? '' : ' dead');
      el.teamStrip.appendChild(d);
    });
    mk(allies, 'ally');
    mk(enemies, 'enemy');
  }

  // ─── Match lifecycle ─────────────────────────────────
  function clearWorldEntities() {
    [...(projectiles || []), ...(flares || [])].forEach(p => { if (p.mesh) scene.remove(p.mesh); });
    (particles || []).forEach(p => scene.remove(p.mesh));
    [...(allies || []), ...(enemies || [])].forEach(ac => { if (ac.mesh) scene.remove(ac.mesh); });
    projectiles = []; flares = []; particles = [];
    allies = []; enemies = [];
    player = null;
  }

  function startMatch(practice) {
    clearWorldEntities();
    const def = JETS[selectedJet];
    match = {
      active: true, practice: !!practice,
      timeLeft: practice ? 120 : MATCH_SECONDS,
      scoreBlue: 0, scoreRed: 0,
      kills: 0, damageDealt: 0, shots: 0
    };

    player = makeAircraft(def, 'blue', 'أنت', true);
    resetAircraft(player, -160, 'blue');
    allies = [player];

    const allyCount = practice ? 1 : 4;
    const enemyCount = practice ? 3 : 5;
    for (let i = 0; i < allyCount; i++) {
      const d = JETS[(selectedJet + 1 + i) % JETS.length];
      const ac = makeAircraft(d, 'blue', BOT_NAMES_ALLY[i], false);
      resetAircraft(ac, -170 - i * 12, 'blue');
      allies.push(ac);
    }
    for (let i = 0; i < enemyCount; i++) {
      const d = JETS[(selectedJet + 2 + i) % JETS.length];
      const ac = makeAircraft(d, 'red', BOT_NAMES_ENEMY[i % BOT_NAMES_ENEMY.length], false);
      resetAircraft(ac, 170 + i * 12, 'red');
      enemies.push(ac);
    }

    el.hangar.classList.add('hidden');
    el.result.classList.add('hidden');
    el.hud.classList.add('active');
    updateTeamStrip();
    running = true;
  }

  function endMatch() {
    if (!match || !match.active) return;
    match.active = false;
    running = false;
    el.hud.classList.remove('active');

    const win = match.scoreBlue > match.scoreRed;
    const draw = match.scoreBlue === match.scoreRed;
    el.resultCard.className = 'result-card ' + (draw ? '' : win ? 'win' : 'lose');
    document.getElementById('result-title').textContent = draw ? 'تعادل' : win ? 'انتصار!' : 'هزيمة';
    document.getElementById('result-sub').textContent = arNum(match.scoreBlue) + ' — ' + arNum(match.scoreRed) + ' · وادي الصخور';
    document.getElementById('r-kills').textContent = arNum(match.kills);
    document.getElementById('r-score').textContent = arNum(match.scoreBlue);
    document.getElementById('r-dmg').textContent = arNum(match.damageDealt);
    const acc = match.shots ? Math.round(100 * Math.min(1, match.kills / Math.max(1, match.shots * 0.05))) : 0;
    document.getElementById('r-acc').textContent = arNum(acc) + '٪';
    el.result.classList.remove('hidden');
  }

  // ─── Main loop ───────────────────────────────────────
  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(0.05, clock.getDelta());

    if (waterMesh) waterMesh.material.opacity = 0.65 + Math.sin(performance.now() * 0.001) * 0.08;

    if (running && match && match.active) {
      match.timeLeft -= dt;
      updatePlayer(dt);
      allies.forEach(ac => {
        if (!ac.isPlayer) updateAI(ac, dt);
        integrateAircraft(ac, dt);
      });
      enemies.forEach(ac => { updateAI(ac, dt); integrateAircraft(ac, dt); });
      updateProjectiles(dt);
      updateCamera(dt);
      updateHUD();

      if (match.timeLeft <= 0 || match.scoreBlue >= SCORE_LIMIT || match.scoreRed >= SCORE_LIMIT) {
        endMatch();
      }
    } else if (hangarPreview) {
      hangarPreview.rotation.y += dt * 0.35;
    }

    renderer.render(scene, camera);
  }

  // ─── Hangar UI ───────────────────────────────────────
  function renderHangar() {
    el.jetList.innerHTML = '';
    JETS.forEach((j, i) => {
      const card = document.createElement('div');
      card.className = 'jet-card' + (i === selectedJet ? ' selected' : '');
      card.innerHTML =
        '<div class="jet-thumb" id="thumb-' + j.id + '"></div>' +
        '<div class="jet-meta"><h3>' + j.name + '<span class="tier">' + j.tier + '</span></h3>' +
        '<div class="role">' + j.role + '</div></div>' +
        '<div class="jet-score">' + arNum(j.trophies) + '<small>كؤوس</small></div>';
      card.addEventListener('click', () => {
        selectedJet = i; renderHangar(); showStats();
        if (hangarPreview) {
          scene.remove(hangarPreview);
          hangarPreview = createJetMesh(JETS[selectedJet], 2.2);
          hangarPreview.position.set(0, 25, 0);
          scene.add(hangarPreview);
        }
      });
      el.jetList.appendChild(card);
      // mini canvas preview
      requestAnimationFrame(() => drawThumb(j, 'thumb-' + j.id));
    });
    showStats();
  }

  function drawThumb(def, id) {
    const host = document.getElementById(id);
    if (!host) return;
    host.innerHTML = '';
    const c = document.createElement('canvas');
    c.width = 220; c.height = 128;
    host.appendChild(c);
    const r = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true });
    r.setSize(220, 128, false);
    r.setClearColor(0x000000, 0);
    const s = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(35, 220 / 128, 0.1, 50);
    cam.position.set(3.2, 1.4, 4.2); cam.lookAt(0, 0, 0);
    s.add(new THREE.AmbientLight(0xffffff, 0.7));
    const L = new THREE.DirectionalLight(0xffffff, 1.1); L.position.set(3, 5, 2); s.add(L);
    const mesh = createJetMesh(def, 1);
    mesh.rotation.y = -0.6; mesh.rotation.x = 0.15;
    s.add(mesh);
    r.render(s, cam);
    r.dispose();
  }

  function showStats() {
    const j = JETS[selectedJet];
    el.statName.innerHTML = j.name + ' <span class="lvl">مستوى ٢٠</span>';
    const rows = [
      ['✚', 'نقاط الإصابة', j.hp, 400],
      ['◷', 'السرعة القصوى', j.topSpeed + ' كم/س', 1600],
      ['»', 'التسارع', j.accel + ' م/ث²', 60],
      ['↻', 'معدل الانعطاف', j.turn + ' °/ث', 50],
      ['◎', 'سرعة الانعطاف المثالية', j.ideal + ' كم/س', 1000],
      ['⛽', 'وقود الاحتراق', j.abFuel.toFixed(1) + ' ث', 20]
    ];
    el.statRows.innerHTML = rows.map(r => {
      const pct = Math.round(100 * (typeof r[2] === 'number' ? r[2] : parseFloat(r[2])) / r[3]);
      const label = typeof r[2] === 'number' ? arNum(r[2]) : String(r[2]).replace(/[0-9.]+/g, m => arNum(+m, m.includes('.') ? 1 : 0));
      return '<div class="stat-row"><div class="stat-ico">' + r[0] + '</div><div><div>' + r[1] +
        '<div class="stat-bar"><i style="width:' + pct + '%"></i></div></div></div>' +
        '<div class="stat-val">' + (typeof r[2] === 'number' ? arNum(r[2]) : r[2].replace(/[0-9]+(\.[0-9]+)?/g, (m) => arNum(+m, m.includes('.') ? 1 : 0))) + '</div></div>';
    }).join('');
  }

  function renderLeaderboard() {
    const pilots = [
      { rank: 1, name: 'السمّ الناقم', squad: 'فول آوت', trophies: 1576 },
      { rank: 2, name: 'صقر الليل', squad: 'مافز', trophies: 1507 },
      { rank: 3, name: 'رايدرز', squad: 'ستورم', trophies: 1418 },
      { rank: 4, name: 'غاليليو', squad: 'مافز', trophies: 1290 },
      { rank: 5, name: 'قمة', squad: 'مافز', trophies: 1210 },
      { rank: 6, name: 'أنت', squad: 'عرض تجريبي', trophies: 1150 }
    ];
    el.lbList.innerHTML = '<h2 style="margin-bottom:8px">أفضل اللاعبين الحاليين</h2>' + pilots.map(p =>
      '<div class="lb-row"><div class="lb-rank">' + arNum(p.rank) + '</div>' +
      '<div class="lb-name">' + p.name + '<small>' + p.squad + '</small></div>' +
      '<div class="lb-trophy">🏆 ' + arNum(p.trophies) + '</div></div>'
    ).join('');
  }

  // ─── Input ───────────────────────────────────────────
  window.addEventListener('keydown', e => { keys[e.key] = true; if ([' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) e.preventDefault(); });
  window.addEventListener('keyup', e => { keys[e.key] = false; });

  function bindStick() {
    const zone = el.stick;
    const knob = el.knob;
    const setKnob = (x, y) => {
      const r = 40;
      knob.style.transform = 'translate(calc(-50% + ' + (x * r) + 'px), calc(-50% + ' + (y * r) + 'px))';
    };
    const onDown = (clientX, clientY, id) => {
      const rect = zone.getBoundingClientRect();
      stick.active = true; stick.id = id;
      onMove(clientX, clientY);
    };
    const onMove = (clientX, clientY) => {
      if (!stick.active) return;
      const rect = zone.getBoundingClientRect();
      let x = (clientX - rect.left) / rect.width * 2 - 1;
      let y = (clientY - rect.top) / rect.height * 2 - 1;
      const len = Math.hypot(x, y) || 1;
      if (len > 1) { x /= len; y /= len; }
      stick.x = x; stick.y = y;
      setKnob(x, y);
    };
    const onUp = () => { stick.active = false; stick.x = 0; stick.y = 0; stick.id = null; setKnob(0, 0); };

    zone.addEventListener('pointerdown', e => { zone.setPointerCapture(e.pointerId); onDown(e.clientX, e.clientY, e.pointerId); });
    zone.addEventListener('pointermove', e => onMove(e.clientX, e.clientY));
    zone.addEventListener('pointerup', onUp);
    zone.addEventListener('pointercancel', onUp);

    document.getElementById('bank-l').addEventListener('pointerdown', () => { bankHold = 1; });
    document.getElementById('bank-r').addEventListener('pointerdown', () => { bankHold = -1; });
    ['bank-l', 'bank-r'].forEach(id => {
      const b = document.getElementById(id);
      b.addEventListener('pointerup', () => { bankHold = 0; });
      b.addEventListener('pointerleave', () => { bankHold = 0; });
    });

    document.getElementById('btn-missile').addEventListener('click', () => player && fireMissile(player));
    document.getElementById('btn-cannon').addEventListener('pointerdown', () => { keys[' '] = true; });
    document.getElementById('btn-cannon').addEventListener('pointerup', () => { keys[' '] = false; });
    document.getElementById('btn-flare').addEventListener('click', () => player && dropFlares(player));
  }

  // ─── Init Three ──────────────────────────────────────
  function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x6eb6e8);
    // fog set below
    // fix fog color typo
    scene.fog = new THREE.Fog(0x87b8e0, 140, 560);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.5, 900);
    camera.position.set(0, 50, -30);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    // lights
    scene.add(new THREE.AmbientLight(0xb0c8e0, 0.45));
    const sun = new THREE.DirectionalLight(0xfff2dd, 1.25);
    sun.position.set(80, 120, 40);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 400;
    sun.shadow.camera.left = -150;
    sun.shadow.camera.right = 150;
    sun.shadow.camera.top = 150;
    sun.shadow.camera.bottom = -150;
    scene.add(sun);
    const hemi = new THREE.HemisphereLight(0x88bbff, 0x445544, 0.35);
    scene.add(hemi);

    // sky gradient via large sphere
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(700, 24, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: {
          top: { value: new THREE.Color(0x2a6db5) },
          mid: { value: new THREE.Color(0x7ec4ef) },
          bot: { value: new THREE.Color(0xd8eaf5) }
        },
        vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: 'uniform vec3 top,mid,bot; varying vec3 vP; void main(){ float h=normalize(vP).y; vec3 c=mix(bot,mid,clamp(h*1.5+0.4,0.0,1.0)); c=mix(c,top,clamp(h*0.9,0.0,1.0)); gl_FragColor=vec4(c,1.0); }'
      })
    );
    scene.add(sky);

    // clouds (simple billboards)
    const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depth: THREE.DoubleSide });
    for (let i = 0; i < 20; i++) {
      const c = new THREE.Mesh(new THREE.PlaneGeometry(rand(40, 90), rand(12, 25)), cloudMat);
      c.position.set(rand(-300, 300), rand(90, 160), rand(-400, 400));
      c.rotation.y = rand(0, Math.PI);
      scene.add(c);
    }

    buildCanyon(scene);
    clock = new THREE.Clock();
    projectiles = []; flares = []; particles = []; allies = []; enemies = [];

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // hangar idle camera
    camera.position.set(40, 35, 60);
    camera.lookAt(0, 10, 0);
    hangarPreview = createJetMesh(JETS[0], 2.2);
    hangarPreview.position.set(0, 25, 0);
    scene.add(hangarPreview);

    renderHangar();
    renderLeaderboard();
    bindStick();

    // tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const lb = tab.dataset.tab === 'lb';
        el.hangarBody.style.display = lb ? 'none' : '';
        el.lbPanel.classList.toggle('show', lb);
        el.lbPanel.style.display = lb ? 'grid' : 'none';
      });
    });
    el.lbPanel.style.display = 'none';

    document.getElementById('btn-match').addEventListener('click', () => {
      if (hangarPreview) { scene.remove(hangarPreview); hangarPreview = null; }
      startMatch(false);
    });
    document.getElementById('btn-practice').addEventListener('click', () => {
      if (hangarPreview) { scene.remove(hangarPreview); hangarPreview = null; }
      startMatch(true);
    });
    document.getElementById('btn-hangar').addEventListener('click', () => {
      el.result.classList.add('hidden');
      el.hangar.classList.remove('hidden');
      clearWorldEntities();
      hangarPreview = createJetMesh(JETS[selectedJet], 2.2);
      hangarPreview.position.set(0, 25, 0);
      scene.add(hangarPreview);
      camera.position.set(40, 35, 60);
      camera.lookAt(0, 10, 0);
    });
    document.getElementById('btn-again').addEventListener('click', () => {
      el.result.classList.add('hidden');
      startMatch(match && match.practice);
    });
    document.getElementById('btn-back-hangar').addEventListener('click', () => {
      document.querySelector('.nav-tab[data-tab="hangar"]').click();
    });

    animate();
    setTimeout(() => {
      el.splash.classList.add('fade');
      setTimeout(() => el.splash.remove(), 500);
    }, 600);
  }

  // boot when Three is ready
  function boot() {
    if (typeof THREE === 'undefined') {
      setTimeout(boot, 50);
      return;
    }
    try { init(); }
    catch (err) {
      console.error(err);
      el.splash.innerHTML = '<h1>عاصفة المعدن</h1><p style="color:#ff8a94">خطأ في التحميل — افتح وحدة التحكم</p>';
    }
  }
  boot();
})();
