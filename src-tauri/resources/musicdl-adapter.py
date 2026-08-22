#!/usr/bin/env python3
"""Bridge an externally installed musicdl package to MAD Toolbox.

This file contains no musicdl source code. It only calls musicdl's documented
public Python API so search results can be selected in the app GUI.
"""

import json
import os
import pickle
import shutil
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

from musicdl import musicdl


LOSSLESS_EXTENSIONS = {"flac", "wav", "alac", "ape", "wv", "tta", "dsf", "dff"}
DOWNSAMPLE_TARGET_RATE = 48000
# 搜索阶段只对头部可解析的无损格式做远端采样率探测；其余格式保持 None，不显示估算
PROBE_SAMPLE_RATE_EXTENSIONS = {"flac", "wav"}
PROBE_HEAD_BYTES = 8192
PROBE_WORKERS = 6


def build_client(request, work_dir_override=None):
    sources = request.get("musicSources") or []
    init_cfg = request.get("initMusicClientsCfg") or {}
    output_directory = work_dir_override or request.get("outputDirectory")
    search_size = max(1, min(int(request.get("searchSizePerSource") or 5), 100))
    for source in sources:
        source_cfg = init_cfg.setdefault(source, {})
        source_cfg.setdefault("search_size_per_source", search_size)
        if output_directory:
            source_cfg["work_dir"] = output_directory
    return musicdl.MusicClient(
        music_sources=sources,
        init_music_clients_cfg=init_cfg,
        clients_threadings=request.get("clientsThreadings") or {},
        requests_overrides=request.get("requestsOverrides") or {},
        search_rules=request.get("searchRules") or {},
    )


def integer_or_none(value):
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def float_or_none(value):
    try:
        return float(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def flac_head_sample_rate(head):
    # "fLaC" + 块头 4 字节，首块必须是 STREAMINFO；采样率是其第 10 字节起的高 20 位
    if len(head) < 21 or head[:4] != b"fLaC" or head[4] & 0x7F != 0:
        return None
    return (head[18] << 12) | (head[19] << 4) | (head[20] >> 4)


def wav_head_sample_rate(head):
    if len(head) < 44 or head[:4] != b"RIFF" or head[8:12] != b"WAVE":
        return None
    offset = 12
    while offset + 8 <= len(head):
        chunk_id = head[offset : offset + 4]
        chunk_size = int.from_bytes(head[offset + 4 : offset + 8], "little")
        # fmt 块数据段：audioFormat(2B) + numChannels(2B) + sampleRate(4B)
        if chunk_id == b"fmt ":
            if offset + 16 > len(head):
                return None
            return int.from_bytes(head[offset + 12 : offset + 16], "little")
        offset += 8 + chunk_size + (chunk_size & 1)
    return None


def fetch_head_bytes(url):
    """拉取远端文件前 8KB；CDN 瞬时抖动（限流/慢启动）重试一次。"""
    for attempt in (1, 2):
        try:
            response = requests.get(
                url,
                headers={"User-Agent": "Mozilla/5.0"},
                stream=True,
                timeout=(3, 8),
            )
        except Exception as error:
            print(f"sample-rate probe failed (attempt {attempt}): {error}", file=sys.stderr)
            continue
        with response:
            if response.status_code == 200:
                return next(response.iter_content(PROBE_HEAD_BYTES), b"")
            print(
                f"sample-rate probe: HTTP {response.status_code} (attempt {attempt})",
                file=sys.stderr,
            )
        time.sleep(0.5)
    return None


def probe_remote_sample_rate(song):
    """流式读取下载链接前 8KB，从文件头解析真实采样率。"""
    url = getattr(song, "download_url", None)
    if not isinstance(url, str) or not url.startswith(("http://", "https://")):
        return None
    head = fetch_head_bytes(url)
    if not head:
        return None
    extension = str(song.ext or "").removeprefix(".").lower()
    if extension == "flac":
        return flac_head_sample_rate(head)
    return wav_head_sample_rate(head)


def probe_lossless_sample_rates(songs):
    """音源 API 不提供采样率（仅下载后读标签才有），而去杂提示依赖它。

    搜索完成后并发探测 flac/wav 结果；单个失败只保持 samplerate=None，不阻塞搜索。
    """
    targets = [
        song
        for song in songs
        if getattr(song, "samplerate", None) is None
        and str(song.ext or "").removeprefix(".").lower() in PROBE_SAMPLE_RATE_EXTENSIONS
    ]
    if not targets:
        return
    with ThreadPoolExecutor(max_workers=min(PROBE_WORKERS, len(targets))) as pool:
        futures = {pool.submit(probe_remote_sample_rate, song): song for song in targets}
        for future in as_completed(futures):
            try:
                sample_rate = future.result()
            except Exception as error:
                print(f"sample-rate probe failed: {error}", file=sys.stderr)
                continue
            if sample_rate:
                futures[future].samplerate = sample_rate


def display_result(index, song):
    extension = str(song.ext or "").removeprefix(".").lower()
    cover_url = song.cover_url if isinstance(song.cover_url, str) else None
    return {
        "index": index,
        "songName": str(song.song_name or "未知曲名"),
        "singers": str(song.singers or "未知歌手"),
        "album": str(song.album or ""),
        "extension": extension,
        "fileSize": str(song.file_size or ""),
        "fileSizeBytes": float_or_none(song.file_size_bytes),
        "duration": str(song.duration or ""),
        "bitrate": integer_or_none(song.bitrate),
        "codec": str(song.codec or ""),
        "sampleRate": integer_or_none(song.samplerate),
        "channels": integer_or_none(song.channels),
        "source": str(song.source or ""),
        "rootSource": str(song.root_source or ""),
        "coverUrl": cover_url,
        "lossless": extension in LOSSLESS_EXTENSIONS,
    }


def download_threadings(request):
    threadings = request.get("clientsThreadings") or {}
    values = [
        value for value in threadings.values() if isinstance(value, int) and value > 0
    ]
    return max(values, default=5)


def downsample_if_needed(song):
    save_path = getattr(song, "save_path", None)
    if not save_path or not os.path.isfile(save_path):
        return
    ffprobe = shutil.which("ffprobe")
    ffmpeg = shutil.which("ffmpeg")
    if not ffprobe or not ffmpeg:
        print("downsample skipped: ffmpeg/ffprobe not found", file=sys.stderr)
        return
    probe = subprocess.run(
        [
            ffprobe,
            "-v",
            "error",
            "-select_streams",
            "a:0",
            "-show_entries",
            "stream=sample_rate",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            save_path,
        ],
        capture_output=True,
        text=True,
    )
    try:
        sample_rate = int(probe.stdout.strip())
    except ValueError:
        return
    if sample_rate <= DOWNSAMPLE_TARGET_RATE:
        return
    stem, extension = os.path.splitext(save_path)
    temp_path = f"{stem}.downsampling{extension}"
    convert = subprocess.run(
        [
            ffmpeg,
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            save_path,
            "-ar",
            str(DOWNSAMPLE_TARGET_RATE),
            temp_path,
        ],
        capture_output=True,
        text=True,
    )
    if convert.returncode != 0 or not os.path.isfile(temp_path):
        print(
            f"downsample failed: {os.path.basename(save_path)}: {convert.stderr.strip()}",
            file=sys.stderr,
        )
        return
    os.replace(temp_path, save_path)
    print(
        f"downsampled: {os.path.basename(save_path)} {sample_rate}Hz -> {DOWNSAMPLE_TARGET_RATE}Hz",
        flush=True,
    )


def download_flat(client, songs, output_directory, num_threadings, downsample=False):
    if not output_directory:
        raise RuntimeError("Missing music output directory.")
    os.makedirs(output_directory, exist_ok=True)
    for song in songs:
        song.work_dir = output_directory
        song._save_path = None
    # 逐首提交下载：每完成一首打印 musicdl-progress 行，宿主据此更新任务卡进度条；
    # 单首失败不中断整批，全部失败才报错
    downloaded = []
    with ThreadPoolExecutor(max_workers=num_threadings) as pool:
        futures = [pool.submit(client.download, [song]) for song in songs]
        for completed, future in enumerate(as_completed(futures), 1):
            try:
                finished = future.result()
                if downsample:
                    for song in finished:
                        downsample_if_needed(song)
                downloaded.extend(finished)
            except Exception as error:
                print(f"download failed: {error}", file=sys.stderr)
            print(f"musicdl-progress: {completed}/{len(songs)}", flush=True)
    if not downloaded:
        raise RuntimeError("musicdl did not download any music.")
    metadata_path = os.path.join(output_directory, "download_results.pkl")
    if os.path.isfile(metadata_path):
        os.remove(metadata_path)
    return downloaded


def search(request_path, state_path):
    with open(request_path, "r", encoding="utf-8") as handle:
        request = json.load(handle)
    staging_directory = os.path.join(os.path.dirname(state_path), "staging")
    os.makedirs(staging_directory, mode=0o700, exist_ok=True)
    client = build_client(request, staging_directory)
    grouped_results = client.search(keyword=request["keyword"])
    songs = []
    for per_source_results in grouped_results.values():
        for song in per_source_results:
            if song.episodes:
                songs.extend(song.episodes)
            else:
                songs.append(song)
    probe_lossless_sample_rates(songs)
    with open(state_path, "wb") as handle:
        pickle.dump({"request": request, "songs": songs}, handle)
    os.chmod(state_path, 0o600)
    shutil.rmtree(staging_directory, ignore_errors=True)
    results = [display_result(index, song) for index, song in enumerate(songs)]
    print(json.dumps({"results": results}, ensure_ascii=False, separators=(",", ":")))


def download(state_path, selected_json, downsample=False):
    with open(state_path, "rb") as handle:
        state = pickle.load(handle)
    selected_indices = json.loads(selected_json)
    songs = state["songs"]
    selected = [songs[index] for index in selected_indices if 0 <= index < len(songs)]
    if not selected:
        raise RuntimeError("No valid music items were selected.")
    output_directory = state["request"].get("outputDirectory")
    client = build_client(
        state["request"], os.path.join(os.path.dirname(state_path), "staging")
    )
    downloaded = download_flat(
        client,
        selected,
        output_directory,
        download_threadings(state["request"]),
        downsample,
    )
    shutil.rmtree(
        os.path.join(os.path.dirname(state_path), "staging"), ignore_errors=True
    )
    print(
        f"musicdl completed: {len(downloaded)} item(s) exported directly to "
        f"{output_directory}."
    )


def playlist(request_path):
    with open(request_path, "r", encoding="utf-8") as handle:
        request = json.load(handle)
    session_directory = os.path.dirname(request_path)
    staging_directory = os.path.join(session_directory, "staging")
    os.makedirs(staging_directory, mode=0o700, exist_ok=True)
    client = build_client(request, staging_directory)
    songs = client.parseplaylist(request["playlistUrl"])
    if not songs:
        raise RuntimeError("musicdl could not parse any music from this playlist.")
    downloaded = download_flat(
        client,
        songs,
        request.get("outputDirectory"),
        download_threadings(request),
        bool(request.get("downsample")),
    )
    shutil.rmtree(staging_directory, ignore_errors=True)
    print(
        f"musicdl completed: {len(downloaded)} playlist item(s) exported directly "
        f"to {request['outputDirectory']}."
    )


def main():
    if len(sys.argv) < 2:
        raise RuntimeError("Missing adapter operation.")
    if sys.argv[1] == "search" and len(sys.argv) == 4:
        search(sys.argv[2], sys.argv[3])
    elif sys.argv[1] == "download" and len(sys.argv) in (4, 5):
        download(
            sys.argv[2],
            sys.argv[3],
            sys.argv[4] == "downsample" if len(sys.argv) == 5 else False,
        )
    elif sys.argv[1] == "playlist" and len(sys.argv) == 3:
        playlist(sys.argv[2])
    else:
        raise RuntimeError("Invalid adapter arguments.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1)
