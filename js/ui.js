import { FIELDS, DIRECTIONS } from './config.js';

const number = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('ja-JP', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const colors = { green: '青', yellow: '黄', red: '赤' };

export function createUI(simulation, onAction) {
  const controller = new AbortController();
  const options = { signal: controller.signal };
  const fields = document.querySelector('#parameter-fields');
  // 表示と検証が食い違わないよう、入力範囲は設定定義から作る。
  fields.innerHTML = FIELDS.map((field) => `<label class="field" for="${field.key}"><span>${field.label}</span><span class="input-wrap"><input id="${field.key}" type="number" min="${field.min}" max="${field.max}" step="${field.step}" value="${simulation.settings[field.key]}" inputmode="decimal"><span>${field.unit}</span></span></label>`).join('');
  function notice(text) { document.querySelector('#notice').textContent = text; }
  for (const field of FIELDS) {
    const input = document.getElementById(field.key);
    const apply = (finished) => {
      try {
        if (input.value === '' || !input.validity.valid) {
          // 編集途中の空欄は許容し、入力確定時にだけ元の値へ戻す。
          if (!finished) return;
          throw new Error(`${field.label}は${field.min}〜${field.max}${field.unit}、刻み${field.step}で指定してください。`);
        }
        simulation.setSettings({ [field.key]: Number(input.value) });
        notice('設定を変更しました。信号時間は次に始まる各区間から反映します。');
      } catch (error) {
        if (finished) input.value = simulation.settings[field.key];
        notice(error.message);
      }
    };
    input.addEventListener('input', () => apply(false), options);
    input.addEventListener('change', () => apply(true), options);
  }
  const actions = { start: 'start', pause: 'pause', resume: 'resume', reset: 'reset', 'reset-view': 'view' };
  for (const [id, action] of Object.entries(actions)) {
    document.getElementById(id).addEventListener('click', () => {
      if (action === 'reset') notice('車両・測定値・信号サイクルをリセットしました。設定値は維持しています。');
      else if (action === 'resume' || action === 'start') notice('交通量は東西・南北それぞれ2方向の合計です。');
      onAction(action);
    }, options);
  }
  function text(id, value) {
    const element = document.getElementById(id);
    if (element.textContent !== value) element.textContent = value;
  }
  function render() {
    const stats = simulation.statistics();
    const signal = simulation.signal;
    const state = { ready: '開始待ち', running: '実行中', paused: '一時停止中' }[simulation.state];
    text('status', state);
    document.querySelector('#status-dot').classList.toggle('running', simulation.state === 'running');
    document.querySelector('#start').disabled = simulation.state !== 'ready';
    document.querySelector('#pause').disabled = simulation.state !== 'running';
    document.querySelector('#resume').disabled = simulation.state !== 'paused';
    document.querySelector('#reset').disabled = false;
    document.querySelector('#reset-view').disabled = false;
    for (const axis of ['EW', 'NS']) {
      const color = signal.color(axis);
      document.getElementById(`signal-${axis}`).dataset.color = color;
      text(`color-${axis}`, colors[color]);
    }
    text('phase-name', signal.holding ? '全赤・交差点内の車両通過待ち' : signal.phase.name);
    text('remaining', signal.holding ? '安全確認中' : `残り ${decimal.format(Math.max(0, signal.remaining))} 秒`);
    document.querySelector('#phase-fill').style.width = `${signal.duration ? Math.max(0, Math.min(100, signal.remaining / signal.duration * 100)) : 0}%`;
    for (const key of ['generated', 'passed', 'active', 'maxQueue', 'pending']) text(key, `${number.format(stats[key])} 台`);
    text('maxSystemQueue', `${number.format(stats.maxSystemQueue)} 台`);
    text('straight-ratio', `直進 ${number.format(100 - simulation.settings.leftPercent - simulation.settings.rightPercent)}％ ／ 左折 ${number.format(simulation.settings.leftPercent)}％ ／ 右折 ${number.format(simulation.settings.rightPercent)}％`);
    for (const { id } of DIRECTIONS) {
      text(`queue-${id}`, `${number.format(stats.queues[id])} 台`);
      text(`pending-${id}`, `${number.format(stats.pendingByDirection[id])} 台`);
    }
    for (const movement of ['straight', 'left', 'right']) text(`passed-${movement}`, `${number.format(stats.passedMovements[movement])} 台`);
    text('averageWait', `${decimal.format(stats.averageWait)} 秒`);
    text('longestWait', `${decimal.format(stats.longestWait)} 秒`);
    text('systemAverageWait', `${decimal.format(stats.systemAverageWait)} 秒`);
    text('systemLongestWait', `${decimal.format(stats.systemLongestWait)} 秒`);
    const seconds = Math.floor(stats.time + 1e-8);
    text('elapsed', `${number.format(Math.floor(seconds / 60))} 分 ${String(seconds % 60).padStart(2, '0')} 秒`);
    text('speed-label', `${simulation.settings.speed.toLocaleString('ja-JP')} 倍速`);
  }
  return { render, notice, dispose() { controller.abort(); } };
}
