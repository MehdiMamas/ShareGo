set shell := ["bash", "-eu", "-o", "pipefail", "-c"]

run:
	flutter run

test:
	flutter analyze
	flutter test

build-android:
	flutter build apk --release

build-ios:
	flutter build ios --release --no-codesign

build-macos:
	flutter build macos --release

build-windows:
	flutter build windows --release

build-linux:
	flutter build linux --release
