import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const PLAY_DURATION_MS = 2400;

const initialMessages = [
  {
    id: "promo-1",
    kind: "promo",
    direction: "out",
    title: "赠送个人资料背景给L10",
    subtitle: "去看看",
    variant: "profile",
  },
  { id: "note-1", kind: "note", text: "04/09 09:45" },
  {
    id: "promo-2",
    kind: "promo",
    direction: "in",
    title: "HelloTalk封面人物",
    subtitle: "生成专属AI头像，成为开屏焦点",
    variant: "cover",
  },
  { id: "note-2", kind: "note", text: "04/13 11:07" },
  {
    id: "link-1",
    kind: "link",
    direction: "out",
    text: "https://ali-global-statics.hellotalk8.com/ai-business/dev/fishing_finalone-main/index.html?HS=1&HA=1&FC=1",
  },
  { id: "note-3", kind: "note", text: "04/13 15:30" },
  { id: "text-1", kind: "text", direction: "out", text: "こんにちは" },
  { id: "note-4", kind: "note", text: "07/01 09:55" },
  { id: "text-2", kind: "text", direction: "out", text: "你好你妈妈今年儿岁" },
  { id: "note-5", kind: "note", text: "昨天 18:18" },
  { id: "voice-1", kind: "voice", direction: "in", duration: "0:11", heard: false, transcript: "" },
  { id: "voice-2", kind: "voice", direction: "in", duration: "0:08", heard: true, transcript: "" },
  { id: "voice-3", kind: "voice", direction: "in", duration: "0:15", heard: false, transcript: "" },
  { id: "voice-4", kind: "voice", direction: "in", duration: "0:06", heard: false, transcript: "我下午可以陪你练习中文。" },
  { id: "voice-5", kind: "voice", direction: "in", duration: "0:09", heard: false, transcript: "", failOnAuto: false },
  { id: "voice-6", kind: "voice", direction: "in", duration: "0:12", heard: false, transcript: "" },
];

const rules = [
  {
    id: "FR-001",
    title: "连续播放队列",
    detail: "从点击的未处理接收语音起，按时间顺序衔接后续未听、未转文字语音。",
    target: "message-voice-1",
  },
  {
    id: "FR-002",
    title: "播放状态与会话",
    detail: "完整播放才标记已听；暂停停在当前条；离开会话停止并清空队列。",
    target: "message-voice-3",
  },
  {
    id: "FR-003",
    title: "转文字与异常",
    detail: "转文字内容保留；队列遇到转文字或自动播放失败的语音时跳过。",
    target: "message-voice-4",
  },
  {
    id: "FR-004",
    title: "灰度开关",
    detail: "关闭客户端灰度后，符合条件的语音仍遵循原有单条播放。",
    target: "feature-flag",
  },
];

function buildInitialState() {
  return {
    route: "thread",
    featureEnabled: true,
    reviewOpen: false,
    messages: initialMessages.map((message) => ({ ...message })),
    playback: null,
    toast: "",
    activeRule: "FR-001",
    userHasScrolled: false,
  };
}

function canEnterContinuousQueue(message) {
  return Boolean(
    message
      && message.kind === "voice"
      && message.direction === "in"
      && !message.heard
      && !message.transcript
      && !message.deleted
      && !message.unplayable,
  );
}

function getQueue(messages, startId) {
  const startIndex = messages.findIndex((message) => message.id === startId);
  return messages
    .slice(startIndex)
    .filter(canEnterContinuousQueue)
    .map((message) => message.id);
}

function getMessage(messages, id) {
  return messages.find((message) => message.id === id);
}

function App() {
  const [state, setState] = useState(buildInitialState);
  const autoScrollRef = useRef(false);
  const scrollRef = useRef(null);

  const currentMessage = useMemo(
    () => getMessage(state.messages, state.playback?.activeId),
    [state.messages, state.playback?.activeId],
  );

  const queueCount = state.playback?.mode === "continuous"
    ? state.playback.queue.length
    : 0;

  const updateState = (updater) => {
    setState((current) => (
      typeof updater === "function" ? updater(current) : { ...current, ...updater }
    ));
  };

  const clearToast = () => {
    window.setTimeout(() => {
      updateState((current) => (current.toast ? { ...current, toast: "" } : current));
    }, 1600);
  };

  const advanceQueue = (current, completedId) => {
    const remaining = (current.playback?.queue ?? []).filter((id) => id !== completedId);
    const valid = remaining.filter((id) => canEnterContinuousQueue(getMessage(current.messages, id)));
    let skippedFailure = false;

    while (valid.length > 0) {
      const nextId = valid.shift();
      const nextMessage = getMessage(current.messages, nextId);
      if (nextMessage?.failOnAuto) {
        skippedFailure = true;
        continue;
      }
      return {
        ...current,
        playback: {
          activeId: nextId,
          queue: [nextId, ...valid],
          mode: "continuous",
          paused: false,
        },
        toast: skippedFailure ? "语音播放失败，已跳过" : "",
      };
    }

    return {
      ...current,
      playback: null,
      toast: skippedFailure ? "语音播放失败" : "",
    };
  };

  useEffect(() => {
    if (!state.playback || state.playback.paused) return undefined;

    const timer = window.setTimeout(() => {
      updateState((current) => {
        if (!current.playback?.activeId) return current;

        const completedId = current.playback.activeId;
        const completed = getMessage(current.messages, completedId);
        const withHeardState = {
          ...current,
          messages: current.messages.map((message) => (
            message.id === completedId ? { ...message, heard: true } : message
          )),
        };

        if (!completed || current.playback.mode === "single") {
          return { ...withHeardState, playback: null, toast: "" };
        }

        return advanceQueue(withHeardState, completedId);
      });
      clearToast();
    }, PLAY_DURATION_MS);

    return () => window.clearTimeout(timer);
  }, [state.playback?.activeId, state.playback?.mode, state.playback?.paused]);

  useEffect(() => {
    const activeId = state.playback?.activeId;
    if (!activeId || state.userHasScrolled) return;
    const messageNode = document.getElementById(`message-${activeId}`);
    if (!messageNode) return;

    autoScrollRef.current = true;
    messageNode.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const resetTimer = window.setTimeout(() => {
      autoScrollRef.current = false;
    }, 280);
    return () => window.clearTimeout(resetTimer);
  }, [state.playback?.activeId, state.userHasScrolled]);

  useEffect(() => {
    if (state.route !== "thread" || state.playback || !scrollRef.current) return undefined;

    const timer = window.setTimeout(() => {
      const firstUnheard = state.messages.find(canEnterContinuousQueue);
      const target = firstUnheard
        ? document.getElementById(`message-${firstUnheard.id}`)
        : null;
      if (target) {
        target.scrollIntoView({ block: "end", behavior: "auto" });
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [state.route]);

  const handleVoiceClick = (message) => {
    if (message.unplayable || message.deleted) {
      updateState((current) => ({ ...current, toast: "语音暂时无法播放" }));
      clearToast();
      return;
    }

    if (state.playback?.activeId === message.id) {
      updateState((current) => ({
        ...current,
        playback: { ...current.playback, paused: !current.playback.paused },
        toast: "",
      }));
      return;
    }

    const queue = state.featureEnabled && canEnterContinuousQueue(message)
      ? getQueue(state.messages, message.id)
      : [message.id];

    updateState((current) => ({
      ...current,
      userHasScrolled: false,
      toast: "",
      playback: {
        activeId: message.id,
        queue,
        mode: queue.length > 1 ? "continuous" : "single",
        paused: false,
      },
    }));
  };

  const toggleTranscript = () => {
    updateState((current) => ({
      ...current,
      messages: current.messages.map((message) => (
        message.id === "voice-4"
          ? {
            ...message,
            transcript: message.transcript ? "" : "我下午可以陪你练习中文。",
          }
          : message
      )),
    }));
  };

  const toggleFailure = () => {
    updateState((current) => ({
      ...current,
      messages: current.messages.map((message) => (
        message.id === "voice-5"
          ? { ...message, failOnAuto: !message.failOnAuto }
          : message
      )),
    }));
  };

  const leaveThread = () => {
    updateState((current) => ({
      ...current,
      route: "home",
      playback: null,
      toast: "",
      userHasScrolled: false,
    }));
  };

  const openThread = () => {
    updateState((current) => ({ ...current, route: "thread", userHasScrolled: false }));
  };

  const handleManualScroll = () => {
    if (!autoScrollRef.current) {
      updateState((current) => (
        current.userHasScrolled ? current : { ...current, userHasScrolled: true }
      ));
    }
  };

  const selectRule = (id) => {
    updateState((current) => ({ ...current, activeRule: id }));
  };

  const goToRuleTarget = (rule) => {
    selectRule(rule.id);
    window.setTimeout(() => {
      document.getElementById(rule.target)?.scrollIntoView({
        block: "center",
        behavior: "smooth",
      });
    }, 0);
  };

  const toggleFeature = () => {
    updateState((current) => ({
      ...current,
      featureEnabled: !current.featureEnabled,
      playback: null,
      toast: current.featureEnabled ? "已恢复单条播放" : "",
    }));
    clearToast();
  };

  return (
    <main className={`workbench ${state.reviewOpen ? "is-reviewing" : ""}`}>
      <aside className="workbench-panel" aria-label="演示工作台">
        <header className="workbench-title">
          <span>社交 / 聊天</span>
          <h1>未听语音连续播放</h1>
          <p>PRD · FR-001 至 FR-004</p>
        </header>

        <section className="control-block">
          <h2>场景控制</h2>
          <div className="control-list">
            <ControlRow
              id="feature-flag"
              label="客户端灰度"
              hint={state.featureEnabled ? "开启" : "关闭"}
              enabled={state.featureEnabled}
              onClick={toggleFeature}
              reviewOpen={state.reviewOpen}
              reviewRule="FR-004"
              onRule={selectRule}
              activeRule={state.activeRule}
            />
            <ControlRow
              label="第三条自动失败"
              hint={getMessage(state.messages, "voice-5")?.failOnAuto ? "模拟中" : "正常"}
              enabled={Boolean(getMessage(state.messages, "voice-5")?.failOnAuto)}
              onClick={toggleFailure}
            />
            <ControlRow
              label="第二条已转文字"
              hint={getMessage(state.messages, "voice-4")?.transcript ? "已处理" : "未转文字"}
              enabled={Boolean(getMessage(state.messages, "voice-4")?.transcript)}
              onClick={toggleTranscript}
            />
          </div>
        </section>

        <section className="status-block" id="playback-status">
          <span>播放状态</span>
          <strong>{state.playback ? (state.playback.paused ? "已暂停" : "播放中") : "未播放"}</strong>
          <small>
            {state.playback
              ? `${state.playback.mode === "continuous" ? "连续队列" : "单条播放"}${queueCount ? ` · 剩余 ${queueCount} 条` : ""}`
              : (state.featureEnabled ? "连续播放灰度已开启" : "单条播放")}
          </small>
          {currentMessage && <em>{currentMessage.duration}</em>}
        </section>

        <section className="control-block tools-block">
          <h2>演示工具</h2>
          <div className="control-actions">
            <button type="button" onClick={leaveThread}>退出会话</button>
            <button type="button" onClick={() => updateState(buildInitialState)}>重置</button>
            <button
              type="button"
              className={state.reviewOpen ? "review-toggle active" : "review-toggle"}
              onClick={() => updateState((current) => ({
                ...current,
                reviewOpen: !current.reviewOpen,
              }))}
            >
              Review
            </button>
          </div>
        </section>

        {state.reviewOpen && (
          <section className="rule-list" aria-label="PRD 规则">
            <p>需求追溯</p>
            {rules.map((rule, index) => (
              <button
                type="button"
                id={`rule-${rule.id}`}
                key={rule.id}
                className={state.activeRule === rule.id ? "rule-card selected" : "rule-card"}
                onClick={() => goToRuleTarget(rule)}
                aria-pressed={state.activeRule === rule.id}
              >
                <b>{index + 1}</b>
                <span>
                  <strong>{rule.id}</strong>
                  <i>{rule.title}</i>
                  <small>{rule.detail}</small>
                </span>
              </button>
            ))}
          </section>
        )}
      </aside>

      <section className="preview-stage" aria-label="HelloTalk 聊天演示">
        <div className="preview-meta">
          <span>聊天会话</span>
          <strong>{state.featureEnabled ? "连续播放灰度" : "原有单条播放"}</strong>
        </div>
        <PhoneCanvas
          state={state}
          scrollRef={scrollRef}
          onBack={leaveThread}
          onOpenThread={openThread}
          onVoiceClick={handleVoiceClick}
          onScroll={handleManualScroll}
          onRule={selectRule}
        />
      </section>

      {state.reviewOpen && <ReviewConnectors activeRule={state.activeRule} />}
    </main>
  );
}

function ControlRow({
  id,
  label,
  hint,
  enabled,
  onClick,
  reviewOpen,
  reviewRule,
  onRule,
  activeRule,
}) {
  return (
    <div className="control-row-wrap">
      <button type="button" className="control-row" id={id} onClick={onClick}>
        <span>{label}<small>{hint}</small></span>
        <i className={enabled ? "switch is-on" : "switch"} aria-hidden="true"><b /></i>
      </button>
      {reviewOpen && reviewRule && (
        <button
          type="button"
          className="review-marker feature-marker"
          data-review-marker={reviewRule}
          onClick={() => onRule(reviewRule)}
          aria-label={`${reviewRule} 界面标记`}
          aria-pressed={activeRule === reviewRule}
        >
          4
        </button>
      )}
    </div>
  );
}

function PhoneCanvas({
  state,
  scrollRef,
  onBack,
  onOpenThread,
  onVoiceClick,
  onScroll,
  onRule,
}) {
  return (
    <div className="phone-canvas">
      {state.route === "thread" ? (
        <ChatThread
          state={state}
          scrollRef={scrollRef}
          onBack={onBack}
          onVoiceClick={onVoiceClick}
          onScroll={onScroll}
          onRule={onRule}
        />
      ) : (
        <ChatHome onOpenThread={onOpenThread} />
      )}
      {state.toast && <div className="toast" role="status">{state.toast}</div>}
    </div>
  );
}

function ChatThread({ state, scrollRef, onBack, onVoiceClick, onScroll, onRule }) {
  return (
    <div className="app-screen thread-screen">
      <StatusBar />
      <header className="thread-header">
        <button type="button" className="nav-icon back" aria-label="返回聊天列表" onClick={onBack} />
        <div className="thread-profile">
          <strong>L10 <b>VIP+</b><i aria-hidden="true">✦</i></strong>
          <span>14:28</span>
        </div>
        <div className="thread-actions">
          <button type="button" className="nav-icon call" aria-label="语音通话" />
          <button type="button" className="nav-icon more" aria-label="更多聊天设置" />
        </div>
      </header>
      <div className="thread-content" ref={scrollRef} onScroll={onScroll}>
        <div className="message-stack">
          {state.messages.map((message) => (
            <ChatMessage
              message={message}
              playback={state.playback}
              reviewOpen={state.reviewOpen}
              activeRule={state.activeRule}
              onVoiceClick={onVoiceClick}
              onRule={onRule}
              key={message.id}
            />
          ))}
        </div>
      </div>
      <Composer />
    </div>
  );
}

function ChatMessage({
  message,
  playback,
  reviewOpen,
  activeRule,
  onVoiceClick,
  onRule,
}) {
  if (message.kind === "note") {
    return <div className="chat-note">{message.text}</div>;
  }

  if (message.kind === "promo") {
    return (
      <div id={`message-${message.id}`} className={`chat-row promo-row ${message.direction === "out" ? "outgoing" : "incoming"}`}>
        {message.direction === "in" && <Avatar kind="mia" />}
        <div className={`promo-bubble ${message.variant}`}>
          <div className="promo-art" aria-hidden="true">
            <span>{message.variant === "profile" ? "HT" : "AI"}</span>
          </div>
          <div className="promo-copy">
            <strong>{message.title}</strong>
            <span>{message.subtitle}</span>
          </div>
          <i className="promo-arrow" aria-hidden="true" />
        </div>
      </div>
    );
  }

  if (message.kind === "link") {
    return (
      <div id={`message-${message.id}`} className="chat-row outgoing">
        <div className="message-bubble link-message">{message.text}</div>
      </div>
    );
  }

  if (message.kind === "text") {
    return (
      <div id={`message-${message.id}`} className={`chat-row ${message.direction === "out" ? "outgoing" : "incoming"}`}>
        {message.direction === "in" && <Avatar kind="mia" />}
        <div className="message-bubble text-message">{message.text}</div>
      </div>
    );
  }

  const active = playback?.activeId === message.id;
  const paused = active && playback?.paused;
  const targetRule = message.id === "voice-1"
    ? "FR-001"
    : message.id === "voice-3"
      ? "FR-002"
      : message.id === "voice-4"
        ? "FR-003"
        : null;

  return (
    <div id={`message-${message.id}`} className="voice-row-wrap">
      <div className={`chat-row ${message.direction === "out" ? "outgoing" : "incoming"}`}>
        {message.direction === "in" && <Avatar kind="mia" />}
        <div className="voice-message">
          <button
            type="button"
            className={active ? "voice-bubble is-playing" : "voice-bubble"}
            onClick={() => onVoiceClick(message)}
            aria-label={`语音 ${message.duration}，${active ? (paused ? "继续播放" : "暂停播放") : "播放"}`}
          >
            <span className={active && !paused ? "voice-pause" : "voice-play"} aria-hidden="true" />
            <span className="voice-length">{message.duration}</span>
            {!message.heard && <i className="unheard" aria-label="未听" />}
            {active && <i className="voice-progress" aria-hidden="true" />}
          </button>
          {message.transcript && <p className="transcript">{message.transcript}</p>}
        </div>
        {reviewOpen && targetRule && (
          <button
            type="button"
            className="review-marker"
            data-review-marker={targetRule}
            onClick={() => onRule(targetRule)}
            aria-label={`${targetRule} 界面标记`}
            aria-pressed={activeRule === targetRule}
          >
            {targetRule === "FR-001" ? "1" : targetRule === "FR-002" ? "2" : "3"}
          </button>
        )}
      </div>
    </div>
  );
}

function Composer() {
  return (
    <footer className="composer">
      <div className="composer-line">
        <button type="button" className="composer-input" aria-label="输入消息">输入消息...</button>
        <button type="button" aria-label="语音输入" className="composer-icon">
          <img src="/ht-assets/mic.png" alt="" />
        </button>
      </div>
      <div className="composer-tools">
        <button type="button" aria-label="更多功能"><img src="/ht-assets/plus.png" alt="" /></button>
        <button type="button" aria-label="发送图片"><img src="/ht-assets/photo.png" alt="" /></button>
        <button type="button" aria-label="打开表情"><img src="/ht-assets/emoji.png" alt="" /></button>
        <button type="button" aria-label="礼物"><img src="/ht-assets/composer_gift.png" alt="" /></button>
        <button type="button" aria-label="翻译"><img src="/ht-assets/translate.png" alt="" /></button>
        <button type="button" aria-label="常用语"><img src="/ht-assets/composer_phrases.png" alt="" /></button>
      </div>
    </footer>
  );
}

function ChatHome({ onOpenThread }) {
  return (
    <div className="app-screen chat-home">
      <StatusBar variant="home" />
      <img className="home-header-image" src="/ht-assets/chat_home_header.png" alt="" />
      <div className="home-row-stack" aria-label="聊天列表">
        <button
          type="button"
          className="home-row-button"
          aria-label="打开聊天：你是一个好人"
          onClick={onOpenThread}
        >
          <img src="/ht-assets/chat_home_row_1.png" alt="" />
        </button>
        {["2", "3", "4", "5", "6"].map((row) => (
          <img
            key={row}
            className="home-row-image"
            src={`/ht-assets/chat_home_row_${row}.png`}
            alt=""
          />
        ))}
      </div>
      <img className="home-bottom-tabs" src="/ht-assets/bottom_tab_chat_active.png" alt="" />
    </div>
  );
}

function Avatar({ kind }) {
  return <img className="message-avatar" src={`/ht-assets/${kind === "mia" ? "chat_avatar_4.png" : "ava-me.png"}`} alt="" />;
}

function StatusBar({ variant = "thread" }) {
  return (
    <div className="status-bar" aria-label="系统状态栏">
      <img
        src={variant === "home" ? "/ht-assets/status_chat_home.png" : "/ht-assets/status_thread_default.png"}
        alt=""
      />
    </div>
  );
}

function ReviewConnectors({ activeRule }) {
  const [paths, setPaths] = useState([]);

  useEffect(() => {
    const renderPaths = () => {
      const nextPaths = rules.flatMap((rule) => {
        const source = document.getElementById(`rule-${rule.id}`);
        const target = document.getElementById(rule.target);
        if (!source || !target) return [];

        const from = source.getBoundingClientRect();
        const to = target.getBoundingClientRect();
        const startX = from.right;
        const startY = from.top + from.height / 2;
        const endX = to.left + Math.min(14, to.width / 2);
        const endY = to.top + Math.min(14, to.height / 2);
        const distance = Math.max(60, (endX - startX) * 0.42);

        return [{
          id: rule.id,
          d: `M ${startX} ${startY} C ${startX + distance} ${startY}, ${endX - distance} ${endY}, ${endX} ${endY}`,
        }];
      });
      setPaths(nextPaths);
    };

    const frame = window.requestAnimationFrame(renderPaths);
    window.addEventListener("resize", renderPaths);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", renderPaths);
    };
  }, [activeRule]);

  return (
    <div className="review-connectors" aria-hidden="true">
      <svg viewBox={`0 0 ${window.innerWidth} ${window.innerHeight}`} preserveAspectRatio="none">
        {paths.map((path) => (
          <path key={path.id} d={path.d} className={path.id === activeRule ? "active-path" : "quiet-path"} />
        ))}
      </svg>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
