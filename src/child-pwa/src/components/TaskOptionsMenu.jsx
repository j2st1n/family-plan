import {useEffect, useId, useRef, useState} from "react";
import {EllipsisHorizontalIcon} from "@heroicons/react/24/solid";

export default function TaskOptionsMenu({label, items, disabled = false, inTimer = false}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef(null);
  const trigger = useRef(null);
  const firstItem = useRef(null);
  const pointerActivation = useRef(false);

  useEffect(() => {
    if (!open) return;
    firstItem.current?.focus();
    const outside = event => {if (!root.current?.contains(event.target)) setOpen(false);};
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  if (!items.length) return null;

  return <div className={`task-stopwatch-menu${inTimer ? " task-stopwatch-menu--timer" : ""}`} ref={root}
    onPointerDownCapture={() => {pointerActivation.current = true;}}
    onPointerCancelCapture={() => {pointerActivation.current = false;}}
    onClickCapture={() => {pointerActivation.current = false;}}
    onBlur={event => {
      // Safari touch activation blurs buttons to no target before click; keep the item mounted.
      // Keyboard focus leaving (including Tab to browser chrome) still dismisses the menu.
      if (!event.currentTarget.contains(event.relatedTarget) && (event.relatedTarget || !pointerActivation.current)) setOpen(false);
    }}
    onKeyDown={event => {
      pointerActivation.current = false;
      if (event.key === "Escape") {event.stopPropagation(); setOpen(false); trigger.current?.focus();}
      if (open && ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        const options = [...root.current.querySelectorAll('[role="menuitem"]')];
        const current = options.indexOf(document.activeElement);
        const next = event.key === "Home" ? 0 : event.key === "End" ? options.length-1 : (current+(event.key === "ArrowUp" ? -1 : 1)+options.length)%options.length;
        options[next]?.focus();
      }
    }}>
    <button type="button" className="task-stopwatch-options" aria-label={label} aria-haspopup="menu"
      aria-expanded={open} aria-controls={open ? id : undefined} ref={trigger} disabled={disabled}
      onClick={() => setOpen(value => !value)}
      onKeyDown={event => {if (event.key === "ArrowDown" && !open) {event.preventDefault(); setOpen(true);}}}>
      <EllipsisHorizontalIcon aria-hidden="true"/>
    </button>
    {open && <div id={id} role="menu" aria-label={label} className="task-stopwatch-popover">
      {items.map((item,index) => <button type="button" role="menuitem" key={item.label} ref={index===0 ? firstItem : undefined}
        className={item.destructive ? "is-destructive" : undefined}
        onClick={async () => {setOpen(false); await item.action(); if (item.restoreFocus!==false) trigger.current?.focus();}}>{item.label}</button>)}
    </div>}
  </div>;
}
