import { createSignal, onCleanup, onMount } from "solid-js";

/**
 * 収まらないときだけ左右に往復スクロールする1行テキスト。収まる場合は普通に表示する。
 * PiP window 内でも動くよう、ResizeObserver は要素が属する window のものを使う。
 */
export const Marquee = (props: { text: string; class?: string }) => {
  let container: HTMLDivElement | undefined;
  let inner: HTMLSpanElement | undefined;
  const [overflow, setOverflow] = createSignal(0);

  onMount(() => {
    if (!container || !inner) return;
    const measure = () =>
      setOverflow(Math.max(0, (inner?.scrollWidth ?? 0) - (container?.clientWidth ?? 0)));
    const Observer = container.ownerDocument.defaultView?.ResizeObserver ?? ResizeObserver;
    const observer = new Observer(measure);
    observer.observe(container);
    observer.observe(inner);
    onCleanup(() => observer.disconnect());
  });

  return (
    <div
      ref={(el) => (container = el)}
      class={`overflow-hidden whitespace-nowrap ${props.class ?? ""}`}
      title={props.text}
    >
      <span
        ref={(el) => (inner = el)}
        class={`inline-block ${overflow() > 0 ? "nowstr-marquee" : ""}`}
        style={{
          "--marquee-distance": `-${overflow()}px`,
          // 30px/s 程度で流し、前後の停止時間を足す
          "--marquee-duration": `${Math.max(4, overflow() / 30 + 3)}s`,
        }}
      >
        {props.text}
      </span>
    </div>
  );
};
