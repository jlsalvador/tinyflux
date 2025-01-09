# TinyFlux - A Browser Extension for Miniflux

[![Download TinyFlux from Firefox Add-ons](assets/vendor/get-the-addon-178x60px.dad84b42.png)](https://addons.mozilla.org/es/firefox/addon/tinyflux)
[![Download TinyFlux from Chrome Web Store](assets/vendor/206x58-chrome-web-bcb82d15b2486.png)](https://chromewebstore.google.com/detail/tinyflux/ffhphofcfffnehjhcmmgnfolidhdfenl)

TinyFlux is a lightweight browser extension for Miniflux that lets you read your subscriptions seamlessly, with a clean and minimalistic interface.

![TinyFlux Screenshot](assets/snapshots/tinyflux.gif)

## Features

- **Intuitive Interface**: Simple and easy to navigate.
- **Unread Item Indicator**: The extension badge displays the count of unread items.
- **Cross-Browser Compatibility**: Works with Chrome, Firefox, Edge, and other modern browsers.
- **In-Browser Reading**: Read full articles without opening new tabs or windows.
- **Optional Sidebar Support**: Enhanced usability with a sidebar.
- **Bookmarking**: Save articles to read later.
- **Quick Actions**: Mark items as read with a single click.

## Requirements

To use TinyFlux, you need a Miniflux instance. You can either:

- Set up your own instance using the [official Miniflux Docker image](https://hub.docker.com/r/miniflux/miniflux). Follow the [installation guide](https://miniflux.app/docs/docker.html).
- Use a public instance, such as [Miniflux Cloud](https://reader.miniflux.app/).

### Launching a Local Miniflux Instance

Run the following commands to start a Miniflux instance locally:

```bash
# Start the PostgreSQL database
$ docker run -d \
    --restart=unless-stopped \
    --name miniflux-db \
    -e POSTGRES_USER=miniflux \
    -e POSTGRES_PASSWORD=miniflux \
    -e POSTGRES_DB=miniflux \
    -v miniflux-db:/var/lib/postgresql/data \
    postgres

# Start the Miniflux service
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

**Note**: Replace the `ADMIN_USERNAME` and `ADMIN_PASSWORD` with secure values.

### Generating an API Token

To use TinyFlux, you'll need a Miniflux API token. Follow the instructions below to generate one:

![How to create an API token](assets/snapshots/minyflux-how-to-create-api-token.gif)

## Getting Started

1. **Install the extension**:

   - [Tinyflux for Firefox](https://addons.mozilla.org/es/firefox/addon/tinyflux)
   - [Tinyflux for Chrome](https://chromewebstore.google.com/detail/tinyflux/ffhphofcfffnehjhcmmgnfolidhdfenl)

2. **Configure TinyFlux**:

   - Enter your Miniflux API endpoint URL and token when prompted. Remember to save your changes. To can test your configuration clicking the button "Test Connection".

3. **Start Reading**:
   - Access your feeds and enjoy reading directly from TinyFlux.

## Installation from Source

For developers or advanced users, you can build and install TinyFlux from source:

1. Clone this repository:

   ```bash
   git clone https://github.com/jlsalvador/tinyflux.git
   cd tinyflux
   ```

2. Install dependencies:

   ```bash
   npm ci
   ```

3. Build the project:

   ```bash
   npm run build
   ```

4. Install the browser extension:
   - **Firefox**:
     1. Navigate to `about:debugging`.
     2. Select "This Firefox".
     3. Click "Load Temporary Add-on...".
     4. Choose the `dist/tinyflux.version.xpi` file.
   - **Chromium-Based Browsers**:
     1. Go to `chrome://extensions`.
     2. Enable "Developer mode".
     3. Click "Load unpacked".
     4. Select the `dist/chromium` directory.

## Contributing

Contributions are welcome! Feel free to open issues, submit pull requests, or suggest new features to improve TinyFlux.

## License

This project is licensed under the [Apache 2.0 License](LICENSE).
