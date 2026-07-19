# FixkrVD

*Fixkr Video Downloader*

> A simple backend server that provides endpoints for downloading videos using [yt-dlp](https://github.com/yt-dlp/yt-dlp) from various platforms.

> [!IMPORTANT]
> Most comments, responses, and logs are written in Indonesian. Feel free to translate them if needed.

## Requirements

* Python 3.11
* [yt-dlp](https://github.com/yt-dlp/yt-dlp) — latest version recommended

> [!WARNING]
> Make sure you are using the latest version of `yt-dlp`. The backend may not work correctly with an outdated version.

### Install yt-dlp

```bash
python3.11 -m pip install -U yt-dlp
```

### Check the yt-dlp version

```bash
yt-dlp --version
```

## Verify the yt-dlp Installation

Make sure that `yt-dlp` is using the Python 3.11 environment.

To check the location of the executable:

```bash
which yt-dlp
```

The output should look similar to:

```console
/home/<user>/.local/bin/yt-dlp
```

## How to Run

Clone the repository and install the required dependencies:

```bash
git clone https://github.com/Muvikri/fixkrVD.git
cd fixkrVD

npm install
python3.11 -m pip install -U yt-dlp

npm start
```
