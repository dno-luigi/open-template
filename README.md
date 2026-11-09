# Open Template Library

Built with [Wron](https://wron.ai).

    npm install
    npm run dev      # http://localhost:5173
    npm run build    # static files in dist/, ready for any host

Every page is in `src/pages`, shared parts in `src/components`, and the design tokens
(colors, fonts, radius) in `site.json` and `tailwind.config.js`.

Forms, data and sign-in keep working through your site's Wron backend (the ids in
`index.html`). Deploy the `dist` folder with a rewrite of every path to `/index.html`
so links like /about load the app.
