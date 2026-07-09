// 폴링 스케줄 — 기본 90초. 실패 시 마지막 데이터 유지 + stale 플래그로 알림.

const { EventEmitter } = require("events");
const { getUsage } = require("./api");

class Poller extends EventEmitter {
  constructor(intervalMs = 90_000) {
    super();
    this.intervalMs = intervalMs;
    this.timer = null;
    this.lastData = null;
  }

  start() {
    this.tick();
    this.timer = setInterval(() => this.tick(), this.intervalMs);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  setIntervalMs(intervalMs) {
    if (this.intervalMs === intervalMs) return;
    this.intervalMs = intervalMs;
    if (this.timer) {
      this.stop();
      this.start();
    }
  }

  async tick() {
    try {
      const data = await getUsage();
      this.lastData = data;
      this.emit("update", { data, stale: false, error: null });
    } catch (err) {
      const code = err.code || "UNKNOWN_ERROR";
      this.emit("update", { data: this.lastData, stale: !!this.lastData, error: code });

      if (code === "RATE_LIMITED") {
        this.pauseFor((err.retryAfterSec || 30) * 1000);
      }
    }
  }

  pauseFor(ms) {
    this.stop();
    setTimeout(() => this.start(), ms);
  }
}

module.exports = Poller;
