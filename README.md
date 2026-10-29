# Herdr Bridge

A small [Pi](https://pi.dev) extension that reports waiting for user input to
[Herdr](https://herdr.dev). Herdr handles sounds, notifications and sidebar status.

## Install

```sh
herdr integration install pi
pi install npm:pi-herdr-bridge
```

Restart Pi or run `/reload`.

## Scope

- Covers extension dialogs using Pi's `select`, `confirm`, `input`, `editor` or
  `custom` UI methods, not limited to specific plugins.
- Requires Pi's `ui_prompt_start` / `ui_prompt_end` events and Herdr's Pi integration
  with `herdr:blocked` support. Runs only in interactive TUI mode inside Herdr.
- No runtime dependencies, prompt logging or permission changes. Does not detect
  network stalls or hung commands. Herdr's settings decide when alerts appear.

Tested with Pi 1.4.0 and Herdr 0.9.3 (Pi integration v8).

---

## 中文

一个轻量 Pi 扩展：将交互界面的等待状态传给 Herdr。
声音、通知和侧边栏显示仍由 Herdr 处理。

### 安装

```sh
herdr integration install pi
pi install npm:pi-herdr-bridge
```

重启 Pi 或执行 `/reload`。

### 范围

- 覆盖使用 Pi 标准 `select`、`confirm`、`input`、`editor`、`custom` UI
  接口的扩展，不限于特定插件。
- 需要 Pi 的 `ui_prompt_start` / `ui_prompt_end` 事件，以及支持
  `herdr:blocked` 的 Herdr Pi 集成。仅在 Herdr 内的交互式 TUI 中运行。
- 无运行时依赖，不记录提示内容，不改变权限规则。不检测网络卡顿或命令挂起。
  是否发出提醒由 Herdr 设置决定。

已在 Pi 1.4.0、Herdr 0.9.3（Pi 集成 v8）中实测。

[MIT](LICENSE)
