// Narration shared by the demo (index.html) and the WebXR page (webxr-test.html).
// States: idle (nothing started), playing, paused, ended.
// - idle/ended: the play button ("Reproducir"/"Repetir") shows while the fox can be seen (setAvailable).
//   Pressing it (a user gesture, which mobile browsers require to play audio) makes the fox run and plays
//   the narration.
// - playing/paused: Pause/Continue and Stop show even if the fox is lost, since the audio keeps going.
//   Pause also freezes the fox; Stop rewinds, back to idle.
// - ended: the fox idles (Survey) and the play button offers a replay.
// Subtitles come from the audio's <track> (WebVTT); the browser picks the active cue from the audio time
// and we draw it ourselves (track mode "hidden") so it looks the same everywhere.
// onStart / onStop: page hooks when the narration starts and when it is stopped (or could not start).
window.createNarration = ({ audio, playButton, pauseButton, stopButton, subtitles, model, onStart, onStop }) => {
  const track = audio.querySelector('track').track;
  let available = false;
  let state = 'idle';

  const showSubtitle = () => {
    const cue = track.activeCues?.[0];
    const active = state === 'playing' || state === 'paused';
    subtitles.hidden = !(cue && active);
    subtitles.firstElementChild.textContent = cue ? cue.text : '';
  };
  track.mode = 'hidden';
  track.addEventListener('cuechange', showSubtitle);

  const setState = (next) => {
    state = next;
    showSubtitle();
    const active = state === 'playing' || state === 'paused';
    playButton.hidden = active || !available;
    playButton.dataset.icon = state === 'ended' ? 'replay' : 'play';
    playButton.textContent = state === 'ended' ? 'Repetir narración' : 'Reproducir narración';
    pauseButton.hidden = stopButton.hidden = !active;
    pauseButton.dataset.icon = state === 'paused' ? 'play' : 'pause';
    pauseButton.textContent = state === 'paused' ? 'Continuar' : 'Pausa';
    model.setAttribute('animation-mixer', 'timeScale', state === 'paused' ? 0 : 1);
  };

  // Returns play()'s promise: without a recent user gesture on this page the browser may refuse to
  // play, which can happen when the headset mode starts it on its own.
  const start = () => {
    onStart?.();
    model.setAttribute('animation-mixer', 'clip', 'Run');
    audio.currentTime = 0;
    setState('playing');
    return audio.play().catch((e) => {
      onStop?.();
      setState('idle');
      throw e;
    });
  };
  const pauseOrResume = () => {
    if (state === 'paused') {
      audio.play();
      setState('playing');
    } else {
      audio.pause();
      setState('paused');
    }
  };
  playButton.addEventListener('click', () => start().catch(() => {}));
  pauseButton.addEventListener('click', pauseOrResume);
  const stop = () => {
    audio.pause();
    audio.currentTime = 0;
    model.setAttribute('animation-mixer', 'clip', 'Survey');
    onStop?.();
    setState('idle');
  };
  stopButton.addEventListener('click', stop);
  audio.addEventListener('ended', () => {
    model.setAttribute('animation-mixer', 'clip', 'Survey');
    setState('ended');
  });
  setState('idle');

  return {
    start,
    stop,
    // Whether the fox can be seen (floor detected, fox placed): shows or hides the play button.
    setAvailable(value) {
      available = value;
      setState(state);
    },
    get state() { return state; },
    get available() { return available; },
  };
};
