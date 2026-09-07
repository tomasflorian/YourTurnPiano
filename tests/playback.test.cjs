const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function boot(storage = {}, initialSong = 'odeToJoy') {
  const elements = new Map();
  const timers = new Map();
  const sounds = [];
  const pageListeners = {};
  let timerId = 0;
  function element() {
    return {
      style: {}, attributes: {}, children: [], listeners: {}, disabled: false,
      classList: { toggle() {} },
      setAttribute(key, value) { this.attributes[key] = value; },
      replaceChildren() { this.children = []; },
      appendChild(child) { this.children.push(child); },
      addEventListener(name, fn) { this.listeners[name] = fn; },
      scrollIntoView() { this.scrollCalls = (this.scrollCalls || 0) + 1; },
      scrollTo({ left }) { this.scrollLeft = left; },
    };
  }
  const context = vm.createContext({
    document: {
      createElement: element,
      getElementById(id) {
        if (!elements.has(id)) {
          const el = element();
          el.disabled = id === 'restart';
          if (id === 'songSelect') el.value = initialSong;
          elements.set(id, el);
        }
        return elements.get(id);
      },
    },
    window: { addEventListener(name, fn) {
      const previous = pageListeners[name];
      pageListeners[name] = () => { if (previous) previous(); fn(); };
    } },
    localStorage: {
      getItem(key) { return storage[key] ?? null; },
      setItem(key, value) { storage[key] = value; },
    },
    setTimeout(fn, ms) { timers.set(++timerId, { fn, ms }); return timerId; },
    clearTimeout(id) { timers.delete(id); },
    recordSound(note, ms) { sounds.push({ note, ms }); },
  });
  const run = code => vm.runInContext(code, context);
  run(source);
  run('beep = recordSound');
  return {
    run, elements, timers, sounds, pageListeners,
    select(value) {
      elements.get('songSelect').value = value;
      elements.get('songSelect').listeners.change();
    },
    tick() {
      assert.equal(timers.size, 1);
      const [id, timer] = timers.entries().next().value;
      timers.delete(id);
      timer.fn();
      return timer.ms;
    },
  };
}

for (const order of [[48, 60], [60, 48]]) {
  test(`both hands accept ${order.join(' then ')} and wait for both`, () => {
    const app = boot();
    app.select('twinkleTwoHands');
    app.run('step()');
    assert.equal(app.run('waitingFor.size'), 2);
    app.run('onNoteOn(61, 100)');
    assert.equal(app.run('waitingFor.size'), 2);
    app.run(`onNoteOn(${order[0]}, 100)`);
    assert.equal(app.run('waitingFor.size'), 1);
    assert.equal(app.run('index'), 0);
    app.run(`onNoteOn(${order[0]}, 100)`);
    assert.equal(app.run('waitingFor.size'), 1);
    app.run(`onNoteOn(${order[1]}, 100)`);
    assert.equal(app.run('index'), 1);
    assert.equal(app.run('playedNotes.size'), 2);
    assert.equal(app.timers.values().next().value.ms, 750);
  });
}

test('automatic bass sustains while the melody advances every beat', () => {
  const app = boot();
  app.select('twinkleTwoHands');
  app.run('playerPatterns[0].fill(false); step()');
  assert.deepEqual(app.sounds, [{ note: 48, ms: 3000 }, { note: 60, ms: 750 }]);
  assert.equal(app.tick(), 750);
  assert.deepEqual(app.sounds[2], { note: 60, ms: 750 });
  assert.equal(app.run('index'), 2);
});

test('mixed ownership plays the automatic hand once after manual input', () => {
  const app = boot();
  app.select('twinkleTwoHands');
  app.run('toggleNote(0); step()');
  assert.equal(app.run('waitingFor.size'), 1);
  app.run('onNoteOn(60, 100)');
  assert.deepEqual(app.sounds, [{ note: 60, ms: 750 }, { note: 48, ms: 3000 }]);
});

test('editing a partially completed onset preserves accepted notes', () => {
  const app = boot();
  app.select('twinkleTwoHands');
  app.run('step(); onNoteOn(48, 100); toggleNote(1)');
  assert.equal(app.run('index'), 1);
  assert.deepEqual(app.sounds, [{ note: 48, ms: 3000 }, { note: 60, ms: 750 }]);
});

test('patterns remain separate across songs, levels, reloads and resets', () => {
  const storage = {};
  const app = boot(storage);
  app.run('toggleNote(0)');
  app.select('twinkleTwoHands');
  app.run('toggleNote(0); level = 2; toggleNote(1)');
  const restored = boot(storage);
  assert.equal(restored.run('playerPatterns[0][0]'), false);
  restored.select('twinkleTwoHands');
  assert.equal(restored.run('playerPatterns[0][0]'), false);
  assert.equal(restored.run('playerPatterns[1][1]'), false);
  restored.run('resetLevelPattern()');
  assert.equal(restored.run('playerPatterns[0][0]'), true);
  assert.equal(restored.run('playerPatterns[1][1]'), false);
  restored.select('odeToJoy');
  assert.equal(restored.run('playerPatterns[0][0]'), false);
});

test('restart and song switch clear partial input, timers and scroll', () => {
  const app = boot();
  app.select('twinkleTwoHands');
  app.run('step(); onNoteOn(48, 100); restart()');
  assert.equal(app.run('playedNotes.size'), 0);
  assert.equal(app.run('waitingFor'), null);
  assert.equal(app.timers.size, 1);
  app.elements.get('roll').scrollLeft = 1000;
  app.select('odeToJoy');
  assert.equal(app.timers.size, 0);
  assert.equal(app.run('index'), 0);
  assert.equal(app.elements.get('roll').scrollLeft, 0);
  app.run('step()');
  assert.equal(app.run('waitingFor.size'), 1);
});

test('every song can complete manually and automatically and wait for restart', () => {
  for (const song of ['odeToJoy', 'twinkle', 'twinkleTwoHands', 'odeToJoyTwoHands']) {
    for (const manual of [false, true]) {
      const app = boot();
      app.select(song);
      app.run(`playerPatterns[0].fill(${manual}); step()`);
      let turns = 0;
      while (app.run('index < GROUPS.length')) {
        assert.ok(++turns < 150, 'song must make progress');
        if (app.run('waitingFor !== null')) {
          app.run('onNoteOn(SONG[[...waitingFor][0]].note, 100)');
        } else {
          app.tick();
        }
      }
      assert.equal(app.run('playedNotes.size'), app.run('SONG.length'));
      app.tick();
      assert.equal(app.run('index'), app.run('GROUPS.length'));
      assert.equal(app.run('reviewMode'), true);
      assert.equal(app.timers.size, 0);
      assert.equal(app.run('noteStatsEls.length'), app.run('SONG.length'));
      assert.equal(app.elements.get('roll').scrollLeft, 0);
    }
  }
});

test('editing while paused keeps the view until manual return or playback resumes', () => {
  const app = boot();
  app.run('level = 4; step(); onNoteOn(64, 100)');
  const scrollCount = () => app.run('rollEls.reduce((n, el) => n + (el.scrollCalls || 0), 0)');
  app.elements.get('roll').scrollLeft = 800;
  const before = scrollCount();
  app.run('toggleNote(20); status()');
  assert.equal(app.elements.get('roll').scrollLeft, 800);
  assert.equal(scrollCount(), before);
  app.elements.get('returnToCursor').listeners.click();
  assert.equal(scrollCount(), before + 1);
  app.run('toggleNote(20); onNoteOn(64, 100)');
  assert.equal(scrollCount(), before + 2);
  assert.equal(app.run('followCursor'), true);
});

test('changing the waiting note to automatic resumes cursor following', () => {
  const app = boot();
  app.run('step(); toggleNote(0)');
  assert.equal(app.run('followCursor'), true);
  assert.equal(app.run('playedIndex'), 0);
  assert.equal(app.run('rollEls[0].scrollCalls'), 1);
});

test('tempo changes affect future notes without resetting progress or manual waits', () => {
  const app = boot();
  const slider = app.elements.get('tempo');
  app.run('step()');
  slider.value = '40';
  slider.listeners.input();
  assert.equal(app.run('waitingFor.size'), 1);
  assert.equal(app.run('index'), 0);
  assert.equal(app.elements.get('tempoValue').textContent, '40 BPM');
  app.run('onNoteOn(64, 100)');
  assert.equal(app.sounds.at(-1).ms, 1500);
  slider.value = '160';
  slider.listeners.input();
  assert.equal(app.run('index'), 1);
  assert.equal(app.tick(), 1500); // The already scheduled note keeps its timing.
  assert.equal(app.sounds.at(-1).ms, 375);
});

test('wrong keys are counted only while waiting and shown only after completion', () => {
  const app = boot();
  app.run('resetMistakes(); onNoteOn(61, 100); level = 4; step()');
  assert.equal(app.run('mistakeCount'), 0);
  app.run('onNoteOn(61, 100); onNoteOn(63, 100)');
  assert.equal(app.run('mistakeCount'), 2);
  assert.equal(app.elements.get('mistakeResult').hidden, true);
  while (app.run('waitingFor !== null')) {
    app.run('onNoteOn(SONG[[...waitingFor][0]].note, 100)');
  }
  assert.equal(app.elements.get('mistakeResult').hidden, true);
  app.tick();
  assert.equal(app.elements.get('mistakeResult').hidden, true);
  assert.match(app.elements.get('statsSummary').textContent, /2 wrong key presses/);
  assert.equal(app.run('mistakeCount'), 0);
  assert.equal(app.timers.size, 0);
  app.run('onNoteOn(64, 100)');
  assert.equal(app.elements.get('mistakeResult').hidden, true);
  app.run('onNoteOn(21, 100)');
  assert.equal(app.run('reviewMode'), false);
  app.run('onNoteOn(64, 100)');
  assert.equal(app.elements.get('mistakeResult').hidden, true);
  app.run('onNoteOn(61, 100); restart()');
  assert.equal(app.run('mistakeCount'), 0);
});

test('initial song matches the selected option and loads its saved pattern', () => {
  const storage = {};
  const previous = boot(storage);
  previous.select('twinkleTwoHands');
  previous.run('toggleNote(0)');
  const app = boot(storage, 'twinkleTwoHands');
  assert.equal(app.run('songId'), 'twinkleTwoHands');
  assert.equal(app.run('SONG.length'), 54);
  assert.equal(app.run('rollEls.length'), 54);
  assert.equal(app.run('playerPatterns[0][0]'), false);
  assert.equal(app.elements.get('songTitle').textContent, 'Twinkle — two hands');
});

test('per-key stats distinguish correct and wrong presses and persist across visits', () => {
  const storage = {};
  const app = boot(storage);
  app.run('recordExpected([0], false); recordExpected([0], true); recordExpected([1], false)');
  assert.equal(app.run("sessionStats['odeToJoy:0'].correct"), 1);
  assert.equal(app.run("sessionStats['odeToJoy:0'].wrong"), 1);
  assert.equal(app.run("sessionStats['odeToJoy:1'].wrong"), 1);
  const restored = boot(storage);
  assert.equal(restored.run("allTimeStats['odeToJoy:0'].correct"), 1);
  assert.equal(restored.run('Object.keys(sessionStats).length'), 0);
  app.run('lastSessionStats = sessionStats; sessionStats = {}; reviewMode = true; buildRoll(); renderStats()');
  assert.equal(app.run('noteStatsEls[0].dot.style.visibility'), 'visible');
  assert.equal(app.run('noteStatsEls[0].bar.style.visibility'), 'visible');
  assert.equal(app.run('noteStatsEls[0].correctBar.style.width'), '50%');
  assert.equal(app.run('noteStatsEls[0].wrongBar.style.width'), '50%');
  assert.equal(app.run('noteStatsEls[1].dot.style.visibility'), 'visible');
  assert.equal(app.run('Object.keys(sessionStats).length'), 0);
});

test('review is stable through edits and clears on the restart button', () => {
  const app = boot();
  app.run('level = 4; step()');
  while (app.run('waitingFor !== null')) app.run('onNoteOn(SONG[[...waitingFor][0]].note, 100)');
  app.tick();
  app.run('toggleNote(0); step()');
  assert.equal(app.run('reviewMode'), true);
  assert.equal(app.timers.size, 0);
  app.elements.get('restart').listeners.click();
  assert.equal(app.run('reviewMode'), false);
  assert.equal(app.run('noteStatsEls.length'), 0);
  assert.equal(app.elements.get('mistakeResult').hidden, true);
  assert.equal(app.run('index'), 0);
  assert.equal(app.timers.size, 1);
});

test('reset stats clears persisted statistics without altering note patterns or playback', () => {
  const storage = {};
  const app = boot(storage);
  app.run('toggleNote(20); step(); onNoteOn(61, 100)');
  app.elements.get('resetStats').listeners.click();
  assert.equal(app.run('Object.keys(allTimeStats).length'), 0);
  assert.equal(app.run('Object.keys(sessionStats).length'), 0);
  assert.equal(app.run('waitingFor.size'), 1);
  const restored = boot(storage);
  assert.equal(restored.run('Object.keys(allTimeStats).length'), 0);
  assert.equal(restored.run('playerPatterns[0][20]'), app.run('playerPatterns[0][20]'));
});

test('invalid or unavailable stats storage does not interrupt input', () => {
  const app = boot({'yourTurnKeyboard.keyStats.v1': '{broken'});
  app.run('localStorage.setItem = () => { throw Error("blocked"); }; step(); onNoteOn(64, 100)');
  assert.equal(app.run('index'), 1);
  assert.equal(app.run("allTimeStats['odeToJoy:0'].correct"), 1);
  assert.match(app.run('statsStorageMessage'), /could not be saved/);
});

test('bulk buttons save the current level only and update manual percentage', () => {
  const storage = {};
  const app = boot(storage, 'twinkleTwoHands');
  app.elements.get('allManual').listeners.click();
  assert.equal(app.run('playerPatterns[0].every(Boolean)'), true);
  assert.match(app.elements.get('manualCompletion').textContent, /100%/);
  assert.equal(app.run('playerPatterns[1].every(Boolean)'), false);
  assert.equal(boot(storage, 'twinkleTwoHands').run('playerPatterns[0].every(Boolean)'), true);
  app.run('step()');
  app.elements.get('allAutomatic').listeners.click();
  assert.equal(app.run('waitingFor'), null);
  assert.equal(app.run('index'), 1);
  assert.match(app.elements.get('manualCompletion').textContent, /Manual: 0%/);
  assert.equal(boot(storage, 'twinkleTwoHands').run('playerPatterns[0].every(value => !value)'), true);
  app.select('odeToJoy');
  assert.equal(app.run('playerPatterns[0][0]'), true);
});

test('late browser restoration synchronizes the song without restarting unchanged playback', () => {
  const app = boot();
  app.elements.get('songSelect').value = 'twinkleTwoHands';
  app.pageListeners.pageshow();
  assert.equal(app.run('SONG.length'), 54);
  app.run('step(); onNoteOn(48, 100)');
  app.pageListeners.pageshow();
  assert.equal(app.run('playedNotes.size'), 1);
  assert.equal(app.run('waitingFor.size'), 1);
});
