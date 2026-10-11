#!/usr/bin/env bash
# App Store screenshots. Runs tool/store_shots.dart on the largest iPhone and
# iPad simulators and saves what the simulator shows, status bar included.
# Build first: flutter build ios --simulator --debug -t tool/store_shots.dart
set -euo pipefail

app=build/ios/iphonesimulator/Runner.app
bundle=com.mehdimamas.sharego
out=${1:-store-shots}
mkdir -p "$out"

# newest iOS runtime, highest model number among the names that match
udid_for() {
  xcrun simctl list devices available -j | python3 -c '
import json, re, sys
pattern = re.compile(sys.argv[1])
found = []
for runtime, devices in json.load(sys.stdin)["devices"].items():
    if ".iOS-" not in runtime:
        continue
    version = [int(n) for n in re.findall(r"\d+", runtime.split(".iOS-")[1])]
    for d in devices:
        if pattern.search(d["name"]):
            model = [int(n) for n in re.findall(r"\d+", d["name"])]
            found.append((version, model, d["name"], d["udid"]))
if not found:
    sys.exit("no simulator matches " + sys.argv[1])
found.sort()
print(found[-1][3])
print(found[-1][2], file=sys.stderr)
' "$1"
}

shoot() {
  local name=$1 udid=$2 stage="" n=0
  xcrun simctl boot "$udid" 2>/dev/null || true
  xcrun simctl bootstatus "$udid" -b > /dev/null
  # first-boot notifications (Apple Intelligence and the like) come and go here
  sleep 90
  xcrun simctl status_bar "$udid" override --time 9:41 --dataNetwork wifi --wifiMode active \
    --wifiBars 3 --cellularMode active --cellularBars 4 --batteryState charged --batteryLevel 100
  xcrun simctl install "$udid" "$app"
  xcrun simctl launch "$udid" "$bundle"
  local tmp
  tmp="$(xcrun simctl get_app_container "$udid" "$bundle" data)/tmp"
  local deadline=$((SECONDS + 180))
  while [ "$SECONDS" -lt "$deadline" ]; do
    if [ -f "$tmp/stage" ]; then
      stage=$(cat "$tmp/stage")
      [ "$stage" = done ] && break
      n=$((n + 1))
      xcrun simctl io "$udid" screenshot "$out/$name-$n-$stage.png"
      rm "$tmp/stage"
    fi
    sleep 1
  done
  xcrun simctl shutdown "$udid"
  if [ "$stage" != done ]; then
    echo "$name: timed out after $n screenshots" >&2
    return 1
  fi
}

shoot iphone "$(udid_for '^iPhone \d+ Pro Max$')"
shoot ipad "$(udid_for '^iPad Pro 13-inch')"
ls -l "$out"
