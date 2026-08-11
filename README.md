# ![Logo](./assets/icon-light-32x32.png) Tinyflux – A browser extension for Miniflux

Tinyflux is a lightweight browser extension for [Miniflux](https://miniflux.app/),
offering a clean reading experience directly in your browser.

[![Download from Chrome Web Store](https://img.shields.io/chrome-web-store/v/ffhphofcfffnehjhcmmgnfolidhdfenl?logo=google-chrome&logoColor=white&style=for-the-badge)](https://chromewebstore.google.com/detail/tinyflux/ffhphofcfffnehjhcmmgnfolidhdfenl)
[![Download from Mozilla Add-on](https://img.shields.io/amo/v/tinyflux?logo=firefox-browser&logoColor=white&style=for-the-badge)](https://addons.mozilla.org/es/firefox/addon/tinyflux)

![Tinyflux Screenshot](assets/snapshots/tinyflux.gif)

## ✨ Features

- **Intuitive Interface:**
  Simple and easy to navigate.
- **Unread Count Badge:**
  View unread items directly from the extension icon.
- **Cross-Browser Support:**
  Compatible with Chrome, Firefox, Edge, and other modern browsers.
- **In-Browser Reading:**
  Read full articles without opening new tabs or windows.
- **Optional Notifications:**
  Stay updated with notifications for new items.
- **Optional Sidebar Integration:**
  Access your feeds in a dedicated sidebar for better multitasking.
- **Multi-Language Support:**
  Available in English, Spanish, Chinese, French, and German.
- **Dark and Light Modes:**
  Toggle between themes based on your preference.
- **Bookmarks:**
  Save articles to read later.
- **Quick Actions:**
  Mark items as read with one click.

## 🧩 Requirements

To use Tinyflux, you need a running Miniflux instance. You can either:

- **Use a public instance**, like [Miniflux Cloud](https://reader.miniflux.app/).
- **Self-host** using the [official Miniflux Docker image](https://hub.docker.com/r/miniflux/miniflux).

<details>
<summary><strong>Click here to see how to run Miniflux with 🐳 Docker Compose</strong></summary>

Create a `compose.yaml` file:

```yaml
services:
  db:
    restart: unless-stopped
    image: postgres:17
    environment:
      - POSTGRES_USER=miniflux
      - POSTGRES_PASSWORD=miniflux
      - POSTGRES_DB=miniflux
    volumes:
      - db:/var/lib/postgresql/data

  miniflux:
    restart: unless-stopped
    image: miniflux/miniflux:latest
    environment:
      - DATABASE_URL=postgres://miniflux:miniflux@db/miniflux?sslmode=disable
      - RUN_MIGRATIONS=1
      - CREATE_ADMIN=1
      - ADMIN_USERNAME=admin
      - ADMIN_PASSWORD=password
    ports:
      - "8080:8080"
    depends_on:
      - db

volumes:
  db:
```

> **ℹ️ Note:** Replace `ADMIN_USERNAME` and `ADMIN_PASSWORD` with secure credentials.

Run the following command to start a Miniflux instance locally

```bash
docker compose up -d
```

See the [Miniflux installation guide](https://miniflux.app/docs/docker.html) for
more details.

</details>

### 🔑 Generating an API Token

Tinyflux requires a Miniflux API token. You can generate one in your Miniflux
account settings:

![How to create an API token](assets/snapshots/minyflux-how-to-create-api-token.gif)

## 🚀 Getting Started

1. **Install the extension**:
   - [Firefox Add-on](https://addons.mozilla.org/es/firefox/addon/tinyflux)
   - [Chrome Web Store](https://chromewebstore.google.com/detail/tinyflux/ffhphofcfffnehjhcmmgnfolidhdfenl)

2. **Configure Tinyflux**:
   - Enter your Miniflux API endpoint and token.
   - Click **"Test Connection"** to verify your setup.
   - Save your configuration.

3. **Start Reading**:
   - Browse and read your feeds directly within the extension.

## 🛠️ Installing from Source

Ideal for developers or advanced users:

1. **Clone the Repository**:

   ```bash
   git clone https://github.com/jlsalvador/tinyflux.git
   cd tinyflux
   ```

2. **Install Dependencies**:

   ```bash
   npm ci
   ```

3. **Build the Project**:

   ```bash
   npm run build
   ```

4. **Load the extension in your browser**:
   - **Firefox**:
     1. Visit `about:debugging`.
     2. Click **"This Firefox"**.
     3. Select **"Load Temporary Add-on…"**.
     4. Choose the `dist/tinyflux.version.xpi` file.

   - **Chromium-based browsers (Chrome, Edge, etc.)**:
     1. Open `chrome://extensions`.
     2. Enable **Developer mode**.
     3. Click **"Load unpacked"**.
     4. Select the `dist/chromium` directory.

## 🤝 Contributing

Contributions are welcome! Open issues, submit pull requests, or suggest
features to help improve Tinyflux.

## 📄 License

This project is licensed under the [Apache 2.0 License](LICENSE).
