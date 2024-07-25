# TinyFlux - A Browser Extension for Miniflux

TinyFlux is a small, lightweight Miniflux client that allows users to easily read their subscriptions within the context of their web browser. It features a clean and minimalistic interface, making it easy to navigate and use.

![Tinyflux Screenshot](assets/snapshots/tinyflux.gif)

## Features

- Simple and intuitive user interface
- Browser extension badge to indicate unread items
- Browser extension compatible with all modern browsers (Chrome, Firefox, Edge, etc.)
- Read the whole article without opening a new tab or window.
- Bookmarking articles to read them later.
- Mark as read when clicking on the "Mark as Read" button.

## Requirements

A Miniflux instance is required to use this extension. You can use the [official Docker image](https://hub.docker.com/r/miniflux/miniflux) to run a Miniflux instance on your own server [(Miniflux Installation with Docker)](https://miniflux.app/docs/docker.html), or publicly available instances such as [Miniflux Cloud](https://reader.miniflux.app/).

```console
$ docker run -d \
    --restart=unless-stopped \
    --name miniflux-db \
    -e POSTGRES_USER=miniflux \
    -e POSTGRES_PASSWORD=miniflux \
    -e POSTGRES_DB=miniflux \
    -v miniflux-db:/var/lib/postgresql/data \
    postgres

$ # Remember to change the username and password
$ docker run -d \
    --restart=unless-stopped \
    --name miniflux \
    --link miniflux-db:postgres \
    -p 8080:8080 \
    -e "DATABASE_URL=postgres://miniflux:miniflux@postgres/miniflux?sslmode=disable" \
    -e "RUN_MIGRATIONS=1" \
    -e "CREATE_ADMIN=1" \
    -e "ADMIN_USERNAME=admin" \
    -e "ADMIN_PASSWORD=password" \
    miniflux/miniflux
```

Create a Miniflux API token for this extension:
![How to create an API token](assets/snapshots/minyflux-how-to-create-api-token.gif)

## Getting Started

1. Download the latest release of TinyFlux from the [Releases](https://github.com/jlsalvador/tinyflux/releases) page.
2. Install the downloaded file as a browser extension in your web browser (e.g., Chrome, Firefox, Edge).
3. If prompted, enter your Miniflux API endpoint URL and token.
4. Once logged in, you can show your feeds from within TinyFlux.

## Installation from sources

1. Clone this repository
2. `npm ci`
3. `npm run build`
4. Install the browser extension from the folder `dist`.
   1. Firefox: `about:debugging` → `This Firefox` → `Load Temporary Add-on...` → Choose file `dist/tinyflux.version.xpi`.
   2. Chromium: `about:extensions` → `Load unpacked` → Choose directory `dist/chromium`.
