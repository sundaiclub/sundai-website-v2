#!/usr/bin/env bash

set -euo pipefail

if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo "Usage: $0 <screenshot-directory> [name-prefix]" >&2
  exit 1
fi

source_dir="$1"

if [[ ! -d "$source_dir" ]]; then
  echo "Screenshot directory not found: $source_dir" >&2
  exit 1
fi

source_dir="$(realpath "$source_dir")"

default_prefix="$(basename "$source_dir")"
name_prefix="${2:-${default_prefix:-playwright-session}}"
seconds_per_image="${PLAYWRIGHT_STITCH_SECONDS_PER_IMAGE:-3}"
output_fps="${PLAYWRIGHT_STITCH_OUTPUT_FPS:-30}"

# Per-image durations can be supplied via a manifest file. Each non-blank,
# non-comment line takes the form:
#   <filename> <seconds>
# where <filename> is the basename of a screenshot in the source directory.
# Any image not listed falls back to $seconds_per_image. The manifest path
# defaults to "<source_dir>/durations.txt" and can be overridden with the
# PLAYWRIGHT_STITCH_DURATIONS_FILE environment variable.
declare -A durations_map
durations_file="${PLAYWRIGHT_STITCH_DURATIONS_FILE:-$source_dir/durations.txt}"
if [[ -f "$durations_file" ]]; then
  while IFS= read -r raw_line || [[ -n "$raw_line" ]]; do
    line="${raw_line%%#*}"
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"
    [[ -z "$line" ]] && continue
    key="${line%%[[:space:]]*}"
    value="${line#"$key"}"
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
    if [[ -z "$value" ]]; then
      echo "Skipping malformed durations line: $raw_line" >&2
      continue
    fi
    durations_map["$key"]="$value"
  done < "$durations_file"
fi

script_path="${BASH_SOURCE[0]}"
if [[ "$script_path" != /* ]]; then
  script_path="${PWD%/}/$script_path"
fi
script_dir="${script_path%/*}"
project_root="${script_dir%/*}"
target_dir="$project_root/test_videos"
mkdir -p "$target_dir"

timestamp="$(date +%Y%m%d-%H%M%S)"
safe_prefix="$(printf '%s' "$name_prefix" | tr ' /' '--' | tr -cd '[:alnum:]_.-')"
target_path="$target_dir/${safe_prefix}-${timestamp}.mp4"

concat_file="$(mktemp)"

escape_for_ffconcat() {
  printf '%s' "$1" | sed "s/'/'\\\\''/g"
}

mapfile -t images < <(
  find "$source_dir" -maxdepth 1 -type f \
    \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.webp' \) \
    | LC_ALL=C sort
)

if [[ "${#images[@]}" -eq 0 ]]; then
  echo "No screenshots found in: $source_dir" >&2
  exit 1
fi

max_w=0
max_h=0
for image in "${images[@]}"; do
  dims="$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0:s=x "$image")"
  w="${dims%x*}"
  h="${dims#*x}"
  if [[ "$w" =~ ^[0-9]+$ && "$h" =~ ^[0-9]+$ ]]; then
    (( w > max_w )) && max_w=$w
    (( h > max_h )) && max_h=$h
  fi
done

if (( max_w == 0 || max_h == 0 )); then
  echo "Failed to determine canvas dimensions from input images." >&2
  exit 1
fi

(( max_w % 2 == 1 )) && max_w=$((max_w + 1))
(( max_h % 2 == 1 )) && max_h=$((max_h + 1))

clip_dir="$(mktemp -d)"
trap 'rm -f "$concat_file"; rm -rf "$clip_dir"' EXIT

clip_index=0
for image in "${images[@]}"; do
  base="$(basename "$image")"
  dur="${durations_map[$base]:-$seconds_per_image}"
  clip_path="$clip_dir/$(printf '%04d' "$clip_index").mp4"
  ffmpeg \
    -hide_banner \
    -loglevel error \
    -y \
    -loop 1 \
    -framerate "$output_fps" \
    -i "$image" \
    -t "$dur" \
    -vf "scale=${max_w}:${max_h}:force_original_aspect_ratio=decrease,pad=${max_w}:${max_h}:(ow-iw)/2:(oh-ih)/2:color=black,format=yuv420p" \
    -c:v libx264 \
    -pix_fmt yuv420p \
    -r "$output_fps" \
    "$clip_path"
  printf "file '%s'\n" "$(escape_for_ffconcat "$clip_path")" >> "$concat_file"
  clip_index=$((clip_index + 1))
done

ffmpeg \
  -hide_banner \
  -loglevel error \
  -y \
  -f concat \
  -safe 0 \
  -i "$concat_file" \
  -c copy \
  -movflags +faststart \
  "$target_path"

echo "$target_path"
