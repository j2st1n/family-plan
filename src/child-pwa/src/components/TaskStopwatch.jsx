import {PauseIcon, PlayIcon} from "@heroicons/react/24/solid";
import TaskOptionsMenu from "./TaskOptionsMenu.jsx";
import {TimerIcon} from "./Icons.jsx";
import {formatActualSeconds, formatElapsedSeconds} from "../../../shared-web/taskTiming.js";

export default function TaskStopwatch({timer, elapsedSeconds, onToggle, onComplete, onCancel, busy = false}) {
  const running = timer.phase === "running";
  const stopped = timer.phase === "stopped";

  return <section className="task-stopwatch" aria-label="本机计时" aria-busy={busy}>
    <TaskOptionsMenu label="计时选项" inTimer disabled={busy} items={[{label:"取消计时",destructive:true,action:onCancel}]}/>
    <p className={`task-stopwatch-state${running ? "" : " is-paused"}`}>
      <span aria-hidden="true"><TimerIcon size={18} /></span>
      <span role="status">{running ? "正在计时" : stopped ? "计时已停止" : "已暂停"}</span>
    </p>
    <output role="timer" aria-live="off" aria-label={`已用时 ${formatActualSeconds(elapsedSeconds)}`} className={`task-stopwatch-digits${elapsedSeconds >= 3600 ? " is-long" : ""}`}>
      {formatElapsedSeconds(elapsedSeconds)}
    </output>
    <div className="task-stopwatch-actions">
      {!stopped && <button type="button" className="task-stopwatch-secondary" disabled={busy} onClick={onToggle}>
        {running ? <PauseIcon aria-hidden="true" /> : <PlayIcon aria-hidden="true" />}
        {running ? "暂停" : "继续"}
      </button>}
      {onComplete && <button type="button" className="task-stopwatch-primary" disabled={busy} onClick={onComplete}>
        {busy ? "正在完成…" : "完成任务"}
      </button>}
    </div>
  </section>;
}
