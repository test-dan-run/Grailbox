#!/usr/bin/env bash
# Android System UI demo mode: a fixed clock, full battery and signal, and no
# notification icons, so the recordings don't show the time of day.
# Usage: statusbar.sh on|off
set -euo pipefail

demo() { adb shell am broadcast -a com.android.systemui.demo -e command "$@" >/dev/null; }

case "${1:-}" in
  on)
    adb shell settings put global sysui_demo_allowed 1
    demo enter
    demo clock -e hhmm 0941
    demo battery -e level 100 -e plugged false
    demo network -e wifi show -e level 4
    demo network -e mobile show -e datatype none -e level 4
    demo notifications -e visible false
    ;;
  off)
    demo exit
    ;;
  *)
    echo "Usage: $0 on|off" >&2
    exit 2
    ;;
esac
