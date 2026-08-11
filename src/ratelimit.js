export class RateLimiter {
  constructor({ intervalMs = 60000, maxRepliesPerWindow = 20 } = {}) {
    this.intervalMs = intervalMs;
    this.max = maxRepliesPerWindow;
    this.windowStart = Date.now();
    this.count = 0;
  }

  allow() {
    const now = Date.now();
    if (now - this.windowStart >= this.intervalMs) {
      this.windowStart = now;
      this.count = 0;
    }
    if (this.count < this.max) {
      this.count += 1;
      return true;
    }
    return false;
  }
}
