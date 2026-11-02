/**
 * Web Audio 纯前端音效模块
 * 专为 iPad / iOS Safari PWA 深度优化：
 * 1. 采用单例 AudioContext + webkitAudioContext 兼容降级
 * 2. 适配 iOS 物理静音开关 (Silent Mode)：
 *    - 优先配置 HTML AudioSession API (navigator.audioSession.type = "playback", Safari 17+)
 *    - 降级支持超短无感 HTML5 音频唤醒媒体通道 (iOS < 17)
 * 3. 健壮的用户手势解锁机制 (touchstart/click/pointerdown)，同步触发 resume 与硬件激活
 * 4. 监听 AudioContext 状态变更 (suspended / interrupted)，在切后台或来电打断后自动重新绑定手势恢复
 * 5. 采用无音频文件依赖的纯算式合成器，杜绝网络与资源加载风险
 */

let sharedAudioContext = null;
let isUnlockListenersBound = false;

/**
 * 配置 iOS 媒体会话类别为 playback
 * 使得 Web Audio 音效可在静音开关开启时正常发声（不被 Ring/Silent 硬件开关静音）
 */
export function configureAudioSession() {
  if (typeof navigator !== "undefined" && "audioSession" in navigator) {
    try {
      navigator.audioSession.type = "playback";
    } catch {
      // 忽略不支持或只读环境异常
    }
  }
}

/**
 * 获取全局单例 AudioContext
 */
export function getAudioContext() {
  if (typeof window === "undefined") return null;

  configureAudioSession();

  if (!sharedAudioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    try {
      sharedAudioContext = new AudioContextClass();

      // 监听系统打断（如电话、锁屏、切后台）与挂起状态
      if (typeof sharedAudioContext.addEventListener === "function") {
        sharedAudioContext.addEventListener("statechange", () => {
          if (
            sharedAudioContext.state === "suspended" ||
            sharedAudioContext.state === "interrupted"
          ) {
            initAudioUnlock();
          }
        });
      }
    } catch (e) {
      console.warn("[soundFx] Failed to create AudioContext:", e);
      return null;
    }
  }

  return sharedAudioContext;
}

/**
 * 确保 AudioContext 处于 running 状态
 * 兼容处理 suspended 与 iOS 特有的 interrupted 状态
 */
async function ensureContextRunning(ctx) {
  if (!ctx) return false;
  configureAudioSession();
  if (ctx.state === "suspended" || ctx.state === "interrupted") {
    try {
      await ctx.resume();
    } catch {
      // 忽略无法恢复的异常
    }
  }
  return ctx.state === "running";
}

/**
 * 初始化 iOS / iPad 手势解锁监听器
 */
export function initAudioUnlock() {
  if (typeof window === "undefined" || isUnlockListenersBound) return;
  isUnlockListenersBound = true;

  const unlockEvents = ["touchstart", "touchend", "click", "pointerdown"];

  const handleUnlock = () => {
    configureAudioSession();
    const ctx = getAudioContext();
    if (!ctx) return;

    // 1. 同步恢复 AudioContext，避免在 microtask 中丢失用户手势上下文
    if (ctx.state === "suspended" || ctx.state === "interrupted") {
      ctx.resume().catch(() => {});
    }

    // 2. 播放 1 个样本极微弱静音 buffer 唤醒 iOS 音频硬件管线
    try {
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    } catch {
      // 忽略
    }

    // 3. 针对 iOS < 17 降级：使用极小静音 HTML5 音频唤醒系统媒体通道以绕过静音开关
    try {
      const silentAudio = new Audio(
        "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA"
      );
      silentAudio.volume = 0.01;
      silentAudio.play().catch(() => {});
    } catch {
      // 忽略
    }

    // 如果状态已恢复为 running，解绑以减少开销；后续若再次打断会由 statechange 重新挂载
    if (ctx.state === "running") {
      unlockEvents.forEach((evt) => {
        document.removeEventListener(evt, handleUnlock, true);
      });
      isUnlockListenersBound = false;
    }
  };

  unlockEvents.forEach((evt) => {
    document.addEventListener(evt, handleUnlock, { capture: true, passive: true });
  });
}

// 在浏览器环境中自启动解锁机制
if (typeof window !== "undefined") {
  initAudioUnlock();
}

/**
 * 1. playTaskComplete: 愉悦上升的和弦琶音 (C5 -> E5 -> G5 -> C6)
 * 用于儿童完成任务时的即时正向反馈
 */
export async function playTaskComplete() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    await ensureContextRunning(ctx);

    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.3, now);
    masterGain.connect(ctx.destination);

    // C大调主要音符频率序列 (C5, E5, G5, C6)
    const notes = [
      { freq: 523.25, time: 0.00, dur: 0.35 }, // C5
      { freq: 659.25, time: 0.07, dur: 0.35 }, // E5
      { freq: 783.99, time: 0.14, dur: 0.35 }, // G5
      { freq: 1046.50, time: 0.21, dur: 0.45 }, // C6
    ];

    notes.forEach(({ freq, time, dur }) => {
      const startTime = now + time;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime);

      // ADSR 包络：快速微上升，自然指数衰减
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(0.35, startTime + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(startTime);
      osc.stop(startTime + dur + 0.05);
    });

    // 释放资源
    setTimeout(() => {
      masterGain.disconnect();
    }, 800);
  } catch (err) {
    console.warn("[soundFx] playTaskComplete error:", err);
  }
}

/**
 * 2. playFanfare: 宏亮欢庆的号角音 (Brass Fanfare)
 * 采用多重滤波三角波模拟铜管音色，营造隆重胜利与通关氛围
 */
export async function playFanfare() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    await ensureContextRunning(ctx);

    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.32, now);
    masterGain.connect(ctx.destination);

    // 号角前奏音符 (G4 -> C5 -> E5 -> G5)
    const melody = [
      { freq: 392.00, time: 0.00, dur: 0.12 }, // G4
      { freq: 523.25, time: 0.12, dur: 0.12 }, // C5
      { freq: 659.25, time: 0.24, dur: 0.12 }, // E5
      { freq: 783.99, time: 0.36, dur: 0.22 }, // G5
    ];

    melody.forEach(({ freq, time, dur }) => {
      const startTime = now + time;
      createBrassNote(ctx, masterGain, freq, startTime, dur);
    });

    // 胜利大和弦收尾 (C5 + E5 + G5 + C6)
    const chordTime = now + 0.58;
    const chordNotes = [523.25, 659.25, 783.99, 1046.50];
    chordNotes.forEach((freq) => {
      createBrassNote(ctx, masterGain, freq, chordTime, 0.7);
    });

    setTimeout(() => {
      masterGain.disconnect();
    }, 1500);
  } catch (err) {
    console.warn("[soundFx] playFanfare error:", err);
  }
}

/**
 * 辅助函数：生成铜管号角音质单音（三角波 + 低通共鸣滤波器）
 */
function createBrassNote(ctx, dest, freq, startTime, duration) {
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const noteGain = ctx.createGain();

  // 三角波配合谐波滤波产生温暖铜管质感
  osc.type = "triangle";
  osc.frequency.setValueAtTime(freq, startTime);

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1600, startTime);
  filter.Q.setValueAtTime(2.5, startTime);

  noteGain.gain.setValueAtTime(0.0001, startTime);
  noteGain.gain.linearRampToValueAtTime(0.25, startTime + 0.02);
  noteGain.gain.setValueAtTime(0.22, startTime + duration * 0.7);
  noteGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  osc.connect(filter);
  filter.connect(noteGain);
  noteGain.connect(dest);

  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
}

/**
 * 3. playTimerDone: 舒缓恬静的提醒音 (Gentle Zen Bell)
 * 柔和低刺激的正弦泛音钟鸣，平复心绪，不惊吓专注后的儿童
 */
export async function playTimerDone() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    await ensureContextRunning(ctx);

    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.28, now);
    masterGain.connect(ctx.destination);

    // 舒缓和弦：第一声 (E大调柔和和弦 E4, B4, E5, G#5)
    const chime1Time = now;
    const chime1Freqs = [329.63, 493.88, 659.25, 830.61];
    chime1Freqs.forEach((freq, idx) => {
      createZenTone(ctx, masterGain, freq, chime1Time + idx * 0.015, 1.8, 0.22);
    });

    // 第二声空灵泛音 (B4, E5, B5)
    const chime2Time = now + 0.75;
    const chime2Freqs = [493.88, 659.25, 987.77];
    chime2Freqs.forEach((freq, idx) => {
      createZenTone(ctx, masterGain, freq, chime2Time + idx * 0.02, 2.0, 0.18);
    });

    setTimeout(() => {
      masterGain.disconnect();
    }, 3000);
  } catch (err) {
    console.warn("[soundFx] playTimerDone error:", err);
  }
}

/**
 * 辅助函数：生成空灵柔和钟音（正弦波 + 柔和慢起音 + 长衰减）
 */
function createZenTone(ctx, dest, freq, startTime, duration, volume) {
  const osc = ctx.createOscillator();
  const noteGain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, startTime);

  // 柔和起音（50ms），避免爆音冲击儿童耳膜
  noteGain.gain.setValueAtTime(0.0001, startTime);
  noteGain.gain.linearRampToValueAtTime(volume, startTime + 0.06);
  // 悠长自然衰减
  noteGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  osc.connect(noteGain);
  noteGain.connect(dest);

  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
}

/**
 * 4. playTaskSubmitted: 柔和愉悦的提交待审核音 (Warm Two-Tone Chime)
 * 用于需要家长审核的任务在孩子点击提交时的听觉反馈
 */
export async function playTaskSubmitted() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    await ensureContextRunning(ctx);

    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.28, now);
    masterGain.connect(ctx.destination);

    // 双音清脆升调 (F5 -> A5)
    const notes = [
      { freq: 698.46, time: 0.00, dur: 0.25 }, // F5
      { freq: 880.00, time: 0.12, dur: 0.40 }, // A5
    ];

    notes.forEach(({ freq, time, dur }) => {
      const startTime = now + time;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(0.32, startTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(startTime);
      osc.stop(startTime + dur + 0.05);
    });

    setTimeout(() => {
      masterGain.disconnect();
    }, 800);
  } catch (err) {
    console.warn("[soundFx] playTaskSubmitted error:", err);
  }
}
