async function main() {
  // CDNに到達できない場合も、初期化エラーを日本語で案内する。
  const [{ createScene }, { Simulation }, { createUI }] = await Promise.all([
    import('./scene.js'), import('./simulation.js'), import('./ui.js'),
  ]);
  const simulation = new Simulation();
  const world = createScene(document.querySelector('#scene-container'));
  let previousTime = null;
  let uiElapsed = 0;
  let animationId;
  const ui = createUI(simulation, (action) => {
    if (action === 'view') world.resetView();
    else simulation[action]();
    previousTime = null;
    world.update(0, simulation);
    world.render();
    ui.render();
  });

  function animate(now) {
    // 長時間の非表示や処理落ち後に、突然大量の計算を走らせない。
    const dt = previousTime === null ? 0 : Math.min((now - previousTime) / 1000, 0.1);
    previousTime = now;
    simulation.advance(dt);
    world.update(dt, simulation);
    world.render();
    uiElapsed += dt;
    if (uiElapsed >= 0.1) { ui.render(); uiElapsed = 0; }
    animationId = requestAnimationFrame(animate);
  }
  ui.render();
  world.update(0, simulation);
  world.render();
  animationId = requestAnimationFrame(animate);

  // 非表示中は自動で一時停止。再開ボタンで続きを観察できる。
  const onVisibility = () => {
    previousTime = null;
    if (document.hidden && simulation.state === 'running') {
      simulation.pause();
      ui.notice('タブが非表示になったため一時停止しました。「再開」で続けられます。');
      ui.render();
    }
  };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', () => {
    cancelAnimationFrame(animationId);
    document.removeEventListener('visibilitychange', onVisibility);
    ui.dispose();
    world.dispose();
  }, { once: true });
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) window.location.reload();
  });
}

main().catch((error) => {
  console.error('初期化に失敗しました。', error);
  document.querySelector('#status').textContent = '読み込みに失敗しました';
  const message = document.querySelector('#error');
  message.textContent = '3Dシーンを表示できませんでした。HTTPサーバー経由で開いているか、インターネット接続とブラウザのWebGL設定を確認してください。';
  message.hidden = false;
});
