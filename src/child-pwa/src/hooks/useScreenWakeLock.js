import { useState, useEffect, useRef, useCallback } from "react";

/**
 * 屏幕常亮保活 Hook (Screen Wake Lock API)
 * 适配 iPad / iOS 16.4+ 及现代平板浏览器：
 * 1. 支持组件受控 enabled 切换与手动 request/release 操作
 * 2. 支持 visibilitychange 自动重连（切后台恢复后重新锁定屏幕）
 * 3. 严格防止内存泄露：组件卸载与失焦时确保 release 并解绑所有事件
 * 4. 健壮处理不支持、低电量模式拒绝 (NotAllowedError) 等异常场景
 *
 * @param {boolean} enabled 是否开启屏幕保活（默认 false）
 * @returns {{ isSupported: boolean, isActive: boolean, request: () => Promise<boolean>, release: () => Promise<void> }}
 */
export default function useScreenWakeLock(enabled = false) {
  const [isActive, setIsActive] = useState(false);
  const isSupported =
    typeof navigator !== "undefined" &&
    "wakeLock" in navigator &&
    typeof navigator.wakeLock?.request === "function";

  const sentinelRef = useRef(null);
  const desiredActiveRef = useRef(enabled);
  const isMountedRef = useRef(true);
  const requestingRef = useRef(false);

  desiredActiveRef.current = enabled;

  const release = useCallback(async () => {
    desiredActiveRef.current = false;
    const sentinel = sentinelRef.current;
    sentinelRef.current = null;
    if (sentinel) {
      try {
        if (!sentinel.released) {
          await sentinel.release();
        }
      } catch (err) {
        console.warn("[useScreenWakeLock] release error:", err);
      } finally {
        if (isMountedRef.current) {
          setIsActive(false);
        }
      }
    } else {
      if (isMountedRef.current) {
        setIsActive(false);
      }
    }
  }, []);

  const request = useCallback(async () => {
    if (!isSupported) return false;
    if (requestingRef.current) return false;

    // 已持有未释放的 sentinel
    if (sentinelRef.current && !sentinelRef.current.released) {
      if (isMountedRef.current) setIsActive(true);
      return true;
    }

    requestingRef.current = true;
    try {
      const sentinel = await navigator.wakeLock.request("screen");

      // 异步返回后，若组件已卸载或用户已取消激活，立即释放
      if (!isMountedRef.current || !desiredActiveRef.current) {
        sentinel.release().catch(() => {});
        return false;
      }

      sentinelRef.current = sentinel;
      if (isMountedRef.current) {
        setIsActive(true);
      }

      sentinel.addEventListener("release", () => {
        // 如果释放的是当前持有的 sentinel，清理引用
        if (sentinelRef.current === sentinel) {
          sentinelRef.current = null;
          if (isMountedRef.current) {
            setIsActive(false);
          }
        }
      });

      return true;
    } catch (err) {
      // 常见于省电模式、页面不可见时请求等
      console.warn("[useScreenWakeLock] request error:", err);
      if (isMountedRef.current) {
        setIsActive(false);
      }
      return false;
    } finally {
      requestingRef.current = false;
    }
  }, [isSupported]);

  // 处理标签页切回前台 (visibilitychange) 时的自动重连
  useEffect(() => {
    if (!isSupported) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible" && desiredActiveRef.current) {
        // 切回前台，自动重新申请屏幕锁
        await request();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isSupported, request]);

  // 处理 enabled 外部属性变化及卸载销毁
  useEffect(() => {
    isMountedRef.current = true;

    if (enabled) {
      desiredActiveRef.current = true;
      request();
    } else {
      release();
    }

    return () => {
      isMountedRef.current = false;
      desiredActiveRef.current = false;
      const sentinel = sentinelRef.current;
      sentinelRef.current = null;
      if (sentinel) {
        try {
          if (!sentinel.released) {
            sentinel.release().catch(() => {});
          }
        } catch {
          // ignore
        }
      }
    };
  }, [enabled, request, release]);

  const manualRequest = useCallback(() => {
    desiredActiveRef.current = true;
    return request();
  }, [request]);

  return {
    isSupported,
    isActive,
    request: manualRequest,
    release,
  };
}
