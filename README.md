# Tinyflux – A browser extension for Miniflux

[![Download Tinyflux from Firefox Add-ons](assets/vendor/get-the-addon-178x60px.dad84b42.png)](https://addons.mozilla.org/es/firefox/addon/tinyflux)
[![Download Tinyflux from Chrome Web Store](assets/vendor/206x58-chrome-web-bcb82d15b2486.png)](https://chromewebstore.google.com/detail/tinyflux/ffhphofcfffnehjhcmmgnfolidhdfenl)

Tinyflux is a lightweight browser extension for [Miniflux](https://miniflux.app/), offering a clean reading experience directly in your browser.

![Tinyflux Screenshot](assets/snapshots/tinyflux.gif)

## ✨ Features

- **Intuitive Interface:** Simple and easy to navigate.
- **Unread Count Badge:** View unread items directly from the extension icon.
- **Cross-Browser Support:** Compatible with Chrome, Firefox, Edge, and other modern browsers.
- **In-Browser Reading:** Read full articles without opening new tabs or windows.
- **Sidebar Integration (Optional):** Access your feeds in a dedicated sidebar for better multitasking.
- **Multi-Language Support:** Currently available in English and Spanish.
- **Dark and Light Modes:** Toggle between themes based on your preference.
- **Bookmarks:** Save articles to read later.
- **Quick Actions:** Mark items as read with one click.

## 🧩 Requirements

To use Tinyflux, you need a Miniflux instance. You can either:

- **Self-host** using the [official Miniflux Docker image](https://hub.docker.com/r/miniflux/miniflux). See the [installation guide](https://miniflux.app/docs/docker.html).
- **Use a public instance**, like [Miniflux Cloud](https://reader.miniflux.app/).

### 🚀 Running a Local Miniflux Instance (with Docker)

Run the following commands to start a Miniflux instance locally:

```bash
# Start PostgreSQL
$ docker run -d \
    --restart=unless-stopped \
    --name miniflux-db \
    -e POSTGRES_USER=miniflux \
    -e POSTGRES_PASSWORD=miniflux \
    -e POSTGRES_DB=miniflux \
    -v miniflux-db:/var/lib/postgresql/data \
    postgres

# Start Miniflux
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

> **Note:** Replace `ADMIN_USERNAME` and `ADMIN_PASSWORD` with secure credentials.

### 🔑 Generating an API Token

Tinyflux requires a Miniflux API token. You can generate one in your Miniflux account settings:

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

Contributions are welcome! Open issues, submit pull requests, or suggest features to help improve Tinyflux.

## 📄 License

This project is licensed under the [Apache 2.0 License](LICENSE).
