// Headless physics regression suite. Builds tracks, runs the sim exactly
// like Game.step does, and asserts who survives and who wipes out.
// Run via: pnpm smoke
import { Engine } from '../src/physics/engine';
import { Rider } from '../src/physics/rider';
import { LineStore } from '../src/lines/store';

let failures = 0;

function sim(build: (store: LineStore) => void, steps = 700): { rider: Rider; crashStep: number } {
  const store = new LineStore();
  build(store);
  const engine = new Engine();
  const rider = new Rider();
  rider.reset(0, 0);
  let crashStep = -1;
  for (let i = 0; i < steps; i++) {
    const snapped = engine.step(rider.allPoints, rider.sticks, store);
    if ((snapped || rider.checkWipeout(engine.contacts)) && !rider.crashed) {
      rider.crash();
      crashStep = i;
    }
  }
  return { rider, crashStep };
}

function expectCrash(name: string, expect: boolean, build: (s: LineStore) => void, steps = 700) {
  const { rider, crashStep } = sim(build, steps);
  const ok = rider.crashed === expect;
  if (!ok) failures++;
  console.log(
    `${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(20)} crashed=${rider.crashed}${
      crashStep >= 0 ? ' @' + crashStep : ''
    } (expected ${expect})`,
  );
}

// ---- survivable riding ----------------------------------------------------

expectCrash('gentle slope', false, (s) => {
  let px = -120,
    py = 34;
  for (let i = 1; i <= 22; i++) {
    const t = i / 22;
    const x = -120 + t * 760;
    const y = 34 + t * 250 - Math.sin(t * Math.PI) * 62;
    s.add('normal', px, py, x, y);
    px = x;
    py = y;
  }
});

// The classic complaint: a small upward kink must NOT eject the rider.
expectCrash('small up-kink', false, (s) => {
  let px = -100,
    py = 20,
    x = -100;
  const seg = (nx: number, ny: number) => {
    s.add('normal', px, py, nx, ny);
    px = nx;
    py = ny;
  };
  for (; x < 600; x += 50) seg(x + 50, py + 20);
  seg(x + 200, py - 40);
  for (x += 200; x < 1400; x += 50) seg(x + 50, py + 20);
});

// A sharp jump lip launches the rider instead of crashing him.
expectCrash('sharp jump lip', false, (s) => {
  let px = -100,
    py = 20,
    x = -100;
  const seg = (nx: number, ny: number) => {
    s.add('normal', px, py, nx, ny);
    px = nx;
    py = ny;
  };
  for (; x < 900; x += 50) seg(x + 50, py + 30);
  seg(x + 150, py - 80);
});

expectCrash('rolling hills', false, (s) => {
  let px = -100,
    py = 30;
  for (let x = -50; x < 3000; x += 50) {
    const y = 30 + (x + 100) * 0.35 + Math.sin(x * 0.01) * 30;
    s.add('normal', px, py, x, y);
    px = x;
    py = y;
  }
});

expectCrash('boosted hills', false, (s) => {
  let px = -100,
    py = 30;
  for (let x = -50; x < 4000; x += 50) {
    const y = 30 + (x + 100) * 0.3 + Math.sin(x * 0.013) * 35;
    s.add('speed', px, py, x, y);
    px = x;
    py = y;
  }
});

expectCrash('flat drop 240px', false, (s) => {
  for (let x = -300; x < 600; x += 50) s.add('normal', x, 260, x + 50, 260);
});

expectCrash('flat drop 500px', false, (s) => {
  for (let x = -300; x < 900; x += 50) s.add('normal', x, 520, x + 50, 520);
}, 900);

expectCrash('slow wall bonk', false, (s) => {
  for (let x = -100; x < 500; x += 50) {
    s.add('normal', x, 20 + (x + 100) * 0.06, x + 50, 20 + (x + 150) * 0.06);
  }
  s.add('normal', 420, 340, 400, -200);
}, 900);

// ---- wipeouts -------------------------------------------------------------

expectCrash('rotated tail landing', true, (s) => {
  let px = -100,
    py = 30;
  for (let x = -50; x < 3000; x += 50) {
    const y = 30 + (x + 100) * 0.35 + Math.sin(x * 0.01) * 40;
    s.add('normal', px, py, x, y);
    px = x;
    py = y;
  }
});

expectCrash('wall at speed', true, (s) => {
  const slope = (x: number) => 20 + (x + 100) * 0.5;
  for (let x = -100; x < 500; x += 50) s.add('speed', x, slope(x), x + 50, slope(x + 50));
  s.add('normal', 420, 340, 400, -200);
});

expectCrash('face-first ramp', true, (s) => {
  const slope = (x: number) => 20 + (x + 100) * 0.9;
  for (let x = -100; x < 400; x += 50) s.add('speed', x, slope(x), x + 50, slope(x + 50));
  s.add('normal', 450, 900, 760, 250);
});

// ---- mechanics ------------------------------------------------------------

{
  // Resting on a flat line, no sinking, no crash.
  const { rider } = sim((s) => {
    for (let x = -200; x < 200; x += 40) s.add('normal', x, 20, x + 40, 20);
  }, 300);
  const tailY = rider.points.tail.y;
  const ok = !rider.crashed && tailY < 25 && tailY > 10;
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${'flat rest'.padEnd(20)} tail y=${tailY.toFixed(1)}`);
}

{
  // Boost ordering: turbo > speed > normal distance on the same slope.
  const dist = (type: string): number => {
    const { rider } = sim((s) => {
      for (let x = -100; x < 4000; x += 50) {
        s.add(type, x, 30 + x * 0.1, x + 50, 35 + x * 0.1);
      }
    }, 400);
    return rider.comX;
  };
  const n = dist('normal');
  const sp = dist('speed');
  const tu = dist('turbo');
  const ok = sp > n + 50 && tu > sp + 50;
  if (!ok) failures++;
  console.log(
    `${ok ? 'ok  ' : 'FAIL'} ${'boost ordering'.padEnd(20)} normal=${n.toFixed(0)} speed=${sp.toFixed(0)} turbo=${tu.toFixed(0)}`,
  );
}

if (failures > 0) {
  console.error(`SMOKE FAIL: ${failures} scenario(s)`);
  process.exit(1);
}
console.log('SMOKE PASS');
